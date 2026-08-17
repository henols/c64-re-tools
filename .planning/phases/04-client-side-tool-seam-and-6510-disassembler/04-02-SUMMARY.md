---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 02
subsystem: mcp-server
tags: [typescript, stock-vice-backend, derived-tools, dispatch-seam, node-test]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "stock-dispatch.ts's STOCK_DISPATCH_TABLE, withStockSession(), ensureStockSession(), stock-handler.ts's error converters"
provides:
  - "stock-derived.ts: STOCK_DERIVED_TOOLS registry, derivedContainerPath(), DerivedToolError, DerivedPureHandler"
  - "withDerivedTool() adapter in stock-dispatch.ts, sitting beside withStockSession()"
  - "hostpath-consumers.test.ts: D-02's second enforcement mechanism, the closed 5-module host-path consumer set"
affects: [04-05-disassembler, 05-screenshots-and-derivations, 06-stock-only-gains]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-tool seam: withDerivedTool(toolName, {needsSession}, handler) registers into the SAME STOCK_DISPATCH_TABLE as withStockSession(), never a second table"
    - "Container-path discipline: derivedContainerPath() returns a path unchanged, existing solely as a named seam an asserted-absence test can point at"
    - "Two-file split for a would-be-cyclic adapter: the leaf (stock-derived.ts, data + pure functions) vs. the adapter (withDerivedTool() in stock-dispatch.ts, which needs ensureStockSession())"

key-files:
  created:
    - .claude/mcp/vice/stock-derived.ts
    - .claude/mcp/vice/stock-derived.test.ts
    - .claude/mcp/vice/hostpath-consumers.test.ts
  modified:
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/package.json
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/vice-broker-client.ts

key-decisions:
  - "Two-file split (stock-derived.ts leaf + withDerivedTool() in stock-dispatch.ts) to avoid a runtime import cycle, per the plan's own plan_decision_module_split block"
  - "hostpath-consumers.test.ts's declared importer set is exactly 5 modules: containerpath.ts, install-resources.ts, stock-paths.ts, vice-proxy.ts, vice-sync.ts"
  - "Rule 1 fix: removed the literal string 'forwardToVice' from stock-derived.ts's header (the plan's own verification gate requires zero occurrences in that file) while keeping every other required literal string (rewriteArguments, gatherWedgeEvidence, Phase 5 criterion 5, stock-paths.ts)"

requirements-completed: [DERIV-07]

# Metrics
duration: ~20min
completed: 2026-08-17
---

# Phase 4 Plan 02: Derived-Tool Seam Summary

**Built the derived-tool interception seam (`withDerivedTool()` + `stock-derived.ts`) that lets a stock tool answer client-side with a structural guarantee its container path is never host-translated, plus D-02's second independent enforcement test (`hostpath-consumers.test.ts`) pinning the closed host-path consumer set at 5 modules.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified/created:** 8

## Accomplishments

- `stock-derived.ts` -- the derived-tool leaf: `STOCK_DERIVED_TOOLS` (data-only registry, seeded with `"vice_disassemble"`), `derivedContainerPath()` (returns the container path unchanged, refuses undeclared tools), `DerivedToolError`, `DerivedPureHandler` type. Imports only `stock-handler.ts` and `vice.ts` at runtime (`StockDispatchDeps` is `import type`-only from `stock-dispatch.ts`, erased under `verbatimModuleSyntax`).
- `withDerivedTool(toolName, { needsSession }, handler)` in `stock-dispatch.ts`, immediately after `withStockSession()`. `needsSession: true` delegates to the exact same `ensureStockSession()` the 25 direct tools use, reusing `convertHandshakeError()`/`convertWireError()` verbatim. `needsSession: false` never calls `ensureStockSession()` at all. Refuses any undeclared tool at call time (never a module-scope throw).
- `stock-derived.test.ts` -- D-02 mechanism 1: a derived handler dispatched through `withDerivedTool()` receives the container path verbatim, proven against a working non-vacuity control (`hostPath()` shown to translate the identical input to a different string under the identical environment).
- `hostpath-consumers.test.ts` -- D-02 mechanism 2: the first committed test of the closed host-path consumer set (previously enforced by comment convention pointing at a test file, `vice-mcp-selector-docs.test.mjs`, that does not exist anywhere in this repo). Pins the set at exactly 5 modules, asserts `stock-derived.ts` and the not-yet-existing disassembler modules are absent, and loops `STOCK_DERIVED_TOOLS` so a future derived module joining the set fails this test.
- Two stale comments (in `vice-proxy.ts` and `vice-broker-client.ts`) that named the non-existent test file and said "four" production modules corrected to name `hostpath-consumers.test.ts` and the true count of five -- comment-only edits, verified via `git diff`.
- `stock-derived.ts` added to `package.json`'s `files[]` in the same commit that makes `stock-dispatch.ts` import it (34 entries, up from 33) -- the shipping-closure gate (walking every relative import transitively reachable from `vice-proxy.ts`) passes.

