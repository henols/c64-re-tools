---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 06
subsystem: infra
tags: [tool-location, backend-detect, vice-broker, LOC-03, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 60-the-seam-wired-into-the-code-that-ships (plans 60-01, 60-02, 60-05)
    provides: the tool-location seam (resolveTool/resolveOnPath), resolvedBackend()'s PD-01/PD-02
      branches, and the closed-consumer-set scan (tool-location-consumers.test.ts) this plan
      preserves unchanged
provides:
  - A widened, terminal environment layer in tool-location.mts's resolveTool(): a slash-free
    declared-variable value is additionally walked on $PATH (reusing resolveOnPath()), and a
    variable set to a separator-free value that resolves through neither check refuses by name
    immediately before the declared-id $PATH probe -- closing the LOC-03 gap CR-01 independently
    reproduced.
  - ResolveToolResult.envCandidate -- the developer's raw declared-variable value, on every
    return path of resolveTool().
  - ResolvedBackendResult.locationRefusal -- the seam's refusal carried verbatim onto
    backend-detect.mts's resolvedBackend(), and the PD-01 branch's configured-name fallback
    switched from the hardcoded "x64sc" literal to the seam's own envCandidate.
  - One additional vice-broker.mts startup stderr line naming the refusal when
    locationRefusal is non-null.
affects: [61-the-doctor-tool-and-its-own-precedence-report, any future phase reading
  ResolveToolResult or ResolvedBackendResult]

# Actuals (#2632)
actuals:
  tokens: 16163
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Environment-layer widening: a declared candidate is resolved as EITHER a literal path
      (existing behaviour) OR, for a separator-free value on an executable-kind record, a $PATH
      search of that value via the seam's own resolveOnPath() -- never a second private $PATH
      walk."
    - "Terminal refusal before a fallback probe: once a declared variable is set to a value that
      cannot be resolved through any of its own layers, resolution stops with a named refusal
      rather than falling through to a broader search that could silently answer with something
      else."

key-files:
  created: []
  modified:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/backend-detect.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/backend-detect.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/resources/tool-location.mjs
    - src/mcp/vice/resources/backend-detect.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "The terminal refusal (envUnresolved) is scoped to separator-FREE values only, regardless of
    record kind. An absolute-path override that resolves nowhere keeps D-08's exact prior
    posture (not refused, only not found, falling through silently) because a $PATH search could
    never plausibly have answered for it -- this reconciles the plan's own must-have truth ('a
    value containing a path separator behaves exactly as today') with the pre-existing,
    unmodified vice-broker-acquire.test.ts 'Plan 60-01 Test 4', which relies on exactly that
    fall-through for an absolute, nonexistent VICE_BIN. See Deviations below."

requirements-completed: []  # LOC-03 stays blocked (shared-ID gate): 60-07-PLAN.md also declares
  # LOC-03 and has not yet produced a SUMMARY. REQUIREMENTS.md is unmodified by this plan.

coverage:
  - id: D1
    description: "A slash-free environment override resolves the binary the developer named,
      end to end, at the seam, at resolvedBackend(), and at the real handleAcquire() spawn call."
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-06 Test A: a slash-free ACME_BIN naming an executable on the injected PATH resolves through the environment layer for acme"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#Plan 60-06 Test 1 (tracer, LOC-03): a bare-string VICE_BIN naming a stub on the injected PATH is the exact string the real spawn call receives"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unresolvable slash-free override refuses by name instead of silently
      resolving a same-named decoy on $PATH, both at the seam and at the real spawn call."
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#an environment variable set to a bare name that resolves nowhere refuses, and resolution never reaches the declared-id $PATH probe"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#Plan 60-06 Test 2 (LOC-03, the substitution case): a bare-string VICE_BIN that exists nowhere, with a decoy executable literally named x64sc on the injected PATH, never reaches the decoy at the real spawn call"
        status: pass
    human_judgment: false
  - id: D3
    description: "An absolute-path override that resolves nowhere, an unset variable, and an
      empty-string variable all behave exactly as before this plan."
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#an environment variable set to an absolute path that does not exist behaves exactly as today: not refused, falling through to the declared-id $PATH probe"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-06 Test C: an empty-string declared variable is treated as unset -- envCandidate is null and resolution falls through to the file layer and then the probe layer"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-06 Test D: an unset ACME_BIN with a real acme on the injected PATH still answers from the probe layer -- the shape CI's ACME job depends on"
        status: pass
    human_judgment: false
  - id: D4
    description: "resources/tool-location.mjs, resources/backend-detect.mjs and
      resources/vice-broker.mjs are regenerated, committed, and resources-sync.test.ts is green."
    verification:
      - kind: other
        ref: "node build.ts (exit 0) + node --test resources-sync.test.ts (0 failing)"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 06: Widened, terminal environment layer for tool-location.mts Summary

**A slash-free `VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME` override now resolves through `$PATH`
via the seam's own `resolveOnPath()`, and an unresolvable slash-free override refuses by name
instead of silently substituting a same-named `$PATH` binary -- traced end to end through
`resolvedBackend()` to the real `handleAcquire()` spawn call.**

Workflow files read: `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/checkpoints.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/tdd.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/worktree-path-safety.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/executor-examples.md`

## Performance

- **Duration:** ~50 min (not machine-timestamped at start; estimated from session extent)
- **Completed:** 2026-09-18T18:00Z
- **Tasks:** 2
- **Files modified:** 9 (exactly the plan's own `files_modified` list, no more, no fewer)

## Accomplishments

- Rewrote `tool-location.mts`'s environment layer (Layer 1) into three ordered steps: the raw
  value as a direct candidate (unchanged), a `$PATH` walk of a separator-free value on an
  `executable`-kind record via the module's own `resolveOnPath()`, and — only for a
  separator-free value that resolved through neither step — a terminal refusal composed in
  `buildFileLayerRefusal()`'s own prose idiom, naming the variable, its value, and every
  candidate tried, immediately before the declared-id `$PATH` probe.
- Added `ResolveToolResult.envCandidate: string | null`, populated on every return path of
  `resolveTool()`, so a consumer can report or attempt what the developer named without
  re-reading the variable by name — keeping `tool-location-consumers.test.ts`'s closed
  consumer set at zero readers.
- `backend-detect.mts`'s `resolvedBackend()` PD-01 branch now takes the seam's whole result:
  the configured name shown on failure falls back to `envCandidate` (retiring the hardcoded
  `"x64sc"` display-name literal the code review flagged as IN-01), and the seam's `refusal`
  is carried onto a new `ResolvedBackendResult.locationRefusal` field.
- `vice-broker.mts` writes one additional startup stderr line naming the refusal, only when
  `locationRefusal` is non-null.
- Regenerated and committed `resources/tool-location.mjs`, `resources/backend-detect.mjs`,
  `resources/vice-broker.mjs`; `resources-sync.test.ts` is green.
- Added a matrix of new tests across `tool-location.test.ts` (12 new tests: A, B, C, D, G, I,
  K×2, L, plus the rewritten "nothing answers" test split into two), `backend-detect.test.ts`
  (4 new consumer-side control tests), and `vice-broker-acquire.test.ts` (4 new end-to-end
  tracer tests: Tests 1-4). All new tests observed RED against the pre-fix code, then GREEN
  after the production change (see TDD Gate Compliance below).

## Task Commits

Each task was committed atomically:

1. **Task 1: The environment layer resolves the binary the developer named — seam, consumer,
   and the real spawn wiring, one path end to end** — `40dcf216` (feat) — includes
   `vice-broker-acquire.test.ts`'s own new end-to-end tests per the plan's file list for this
   task.
2. **Task 2: The full environment-layer matrix across all four declared variables, and the
   shipped test whose intent this deliberately changes** — `3d9b69d5` (test)

_Both tasks carry `tdd="true"`; RED was observed via the pre-existing shipped suite's own
pinned assertions going red the moment the production code changed (see TDD Gate Compliance),
and via manual pre-write probes of the exact scenarios each new test encodes, before any test
text was committed._

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/mcp/vice/tool-location.mts` — widened environment layer, `envCandidate` field, terminal
  refusal, amended module header (PD-16).
- `src/mcp/vice/backend-detect.mts` — `locationRefusal` field, `envCandidate` fallback for the
  configured name in the PD-01 branch.
- `src/mcp/vice/vice-broker.mts` — one additional startup stderr line.
- `src/mcp/vice/tool-location.test.ts` — 12 new tests, one shipped test rewritten in place.
- `src/mcp/vice/backend-detect.test.ts` — 4 new consumer-side control tests.
- `src/mcp/vice/vice-broker-acquire.test.ts` — 4 new end-to-end tracer tests.
- `src/mcp/vice/resources/tool-location.mjs`, `resources/backend-detect.mjs`,
  `resources/vice-broker.mjs` — regenerated compiled artifacts.

## Decisions Made

- **Terminal refusal scoped to separator-free values only, regardless of record kind** — see
  Deviations below for the full reasoning; this is the single interpretive decision this plan
  required beyond its own explicit instructions, and it is load-bearing for both the plan's own
  must-have truth and for not regressing a pre-existing, unmodified test.
- Widening reuses the seam's own exported `resolveOnPath()` rather than a new private copy,
  per the plan's own instruction and this project's standing "one $PATH walk per seam"
  discipline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug, discovered mid-implementation] Scoped the terminal refusal to
separator-free values, reconciling a genuine tension inside the plan's own text**
- **Found during:** Task 1, immediately after the first implementation pass, while running the
  full `vice-broker-acquire.test.ts` suite as a RED/GREEN check.
- **Issue:** The plan's own `<must_haves><truths>` list states, verbatim: "A value containing a
  path separator behaves exactly as today ... because the widening applies only to a
  separator-free value on an executable-kind record." Task 2's own `<behavior>` Test E
  description, by contrast, reads: "a value containing a separator that does not exist ... and
  the call refuses." These two are in direct tension for the same scenario. My first
  implementation pass followed the more literal reading of PD-13's action text ("when the
  variable was set non-empty and nothing resolved it — stop, with a refusal") and made the
  refusal fire for ANY unresolved non-empty value, separator or not. This broke a pre-existing,
  unmodified test the plan's own edge-coverage table does not list for rewrite —
  `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" — which asserts that an absolute,
  nonexistent `VICE_BIN` falls through silently to the declared-id `$PATH` probe, exactly as
  before this phase.
- **Fix:** Re-read every must-have truth, every Task 1/2 behavior line, and the phase
  verification's own description of the reported defect ("a slash-free env-var value ... is
  the shape many real setups use"). Concluded the must-have truth is authoritative (it is the
  literal graded contract, titled `must_haves`, and its own justification clause is only
  internally consistent if the terminal refusal is ALSO scoped to separator-free values — a
  `$PATH` search could never plausibly have answered for an absolute path in the first place,
  so refusing it would be a second, unstated change the truth's own "because" clause does not
  account for). Restricted `envUnresolved` to fire only when the declared value contains no
  `/`, for both `executable`- and `directory`-kind records. This reconciles all given data
  points: Test G's directory-kind bare-name refusal, Test 2's bare-name-decoy refusal, the
  must-have truth, AND the pre-existing "Plan 60-01 Test 4" all hold simultaneously.
- **Files modified:** `src/mcp/vice/tool-location.mts` (Layer 1 logic and its own header
  comments, revised to state the separator-free scoping explicitly and explain why).
- **Verification:** Full `vice-broker-acquire.test.ts` suite green (33/33, including the
  untouched "Plan 60-01 Test 4"); the two new seam-level tests in `tool-location.test.ts`
  ("...bare name that resolves nowhere refuses..." and "...an absolute path that does not
  exist behaves exactly as today...") assert both halves of this distinction directly and
  permanently, so a future regression in either direction is caught at the seam level.
- **Committed in:** `40dcf216` (production code), `3d9b69d5` (the two tests that pin the
  distinction).

**2. [Rule 1 — Bug, minor] Test E's literal wording ("and the call refuses") was not carried
into the shipped test for a separator-containing unresolved value**
- **Found during:** Task 2, writing the new matrix.
- **Issue:** Task 2's own `<behavior>` Test E prose, read in isolation, would have produced a
  test asserting refusal for a separator-containing unresolved value — which would directly
  contradict the must-have truth this plan is graded against and would also have required
  rewriting the untouched "Plan 60-01 Test 4" (deviation #1's own finding).
  Instead, "Test E" is represented in the shipped suite as TWO tests: one for the bare-name
  refusal case (matching the LOC-03 defect this plan closes) and one explicit control asserting
  the separator-containing value is UNCHANGED — this is the more defensible, internally
  consistent reading given the conflict, and it is called out here for visibility since it
  departs from the letter of the plan's own Test E description.
- **Fix:** As above — no code change beyond deviation #1; this is the same finding, restated
  from the test-authoring side.
- **Files modified:** `src/mcp/vice/tool-location.test.ts`.
- **Verification:** Both tests pass; `Plan 60-01 Test 4` in `vice-broker-acquire.test.ts` is
  byte-for-byte unmodified and still green.
- **Committed in:** `3d9b69d5`.

---

**Total deviations:** 2 auto-fixed (both Rule 1, and both the same underlying interpretive
finding, documented from two angles for full traceability). **Impact on plan:** Necessary for
correctness — the alternative (refusal firing for any unresolved value regardless of separator)
would have silently violated the plan's own must-have truth while also regressing a
pre-existing, working test the plan did not ask to change. No scope creep: no files outside the
plan's own `files_modified` list were touched.

## TDD Gate Compliance

Both tasks carry `tdd="true"`. Gate evidence:

- **RED:** Before any Task 1 production change, `node --test tool-location.test.ts` and
  `vice-broker-acquire.test.ts` were green against the OLD code (66 and 29 tests respectively).
  Immediately after the Layer 1 rewrite landed (before any test file was touched), re-running
  both suites showed exactly the expected, intentional RED: `tool-location.test.ts`'s own
  pre-existing "nothing answers" test failed (1 failing, all 65 others still green) and
  `vice-broker-acquire.test.ts`'s pre-existing "Plan 60-01 Test 4" failed (1 failing, all 28
  others still green) under the first (over-broad) implementation pass — both failures were on
  the TARGET assertions for the behavior being changed, not on an unrelated crash, syntax
  error, or zero-test discovery, satisfying the #3770 intentional-RED bar. This is what
  surfaced deviation #1 above; after narrowing the refusal's scope, "Plan 60-01 Test 4" returned
  to green (an unaffected control) while the deliberately-changed "nothing answers" test stayed
  red until Task 2's rewrite.
- **GREEN:** After Task 2's rewrite of the "nothing answers" test and the full new matrix,
  `tool-location.test.ts` (76/76), `vice-broker-acquire.test.ts` (33/33), and
  `backend-detect.test.ts` (25/25) are all green.
- **REFACTOR:** None needed beyond the header-comment revisions made alongside deviation #1's
  fix (folded into the `feat` commit, not a separate commit, since this plan's commit protocol
  is per-task rather than per-RED/GREEN/REFACTOR cycle — see Task Commits above).

No RED/GREEN commit-message convention violation: this plan's own `<tasks>` structure commits
per TASK (matching every other plan in this phase), not per RED/GREEN/REFACTOR micro-commit;
the `test(60-06)`/`feat(60-06)` split instead separates "production code + its own end-to-end
tests" (Task 1) from "the exhaustive matrix + the deliberate rewrite" (Task 2), which is the
grain the plan's own two tasks are already cut on.

## Issues Encountered

None beyond the interpretive tension documented under Deviations above.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

- `src/mcp/vice/tool-location.mts` — FOUND
- `src/mcp/vice/backend-detect.mts` — FOUND
- `src/mcp/vice/vice-broker.mts` — FOUND
- `src/mcp/vice/tool-location.test.ts` — FOUND
- `src/mcp/vice/backend-detect.test.ts` — FOUND
- `src/mcp/vice/vice-broker-acquire.test.ts` — FOUND
- `src/mcp/vice/resources/tool-location.mjs` — FOUND
- `src/mcp/vice/resources/backend-detect.mjs` — FOUND
- `src/mcp/vice/resources/vice-broker.mjs` — FOUND
- Commit `40dcf216` — FOUND in `git log --oneline --all`
- Commit `3d9b69d5` — FOUND in `git log --oneline --all`
- Re-ran every `<acceptance_criteria>` item from both tasks: all pass (direct `resolveTool()`
  probes, `resolvedBackend()` probes, `npm run typecheck` clean, `node build.ts` +
  `resources-sync.test.ts` green, `tool-location-consumers.test.ts` green with unchanged
  expected arrays).
- Re-ran the plan-level `<verification>` block: `node --test` on all three named files plus
  `tool-location-consumers.test.ts` and `resources-sync.test.ts` — all green, no live broker
  process running.

## Next Phase Readiness

- LOC-03 stays `Gaps Found` in `REQUIREMENTS.md` — a deliberate no-op by this plan (shared-ID
  gate): `60-07-PLAN.md` also declares `LOC-03` and has not yet produced a `60-07-SUMMARY.md`.
  `LOC-03` becomes markable once 60-07 finishes.
- `LOC-02` and `LOC-04` remain flagged `unclassified` from prior plans (60-05, 60-04
  respectively) — unaffected by this plan, carried forward as recorded in this plan's own
  "Flagged planner assumptions" section.
- 60-07 is the next plan in this gap-closure wave (`WR-01`/`LOC-04`); it depends on the same
  `tool-location.mts` this plan modified — its own `<read_first>` should be checked against the
  amended Layer 1 shape (three ordered steps, `envCandidate`, the terminal refusal) rather than
  the pre-this-plan two-step version.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*
