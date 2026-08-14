---
phase: 03-direct-tools
plan: 08
subsystem: api
tags: [typescript, binary-monitor, vice, mcp, checkpoints, watchpoints, condition-ast, rate-limiting]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-01: stock-handler.ts (StockSessionHandler/stockAnswer/convertWireError), stock-address.ts (parseAddress/parseByteCount), stock-runstate.ts idiom; 03-02: stock-protocol.ts's checkpointSetBody/checkpointToggleBody/cpNumBody/conditionSetBody encoders and CheckpointOperation; 03-03: stock-condition.ts's typed AST, emitCondition(), parseConditionString(), conditionFromJson()"
provides:
  - "stock-checkpoints.ts -- handleCheckpointAdd/Delete/List/Toggle/SetCondition and handleWatchAdd as StockSessionHandlers, fork-compatible argument names"
  - "The D-10 client-side condition registry (targetId-keyed), immutable-once-set enforcement, and setConditionFailClosed() -- the one call site for conditionSetBody(), deleting the checkpoint it was conditioning on any CONDITION_SET failure"
  - "The D-11 trace guard: per-client WeakMap<ViceMonitorClient, TraceGuardState>, a 1-second/20-hit rate limit per checkpoint, and a CHECKPOINT_TOGGLE auto-disable deferred out of the event-listener's call stack via setImmediate()"
affects: [03-12, 03-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Task-ordered incremental commits within one file: Task 1 ships a functioning skeleton for the D-10/D-11 plumbing its own handlers call into (plain registry read/write/delete; a Set-based trace-checkpoint registration with an always-empty auto-disable report), which Task 2 and Task 3 each replace piece by piece with the real implementation -- every intermediate commit independently typechecks and its own test subset passes"
    - "Deferred send out of an event-listener's call stack via setImmediate(), with the window clock injected as a parameter (default Date.now, never called inline) so timing tests need no real timers"
    - "A single namespace import (`import * as StockConditionEncoder from \"./stock-protocol.ts\"`) used for exactly one encoder (conditionSetBody), keeping the literal call site to conditionSetBody() at exactly one occurrence in the module's non-comment lines, distinct from every other encoder's ordinary named import"

key-files:
  created:
    - .claude/mcp/vice/stock-checkpoints.ts
    - .claude/mcp/vice/stock-checkpoints.test.ts
  modified: []

key-decisions:
  - "D-10 registry keyed on session.targetId, not on the session object -- a stockReconnect() builds a fresh session but MachineRestartedError already guarantees it is the same machine, and the emulator's checkpoints/conditions survive the reconnect on the wire side"
  - "D-11's rate-limit/auto-disable uses setImmediate() deferral (per RESEARCH.md Focus Item 5's two offered designs), not a next-dispatch check, because the CHECKPOINT_INFO flood is synchronous and blocking the emulator thread -- promptness is the point"
  - "checkpoint_list reports both a session-wide autoDisables[] array (from autoDisableReportFor()) and a per-entry autoDisabled field, matching the plan's explicit instruction to surface both shapes"
  - "vice_checkpoint_add and vice_watch_add gained no inline condition argument (D-12) except watch_add's own fork-schema condition, which is atomic there by the fork's own schema and stays that way on stock"

patterns-established:
  - "Rate-limited event-listener pattern: pure synchronous arithmetic in the listener (window rolling, threshold check, in-flight guard), all I/O deferred to a setImmediate callback that swallows its own failures into recorded state rather than throwing"

requirements-completed: [DIRECT-03]

# Metrics
duration: ~50min
completed: 2026-08-14
---

# Phase 3 Plan 8: Checkpoints, Conditions and the D-11 Trace Guard Summary

**Checkpoint/watchpoint handler family for stock VICE (add/delete/list/toggle/set-condition/watch-add) plus the two hazard guards CONTEXT.md pulled into this phase: a targetId-keyed condition registry with fail-closed CHECKPOINT_DELETE cleanup on a failed CONDITION_SET, and a per-checkpoint 20-hits/second rate limiter that auto-disables a `stop:false` trace checkpoint via a CHECKPOINT_TOGGLE deferred out of the event-listener's call stack.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `handleCheckpointAdd`/`handleCheckpointDelete`/`handleCheckpointList`/`handleCheckpointToggle`: fork-compatible argument names (`start`/`end`/`stop`/`load`/`store`/`exec`, `checkpoint_num`, `enabled`), the op bitmask composed from the three booleans and defaulting to `Exec` alone (reported via `operation.defaulted`), `stop:false` refused without `acknowledgeTraceRisk:true` naming the synchronous-CHECKPOINT_INFO hazard concretely, `checkpoint_list` cross-checking `related[]` count against the terminal reply's `total` (`totalReported`/`entriesReceived`)
- `handleCheckpointSetCondition`/`handleWatchAdd`: D-09's string-or-object condition discrimination (`nodeFromConditionArg`), condition immutability once set (a second `set_condition` refuses naming the first condition's text), `setConditionFailClosed()` as the ONE call site for `conditionSetBody()` -- a failed `CONDITION_SET` always issues `CHECKPOINT_DELETE` for the checkpoint it was conditioning, reporting both failures when the delete also fails
- The D-11 trace guard: `registerTraceCheckpoint()` attaches one idempotent `'event'` listener per client (`WeakMap<ViceMonitorClient, TraceGuardState>`), a 1-second rolling window per checkpoint id, `TRACE_HITS_PER_SECOND_LIMIT` (20) triggers exactly one `CHECKPOINT_TOGGLE` deferred via `setImmediate()` -- a test proves zero sends immediately after the threshold-crossing `emit()` and exactly one after the tick, and 40 events still produce only one toggle (the `disableScheduled` in-flight guard)
- No `vice_checkpoint_set_ignore_count` (D-15) and no inline `condition` argument on `vice_checkpoint_add` (D-12)