## Signature 04-05 must call to register `vice_disassemble`

```ts
import { withDerivedTool } from "./stock-dispatch.ts";

// needsSession: false -- a pure client-side computation with no wire access:
vice_disassemble: withDerivedTool("vice_disassemble", { needsSession: false }, handleDisassemble),

// OR, if the disassembler needs a live memory read:
vice_disassemble: withDerivedTool("vice_disassemble", { needsSession: true }, handleDisassemble),
```

`handleDisassemble` must be typed `DerivedPureHandler` (needsSession: false, imported from `./stock-derived.ts`) or `StockSessionHandler` (needsSession: true, imported from `./stock-handler.ts`) to match the overload. `"vice_disassemble"` is already declared in `STOCK_DERIVED_TOOLS` (`stock-derived.ts`) -- no change needed there. Any output path the handler produces must be routed through `derivedContainerPath("vice_disassemble", path)`, never through `hostpath.ts`.

## The five-member importer list `hostpath-consumers.test.ts` now pins

```
containerpath.ts
install-resources.ts
stock-paths.ts
vice-proxy.ts
vice-sync.ts
```

Widening this list is a reviewed decision, not a mechanical fix for a failing test. A module implementing a `STOCK_DERIVED_TOOLS` entry may never be added to it.

## Task Commits

1. **Task 1: Create stock-derived.ts -- the derived-tool leaf and container-path discipline** - `282965b` (feat)
2. **Task 2: Add withDerivedTool() to stock-dispatch.ts and its behavioural tests** - `920f3c5` (feat)
3. **Task 3: Create hostpath-consumers.test.ts -- D-02's asserted absence, and fix the two stale consumer-set comments** - `5adfa03` (test; includes the Rule 1 `forwardToVice` wording fix to stock-derived.ts's header, discovered while running the plan's own verification gate)

## Files Created/Modified

- `.claude/mcp/vice/stock-derived.ts` - the derived-tool leaf: registry, container-path discipline, error type
- `.claude/mcp/vice/stock-derived.test.ts` - D-02 mechanism 1's behavioural test with non-vacuity control
- `.claude/mcp/vice/stock-dispatch.ts` - `withDerivedTool()` adapter added beside `withStockSession()`
- `.claude/mcp/vice/stock-dispatch.test.ts` - 6 new `withDerivedTool` behavioural tests appended
- `.claude/mcp/vice/hostpath-consumers.test.ts` - D-02 mechanism 2, the closed consumer-set test
- `.claude/mcp/vice/package.json` - `stock-derived.ts` added to `files[]` (34 entries)
- `.claude/mcp/vice/vice-proxy.ts` - stale host-path-consumer-set comment corrected (comment-only)
- `.claude/mcp/vice/vice-broker-client.ts` - stale host-path-consumer-set comment corrected (comment-only)

## Decisions Made

