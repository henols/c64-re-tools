---
phase: 07-cycle-timing-and-wedge-triage
plan: 08
subsystem: stock-vice-backend
tags: [dispatch-table, manifest, conformance, timing, wedge-triage, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-03's handleRunUntil (stock-run-until.ts) and 07-05's handleCyclesStopwatch (stock-timing.ts) -- both fully implemented and unit-tested but unregistered until this plan"
provides:
  - "vice_cycles_stopwatch and vice_run_until wired into STOCK_DISPATCH_TABLE via withDerivedTool, and declared in STOCK_DERIVED_TOOLS"
  - "tools-manifest.stock.json taken from 34 to 36 tools, with fork-compatible inputSchemas plus the stock-only optional timeout_ms extra"
  - "Two D-02 conformance cases dispatched through the real dispatchStock() path, validating each answer against its own declared outputSchema"
affects: [07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The manifest-completeness/derived-tool-registry guard chain (stock-dispatch.test.ts's REGISTERED_TOOL_NAMES/CONFORMANCE_TOOL_NAMES, hostpath-consumers.test.ts's DERIVED_TOOL_MODULES, stock-derived.test.ts's STOCK_DERIVED_TOOLS count) all move together as one unit whenever a derived tool is registered -- missing any one of the four fails a named assertion rather than passing vacuously"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-derived.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
    - .claude/mcp/vice/stock-derived.test.ts

key-decisions:
  - "This plan's own objective corrects 07-RESEARCH.md's stated 34 -> 37 manifest delta to 34 -> 36: vice_diagnose and vice_recycle are proxy-local synthetic tools with no manifest entry on either backend today, so this plan registers only the two Phase 7 timing tools; plan 07-09 takes the manifest 36 -> 38 when it registers those two."
  - "vice_cycles_stopwatch's outputSchema deliberately omits 'cycles' from required -- schema-level enforcement of TIME-03 (an unmeasurable bracket answers measurable:false with a reason and no cycles key, never a fabricated zero)."
  - "The vice_run_until conformance case dispatches with an explicit small timeout_ms (25ms) against a harness that never synthesises a checkpoint_info event, deliberately exercising the TIMEOUT answer shape (the shape a caller sees on an unreachable address) rather than the hit path -- this keeps the case well under a second instead of waiting on the 30000ms production default."

requirements-completed: [TIME-01, TIME-02, TIME-03]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 07 Plan 08: Register vice_cycles_stopwatch and vice_run_until on stock Summary

**Wired both Phase 7 timing handlers into the stock dispatch table, manifest (34 -> 36), and conformance suite -- and fixed three out-of-plan test files whose derived-tool-registry guards the new registrations tripped.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-18T08:03:25Z
- **Tasks:** 3/3 completed
- **Files modified:** 7 (4 in plan scope, 3 Rule 3 fixes)

## Accomplishments
- `vice_cycles_stopwatch` (TIME-01/TIME-03) and `vice_run_until` (TIME-02) are now reachable: both registered in `STOCK_DISPATCH_TABLE` via `withDerivedTool(..., { needsSession: true }, ...)`, and declared in `STOCK_DERIVED_TOOLS` -- previously `dispatchStock()` refused both by name.
- Both modules (`stock-timing.ts`, `stock-run-until.ts`) added to `package.json`'s `files[]` in the same commit as their registration, so the published tarball actually ships them (`scripts/check-npm-packages.mjs` passes, 55 files in `@henols/vice-mcp`).
- `tools-manifest.stock.json` taken from 34 to 36 tools: `vice_cycles_stopwatch`'s `inputSchema` matches the fork's exactly (`action` enum `reset`/`read`/`reset_and_read`, required); its `outputSchema` makes `cycles` optional (TIME-03) and declares the `route` enum (`cpu_history`/`frame_position`/`unavailable`). `vice_run_until`'s `inputSchema` matches the fork's `address`/`cycles` shape plus the stock-only optional `timeout_ms` (never required, satisfying D-02); its `outputSchema` covers both the hit and timeout answer shapes.
- Two conformance cases added to `stock-dispatch.test.ts`, each dispatching through the real `dispatchStock()` path (never the handler directly) and validating the actual answer against its own declared `outputSchema`: `vice_cycles_stopwatch` exercises Route B (frame-position reconstruction, since the conformance harness's session always declares `capabilities.cpuHistory: "absent"`) with `action: "reset"`; `vice_run_until` exercises the timeout answer shape with an explicit `timeout_ms: 25` (well under one second, never waiting on the 30000ms default).
- Corrected `vice_joystick_tap`'s stale `TRIMMED_TOOL_DECISIONS` reason string (previously "needs a resume plus Phase 7's timing route", which stopped being true once this phase shipped its timing route) to the actual disposition: cut from scope, no skill calls it and no requirement names it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dispatch table, STOCK_DERIVED_TOOLS and package files[]** - `5e54822` (feat)
2. **Task 2: Manifest entries (34 -> 36) and the registered-name guards** - `8500ab6` (feat)
3. **Task 3: Two conformance cases (+ Rule 3 fixes for three other guard files)** - `b9824df` (test)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-dispatch.ts` - imports `handleCyclesStopwatch`/`handleRunUntil`; two new `STOCK_DISPATCH_TABLE` entries under `// derived (TIME-01)` / `// derived (TIME-02)` comments
- `.claude/mcp/vice/stock-derived.ts` - `vice_cycles_stopwatch`/`vice_run_until` added to `STOCK_DERIVED_TOOLS`
- `.claude/mcp/vice/package.json` - `files[]` gains `stock-timing.ts` and `stock-run-until.ts`
- `.claude/mcp/vice/tools-manifest.stock.json` - two new tool entries (34 -> 36), each with `inputSchema` and `outputSchema`
- `.claude/mcp/vice/stock-dispatch.test.ts` - `REGISTERED_TOOL_NAMES` (34 -> 36 names, both count assertions updated), two new `conformanceTest()` cases, corrected `vice_joystick_tap` reason string in `TRIMMED_TOOL_DECISIONS`
- `.claude/mcp/vice/hostpath-consumers.test.ts` (Rule 3) - `DERIVED_TOOL_MODULES` gains both new tools' module mappings, so D-05-12's key-set-equality and hostpath-non-import guards cover them
- `.claude/mcp/vice/stock-derived.test.ts` (Rule 3) - `STOCK_DERIVED_TOOLS` count assertion updated 9 -> 11, with explicit `.has()` checks for both new names

## Decisions Made
- Followed the plan's own correction verbatim: the manifest delta is 34 -> 36 in this plan, not 34 -> 37 as `07-RESEARCH.md` originally stated -- `vice_diagnose`/`vice_recycle` have no manifest entry on either backend and are explicitly plan 07-09's job.
- Chose Route B (frame-position) rather than Route A (CPUHISTORY_GET) for the `vice_cycles_stopwatch` conformance case, since `buildConformanceSession()`'s fixed shape always declares `capabilities.cpuHistory: "absent"` -- documented in a comment at the case site so a future reader does not mistake this for an oversight.
- Left `cleanupError` (a possible key on `vice_run_until`'s timeout-with-delete-failure path) out of the `outputSchema`'s declared properties, matching the plan's own listed optional-key set exactly; `checkAgainstSchema()` only rejects undeclared keys when `additionalProperties: false` is set, which no other stock manifest entry uses either, so this is consistent with the established convention rather than a gap.

## Deviations from Plan

### Auto-fixed Issues (Rule 3 -- blocking test fixes)

**1. [Rule 3] `hostpath-consumers.test.ts`'s D-05-12 guard failed on the two new derived-tool registrations**
- **Found during:** Task 3, running `npm run test:automated`
- **Issue:** `DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly` failed the moment `vice_cycles_stopwatch`/`vice_run_until` joined `STOCK_DERIVED_TOOLS` (Task 1) without a corresponding entry in this sibling test file's own declared module map -- this guard exists precisely to catch a derived tool with no traceable implementing module, and blocks completion of this plan's own verification block if left unfixed.
- **Fix:** Added `vice_cycles_stopwatch: "stock-timing.ts"` and `vice_run_until: "stock-run-until.ts"` to `DERIVED_TOOL_MODULES`.
- **Files modified:** `.claude/mcp/vice/hostpath-consumers.test.ts`
- **Commit:** `b9824df`

**2. [Rule 3] `stock-derived.test.ts`'s hardcoded entry count went stale**
- **Found during:** Task 3, same `npm run test:automated` run
- **Issue:** `STOCK_DERIVED_TOOLS: exactly nine entries` asserted `.size === 9` and enumerated only the pre-Phase-7 nine names by hand -- this became false the instant Task 1 added two names to the set.
- **Fix:** Updated the assertion to 11, renamed the test description, and added explicit `.has()` checks for both new tool names (matching the file's own per-name assertion convention rather than only bumping the count).
- **Files modified:** `.claude/mcp/vice/stock-derived.test.ts`
- **Commit:** `b9824df`

Both fixes are direct, mechanical consequences of this plan's own Task 1 registration (the same STOCK_DERIVED_TOOLS set both sibling test files independently assert against) -- not unrelated pre-existing issues, and squarely in scope per the standing scope-boundary rule.

## Issues Encountered

`npm run test:automated` reports 1 pre-existing failure unrelated to this plan: `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test, the same known worktree-path artifact already documented in `07-01`'s, `07-02`'s, `07-03`'s and `07-05`'s summaries and in `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` -- not caused by any file this plan touches. All 1481 other tests pass (1473 pass + 5 pre-existing `todo` + 3 fixed by this plan's Rule 3 corrections above), and `node --test stock-dispatch.test.ts` alone passes 116/116.

`npm ci --no-audit --no-fund` was run once in `.claude/mcp/vice` at the start of this session -- this isolated worktree had no `node_modules/` yet (the `SessionStart` hook that provisions them had not run here), matching the same environment-setup step noted in `07-03`'s and `07-05`'s summaries. Not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both `vice_cycles_stopwatch` and `vice_run_until` are fully dispatchable, advertised, and conformance-validated on the stock backend. Plan 07-09 can now register `vice_diagnose`/`vice_recycle` (manifest 36 -> 38) against a clean, fully-green baseline -- `REGISTERED_TOOL_NAMES`, `CONFORMANCE_TOOL_NAMES`, `DERIVED_TOOL_MODULES` and `STOCK_DERIVED_TOOLS`'s count are all consistent at 36/36/11 respectively as of this plan's completion. No blockers. The one pre-existing, out-of-scope worktree path-agreement test failure noted above requires no action from this plan or the next.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
