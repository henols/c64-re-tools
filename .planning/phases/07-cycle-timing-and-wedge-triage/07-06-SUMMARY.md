---
phase: 07-cycle-timing-and-wedge-triage
plan: 06
subsystem: stock-vice-backend
tags: [wedge-triage, binary-monitor, checkpoint-trap, liveness-bracket, monitor-ownership, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-05's readCycleBaseline()/resolveVideoStandard() (stock-timing.ts) -- the shared dual-route cycle-baseline primitive this plan's liveness bracket reuses verbatim"
provides:
  - "handleDiagnoseStock -- vice_diagnose's full stock implementation: five verdicts (restarted, checkpoint_trap, wedged, monitor_held_elsewhere, live), bounded session acquisition, and a never-throw answer shape"
  - "resolveStockLiveIrqHandler()/gatherStockCheckpointTrapEvidence() -- the fork's live-tested checkpoint-trap algorithm ported onto stock's own MEM_GET/REGISTERS_GET/CHECKPOINT_LIST primitives, exported for plan 07-07's stock recycle evidence gatherer"
  - "runStockLivenessBracket() -- the snapshot-resume-wait-halt-compare bracket (exactly one resume, two halting reads, zero traffic during the wait), exported for plan 07-07"
affects: [07-07, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A needsSession:false derived tool that nonetheless reaches the wire, by calling ensureStockSession(deps) itself inside its own try/catch -- the one declared exception to DerivedPureHandler's contract, needed because withDerivedTool's own preamble would convert a thrown MonitorOwnershipError into refusal text before this handler's own five-verdict return value could exist"
    - "Env-var-driven timeouts read fresh on every call (diagnoseSessionTimeoutMs()/diagnoseBracketWindowMs()) rather than cached as a module-level constant like vice-proxy.ts's CAPTURE_STEP_TIMEOUT_MS -- needed so one test process can drive many distinct timeout/window values without a dynamic re-import per case"
    - "A bigint (CycleBaseline's cpu_history route `cycle` field) must never reach JSON.stringify() inside stockAnswer()/derivedAnswer() -- serializeCycleBaseline()/serializeBracket() are the one conversion point"
    - "An answer that could not establish any of the five verdicts (bounded-acquisition timeout, a liveness bracket whose route is 'unavailable') is a plain isError:true refusal, never a sixth verdict and never one of the five reported without evidence"

key-files:
  created:
    - .claude/mcp/vice/stock-diagnose.ts
    - .claude/mcp/vice/stock-diagnose.test.ts
  modified: []

key-decisions:
  - "handleDiagnoseStock is registered (07-09) with withDerivedTool(\"vice_diagnose\", { needsSession: false }, ...) but acquires its own session via ensureStockSession(deps) inside its own try/catch -- the declared exception to stock-derived.ts's DerivedPureHandler doc comment, amended in 07-09 not here"
  - "When a session was actually obtained, every verdict answer goes through stockAnswer(session.client, payload) (a real client exists, so a real runState is knowable); when acquisition itself failed or timed out (monitor_held_elsewhere, restarted from a thrown MachineRestartedError, the bounded-acquisition timeout), the answer goes through derivedAnswer() instead, whose honest runState:\"unknown\" is correct since no client was ever created"
  - "The liveness bracket's 'unavailable' route (or a route change mid-bracket) answers isError:true 'inconclusive' text, never a wedged verdict -- a bracket that cannot measure at all must not be mistaken for one that measured zero advance"
  - "diagnoseSessionTimeoutMs()/diagnoseBracketWindowMs() are functions reading process.env fresh on every call, not module-level constants, so stock-diagnose.test.ts can drive small values across many test cases within one process"

requirements-completed: [TIME-04]

# Metrics
duration: ~30min
completed: 2026-08-18
---

# Phase 07 Plan 06: vice_diagnose (stock) -- five-verdict wedge triage Summary

**`vice_diagnose`'s stock implementation: the fork's live-tested checkpoint-trap algorithm ported onto stock's own wire primitives, a snapshot-resume-wait-halt-compare liveness bracket in place of the fork's ping-poll (which stock cannot do), bounded session acquisition, and a fifth verdict (`monitor_held_elsewhere`) from the broker's own single-client enforcement.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-18
- **Tasks:** 3 completed
- **Files modified:** 2 (both newly created)

## Accomplishments
- `resolveStockLiveIrqHandler()` -- the fork's `resolveLiveIrqHandler()` ported verbatim in logic: three `session.client.send(CommandType.MemoryGet, ...)` reads ($01, the RAM vector pair, and the hardware vector pair only when HIRAM is clear), never reaching `vice-proxy.ts`/`rewriteArguments()`/`forwardToVice()`
- `gatherStockCheckpointTrapEvidence()` -- enumerates checkpoints via `handleCheckpointList()`, reads PC via `handleRegistersGet()`, resolves the live IRQ handler, and matches the fork's two named trap shapes (an armed stopping exec checkpoint at the current PC, or one at the resolved handler entry with `hitCount === 0`) against stock's own field spellings (`id`/`hitCount`/`operation.flags`, never the fork's `checkpoint_num`/`hit_count`) -- makes NO resume and NO stopwatch call, and continues rather than aborting when `vice_checkpoint_list` itself refuses
- `runStockLivenessBracket()` -- exactly one `readCycleBaseline()` (halting read), one `CommandType.Exit` (resume), one real wall-clock wait with zero socket traffic, one more `readCycleBaseline()`; a bracket-silence test proves every send after the resume lands only once the full wait window has elapsed
- `STOCK_DIAGNOSE_VERDICTS` -- the frozen five-verdict vocabulary (`restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`); `stale_read_path` is deliberately absent since every stock read pauses uniformly, unreachable by construction
- `handleDiagnoseStock()` -- bounded session acquisition (races `ensureStockSession()` against a configurable deadline, default 10000ms), fixed cheap-to-expensive check order (epoch comparison at zero emulator cost, checkpoint-trap evidence with no resume, then the liveness bracket(s)), never throws, and never invents a sixth verdict or reports one of the five unestablished
- 25 unit tests: banked-in/banked-out IRQ resolution (2 vs 3 `MemoryGet` sends), both trap shapes plus the hitCount:1 non-trapping sibling, the disabled/trace-mode/load-only filter, bracket advance/no-advance/silence, all three no-session verdict paths (`monitor_held_elsewhere`, thrown-`restarted`, epoch-`restarted`), the full `wedged`/`live` flows with exact `Exit` send counts, the bounded-acquisition timeout (well under 250ms), never-throws, and structural greps (zero `vice-proxy`/`rewriteArguments`/`forwardToVice`/bare `call(` references; `stale_read_path` only inside its explanatory comment) -- 25/25 pass in well under 15 seconds, no real socket or emulator

## Task Commits

Each task was committed atomically:

1. **Task 1: Port resolveLiveIrqHandler() and gatherCheckpointTrapEvidence() onto stock primitives** - `174f1a0` (feat)
2. **Task 2: The stock liveness bracket and the five-verdict handleDiagnoseStock** - `5fad7f0` (feat)
3. **Task 3: stock-diagnose.test.ts** - `4c3f493` (test)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-diagnose.ts` - `resolveStockLiveIrqHandler`, `gatherStockCheckpointTrapEvidence`, `renderStockCheckpointTrapReport`, `runStockLivenessBracket`, `STOCK_DIAGNOSE_VERDICTS`, `diagnoseSessionTimeoutMs`/`diagnoseBracketWindowMs`, and `handleDiagnoseStock` -- the full stock `vice_diagnose` implementation. Registration into `STOCK_DISPATCH_TABLE`/`tools-manifest.stock.json` is explicitly deferred to plan 07-09 per this plan's own objective.
- `.claude/mcp/vice/stock-diagnose.test.ts` - 25 tests covering both IRQ-handler branches, both checkpoint-trap shapes plus the non-trapping sibling and filter cases, the liveness bracket's route selection/silence, all five verdicts through `handleDiagnoseStock`, the bounded-acquisition timeout, never-throws, and structural source-grep checks

## Decisions Made
- `handleDiagnoseStock` self-acquires its session (bypassing `withDerivedTool`'s preamble) so a `MonitorOwnershipError`/`MachineRestartedError` thrown during acquisition becomes a genuine verdict rather than generic refusal text -- documented as the one declared exception to `DerivedPureHandler`'s "structurally cannot reach the wire" contract, with the doc-comment amendment itself deferred to 07-09 (the registration plan) per this plan's own instruction
- Answers use `stockAnswer(session.client, ...)` when a session exists and `derivedAnswer(...)` (honest `runState:"unknown"`) when it does not -- reconciling the plan's "every answer goes through stockAnswer" instruction with the fact that `monitor_held_elsewhere` and thrown-`restarted` are reached before any client is ever created
- The liveness bracket's `"unavailable"` route (or a route change mid-bracket, e.g. a reconnect) is reported as an `isError:true` "inconclusive" refusal rather than folded into `wedged` -- a bracket that cannot measure at all must never be mistaken for one that measured zero advance
- `diagnoseSessionTimeoutMs()`/`diagnoseBracketWindowMs()` are functions that read their environment-variable overrides fresh on every call, not module-level constants computed once at import time (unlike `vice-proxy.ts`'s `CAPTURE_STEP_TIMEOUT_MS`) -- ESM static-import hoisting means a test file cannot set `process.env` before a module-load-time constant is computed without a dynamic re-import per test case, and this file's own test drives several distinct timeout/window values within one process

## Deviations from Plan

None -- plan executed exactly as written. All three tasks' acceptance-criteria greps pass, all `<verify>` blocks pass, and the plan-level `<verification>` block passes (see below), with one unrelated pre-existing failure noted under Issues Encountered.

All verification passed:
- `npx tsc --noEmit -p tsconfig.json` exits 0
- `node --test stock-diagnose.test.ts` -- 25/25 pass in well under 15 seconds
- Comment-filtered `stock-diagnose.ts` references none of `vice-proxy`, `forwardToVice`, `rewriteArguments`, bare `call(`
- `STOCK_DIAGNOSE_VERDICTS` has exactly five members (`restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`) and excludes `stale_read_path`
- `grep -c "0x02"` on `stock-diagnose.ts` returns 1, with `HIRAM_MASK` a named constant, never an inline literal at the comparison site
- `runStockLivenessBracket()` issues exactly 1 `CommandType.Exit` send per bracket, and the total send count during the wait window is 0

## Issues Encountered

`npm run test:automated` (part of the plan's `<verification>` block) reports 1 failure out of 1504 tests (1335 top-level, several nested): `repo-root.test.ts`'s "path agreement" test, the same pre-existing worktree artifact already documented as deferred in 07-01/07-02/07-05's summaries and `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` -- not caused by this plan's new `stock-diagnose.ts`/`stock-diagnose.test.ts` files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`resolveStockLiveIrqHandler()`, `gatherStockCheckpointTrapEvidence()`, and `runStockLivenessBracket()` are exported and ready for plan 07-07's stock recycle evidence gatherer to reuse verbatim. `handleDiagnoseStock` is fully implemented and unit-tested but not yet wired into `STOCK_DISPATCH_TABLE`/`tools-manifest.stock.json`; that registration -- along with amending `stock-derived.ts`'s `DerivedPureHandler` doc comment for this handler's declared exception -- is explicitly plan 07-09's job, matching this plan's own stated output boundary. No blockers for 07-07 or 07-09.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-diagnose.ts
- FOUND: .claude/mcp/vice/stock-diagnose.test.ts
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-06-SUMMARY.md
- FOUND: 174f1a0 (feat: port resolveStockLiveIrqHandler/gatherStockCheckpointTrapEvidence to stock)
- FOUND: 5fad7f0 (feat: add stock liveness bracket and five-verdict handleDiagnoseStock)
- FOUND: 4c3f493 (test: stock-diagnose.test.ts covering all five verdicts)
