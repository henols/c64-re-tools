---
phase: 03-direct-tools
plan: 07
subsystem: api
tags: [typescript, binary-monitor, vice, mcp, registers, catalog, stock-vice]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-01's stock-handler.ts (StockSessionHandler, stockAnswer(), convertWireError()), 03-02's stock-protocol.ts request-body encoders (memspaceBody, registersSetBody)"
provides:
  - stock-registers.ts -- registerCatalogFor() (the per-session register catalog, built from REGISTERS_AVAILABLE and cached on the session object), resetRegisterCatalogsForTest(), and three StockSessionHandlers: handleRegistersAvailable (stock-only enumeration), handleRegistersGet, handleRegistersSet
affects: [03-12, 03-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-session lazy-fetch-then-cache catalog keyed on the session object itself via a module-level catalog map -- a stockReconnect() hands back a new session object, so cache invalidation is automatic with no manual clear needed"
    - "Explanatory refusal (never a silent read-modify-write) for a caller asking to write an individual status-register flag bit that the wire only exposes as part of a whole register"

key-files:
  created:
    - .claude/mcp/vice/stock-registers.ts
    - .claude/mcp/vice/stock-registers.test.ts
  modified:
    - .planning/phases/03-direct-tools/deferred-items.md

key-decisions:
  - "REGISTERS_AVAILABLE surfaces as its own stock-only vice_registers_available handler, not a field grafted onto vice_registers_get's answer -- per the planner decision already recorded in 03-07-PLAN.md (enumeration and value-reading are different operations with different callers)"
  - "handleRegistersGet reports ids the catalog doesn't recognize in a separate unknownIds array rather than dropping them, matching the plan's final answer-shape spec (registers: Record<string,number> plus unknownIds: Array<{id,value}>)"
  - "handleRegistersSet's flag-bit refusal (N|V|B|D|I|Z|C) names whichever status-register candidate name (FL/SR/P/STATUS/FLAGS) the connected catalog actually reports, rather than guessing a fixed name that might not exist on a given build"
  - "Corrected the plan's own illustrative REGISTERS_SET body test offsets (itemSize at body[2], id at body[3]) to the arithmetically correct offsets (body[3]/body[4]) given the 3-byte memspace+count header -- same off-by-one already identified and fixed in 03-02-SUMMARY.md's own deviation log for the identical body shape"

requirements-completed: [DIRECT-02, DIRECT-09]

# Metrics
duration: 45min
completed: 2026-08-14
---

# Phase 3 Plan 7: Register Catalog and vice_registers_* Handlers Summary

**Per-session register catalog built once from stock VICE's REGISTERS_AVAILABLE enumeration (never a hardcoded id table), backing a stock-only `vice_registers_available` handler plus fork-compatible `vice_registers_get`/`vice_registers_set` handlers that range-check writes against the wire's own declared register size and refuse individual status-flag-bit writes with an explanation.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-14 (worktree spawn + context load)
- **Completed:** 2026-08-14
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 deferred-items.md append)

