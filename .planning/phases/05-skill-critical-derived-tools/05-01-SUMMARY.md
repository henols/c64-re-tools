---
phase: 05-skill-critical-derived-tools
plan: 01
subsystem: api
tags: [stock-vice, binary-monitor, derived-tool, memory-search, memory-compare, mem-get, typescript]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler
    provides: "withDerivedTool()/STOCK_DERIVED_TOOLS seam, stock-address.ts's parseAddress()/parseByteCount(), stock-handler.ts's isErrorText/convertWireError/stockAnswer"
provides:
  - "stock-memory-search.ts exporting handleMemorySearch and handleMemoryCompare -- the DERIV-01 derived handlers, unregistered pending 05-06's dispatch wiring"
  - "stock-memory-search.test.ts -- 32 passing unit tests against a fake session"
affects: [05-06-derived-tool-registration-and-manifest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-tool handler shape (copied from stock-disassemble.ts): isPlainObject guard -> parseAddress/parseByteCount -> array validation mirroring vice_memory_write's data[] loop -> memGetBody({sidefx:false,...}) -> session.client.send(CommandType.MemoryGet) in try/catch -> response.type/short-read guards -> stockAnswer()"
    - "Refusal-by-name for an out-of-scope enum value (mode:'snapshot'), fired before any wire send -- same precedent as D-15/D-16"
    - "Derived value (range2_end) computed from another argument's length rather than accepted as its own argument, with an explicit over-$ffff refusal"

key-files:
  created:
    - .claude/mcp/vice/stock-memory-search.ts
    - .claude/mcp/vice/stock-memory-search.test.ts
  modified: []

key-decisions:
  - "mode:'snapshot' is refused by name before any MEM_GET is sent (D-05-01) -- no memory-only snapshot producer tool exists on either backend, and the two alternative implementations (destructive restore, or an unverified .vsf parser) were both rejected in the plan"
  - "range2_end is derived from range1's length and refused above $ffff before any wire send; it is never accepted as its own argument, matching the fork's own schema"

patterns-established:
  - "Shared parseByteArray()/isByteArrayError() helper inside a derived-tool module for validating both pattern and mask through the same code path, returning a discriminated number[] | StockErrorResult"

requirements-completed: [DERIV-01]

# Metrics
duration: 13min
completed: 2026-08-17
---

# Phase 5 Plan 1: DERIV-01 Memory Search/Compare Summary

**`vice_memory_search`/`vice_memory_compare` computed client-side over one-or-two `sidefx:false` MEM_GET reads, with `mode:'snapshot'` refused by name before any wire send.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-17T19:20:46+02:00
- **Completed:** 2026-08-17T19:33:22+02:00
- **Tasks:** 3
- **Files modified:** 2 (both created)

## Accomplishments
- `handleMemorySearch` finds exact and per-byte-masked patterns over one `sidefx:false` MEM_GET read, with overlapping matches (scan advances by 1, never by `pattern.length`) and a bounded, honestly-flagged (`truncated`) result list
- `handleMemoryCompare` diffs two live ranges over two `sidefx:false` MEM_GET reads, deriving `range2_end` from `range1`'s length, and refuses `mode:'snapshot'` by name with zero wire sends
- 32 passing unit tests, including a `sidefx:false` wire-body regression guard for both handlers and 18 zero-send refusal assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stock-memory-search.ts with handleMemorySearch** - `a0f9bdf` (feat)
2. **Task 2: Add handleMemoryCompare -- mode 'ranges' only, mode 'snapshot' refused by name** - `60ee44d` (feat)
3. **Task 3: Create stock-memory-search.test.ts** - `08d07ff` (test)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `.claude/mcp/vice/stock-memory-search.ts` - Exports `handleMemorySearch` and `handleMemoryCompare` (both `StockSessionHandler`); not yet registered in `stock-dispatch.ts`/`stock-derived.ts` (05-06's job)
- `.claude/mcp/vice/stock-memory-search.test.ts` - 32 `node:test` cases against a fake session, mirroring `stock-disassemble.test.ts`'s `makeSession()`/`DEPS`/`memoryGetReply()`/`parseAnswer()` harness

## Answer Key Reference (for 05-06's `outputSchema`)

**`handleMemorySearch` success payload keys:** `start`, `end`, `searched` (= `end - start + 1`), `pattern` (validated `number[]`), `mask` (present ONLY when supplied), `maxResults`, `matches` (`number[]` of addresses), `count` (= `matches.length`), `truncated`, plus `runState` (added automatically by `stockAnswer()`).

**`handleMemoryCompare` success payload keys (mode `"ranges"` only -- `mode:"snapshot"` never reaches a success payload):** `mode` (always `"ranges"`), `range1Start`, `range1End`, `range2Start`, `range2End` (derived, never an input), `length`, `maxDifferences`, `differences` (array of `{ offset, address1, address2, value1, value2 }`), `count`, `truncated`, `identical` (= `count === 0 && !truncated`), plus `runState`.

## `mode:'snapshot'` Refusal Text (for 05-08's `docs/stock-vice-parity.md`)

Exact text returned by `handleMemoryCompare({ mode: "snapshot", ... })`:

> `vice_memory_compare: mode:'snapshot' is not implemented on the stock backend -- there is no memory-only snapshot producer tool on either backend (vice_snapshot_save writes a whole-machine .vsf), so serving it would mean either destructively restoring the machine to read memory out of it, or parsing an unverified binary snapshot format. Use mode:'ranges' to compare two live ranges captured at different points in time, or use the c64-ram-capture skill's own full-image diff.`

## Decisions Made
- **D-05-01 (from the plan, confirmed as implemented):** `mode:'snapshot'` refused by name, before any `MEM_GET`, with both working alternatives named in the refusal text. Asserted by a zero-sends test.
- Module constants `DEFAULT_MAX_RESULTS = 100`, `MAX_MAX_RESULTS = 10000`, `MAX_PATTERN_BYTES = 0x1000` declared exactly as the plan specified, shared between both handlers (no duplicate constants for `max_differences`).

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria grep/node gates for all three tasks pass, and the plan's own `<verify>` script text (source-gate assertions) was run verbatim against the finished file for both Task 1 and Task 2, plus the exact Task 3 verification script.

## Issues Encountered

`npm run test:automated` reports 1 failure out of 1227 tests: `repo-root.test.ts`'s "path agreement ... the agreed path is not under .claude" assertion trips because this parallel-executor's own worktree is nested under `.claude/worktrees/agent-a6fbc6047a5154e49/`, so `supervisorDir()` resolves to a path literally containing `.claude` -- an artifact of the worktree execution environment, not a regression from this plan's changes (`repo-root.test.ts` has been unmodified since the initial commit, and this plan touched only `stock-memory-search.ts`/`stock-memory-search.test.ts`). Logged to `.planning/phases/05-skill-critical-derived-tools/deferred-items.md`, not fixed (out of scope per the executor's scope-boundary rule). All 1058 other automated tests pass, including `fork-manifest-surface.test.ts` (62 fork tools unchanged), `hostpath-consumers.test.ts` (five-member consumer set unchanged, `stock-memory-search.ts` absent from it), `test-gate.test.ts` (drift guard passes with the new file in the automated set), and all 32 new `stock-memory-search.test.ts` tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`handleMemorySearch`/`handleMemoryCompare` are fully built and unit-tested but deliberately UNREGISTERED -- no entry in `stock-dispatch.ts`, `stock-derived.ts`, `tools-manifest.stock.json`, or `package.json`'s `files[]`. 05-06 (wave 2) owns wiring all four of those shared files in one commit that makes this module reachable, per the objective's stated ownership split and Phase 3 Rule 2 (packaging closure in the same commit as reachability). The answer key lists and the exact `mode:'snapshot'` refusal text above are recorded for 05-06's `outputSchema` and 05-08's `docs/stock-vice-parity.md` respectively.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-memory-search.ts`
- FOUND: `.claude/mcp/vice/stock-memory-search.test.ts`
- FOUND: `.planning/phases/05-skill-critical-derived-tools/05-01-SUMMARY.md`
- FOUND commit `a0f9bdf` (Task 1)
- FOUND commit `60ee44d` (Task 2)
- FOUND commit `08d07ff` (Task 3)
- FOUND commit `89a6a2d` (metadata)
