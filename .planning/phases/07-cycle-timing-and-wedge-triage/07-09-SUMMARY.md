---
phase: 07-cycle-timing-and-wedge-triage
plan: 09
subsystem: stock-vice-backend
tags: [wedge-triage, dispatch-table, manifest, conformance, module-cycle, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-06's handleDiagnoseStock (stock-diagnose.ts) and 07-07's handleRecycleStock (stock-recycle.ts) -- both fully implemented and unit-tested but unregistered until this plan; 07-08's 34 -> 36 registration pattern this plan extends to 38"
provides:
  - "vice_diagnose and vice_recycle wired into STOCK_DISPATCH_TABLE via withDerivedTool -- the last two of Phase 7's four TIME-04-adjacent tools, and the final two tools of the whole stock backend's advertised surface"
  - "tools-manifest.stock.json taken from 36 to 38 tools, with vice_diagnose's five-verdict enum pinned and the stale_read_path divergence stated in its description, and vice_recycle's reason gate matching the fork's required set exactly"
  - "PROXY_LOCAL_TOOLS -- a third named manifest-test category (beside STOCK_ONLY_TOOLS) for tools served proxy-locally on both backends and therefore absent from the fork's own tools-manifest.json"
  - "A fixed two/three-node ES module runtime cycle (stock-dispatch.ts <-> stock-diagnose.ts <-> stock-recycle.ts) that crashed with a TDZ ReferenceError depending on which module a test entered through"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A handler a dispatch-table module imports back from a module that itself imports a REAL (non-type-only) runtime value from the dispatch-table module must be declared as a `function`, never a `const` arrow-function export -- function declarations are initialised during ES module INSTANTIATION (before any module in the graph evaluates), while `const` bindings only initialise when their own module's evaluation reaches the assignment statement, making a `const` export unsafe to reference from inside any cycle regardless of entry order. A module-scope `<Type>` const-assignment placed just after the declaration preserves the type check that a `function` declaration cannot carry inline."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-derived.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/stock-diagnose.ts
    - .claude/mcp/vice/stock-recycle.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
    - .claude/mcp/vice/stock-derived.test.ts

key-decisions:
  - "vice_recycle's outputSchema.required is [\"recycled\", \"recordPath\", \"killStage\", \"runState\"] -- NOT the plan's own literal suggestion of [\"requested\", \"outcome\", \"recordPath\", \"runState\"]. Read handleRecycleStock's actual success path (stock-recycle.ts): the one stockAnswer() call on the confirmed-kill branch emits exactly { recycled: true, recordPath, killStage } plus the stamped runState -- no 'requested' or 'outcome' key exists anywhere in the real payload. The plan's own read_first instruction (\"the exact payload keys handleRecycleStock emits\") pointed at the code, not the prose description, as the source of truth; the manifest was written to match the real conformance-tested answer rather than the plan's inaccurate description."
  - "handleDiagnoseStock and handleRecycleStock are declared as plain `function`s (not `const` arrow-function exports) -- required by a genuine module cycle this plan's own Task 1 completed (see Deviations), not a style preference."
  - "DerivedPureHandler's doc comment (stock-derived.ts) documents vice_diagnose by name as the one declared exception to \"a needsSession:false handler structurally cannot reach the wire\" -- it self-acquires a session via ensureStockSession(deps) inside its own try/catch so a thrown MonitorOwnershipError/MachineRestartedError becomes one of its own five verdicts rather than withDerivedTool()'s generic refusal text."

requirements-completed: [TIME-04]

# Metrics
duration: ~50min
completed: 2026-08-18
---

# Phase 07 Plan 09: Register vice_diagnose and vice_recycle on stock (36 -> 38) Summary

**Wired the last two stock tools -- vice_diagnose's five-verdict wedge triage and vice_recycle's evidence-then-kill recovery -- into the stock dispatch table and manifest (36 -> 38), and fixed a genuine ES-module runtime cycle between stock-dispatch.ts, stock-diagnose.ts and stock-recycle.ts that this plan's own registration completed.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-18T09:05:00Z (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 9 (5 in plan scope, 2 Rule 1 cycle-fix files, 2 Rule 3 guard fixes)

## Accomplishments
- `vice_diagnose` (TIME-04) and `vice_recycle` (TIME-04) are now reachable: both registered in `STOCK_DISPATCH_TABLE` via `withDerivedTool()` -- `vice_diagnose` with `needsSession: false` (it self-acquires its session to preserve its own verdict vocabulary) and `vice_recycle` with `needsSession: true` -- previously `dispatchStock()` refused both by name. No change to `vice-proxy.ts`: `buildBackendAwareTool()` already routed `RECYCLE_TOOL`/`DIAGNOSE_TOOL` to `dispatchStock()` on the stock backend.
- Both modules (`stock-diagnose.ts`, `stock-recycle.ts`) added to `package.json`'s `files[]` in the same commit as their registration; `node scripts/check-npm-packages.mjs` passes (57 files in `@henols/vice-mcp`).
- `stock-derived.ts`'s `DerivedPureHandler` doc comment amended to name `vice_diagnose` as the one declared exception to the "structurally cannot reach the wire" contract, per this plan's own instruction.
- `tools-manifest.stock.json` taken from 36 to 38 tools: `vice_diagnose`'s `inputSchema` takes no arguments (matching `DIAGNOSE_TOOL`); its `outputSchema.verdict.enum` is pinned to `STOCK_DIAGNOSE_VERDICTS`'s exact five values in order, and its description states the `stale_read_path` divergence explicitly (absent on stock because every read pauses the machine uniformly). `vice_recycle`'s `inputSchema.required` is `["reason"]`, matching `RECYCLE_TOOL` exactly; its `outputSchema` matches `handleRecycleStock`'s real success payload (see Decisions).
- A third named manifest-test category, `PROXY_LOCAL_TOOLS` (`stock-dispatch.test.ts`), distinct from `STOCK_ONLY_TOOLS`: the D-03 name-coverage test now skips these two names in its fork-counterpart check and separately asserts each is present on stock, absent from the fork manifest, and never mislabelled stock-only -- the bidirectional table/manifest agreement guard and the D-06 runState guard are unchanged and still pass.
- `REGISTERED_TOOL_NAMES` and both count assertions updated 36 -> 38.
- Two new `conformanceTest()` cases dispatch through the real `dispatchStock()` path: `vice_diagnose` exercises the cheapest deterministic verdict (`checkpoint_trap`, zero `Exit` sends) and cross-checks the real answer's `verdict` against the manifest's own declared enum; `vice_recycle` extends `CONFORMANCE_BROKER_CONTROL` with a `recycle()` stub and redirects `VICE_INCIDENTS_DIR` to a disposable temp directory, cleaned up afterward (`git status --porcelain .planning/incidents` empty). A regression test proves `stockHandlerFor` resolves both names as functions and that neither tool's answer contains the "is not implemented by the stock backend" refusal text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dispatch entries, derived registry, files[], and the documented needsSession exception** - `9b92b5d` (feat)
2. **Task 2: Manifest entries (36 -> 38) and the registered-name guards** - `ec27778` (feat)
3. **Task 3: Conformance cases + Rule 1 module-cycle fix + Rule 3 guard fixes** - `8b6c90b` (test)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-dispatch.ts` - imports `handleDiagnoseStock`/`handleRecycleStock`; two new `STOCK_DISPATCH_TABLE` entries under a `// derived (TIME-04)` comment block documenting the deliberate `needsSession` asymmetry
- `.claude/mcp/vice/stock-derived.ts` - `vice_diagnose`/`vice_recycle` added to `STOCK_DERIVED_TOOLS`; `DerivedPureHandler`'s doc comment amended with the named exception
- `.claude/mcp/vice/package.json` - `files[]` gains `stock-diagnose.ts` and `stock-recycle.ts`
- `.claude/mcp/vice/tools-manifest.stock.json` - two new tool entries (36 -> 38)
- `.claude/mcp/vice/stock-dispatch.test.ts` - `PROXY_LOCAL_TOOLS` category and D-03 test extension; `REGISTERED_TOOL_NAMES`/count assertions -> 38; `CONFORMANCE_BROKER_CONTROL` gains a `recycle()` stub; two new conformance cases; one regression test
- `.claude/mcp/vice/stock-diagnose.ts` (Rule 1) - `handleDiagnoseStock` converted from a `const` arrow-function export to a `function` declaration, breaking the module-cycle TDZ hazard; a module-scope type-check const preserves the `DerivedPureHandler` contract
- `.claude/mcp/vice/stock-recycle.ts` (Rule 1) - `handleRecycleStock` converted identically; `StockToolResult` added to its `stock-handler.ts` import
- `.claude/mcp/vice/hostpath-consumers.test.ts` (Rule 3) - `DERIVED_TOOL_MODULES` gains both new tools' module mappings
- `.claude/mcp/vice/stock-derived.test.ts` (Rule 3) - `STOCK_DERIVED_TOOLS` count assertion updated 11 -> 13, with explicit `.has()` checks for both new names

## Decisions Made
- `vice_recycle`'s manifest `outputSchema.required` matches the REAL emitted keys (`recycled`, `recordPath`, `killStage`, `runState`) rather than the plan's own literal text (`requested`, `outcome`, `recordPath`, `runState`) -- see key-decisions above for the full rationale. The conformance test (Task 3) validates the real dispatch answer against this schema, so this divergence was caught immediately rather than shipped silently.
- `handleDiagnoseStock`/`handleRecycleStock` are `function` declarations, not `const` arrow-function exports -- required by the module-cycle fix (Rule 1 below), matching `ensureStockSession`'s own established `function`-declaration shape in `stock-dispatch.ts`.
- Followed the plan's own instruction verbatim on everything else: the `PROXY_LOCAL_TOOLS` category name, the five-verdict enum order, the reason-gate `inputSchema`, and the `needsSession` asymmetry comment placement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A genuine ES module runtime cycle crashed with a TDZ ReferenceError depending on test entry order**
- **Found during:** Task 3, running `npm run test:automated` (surfaced first as `stock-recycle.test.ts` failing outright)
- **Issue:** This plan's Task 1 registration made `stock-dispatch.ts` import `handleDiagnoseStock` (from `stock-diagnose.ts`) and `handleRecycleStock` (from `stock-recycle.ts`) as REAL runtime values. `stock-diagnose.ts` already imported `ensureStockSession` (also a real runtime value) from `stock-dispatch.ts`, and `stock-recycle.ts` already imported several functions from `stock-diagnose.ts`. This completed a genuine multi-node runtime cycle: `stock-dispatch.ts` <-> `stock-diagnose.ts` <-> `stock-recycle.ts`. Both `handleDiagnoseStock` and `handleRecycleStock` were declared as `const` arrow-function exports, which in ES modules only initialise when their OWN module's evaluation reaches the assignment statement -- unlike a `function` declaration, which initialises during module INSTANTIATION, before any module in the graph starts evaluating. Entering the cycle via `stock-dispatch.test.ts` (which imports `stock-dispatch.ts` as the graph's root) happened to dodge the hazard, because Node fully evaluates each dependency module before returning to build `STOCK_DISPATCH_TABLE`. Entering via `stock-recycle.test.ts` (whose subject imports `stock-diagnose.ts`, which imports `stock-dispatch.ts`, which imports back into both `stock-diagnose.ts` and `stock-recycle.ts`) crashed with exactly `ReferenceError: Cannot access 'handleDiagnoseStock' before initialization` at `stock-dispatch.ts`'s own `STOCK_DISPATCH_TABLE` literal -- an entry-point-order-dependent production bug, not merely a test artifact, since `vice-proxy.ts`'s own import order at process startup determines which module evaluates first there too.
- **Fix:** Converted both `handleDiagnoseStock` (`stock-diagnose.ts`) and `handleRecycleStock` (`stock-recycle.ts`) from `const` arrow-function exports to plain `function` declarations -- immune to entry-point order, matching `ensureStockSession`'s own established `function`-declaration shape in `stock-dispatch.ts` (never a `const`, for the identical reason, per that function's own header comment). A module-scope type-check const (`const _handleDiagnoseStockShapeCheck: DerivedPureHandler = handleDiagnoseStock;`, and the equivalent for `StockSessionHandler`/`handleRecycleStock`) preserves the compile-time contract that moved off the declaration itself; both are erased at runtime (never exported, never referenced elsewhere) so they add no new surface.
- **Files modified:** `.claude/mcp/vice/stock-diagnose.ts`, `.claude/mcp/vice/stock-recycle.ts` (plus `StockToolResult` added to the latter's existing `stock-handler.ts` import)
- **Verification:** `node --test stock-recycle.test.ts` (18/18), `node --test stock-diagnose.test.ts` (25/25), `node --test stock-dispatch.test.ts` (119/119) all pass; `npx tsc --noEmit` exits 0; `npm run test:automated` returns to its baseline 1 pre-existing failure (see Issues Encountered)
- **Commit:** `8b6c90b`

**2. [Rule 3 - Blocking] `hostpath-consumers.test.ts`'s D-05-12 guard failed on the two new derived-tool registrations**
- **Found during:** Task 3, same `npm run test:automated` run
- **Issue:** `DERIVED_TOOL_MODULES' key set equals STOCK_DERIVED_TOOLS exactly` failed the moment `vice_diagnose`/`vice_recycle` joined `STOCK_DERIVED_TOOLS` (Task 1) without a corresponding entry in this sibling test file's own declared module map.
- **Fix:** Added `vice_diagnose: "stock-diagnose.ts"` and `vice_recycle: "stock-recycle.ts"` to `DERIVED_TOOL_MODULES`.
- **Files modified:** `.claude/mcp/vice/hostpath-consumers.test.ts`
- **Commit:** `8b6c90b`

**3. [Rule 3 - Blocking] `stock-derived.test.ts`'s hardcoded entry count went stale**
- **Found during:** Task 3, same `npm run test:automated` run
- **Issue:** `STOCK_DERIVED_TOOLS: exactly eleven entries` asserted `.size === 11` and enumerated only the pre-this-plan eleven names by hand -- became false the instant Task 1 added two names to the set.
- **Fix:** Updated the assertion to 13, renamed the test description, and added explicit `.has()` checks for both new tool names (matching the file's own per-name assertion convention).
- **Files modified:** `.claude/mcp/vice/stock-derived.test.ts`
- **Commit:** `8b6c90b`

Both Rule 3 fixes are direct, mechanical consequences of this plan's own Task 1 registration -- squarely in scope per the standing scope-boundary rule. The Rule 1 fix is a genuine bug this plan's own registration introduced (not pre-existing), found and fixed within the same plan, per Rule 1's own definition.

## Issues Encountered

`npm run test:automated` reports 1 pre-existing failure out of 1527 tests (1521 pass, 5 pre-existing `todo`): `repo-root.test.ts`'s "path agreement" test -- the same documented worktree-path artifact already noted in `07-01`/`07-02`/`07-05`/`07-06`/`07-07`/`07-08`'s summaries and `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md`, unrelated to any file this plan touches.

`npm ci --no-audit --no-fund` was run once in `.claude/mcp/vice` at the start of this session -- this isolated worktree had no `node_modules/` yet. Not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The stock backend's advertised tool surface is now complete for this milestone: 38 tools, all dispatchable, all conformance-validated against their own declared `outputSchema`, with `REGISTERED_TOOL_NAMES`, `CONFORMANCE_TOOL_NAMES`, `DERIVED_TOOL_MODULES` and `STOCK_DERIVED_TOOLS`'s count all consistent at 38/38/38/13 respectively. `vice_diagnose` and `vice_recycle` -- the wedge-triage skill's own documented opening and recovery moves -- work on stock exactly as they do on the fork, modulo the one named divergence (`stale_read_path` absent, stated in the tool's own description). No blockers for phase completion. The one pre-existing, out-of-scope worktree path-agreement test failure requires no action from this plan.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-dispatch.ts
- FOUND: .claude/mcp/vice/stock-derived.ts
- FOUND: .claude/mcp/vice/package.json
- FOUND: .claude/mcp/vice/tools-manifest.stock.json
- FOUND: .claude/mcp/vice/stock-dispatch.test.ts
- FOUND: .claude/mcp/vice/stock-diagnose.ts
- FOUND: .claude/mcp/vice/stock-recycle.ts
- FOUND: .claude/mcp/vice/hostpath-consumers.test.ts
- FOUND: .claude/mcp/vice/stock-derived.test.ts
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-09-SUMMARY.md
- FOUND: 9b92b5d (feat: register vice_diagnose and vice_recycle on stock dispatch)
- FOUND: ec27778 (feat: manifest entries for vice_diagnose/vice_recycle, 36 -> 38)
- FOUND: 8b6c90b (test: conformance cases + Rule 1 module-cycle fix + Rule 3 guard fixes)