## Accomplishments
- `registerCatalogFor()`: fetches `REGISTERS_AVAILABLE` (0x83) exactly once per session, caches the result keyed on the session object itself (never `session.client`), and refuses (rather than silently caching) an empty enumeration -- a build that reports zero registers cannot support `vice_registers_set`.
- `handleRegistersAvailable` (stock-only, no fork counterpart): lists every catalog register in the wire's own order through `stockAnswer()`, satisfying DIRECT-09's register-enumeration half.
- `handleRegistersGet`: renders the `REGISTERS_GET` reply's `{id,value}` pairs into `name -> value` through the catalog, reporting any id the catalog does not recognize in a separate `unknownIds` array instead of dropping it.
- `handleRegistersSet`: resolves the fork's `register` argument (case-insensitive) through the catalog to a wire id, range-checks the requested value against that register's declared size (`0..0xff` for 1 byte, `0..0xffff` for 2 bytes), gives an explanatory refusal naming the connected build's actual status-register name when asked to write an individual flag bit (`N|V|B|D|I|Z|C`), and reports both the requested value and the value `REGISTERS_SET`'s own reply echoed back.
- Zero hardcoded register ids anywhere in the module (grep-gated), zero `isError: false` literals outside `stockAnswer()`, zero `CommandType.Exit` references (D-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: The per-session register catalog and vice_registers_available** - `1e8674f` (feat)
2. **Task 2: vice_registers_get and vice_registers_set** - `916bb32` (feat, includes a deferred-items.md log entry)

## Files Created/Modified
- `.claude/mcp/vice/stock-registers.ts` - `RegisterCatalog`, `registerCatalogFor()`, `resetRegisterCatalogsForTest()`, `handleRegistersAvailable`, `handleRegistersGet`, `handleRegistersSet`
- `.claude/mcp/vice/stock-registers.test.ts` - 16 tests: catalog mapping/caching/refusal, `REGISTERS_AVAILABLE` body shape, `handleRegistersAvailable` wire-order + argument validation, `handleRegistersGet` unknown-id reporting, `handleRegistersSet` case-insensitive resolution + wire body shape + unknown-name/flag-bit/range refusals + read-back reporting + wire-rejection handling + argument validation
- `.planning/phases/03-direct-tools/deferred-items.md` - appended item 3, logging an unrelated intermittent `build-atomic.test.ts` flake observed during this plan's full-suite verification

## Decisions Made
- Kept the catalog map keyed on the `StockConnectSession` object itself (not `session.client`), matching the plan's explicit spec -- this makes a `stockReconnect()`'s brand-new session object equivalent to "never fetched," with no manual invalidation call needed anywhere.
- Consolidated the catalog map's construction into a single one-line factory function (`freshCatalogMap()`) so the primitive's name appears on exactly one line in the file, satisfying the plan's own grep-gated acceptance criterion while still giving `resetRegisterCatalogsForTest()` a real reset path.
- For `handleRegistersGet`'s unknown-id reporting, followed the plan's own **final, concrete** answer-shape spec (`registers: Record<string,number>` plus `unknownIds: Array<{id,value}>`) rather than an earlier, looser prose sentence in the same task block describing a per-item `{id, name: null, value}` shape -- the two are not fully reconcilable as one object shape, and the later, more specific bullet (which the acceptance criteria also test against) is authoritative.
- `handleRegistersSet`'s flag-bit refusal checks a small ordered list of candidate status-register names (`FL`, `SR`, `P`, `STATUS`, `FLAGS`) against the connected catalog and names whichever one actually resolves, rather than assuming a fixed name -- since the catalog itself is build-sourced and not guaranteed to use any particular spelling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the plan's own illustrative REGISTERS_SET body test offsets**
- **Found during:** Task 2 (writing the required `register: "a"` body-shape test)
- **Issue:** The plan's action text and acceptance criteria both claim the encoded `REGISTERS_SET` body's `readUInt16LE(1)` is `1` (one item) "with `body[2] === 3` (itemSize) and the resolved id at `body[3]`". Given `registersSetBody()`'s actual, already-shipped wire layout (`stock-protocol.ts`, landed in plan 03-02) -- a 3-byte header (`memspace(1) count(u16LE)` at offsets 0-2) followed by each item's own `itemSize(1) regId(1) value(u16LE)` -- the first item's `itemSize` byte sits at offset **3**, not offset 2, and the register id sits at offset **4**, not offset 3. This is the identical off-by-one already identified and corrected in `03-02-SUMMARY.md`'s own deviation log for the same body shape (that plan's own worked examples for `registersSetBody` with two items), which explicitly cross-references this plan (03-07) as showing "the same drafting pattern."
- **Fix:** Wrote the test assertions against the arithmetically correct offsets (`body[3] === 3`, `body[4] === <resolved id>`), with an inline comment naming the discrepancy and its 03-02 precedent, rather than either miswriting the encoder to match the plan's wrong illustration or asserting against offsets that don't match the shipped, already-tested encoder.
- **Files modified:** `.claude/mcp/vice/stock-registers.test.ts`
- **Verification:** `node --test stock-registers.test.ts` (16/16 pass, including this test); the encoder itself (`registersSetBody()` in `stock-protocol.ts`) was not modified, since its byte layout was already correct and already covered by `stock-protocol.test.ts`'s own (also-corrected) offset assertions.
- **Committed in:** `916bb32` (Task 2 commit)

**2. Logged (not fixed) an unrelated, intermittently flaky test observed during full-suite verification**
- **Found during:** running `npm run test:automated` after Task 2
- **Issue:** `build-atomic.test.ts`'s "the private temp directory is cleaned up on both the success and the failure path" test failed once in a full-suite run; re-running `node --test build-atomic.test.ts` in isolation immediately afterward passed 6/6 with no changes, confirming intermittent flakiness rather than a deterministic regression, and confirming (by file scope) it is unrelated to anything this plan touches.
- **Action:** Logged to `.planning/phases/03-direct-tools/deferred-items.md` (appended as item 3, per the SCOPE BOUNDARY rule and this phase's own "append, don't rewrite" convention for the shared deferred-items file) rather than investigated or fixed.
- **Files modified:** `.planning/phases/03-direct-tools/deferred-items.md`

---

**Total deviations:** 2 (1 Rule 1 auto-fix correcting the plan's own illustrative test numbers to match the already-shipped, already-tested encoder; 1 logged-and-deferred out-of-scope flaky test)
**Impact on plan:** The Rule 1 fix corrects only this plan's own test assertions to match the encoder's real, already-verified byte layout -- no change to any shipped encoder or handler behavior. The deferred flake is unrelated to this plan's file scope and requires no action here.

## Issues Encountered

- **Pre-existing, environment-only test failure (not caused by this plan):** `repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails when the checkout itself is nested under `.claude/worktrees/agent-<id>/`, exactly as documented in this phase's `deferred-items.md` item 1 (confirmed by every prior 03-* plan in this phase). Not fixed here, out of scope, already logged.
- **This worktree's `.claude/mcp/vice/node_modules` was not provisioned at spawn.** Copied from the main checkout's already-`npm ci`'d tree (byte-identical lockfile confirmed), per the documented environment note and this phase's own established precedent (03-05-SUMMARY.md item 1) -- not a new deviation, not committed (gitignored).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `registerCatalogFor()`, `handleRegistersAvailable`, `handleRegistersGet`, and `handleRegistersSet` are all exported and ready for plans 03-12/03-13's dispatch-seam wiring (`STOCK_DISPATCH_TABLE` entries plus `tools-manifest.stock.json` entries for `vice_registers_get`, `vice_registers_set`, and the new stock-only `vice_registers_available`) -- this plan intentionally makes no dispatch or manifest edits, per its own objective.
- No blockers for the remaining Wave 2 plans in this phase -- this plan's only files (`stock-registers.ts`, `stock-registers.test.ts`) are not imported by any other plan's files yet.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-registers.ts`
- FOUND: `.claude/mcp/vice/stock-registers.test.ts`
- FOUND: `.planning/phases/03-direct-tools/deferred-items.md`
- FOUND: `.planning/phases/03-direct-tools/03-07-SUMMARY.md` (this file)
- FOUND commit `1e8674f` (Task 1, confirmed via `git log --oneline --all`)
- FOUND commit `916bb32` (Task 2, confirmed via `git log --oneline --all`)
