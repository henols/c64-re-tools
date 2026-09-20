---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
plan: 08
subsystem: infra
tags: [text-channel, channel-lock, mutex, incident-attribution, node-test]

# Dependency graph
requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    provides: "63-07's relay-teardown-before-kill work and its shared SESS-05 requirement"
provides:
  - "withTextTool() declares its operation on the grant only after channel-lock.ts's shared mutex is actually held, symmetric with stock-dispatch.ts's withChannelLockHeld()/declareOperation()"
  - "A cross-channel-contention test proving a queued text call declares nothing until granted, and a timeout declares/clears nothing"
affects: [text-tools.ts, text-tools.test.ts, incident-record.ts, vice-broker.mts]

# Actuals (#2632)
actuals:
  tokens: 3496
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "declareTextOperation()/declareOperation() symmetric pair: declare only once the shared cross-channel mutex is held, clear before it is released, never outside that locked section"

key-files:
  created: []
  modified:
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts

key-decisions:
  - "Case 3 (symmetry) used a source-symmetry assertion (line-order comparison in both files' own source) rather than a live binary-channel drive through dispatchStock(), because text-tools.test.ts carries no binary-monitor stub session harness -- the only existing binary-tool coverage in the file spawns a real emulator, too heavy to justify for a static ordering fact. Plan explicitly authorized this fallback."

requirements-completed: [SESS-05]

coverage:
  - id: D1
    description: "withTextTool() declares the operation on the grant only after channel-lock.ts's shared mutex is granted, via a new declareTextOperation() helper mirroring stock-dispatch.ts's declareOperation()"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-tools.test.ts#withTextTool declares the operation only AFTER the shared cross-channel mutex is granted"
        status: pass
    human_judgment: false
  - id: D2
    description: "A text tool whose lock acquisition times out declares nothing and clears nothing"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-tools.test.ts#withTextTool that times out acquiring the lock declares nothing and clears nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both channel wrappers (text and binary) declare only after acquiring the shared lock, proven by cross-channel contention (text side) and source-symmetry assertion (binary side, per the plan's authorized fallback)"
    requirement: SESS-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/text-tools.test.ts#both channel wrappers declare only after acquiring the shared lock"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 08: Declare-After-Lock Ordering for the Text Channel Summary

**`withTextTool()` now declares its operation on the grant only after channel-lock.ts's shared cross-channel mutex is actually held, mirroring `stock-dispatch.ts`'s `declareOperation()`/`withChannelLockHeld()` ordering exactly, proven under genuine binary-vs-text contention.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-20
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `declareTextOperation(lease, name)` to `text-tools.ts` — the text-channel counterpart of `stock-dispatch.ts`'s `declareOperation()` — and moved the declare/clear pair inside the `withTextChannelLock()` callback so a text tool never declares while merely queued behind a running binary operation.
- Removed the pre-lock declare and the outer-`finally` clear that previously let a queued text call overwrite `GrantRecord.operation` (a single field per grant, `handleOperationNote()`'s own model) with a name that had not started running, and let it erase a genuinely-running binary operation's declaration on its own way out.
- Proved the fix under real cross-channel contention: a case that acquires `channel: "binary"` first, starts the text handler without awaiting it, asserts nothing was declared while queued, then releases and asserts the declare/clear pair landed in order.
- Proved the timeout path declares and clears nothing at all, so a refused-and-abandoned call cannot perturb another channel's field.
- Full suite: 4263 tests / 4181 pass / 0 fail / 82 skipped (baseline after plan 63-07: 4260/4178/0/82 — this plan's 3 new passing cases account for the entire delta, no regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the text operation only once the shared lock is actually granted** - `b28d59b9` (fix)
2. **Task 2: Prove the ordering under genuine cross-channel contention** - `04a16f2d` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/text-tools.ts` - Added `declareTextOperation()`; moved the declare/clear pair inside `withTextChannelLock()`'s callback; deleted the pre-lock declare and the outer-`finally` clear; added a `WHAT NOT TO DO` bullet naming the prohibition.
- `src/mcp/vice/text-tools.test.ts` - Extended `makeStubBrokerControl()`/`makeDeps()` with an optional recorder array; added three new cases proving the ordering under contention, under timeout, and by source-symmetry.

## Decisions Made

- **Symmetry case (Task 2, case 3) took the source-symmetry form**, not a live binary-side drive. `text-tools.test.ts` has no binary-monitor stub session harness — the file's only existing binary-tool coverage (the LIVE case near the end of the file) spawns a real VICE emulator process, which is far too heavy to stand up solely to prove a static ordering fact. The plan's own action explicitly authorized this fallback ("If driving the binary side from this file proves to need a harness this file does not have, replace this third case with a source-symmetry assertion instead"). The case reads both `text-tools.ts` and `stock-dispatch.ts` at test time and asserts, in each file's own source, that the line calling the declare function appears strictly after the line calling the lock-acquisition function.
- **`handleOperationNote()`'s one-operation-per-grant model was left unchanged**, per the plan's `<planner_findings>` #4 — this plan only fixed the ordering of callers into that existing model, never pluralized or re-keyed the field.

## Deviations from Plan

None - plan executed exactly as written. Task 1 carried a `tdd="true"` attribute, but the plan's own task split places the regression test in a separate Task 2 (a fix-then-regression-test structure for a gap-closure defect, not a single-task RED-GREEN cycle) — there was no failing test scoped to Task 1 alone to write first, so the canonical RED phase did not apply within Task 1's own boundary. Task 1 was verified via its own `<verify>`/`<acceptance_criteria>` (typecheck plus structural grep checks) exactly as the plan specified, and Task 2's tests independently confirm the corrected behavior end to end. No `## TDD Gate Compliance` violation is recorded because the plan's `type: execute` frontmatter (not `type: tdd`) and `workflow.tdd_mode: false` mean the strict RED/GREEN gate sequence was never the applicable contract here — flagged here for visibility only.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SESS-05 is now fully closed: both sibling plans declaring it (63-07 and this plan) have landed, and `requirements.ready-ids` confirmed it ready before marking complete.
- No `.mts` file was touched by this plan's own commits, so no host-bound `resources/*.mjs` rebuild is required.
- 63-VERIFICATION.md's GAP 1 third `missing:` item (WR-01, the ordering PARTIAL) is closed by this plan.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: src/mcp/vice/text-tools.ts
- FOUND: src/mcp/vice/text-tools.test.ts
- FOUND commit: b28d59b9 (fix, Task 1)
- FOUND commit: 04a16f2d (test, Task 2)
- `grep -c "function declareTextOperation" src/mcp/vice/text-tools.ts` = 1
- Plan-level `<verification>`: typecheck exit 0; `node --test --test-reporter=tap text-tools.test.ts` reports `# fail 0` with all three new case names present; `npm --prefix src/mcp/vice test` exits 0 with 4263/4181/0/82 (baseline 4260/4178/0/82 plus these 3 cases, no regressions); `withTextTool()`'s own body contains no direct `noteOperation` call (verified `outer_declare=0`); no `.mts` file appears in this plan's own commits.
