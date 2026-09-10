---
phase: 43-the-runtime-evidence-layer
plan: 07
subsystem: testing
tags: [evidence, structural-guard, durability, concurrency, sigkill, documentation]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 02)
    provides: "SCHEMA_VERSION 4's anno_evid_exec table and its insertExecObservations/listExecObservations/deleteExecObservationsForRun store functions -- the write/reset surface this plan's concurrent planting drives directly"
  - phase: 43-the-runtime-evidence-layer (plan 06)
    provides: "anno_evid_disagreements/anno_evid_runs/anno_evid_reset -- the four real answers this plan's structural guard walks"
provides:
  - "evid-report-keys.test.ts: a derived structural guard walking every anno_evid_* verb's real JSON answer, refusing a combined-figure/rate/exhaustiveness key and demanding a denominator beside every count -- EVID-04's fourth control"
  - "a source-traced proof that RuntimeExecClass has exactly two members and no shipped evidence-family module assigns a runtime literal outside it"
  - "anno-durability-mutator.mjs's insert-evid mode gains an optional readiness-marker argv token, reused by a genuinely concurrent two-run-identity SIGKILL planting and a reset-then-relaunch planting in anno-durability.test.ts -- EVID-05's criterion 5"
  - "docs/phase43-runtime-evidence-layer.md: the shipped layer's four surfaces, its one positive fact, its four reconciliation buckets, its run identity, and six named accepted limits"
affects: []

# Actuals (#2632)
actuals:
  tokens: 12496
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A structural guard's SCOPE is derived from ANNO_TOOL_DEFINITIONS by the family's own name prefix and asserted equal to the guard's fixture table in both directions, rather than a hand-typed verb list -- a fifth evidence verb added later without an entry fails by name"
    - "A denominator-adjacency walk climbs an explicit ancestor stack rather than checking only the immediate object, so a nested count (e.g. a per-run observationCount) can satisfy the rule via an enclosing answer's denominator without requiring every nested object to carry its own copy"
    - "once(child, \"exit\") must be captured immediately after spawn(), before any blocking wait -- a mutator mode with a near-instant self-SIGKILL ending can exit before a listener attached later ever registers, silently missing the event and hanging the process (Node's own \"unsettled top-level await\" diagnostic is the tell)"

key-files:
  created:
    - src/mcp/vice/evid-report-keys.test.ts
    - docs/phase43-runtime-evidence-layer.md
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-durability-mutator.mjs
    - src/mcp/vice/anno-durability.test.ts
    - src/mcp/vice/textmon-seam.test.ts
    - .planning/phases/43-the-runtime-evidence-layer/43-RESEARCH.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "anno_evid_reset's answer gained a denominator (existing.length, the pre-delete row count for that identity) -- the one real gap the new structural guard's own clean control found in shipped code, not merely in a planted fixture."
  - "The concurrent planting's identity A carries a batch of exactly one observation, matching the mutator's own single-raw-insert design (decision 2 in anno-durability-mutator.mjs) rather than adding a batch capability to the mutator; the all-or-nothing predicate is written generically so it would still hold at a larger batch size."
  - "Child A is killed by the PARENT (child.kill('SIGKILL')) immediately after its readiness marker appears, in addition to the mode's own unconditional self-kill ending -- either kill satisfies 'no clean close', and the marker is what lets the parent order a genuinely concurrent second writer (identity B) without sleeping."

requirements-completed: [EVID-04, EVID-05]