## Task Commits

Each task was committed atomically:

1. **Task 1: Checkpoint add, delete, list and toggle** - `e40bad5` (feat)
2. **Task 2: Conditions -- the D-10 registry, fail-closed cleanup, and watchpoints** - `85905e5` (feat)
3. **Task 3: The D-11 trace guard -- rate limit and deferred auto-disable** - `99e280d` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: all three tasks touch the same two files (a single continuous handler-family module, per the plan's own design -- Task 1's handlers already call into Task 2's/Task 3's exported functions). Each task was committed by shipping a functioning skeleton for the not-yet-built pieces in Task 1 (a plain registry, a Set-based trace-checkpoint list with an always-empty auto-disable report), then replacing each skeleton piece by piece in Tasks 2 and 3 -- every commit independently typechecks (`npm run typecheck`) and its own test subset passes (`node --test stock-checkpoints.test.ts`), matching the precedent set by plan 03-02's own summary for this exact same-file, multi-task situation._

## Files Created/Modified

- `.claude/mcp/vice/stock-checkpoints.ts` (729 lines) - `handleCheckpointAdd`, `handleCheckpointDelete`, `handleCheckpointList`, `handleCheckpointToggle`, `handleCheckpointSetCondition`, `handleWatchAdd` (all `StockSessionHandler`s); `conditionTextFor`/`resetCheckpointStateForTest` (exported); `registerTraceCheckpoint`/`autoDisableReportFor`/`TRACE_HITS_PER_SECOND_LIMIT` (exported, D-11); `setConditionFailClosed` (private, D-10 fail-closed helper)
- `.claude/mcp/vice/stock-checkpoints.test.ts` (562 lines, 31 tests) - DI-stubbed `ViceMonitorClient` (a real `EventEmitter` plus a spy `send()`), golden byte-offset assertions for every encoder call, the D-10 immutability/fail-closed/both-failures cases, and the D-11 rate-limit/deferred-toggle/rolling-window/auto-disable-report cases (including an injected clock, never a real timer)

## Decisions Made

