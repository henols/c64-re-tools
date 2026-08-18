---
phase: 07-cycle-timing-and-wedge-triage
plan: 07
subsystem: stock-vice-backend
tags: [wedge-triage, incident-record, broker-control-plane, checkpoint-trap, liveness-bracket, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-06's runStockLivenessBracket()/gatherStockCheckpointTrapEvidence()/resolveStockLiveIrqHandler() (stock-diagnose.ts) -- reused verbatim as this plan's own evidence primitives"
provides:
  - "gatherStockWedgeEvidence() -- the stock-native replacement for the fork's rewriteArguments()-coupled gatherWedgeEvidence(): four deadline-bounded, never-throwing evidence items (bracket, registers, checkpoints, irqHandler), with screenshot/snapshot deliberately absent"
  - "handleRecycleStock() -- vice_recycle's full stock implementation: reason gate, record-before-RPC ordering (D-17), per-outcome finalisation, and post-recycle teardown via stockDisconnect()"
affects: [07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "captureStep()'s deadline read fresh per call via an exported stockCaptureStepTimeoutMs() function, not a module-load-time constant -- deliberately diverging from vice-proxy.ts's own CAPTURE_STEP_TIMEOUT_MS so this module's own test suite can drive a sub-50ms deadline within one process (the same ESM static-import-hoisting rationale 07-06's diagnoseSessionTimeoutMs()/diagnoseBracketWindowMs() already established for exactly this reason)"
    - "A frame_position-route bracket's within-one-frame position delta is folded into the SAME `cycles` field formatEvidenceValue() already renders (as a descriptive string, not a bare number) rather than adding a second rendered field to incident-record.ts, which this plan's files_modified scope excludes from editing"
    - "The checkpoints evidence item reuses gatherStockCheckpointTrapEvidence() wholesale (not a direct vice_checkpoint_list call) even though that also re-resolves the IRQ handler and PC as a side effect -- reuse of the existing exported primitive, not re-derivation, is the explicit instruction this plan carries forward from 07-06"

key-files:
  created:
    - .claude/mcp/vice/stock-recycle.ts
    - .claude/mcp/vice/stock-recycle.test.ts
  modified: []

key-decisions:
  - "handleRecycleStock re-consults deps.ensureLease() itself (rather than reading fields off session) to obtain the HeldLease -- session.brokerControl is the narrowed claim/release-only StockConnectBrokerControl, which does not carry recycle()/targetId; this re-consultation is free per ensureStockSession()'s own documented rationale (it already ran once acquiring the session)"
  - "A non-ok lease outcome's message is returned verbatim (never re-worded), per the plan's own instruction; the lease===null (VICE_MCP_URL override) case gets a composed refusal since there is no upstream message to reuse for it"
  - "recycleAckOutcomeMessage() is redeclared locally rather than imported from vice-proxy.ts (which this module must never import) -- the SAME broker produces this ack shape for both backends since the control-plane RPC is transport-independent, so the per-outcome wording is deliberately the same vocabulary"
  - "Each non-ok ControlRecycleResult kind collapses to exactly one of three finalised outcomes (broker_gone, timeout, internal), mirroring the fork's own three-way mapping rather than inventing a fourth -- verified with one test per outcome bucket, including a representative 'protocol' kind for the internal bucket"

requirements-completed: [TIME-04]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 07 Plan 07: vice_recycle (stock) -- stock-native evidence gatherer + record-before-RPC recycle Summary

**Stock `vice_recycle`: a four-item stock-native evidence gatherer built entirely on plan 07-06's exported primitives (no screenshot), feeding an incident record that is provably on disk -- evidence section complete -- before the broker's destructive recycle RPC is ever sent.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-18
- **Tasks:** 3 completed
- **Files modified:** 2 (both newly created)

## Accomplishments
- `gatherStockWedgeEvidence()` -- assembles `bracket`/`registers`/`checkpoints`/`irqHandler` evidence items, each raced against a per-step deadline via a ported `captureStep()`, so a wedged machine that fails every read still produces a fully populated (four `available: false`, non-empty-reason) evidence object rather than aborting or stalling; `screenshot`/`snapshot` are left genuinely absent (`undefined`, never `{available:false}`) since `SHOT-*` was cut from this milestone's scope and stock has no `vice_display_screenshot`
- A bracket whose `advanced` came back `null` (cannot measure at all) is reported unavailable rather than a fabricated zero -- the "honest zero only on a genuine no-advance measurement" invariant from must_have 5
- `handleRecycleStock()` -- reason gate first (before any lease consultation, gather, or write); re-consults `deps.ensureLease()` for the `HeldLease` carrying `brokerControl`/`targetId`; gathers evidence, writes the incident record, then sends `lease.brokerControl.recycle(lease.targetId)` -- in that order and no other, with no branch between the write and the RPC that could reach the RPC with the write skipped
- Every non-ok recycle outcome (`broker_gone`/`deadline`/anything else) finalises the record with a distinct outcome and returns a well-formed refusal naming the record path; an ok RPC whose ack was not a successful kill (`identity_refused`, etc.) finalises with the ack's own outcome and does **not** tear the session down
- A confirmed kill (`already_exited`/`sigterm`/`sigkill`) finalises the record with outcome `ok`, builds the answer via `stockAnswer()` (reading `runState` from the still-connected client) **before** calling `stockDisconnect()`, releasing the socket and the broker-side monitor claim together (CR-05) without ever importing `clearHeldStockSession()`
- 18 unit tests: full gather (healthy + all-rejects + checkpoint-list-refusal), the exported `stockCaptureStepTimeoutMs()`'s default/override, a sub-50ms never-settles deadline case, the three-way reason gate, non-ok/null lease refusals, **the load-bearing ordering test** (the recycle RPC stub itself reads the incidents directory and observes exactly one record file with a complete evidence section already on disk at RPC time), no-screenshot, degraded-evidence-still-recycles, one test per outcome bucket, the refused-ack case, the success path (`stockDisconnect` called exactly once), and a structural comment-stripped source gate -- 18/18 pass in ~3s, no test writes outside its own temp `VICE_INCIDENTS_DIR`

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: gatherStockWedgeEvidence() and handleRecycleStock()** - `a884d56` (feat) -- both tasks landed in a single commit; the two functions were authored together in one file write rather than as two separable diffs, so the task-level commit boundary collapses to one commit covering both
2. **Task 3: stock-recycle.test.ts** - `02ab2e3` (test)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-recycle.ts` - `gatherStockWedgeEvidence`, `handleRecycleStock`, and the exported `stockCaptureStepTimeoutMs()` -- the full stock `vice_recycle` implementation. Registration into `STOCK_DISPATCH_TABLE`/`tools-manifest.stock.json` is explicitly deferred to plan 07-09 per this plan's own objective; `stock-dispatch.ts`, `stock-derived.ts`, `tools-manifest.stock.json` and `package.json` were not touched.
- `.claude/mcp/vice/stock-recycle.test.ts` - 18 tests covering the evidence gatherer's degradation behaviour, the deadline seam, the reason gate, the record-before-RPC ordering (observed from inside the RPC stub itself), no-screenshot, degraded-evidence-still-recycles, per-outcome finalisation, the success path's teardown, and a structural source-grep gate

## Decisions Made
- `stockCaptureStepTimeoutMs()` is a function reading `VICE_RECYCLE_CAPTURE_TIMEOUT_MS` fresh on every call rather than a `const` computed once at import time (unlike the fork's own `CAPTURE_STEP_TIMEOUT_MS`) -- this is a deliberate deviation from the plan's literal `STOCK_CAPTURE_STEP_TIMEOUT_MS` naming, made because a module-load-time constant would be untestable with a sub-50ms deadline within this test file's single process (ESM static-import hoisting runs the import before any test-file statement could set the environment variable first) -- exactly the same rationale 07-06 already used and documented for `diagnoseSessionTimeoutMs()`/`diagnoseBracketWindowMs()`. It still defaults to 8000 and reads the same `VICE_RECYCLE_CAPTURE_TIMEOUT_MS` the fork's own step deadline reads, so the "one knob governs both backends" requirement holds.
- `bracketEvidenceValue()` folds a `frame_position`-route bracket's within-one-frame position delta and its explanatory note into the single `cycles` field `formatEvidenceValue()` already renders (as a string rather than a bare number), rather than modifying `incident-record.ts` to render a second field -- `incident-record.ts` is outside this plan's `files_modified` scope.
- `handleRecycleStock` reads `session.deps.readEpochFn ?? readEpoch` for the pre-kill epoch snapshot, matching `stockReconnect()`'s own testability convention, rather than always calling the real `readEpoch()` directly.

## Deviations from Plan

**1. [Rule 3 - Blocking] `STOCK_CAPTURE_STEP_TIMEOUT_MS` implemented as an exported function, not a `const`**
- **Found during:** Task 1 (porting `captureStep()`)
- **Issue:** The plan's own acceptance criteria require a test asserting "a step whose promise never settles is cut off at the deadline... asserted with a test-set deadline under 50ms" within the same test process that also exercises the 8000ms production default. A module-level `const` computed from `process.env` at import time cannot be overridden by a same-file test after the fact -- ESM import hoisting runs the static `import` (and therefore the constant's initializer) before any statement in the importing test file executes, so setting `process.env.VICE_RECYCLE_CAPTURE_TIMEOUT_MS` in the test file would arrive too late.
- **Fix:** Implemented `stockCaptureStepTimeoutMs()` as an exported function reading the environment variable fresh on every call -- the exact pattern 07-06's `stock-diagnose.ts` already established (and documented) for `diagnoseSessionTimeoutMs()`/`diagnoseBracketWindowMs()` for the identical reason. Default (8000) and the environment variable name (`VICE_RECYCLE_CAPTURE_TIMEOUT_MS`, shared with the fork) are unchanged from the plan's own specification.
- **Files modified:** `.claude/mcp/vice/stock-recycle.ts` (function definition), `.claude/mcp/vice/stock-recycle.test.ts` (the deadline and default/override tests)
- **Verification:** `stockCaptureStepTimeoutMs()`'s default/override test and the sub-50ms never-settles test both pass; `npx tsc --noEmit` exits 0
- **Committed in:** `a884d56` (Task 1+2 commit), test in `02ab2e3`

---

**Total deviations:** 1 auto-fixed (1 blocking-issue fix, Rule 3)
**Impact on plan:** Necessary for the plan's own acceptance criteria to be testable at all; no scope creep, no behavioural difference from the plan's stated default/env-var contract.

## Issues Encountered

None beyond the deviation above. `npm run test:automated` (1355 top-level cases, 1524 total including nested) reports 1 pre-existing failure: `repo-root.test.ts`'s "path agreement" test -- the same documented worktree-path artifact already noted in 07-01/07-02/07-05/07-06's summaries and `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md`, unrelated to this plan's new files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`gatherStockWedgeEvidence()` and `handleRecycleStock()` are fully implemented and unit-tested but not yet wired into `STOCK_DISPATCH_TABLE`/`tools-manifest.stock.json` -- that registration is explicitly plan 07-09's job, matching this plan's own stated output boundary. `stock-dispatch.ts`, `stock-derived.ts`, `tools-manifest.stock.json` and `package.json` were left untouched, as instructed. No blockers for 07-09.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