coverage:
  - id: D1
    description: "A derived structural guard walks every real anno_evid_* answer and refuses a combined-figure, rate, or exhaustiveness key, non-vacuously (visits a nested disagreement row), with a planted control proving the walk can fail"
    requirement: EVID-04
    verification:
      - kind: unit
        ref: "evid-report-keys.test.ts#direction 2 (banned keys), clean control / planted control"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every count-shaped key in every real evidence answer carries a denominator, in its own object or an enclosing answer -- including anno_evid_reset, a real gap this plan's own guard found and fixed"
    requirement: EVID-04
    verification:
      - kind: unit
        ref: "evid-report-keys.test.ts#direction 3 (denominator adjacency), clean control / planted control"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard's verb scope is derived from ANNO_TOOL_DEFINITIONS by family name prefix and asserted equal to the guard's own fixture table in both directions, so a fifth evidence verb added later without an entry fails by name"
    requirement: EVID-04
    verification:
      - kind: unit
        ref: "evid-report-keys.test.ts#direction 1 (scope completeness), clean control / planted control"
        status: pass
    human_judgment: false
  - id: D4
    description: "RuntimeExecClass has exactly two members and no shipped evidence-family module (evid-reconcile.ts, evid-ingest.ts, anno-types.ts) assigns a runtime literal outside it, proven by a source scan over shippedTsModules() with comments stripped"
    requirement: EVID-04
    verification:
      - kind: unit
        ref: "evid-report-keys.test.ts#direction 4 (no runtime data branch), clean control / planted control"
        status: pass
    human_judgment: false
  - id: D5
    description: "A bracket's validity survives a concurrent writer: two distinct run identities write into one store concurrently, one is SIGKILLed after a readiness marker, and a fresh process finds the survivor's rows the complete union of its seed and second batch, the casualty all-or-nothing, and the block table untouched"
    requirement: EVID-05
    verification:
      - kind: unit
        ref: "anno-durability.test.ts#EVID-05 concurrent planting"
        status: pass
    human_judgment: false
  - id: D6
    description: "A relaunch after a reset -- a re-measure from a separate process -- leaves a neighbour run identity's rows byte-identical to its seed"
    requirement: EVID-05
    verification:
      - kind: unit
        ref: "anno-durability.test.ts#EVID-05 relaunch planting"
        status: pass
    human_judgment: false
  - id: D7
    description: "The shipped runtime evidence layer -- its four surfaces, its one positive fact, its four reconciliation buckets, run identity, and at least five named accepted limits -- is recorded in one document that points at plan 43-01's A/B verdict rather than restating it"
    verification:
      - kind: unit
        ref: "node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts anno-seam.test.ts capture-seam.test.ts (85/85 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 7: The Structural Guard and the Concurrency Proof Summary

**A derived structural guard over every `anno_evid_*` answer at once, a genuinely concurrent two-identity SIGKILL planting for `anno_evid_reset`, and the phase's own findings document -- closing EVID-04's fourth control and EVID-05's criterion 5.**

## Performance

- **Duration:** ~45 min
- **Started:** ~2026-09-10T13:40:00+02:00 (approx.)
- **Completed:** 2026-09-10T14:18:18+02:00
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- `evid-report-keys.test.ts`: one derived key walk drives all four real `anno_evid_*` verbs against a shared planted-disagreement fixture store, refuses any report key matching a combined-figure/rate/exhaustiveness vocabulary (non-vacuously, reaching a nested disagreement row), demands a denominator beside every count-shaped key (climbing an ancestor stack so a nested count can be satisfied by an enclosing answer's denominator), and source-scans the evidence family to prove `RuntimeExecClass` has exactly two members with no runtime literal escaping it. Every direction pairs a planted control with a clean control over the real tree, and the guard's own scope is derived from `ANNO_TOOL_DEFINITIONS` rather than a hand-typed list of four verbs.
- `anno-durability-mutator.mjs`'s `insert-evid` mode gains one optional argv token (a readiness-marker path), written after the store opens and before the insert starts, reusing the exact `commit`/`no-commit` writer selection every other mode already uses -- no second write sequence.
- `anno-durability.test.ts` gains two EVID-05 plantings: a genuinely concurrent two-run-identity SIGKILL (two spawned children racing against the same store file, never a second sequential run) proving the survivor's rows are the complete union of its seed and second batch and the casualty is all-or-nothing, with the block table proven untouched throughout; and a reset-then-relaunch from a separate process proving a neighbour identity's rows stay byte-identical.
- `docs/phase43-runtime-evidence-layer.md` records the shipped layer's four surfaces, its one positive fact, its four reconciliation buckets, its run-identity composite (pointing at plan 43-01's A/B findings document rather than restating the verdict), and six named accepted limits.