- Kept `emitCondition()`'s output as the only source of `conditionSetBody()`'s `expression` argument -- never a raw caller string, per D-09/D-10 and this file's own header comment.
- `setConditionFailClosed()` is called from both `handleCheckpointSetCondition` and `handleWatchAdd`, the shared cleanup point for the "armed but not yet conditioned" window D-10 exists to close.
- `checkpoint_num`/`address`/`condition` argument validation each throw a plain `Error` or the imported `StockConditionError`/`StockAddressError` types (never a bespoke third error class) -- a `StockConditionError` is returned to the caller verbatim, never re-worded, per D-09's explicit instruction.
- Used a single-purpose namespace import for `conditionSetBody()` alone (`import * as StockConditionEncoder from "./stock-protocol.ts"`) so the plan's literal grep gate ("exactly one call site for `conditionSetBody`") passes mechanically rather than only in prose -- every other encoder (`checkpointSetBody`, `checkpointToggleBody`, `cpNumBody`) keeps the ordinary named-import style, since only `conditionSetBody` carries this specific acceptance criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned this worktree's `.claude/mcp/vice/node_modules`**
- **Found during:** Task 1, first `npm run typecheck` attempt
- **Issue:** This parallel-executor worktree started with no `node_modules/` installed at all (`tsc: not found`), an environment gap unrelated to this plan's own files -- already documented as a recurring, expected artifact of the worktree-per-executor model in `.planning/phases/03-direct-tools/deferred-items.md` (item 2, logged by 03-01).
- **Fix:** Copied the main checkout's already-`npm ci`'d `node_modules/` into this worktree (byte-identical, committed `package-lock.json`; no registry fetch, no new/unverified package) -- exactly the sanctioned environment fix the `<environment_note>` in this plan's own execution context names.
- **Files modified:** none tracked (`node_modules/` is gitignored)
- **Verification:** `npm run typecheck` and `node --test stock-checkpoints.test.ts` both ran cleanly afterward.
- **Committed in:** not committed (gitignored, environment-only)

---

**Total deviations:** 1 auto-fixed (1 blocking/environment, not a code change)
**Impact on plan:** None on the shipped module. Purely an environment-provisioning step already anticipated by this plan's own execution context and by a prior plan's deferred-items entry.

## Issues Encountered

- **Pre-existing, unrelated test failure (not caused by this plan):** `repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails in this worktree for the same reason documented by every prior Phase 3 plan (03-01 through 03-05) in `.planning/phases/03-direct-tools/deferred-items.md` -- the worktree checkout path itself sits under a `.claude/` segment. `npm run test:automated` reports 721 pass / 1 fail / 5 todo, with the 1 failure being this already-logged, pre-existing artifact; all 31 tests in `stock-checkpoints.test.ts` pass, and `npm run typecheck` exits 0. Not re-logged per this project's own instruction (already documented).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `stock-checkpoints.ts` exports all six `StockSessionHandler`s this plan promised; plans 03-12 (dispatch-table wiring) and 03-13 (manifest entries) can wire `vice_checkpoint_add`/`delete`/`list`/`toggle`/`set_condition` and `vice_watch_add` directly against these exports -- no dispatch or manifest edits were made here, matching this plan's own stated scope.
- `conditionTextFor()`/`resetCheckpointStateForTest()`/`registerTraceCheckpoint()`/`autoDisableReportFor()`/`TRACE_HITS_PER_SECOND_LIMIT` are all exported and ready for any later plan (or a future dispatch-seam test) that needs to introspect trace-guard/condition-registry state directly.
- No blockers for downstream Phase 3 plans. This plan's diff touches only `stock-checkpoints.ts` and `stock-checkpoints.test.ts`, as required.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-checkpoints.ts`
- FOUND: `.claude/mcp/vice/stock-checkpoints.test.ts`
- FOUND: `.planning/phases/03-direct-tools/03-08-SUMMARY.md`
- FOUND commit: `e40bad5` (Task 1)
- FOUND commit: `85905e5` (Task 2)
- FOUND commit: `99e280d` (Task 3)
