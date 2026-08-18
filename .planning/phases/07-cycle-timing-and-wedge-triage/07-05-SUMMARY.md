---
phase: 07-cycle-timing-and-wedge-triage
plan: 05
subsystem: stock-vice-backend
tags: [binary-monitor, cpuhistory, resource-get, cycle-stopwatch, video-standard, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-01's fixed probeCpuHistory() (count=1, InvalidParameter classified as absent) and 07-02's CPUHISTORY_GET/RESOURCE_GET wire decoders in stock-protocol.ts"
provides:
  - "handleCyclesStopwatch (vice_cycles_stopwatch's stock implementation) -- Route A (CPUHISTORY_GET, exact for any bracket) and Route B (LIN/CYC frame-position reconstruction, exact only within one frame, with a proven-wraparound refusal)"
  - "readCycleBaseline()/resolveVideoStandard() -- the shared primitives 07-06's stock-diagnose.ts liveness bracket reuses verbatim"
affects: [07-06, 07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An unmeasurable bracket emits measurable:false with a reason and NO cycles key at all -- 0 is a wrong answer, not a null answer (T-07-01)"
    - "Route selection is a single read of session.capabilities.cpuHistory, settled once at connect time (BACK-04) -- never a second probe"
    - "A read-only resource (MachineVideoStandard) is cached per session.targetId (a plain string key) rather than per session object, since this file adds no RESOURCE_SET path that could invalidate it mid-session; a FAILED read is deliberately never cached, so a transient wire error gets a fresh chance next call"

key-files:
  created:
    - .claude/mcp/vice/stock-timing.ts
    - .claude/mcp/vice/stock-timing.test.ts
  modified: []

key-decisions:
  - "resolveVideoStandard()'s cache only stores SUCCESSFUL reads; a PAL fallback (assumed:true) is never cached, so a transient wire failure can resolve for real on a later call rather than pinning a degraded answer for the whole session"
  - "Route A issues PC via one extra REGISTERS_GET (readProgramCounter()); Route B reads PC out of the SAME REGISTERS_GET reply it already needs for LIN/CYC -- keeping the bracket at exactly two halting reads either way, as 07-06's liveness check needs"
  - "The frame-position wraparound refusal names CPUHISTORY_GET as the route that CAN measure that bracket, and never guesses a '+ k * cyclesPerFrame' correction for an unknown k"
  - "handleCyclesStopwatch checks in this fixed order: no-stored-baseline, then the CURRENT sample's route:\"unavailable\", then baseline/sample route mismatch, then route-specific arithmetic -- so a build that never exposes LIN/CYC (or lost cpu-history capability across a reconnect) always gets an honest, specific refusal"

requirements-completed: [TIME-01, TIME-03]

# Metrics
duration: ~20min
completed: 2026-08-18
---

# Phase 07 Plan 05: vice_cycles_stopwatch (stock) -- dual-route cycle measurement Summary

**`vice_cycles_stopwatch`'s stock implementation: an exact CPUHISTORY_GET-based stopwatch on VICE >= 3.10, a within-one-frame LIN/CYC reconstruction below it, and an explicit refusal -- never a fabricated figure -- the moment a frame boundary is proven crossed.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-18T09:47:21+02:00
- **Tasks:** 3 completed
- **Files modified:** 2 (both newly created)

## Accomplishments
- `VIDEO_STANDARDS` -- all four `MachineVideoStandard` integer values (PAL 63/312, NTSC 65/263, NTSC-old 64/262, PAL-N 65/312), cited against `c64/c64.h`/`machine.h`, with no hardcoded PAL-only assumption anywhere in the arithmetic
- `resolveVideoStandard()` reads `MachineVideoStandard` via the read-only `RESOURCE_GET` encoder/parser 07-02 added, caches a successful read per `session.targetId`, and never throws -- a wire failure or unrecognized value falls back to PAL with `assumed: true` and a `reason`
- `readCycleBaseline()` -- the shared dual-route primitive: Route A (`CPUHISTORY_GET(count:1)`, never `count:0`) returns an exact bigint cycle plus PC via one extra `REGISTERS_GET`; Route B reads `LIN`/`CYC`/`PC` from a single `REGISTERS_GET` reply via `registerCatalogFor()`, computing the within-frame position; a build enumerating neither `LIN` nor `CYC` returns `route: "unavailable"` with a reason, never a substituted zero
- `handleCyclesStopwatch` -- `reset`/`read`/`reset_and_read`, matching the fork manifest's argument shape exactly. Every unmeasurable path (no baseline, route mismatch, Route A backwards clock, Route B proven wraparound, route `"unavailable"`) answers `measurable: false` with a reason and **no** `cycles` key at all; Route A measurable answers carry both `cycles` (Number) and `cyclesExact` (the bigint's decimal string); Route B measurable answers are labelled `exactness: "within-one-frame-unverified"` with an explicit `caveat`
- 22 unit tests covering route selection, exact Route A decode, Route A's backwards-clock refusal, all four video standards' Route B arithmetic (table-driven), the proven-wraparound refusal (TIME-03), the no-baseline/route-mismatch/missing-LIN-CYC/video-standard-fallback/`reset_and_read`-every-path-update cases, argument validation, and cache behaviour -- 22/22 pass in well under 10 seconds, no real socket or emulator

## Task Commits

Each task was committed atomically:

1. **Task 1: Video-standard table, frame-position arithmetic, and readCycleBaseline()** - `97bba2f` (feat)
2. **Task 2: handleCyclesStopwatch with honest refusal on every unmeasurable path** - `627a10c` (feat)
3. **Task 3: stock-timing.test.ts** - `fc363ab` (test)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-timing.ts` - `VIDEO_STANDARDS`, `resolveVideoStandard()`, `positionWithinFrame()`, `readCycleBaseline()` (plus its private `readProgramCounter()` helper), `resetTimingStateForTest()`, and `handleCyclesStopwatch` -- the full stock `vice_cycles_stopwatch` implementation and its shared primitives. Registration into `STOCK_DISPATCH_TABLE`/`tools-manifest.stock.json` is explicitly deferred to plan 07-08 per this plan's own objective.
- `.claude/mcp/vice/stock-timing.test.ts` - 22 tests: route selection (never a `RESOURCE_GET` on Route A), Route A exact decode and backwards-clock refusal, Route B arithmetic table-driven across all four video standards, the TIME-03 wraparound refusal, no-baseline/route-mismatch/missing-LIN-CYC/video-standard-fallback/cache-behaviour/argument-validation cases

## Decisions Made
- The video-standard cache is keyed on `session.targetId` (a plain string), not the session object itself (unlike `bankCatalogFor()`'s/`registerCatalogFor()`'s object-keyed `WeakMap`s) -- per this plan's own instruction, since this file adds no `RESOURCE_SET` path and the resource's only write side lives entirely outside this codebase's reach
- A `resolveVideoStandard()` fallback is deliberately never cached, so a transient wire failure gets a fresh chance to resolve for real on a later call rather than pinning a degraded PAL answer for the whole session
- `handleCyclesStopwatch`'s check order (no-baseline -> current-sample-unavailable -> route-mismatch -> route-specific arithmetic) ensures a build that never exposes `LIN`/`CYC` gets the same honest `"unavailable"` refusal on both `reset` and `read`, and a mid-session capability change (a reconnect) surfaces as an explicit mismatch rather than a wrong number

## Deviations from Plan

None -- plan executed exactly as written. All three tasks' acceptance-criteria greps pass, all `<verify>` blocks pass, and the plan-level `<verification>` block passes (see below), with one unrelated pre-existing failure noted under Issues Encountered.

## Issues Encountered

`npm run test:automated` (part of the plan's `<verification>` block) reports 1 failure out of 1479 tests: `repo-root.test.ts`'s "path agreement" test, the same pre-existing worktree artifact already documented as deferred in 07-01's and 07-02's summaries (and `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md`) -- not caused by this plan's new `stock-timing.ts`/`stock-timing.test.ts` files.

All other verification passed:
- `npx tsc --noEmit -p tsconfig.json` exits 0
- `node --test stock-timing.test.ts` -- 22/22 pass in ~0.4s
- Comment-filtered `stock-timing.ts` contains zero `cycles: 0` and zero `cycles: null`
- Comment-filtered `stock-timing.ts` contains zero `RESOURCE_SET`/`ResourceSet`/`resourceSetBody` references
- `grep -c "clampCpuHistoryCount" stock-timing.ts` returns 2 (import + call), never with a count of 0
- Comment-filtered `stock-timing.ts` contains zero occurrences of the literal `19656` (it appears only inside a `//` comment, which comment-filtering strips)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`readCycleBaseline()`/`resolveVideoStandard()` are exported and ready for 07-06's `stock-diagnose.ts` liveness bracket to reuse verbatim -- both PC and the cycle/position evidence come out of the same two-halting-read shape that bracket needs. `handleCyclesStopwatch` is fully implemented and unit-tested but not yet wired into `STOCK_DISPATCH_TABLE` or `tools-manifest.stock.json`; that registration is explicitly plan 07-08's job, matching this plan's own stated output boundary. No blockers for 07-06 or 07-08.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-timing.ts
- FOUND: .claude/mcp/vice/stock-timing.test.ts
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-05-SUMMARY.md
- FOUND: 97bba2f (feat: video-standard table, frame-position arithmetic, readCycleBaseline())
- FOUND: 627a10c (feat: handleCyclesStopwatch with honest refusal on every unmeasurable path)
- FOUND: fc363ab (test: stock-timing.test.ts)