## Task Commits

Each task was committed atomically:

1. **Task 1: One derived key walk refuses a rate and demands a denominator across every evidence answer** - `912e4301` (test)
2. **Task 2: A bracket survives a concurrent writer being killed mid-ingest** - `08639169` (test)
3. **Task 3: Record the shipped layer, its four surfaces and its accepted limits** - `e5b365e8` (docs)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/mcp/vice/evid-report-keys.test.ts` - the derived structural guard: four named direction predicates, each with a planted and a clean control, plus the mechanical `files[]`-absence check
- `docs/phase43-runtime-evidence-layer.md` - the phase's own findings document
- `src/mcp/vice/anno-tools.ts` - `dispatchEvidReset` gained `denominator: existing.length`
- `src/mcp/vice/anno-durability-mutator.mjs` - `insert-evid`'s optional readiness-marker argv token
- `src/mcp/vice/anno-durability.test.ts` - the two new EVID-05 plantings
- `src/mcp/vice/textmon-seam.test.ts` - `evid-report-keys.test.ts` added to the declared access-map literal-consumer set
- `.planning/phases/43-the-runtime-evidence-layer/43-RESEARCH.md` - Open Questions items 1 and 3 now point at the shipped doc
- `.planning/REQUIREMENTS.md` - EVID-04/EVID-05 marked complete

## Decisions Made
- **`anno_evid_reset` gained a denominator.** The new guard's own clean control over the real tree found that `anno_evid_reset`'s answer carried `observationsRemoved` with no denominator anywhere -- a genuine gap in shipped code, not merely a planted violation. Fixed by adding `denominator: existing.length` (the bracket's pre-delete row count), following the exact discipline every other evidence answer already uses.
- **The concurrent planting's identity A batch is exactly one observation**, matching `mutateEvidence()`'s own single-raw-insert design rather than adding a batch capability the mutator's own decision record explicitly reserves against. The all-or-nothing predicate is written as one derived check over the observed row set, so it would still hold correctly at a larger batch size without modification.
- **The parent kills child A externally, in addition to the mode's own unconditional self-kill.** `child.kill("SIGKILL")` fires the instant A's readiness marker appears, while a second child (identity B) writes concurrently against the same store file -- genuine cross-process contention, not a second sequential run. Killing an already-exited process is harmless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `anno_evid_reset`'s answer had no denominator**
- **Found during:** Task 1, writing the denominator-adjacency direction's clean control
- **Issue:** `dispatchEvidReset` returned `{store, revision, changed, observationsRemoved}` with no `denominator` anywhere in the object -- exactly the soundness gap EVID-04 and this plan's own guard exist to catch, on shipped code rather than a fixture.
- **Fix:** Added `denominator: existing.length` (the identity's pre-delete row count) to `dispatchEvidReset`'s return value.
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `evid-report-keys.test.ts`'s direction 3 clean control passes against the real `anno_evid_reset` answer; `node --test anno-tools.test.ts` (86/86, 1 opt-in skip) stays green.
- **Committed in:** `912e4301` (Task 1 commit)

**2. [Rule 1 - Bug] The first concurrent-planting draft hung indefinitely**
- **Found during:** Task 2, stress-testing the new concurrent test for flakiness
- **Issue:** The first draft called `await once(childB, "exit")`/`await once(childA, "exit")` only AFTER `waitForMarker()` and the parent's kill call. `insert-evid`'s own ending (open, marker, insert, commit, self-SIGKILL) is near-instant -- well under `waitForMarker`'s own 50ms poll interval -- so both children routinely exited before the listeners were ever attached. `once()` registered against an event that had already fired waits forever for one that will not come again, and with no live child process left, the event loop had nothing else to do: Node printed its own "Detected unsettled top-level await" diagnostic and the process idled rather than crashing or timing out. Reproduced deterministically in a standalone script (30/30 hangs before the fix, 0/30 after) and in the real test file (hung on the first `--test-name-pattern=EVID-05` run; 8/8 stress runs clean after the fix).
- **Fix:** Capture `once(childA, "exit")`/`once(childB, "exit")` immediately after both `spawn()` calls, before `waitForMarker()` or any kill -- registering the listener before either child has a chance to exit.
- **Files modified:** `src/mcp/vice/anno-durability.test.ts`
- **Verification:** 30 standalone iterations of the isolated race and 8 stress runs of the real test file, all clean; the full `anno-durability.test.ts` suite (12/12) and `npm run typecheck` both green.
- **Committed in:** `08639169` (Task 2 commit)

**3. [Rule 3 - Blocking] `textmon-seam.test.ts`'s declared literal-consumer set needed a new entry**
- **Found during:** Task 3's `npm run test:automated` full-suite pass
- **Issue:** `evid-report-keys.test.ts`'s local `memmapReplyText()` fixture helper spells the access-map header literal (`"addr: IO  ROM RAM"`), which `textmon-seam.test.ts`'s declared literal-consumer set for the "access map" format did not yet name -- a new, unreviewed consumer this guard is designed to require an entry for, following the exact precedent already recorded for `anno-tools.test.ts`/`evid-ingest.test.ts`.
- **Fix:** Added an entry citing this plan and its own reason.
- **Files modified:** `src/mcp/vice/textmon-seam.test.ts`
- **Verification:** `node --test textmon-seam.test.ts` (33/33); `npm run test:automated` settled back to the documented 3-failure floor.
- **Committed in:** `e5b365e8` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 missing-critical, 1 bug, 1 blocking structural-guard maintenance).
**Impact on plan:** All three were necessary for correctness or to keep pre-existing structural guards meaningful and green. No scope creep.

## Issues Encountered
`npm run test:automated` showed 5 failures on the first post-Task-3 run: the documented 3-failure floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`) plus 2 extra, both at the already-documented intermittent `audit-root-args.test.ts:982` race. A re-run settled back to exactly the documented 3-failure floor, none outside it, matching the pattern recorded in every prior plan's own self-check this phase.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This is the final plan of Phase 43. All six requirements (EVID-01 through EVID-06) are now `Complete` in `.planning/REQUIREMENTS.md`.
- The runtime evidence layer's own findings document (`docs/phase43-runtime-evidence-layer.md`) is the one place a future phase reads for what shipped, its one positive fact, and its accepted limits.
- No stubs, no skipped tests, no unrun `<verify>` commands from this plan.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `src/mcp/vice/evid-report-keys.test.ts` and `docs/phase43-runtime-evidence-layer.md` confirmed present on disk with `[ -f ]`.
- All three task commit hashes (`912e4301`, `08639169`, `e5b365e8`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `node --test evid-report-keys.test.ts` (9/9, all planted controls failing their subject), `node --test anno-durability.test.ts` (12/12, including 8 additional stress runs of the concurrent case with no hang), `npm run typecheck` (clean), `package.json`'s `files[]` containing neither new test file nor the mutator, `docs/phase43-runtime-evidence-layer.md` carrying six `## ` headings and naming every shipped surface, `node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts anno-seam.test.ts capture-seam.test.ts` (85/85), and `npm run test:automated` (settled at the documented 3-failure floor on re-run).
- `pgrep -x x64sc` empty -- no live VICE broker or emulator was started during this plan (pure module/store/mutator work, no live emulator interaction needed).