- Two-file split (leaf + adapter) to avoid a runtime cycle `stock-dispatch.ts -> stock-derived.ts -> stock-dispatch.ts`, exactly as the plan's `plan_decision_module_split` block specified.
- `hostpath-consumers.test.ts`'s derived-family absence check loops `STOCK_DERIVED_TOOLS` and derives an expected module name per tool (`stock-<toolname-without-vice_-prefix>.ts`), rather than hardcoding a fixed list of future file names -- this generalizes past `vice_disassemble` to any tool a later phase adds to the registry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stock-derived.ts's header named "forwardToVice" by name, which the plan's own verification gate forbids**
- **Found during:** Task 3, while running the plan's `<verification>` block (`grep -c 'forwardToVice' .claude/mcp/vice/stock-derived.ts` must output `0`)
- **Issue:** Task 1's header comment (written to explain the D-01/D-02 hazard) used the literal string "forwardToVice()" twice, which the plan-level verification explicitly forbids in this file (task 1's own acceptance criteria required `rewriteArguments`, `gatherWedgeEvidence`, `Phase 5 criterion 5` and `stock-paths.ts` by name, but never `forwardToVice`)
- **Fix:** Reworded the two sentences to describe the function ("the fork-forwarding function at vice-proxy.ts:2773") without naming it literally, preserving every required literal string
- **Files modified:** `.claude/mcp/vice/stock-derived.ts`
- **Verification:** `grep -c 'forwardToVice' stock-derived.ts` now outputs `0`; all 4 required literal strings still present; `npm run typecheck` and `node --test stock-derived.test.ts` still pass
- **Committed in:** `5adfa03` (bundled with Task 3's commit since it was discovered running that task's verification)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Correctness-only fix to a header comment; no behavioural change, no scope creep.

## Issues Encountered

- The plan's task 3 `<verify>` automated command (`grep -rn 'vice-mcp-selector-docs' .` across the whole `.claude/mcp/vice` directory, requiring zero matches) is broader than task 3's actual scope. Four pre-existing files unrelated to this plan (`build.ts`, `build-atomic.test.ts`, `host-scripts.test.ts`, `vice-proxy.test.ts`) legitimately reference the same deleted `vice-mcp-selector-docs.test.mjs`/`.ts` filename in their own historical-documentation comments, predating this plan and outside its `files_modified` list. This plan's own new `hostpath-consumers.test.ts` also necessarily names that filename once, per the plan's own Part A instruction to document the ground truth by name. Per the SCOPE BOUNDARY rule ("only auto-fix issues directly caused by the current task's changes"), those four unrelated files were left untouched. The two specific stale comments this task actually targeted (`vice-proxy.ts` lines ~104-110, `vice-broker-client.ts` lines ~23-26) are confirmed fixed: `grep -c "vice-mcp-selector-docs" vice-proxy.ts vice-broker-client.ts` both output `0`.

## Known Stubs

None -- both new leaf functions (`derivedContainerPath()`, `withDerivedTool()`) are fully implemented per the plan's spec; no tool is registered through the new adapter in this plan (04-05 registers `vice_disassemble`), which is an intentional, explicitly-stated non-goal of this plan, not a stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `withDerivedTool()` and `STOCK_DERIVED_TOOLS` are ready for 04-05 to register `vice_disassemble` with a one-line addition to `STOCK_DISPATCH_TABLE` (signature recorded above).
- `hostpath-consumers.test.ts` will fail loudly if 04-05's disassembler modules (`stock-disassemble.ts`, `disasm-*.ts`) ever import `hostpath.ts` -- confirmed by manually adding such an import to `stock-derived.ts` and observing the gate fail (then reverted).
- `STOCK_DISPATCH_TABLE` is unchanged at exactly 25 keys; the full regression suite (`npm run test:automated`, 969 tests) passes except one pre-existing, environment-specific failure unrelated to this plan (see below), and `npm run smoke` boots the stdio server cleanly with the new module in the graph.
- **Known pre-existing environment failure, not introduced by this plan:** `repo-root.test.ts`'s "path agreement ... is not under .claude" test fails in this worktree because the worktree itself is checked out under `.claude/worktrees/agent-.../`, so `repoRoot()` legitimately resolves to a path containing `.claude` as a path segment -- an artifact of the worktree execution environment, not a regression in this plan's code. Verified: `repoRoot()` returns `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-ac6364419df54f1fb` in this environment, which the test's own "not under .claude" assertion cannot satisfy from inside a worktree at this location.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-derived.ts`
- FOUND: `.claude/mcp/vice/stock-derived.test.ts`
- FOUND: `.claude/mcp/vice/hostpath-consumers.test.ts`
- FOUND commit `282965b` (Task 1)
- FOUND commit `920f3c5` (Task 2)
- FOUND commit `5adfa03` (Task 3)

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*
