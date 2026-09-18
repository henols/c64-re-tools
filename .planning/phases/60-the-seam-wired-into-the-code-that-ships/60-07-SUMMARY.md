---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 07
subsystem: infra
tags: [tool-location, host-tool, c1541, petcat, WR-01, WR-02, citation-ledger, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 60-the-seam-wired-into-the-code-that-ships (plans 60-03, 60-04, 60-06)
    provides: the tool-location seam's file-layer refusal shape (resolveTool()'s ResolveToolResult.refusal,
      buildFileLayerRefusal()), findSiblingBinary()'s tools.json-first precedence order (plan 60-04),
      and the widened, terminal environment layer plan 60-06 shipped -- this plan's Task 2 re-measures
      the unchanged-behaviour claim against that widened contract for the second time in the phase.
provides:
  - findSiblingBinary() carries the seam's own file-layer refusal reason verbatim (a `refusal: string
    | null` field on its return shape and in its process-lifetime memo) to the c1541 and petcat.decode
    refusal sites, mirroring buildHostToolArgv()'s own ACME branch precedent -- a malformed
    tools.json entry now tells a user what is wrong with it (wrong kind, missing executable bit,
    absent on disk) instead of the generic "does not exist" + install-VICE remedy (WR-01 closed).
  - A written WR-02 decision in findSiblingBinary()'s own header, recording the memo's caching
    tension with the seam's own no-memo rationale as an open, deliberately-not-resolved concern,
    with its trigger for revisiting named -- no reset hatch added, no guard claimed.
  - A second, committed full-suite failing-set-difference evidence note re-measuring LOC-03's
    unchanged-behaviour claim against plan 60-06's widened environment-layer contract, finding and
    fixing seven citation-ledger regressions (documentation-only) along the way.
affects: [61-the-doctor-tool-and-its-own-precedence-report, any future plan reading
  findSiblingBinary()'s return shape or citing a line inside docs/phase58-declaration-provenance.md
  or docs/phase59-tool-location-placement.md]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 15446
  tasks: 2
  commits: 4
plan_head_before: cf108284b73ebcd5d58d0245561b428e1b7e03d2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refusal-first branching before the null-path branch: findSiblingBinary()'s two call sites
      (c1541, petcat.decode) now check a seam refusal before checking for a null path, mirroring
      buildHostToolArgv()'s pre-existing ACME branch -- a refusal is quoted verbatim with no remedy
      appended; a genuine not-found keeps the remedy. Established as the shape any future refusal-
      carrying resolver in this file should follow."
    - "Citation-ledger drift as a first-class regression: a line-number citation into a still-live
      source file is treated as part of the failing-set-difference claim's own scope -- a citation
      that no longer resolves is a genuine defect this project's phase58-citation-ledger.test.ts
      exists to catch, not a documentation nicety to defer."

key-files:
  created:
    - .planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/resources/host-tool.mjs
    - docs/phase58-declaration-provenance.md
    - docs/phase59-tool-location-placement.md

key-decisions:
  - "The old Plan 60-04 Test 7 scenario (a tools.json entry naming a nonexistent path for c1541/
    petcat) became, under this plan's own WR-01 fix, a REFUSAL rather than a not-found case --
    rewritten to exercise the genuinely-absent-entry case instead, preserving the test's own
    stated intent (not-found + remedy) rather than silently drifting onto the newly-refused shape."
  - "Fixed all seven citation-ledger regressions this task's own required full-suite measurement
    surfaced, including four traced to plan 60-06's environment-layer rewrite and one pre-existing
    ROADMAP.md drift unrelated to either plan -- per this task's own acceptance criterion (a
    regression must not exist in the failing set, whoever caused it) and plan 60-05's own
    precedent for a regression found by this exact measurement in a gap-closure wave's last plan."

requirements-completed: [LOC-03, LOC-04, DECL-03]

coverage:
  - id: D1
    description: "A malformed tools.json entry for c1541 or petcat (wrong kind, missing executable
      bit, absent on disk) produces the seam's own specific reason -- naming the file, the path,
      and which condition failed -- instead of the generic 'does not exist' + install-VICE remedy."
    requirement: "DECL-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 1 (the tracer, end to end through the built artifact): a tools.json path for c1541 that does not exist on disk produces the seam's own reason, not the generic sentence"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 2: a tools.json entry naming a real, non-executable file for c1541 produces the seam's executable-bit reason"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 5 (the second tool): the same malformed-entry case for petcat through petcat.decode, proving the change is in the shared helper"
        status: pass
    human_judgment: false
  - id: D2
    description: "A genuinely absent c1541/petcat, with nothing said about it in tools.json, still
      produces today's refusal shape (tool id, absence, tried list, declaration's remedy), and a
      malformed-entry refusal never carries that remedy text."
    requirement: "LOC-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 3 (the clean control): with nothing said about c1541 in the file and no binary anywhere, the refusal is unchanged -- tool id, absence, tried list, and the declaration's remedy"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 4 (no remedy on a refusal): the malformed-entry message does NOT contain the scratch declaration's remedy sentence, matching the ACME branch's precedent"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-binary-name memo's caching timing is provably unchanged: a second call
      for the same binary name replays the memoised refusal without re-reading tools.json, and no
      reset hatch was added to the module."
    verification:
      - kind: unit
        ref: "src/mcp/vice/host-tool.test.ts#Plan 60-07 Test 6 (the memo is unchanged): within one module instance, a second call for the same binary name replays the memoised refusal without re-reading tools.json"
        status: pass
      - kind: other
        ref: "grep -aoE 'export function [A-Za-z0-9_]*[Ff]orTests' src/mcp/vice/host-tool.mts -> (none)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The failing set of the full test suite after this gap-closure pass contains
      nothing that was passing before it, measured against the tree as it stood at the end of the
      phase's first execution (ce890041) and recorded as committed evidence, with the one
      deliberate plan-60-06 test rewrite named under both its old and new names."
    requirement: "LOC-03"
    verification:
      - kind: integration
        ref: ".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md: full npm test glob (--test-reporter=tap) in both trees, no live broker, exit status read directly; comm -13 base post (regressions) is empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "resources/host-tool.mjs is regenerated and committed, and resources-sync.test.ts
      is green against it."
    verification:
      - kind: other
        ref: "node build.ts (exit 0) + node --test resources-sync.test.ts (2/2 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 07: The Seam's Own Reason Reaches the c1541/petcat Refusals, and LOC-03 Re-Measured Summary

**`findSiblingBinary()` now carries the tool-location seam's own file-layer refusal reason
verbatim to the `c1541`/`petcat.decode` refusal sites instead of discarding it into a generic
"does not exist" sentence (WR-01), records the `WR-02` memo-caching tension as an open,
deliberately-unresolved decision, and a second full-suite failing-set-difference evidence note
re-proves LOC-03's unchanged-behaviour claim against plan 60-06's widened environment-layer
contract -- finding and fixing seven stale line citations along the way.**

Workflow files read: `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/checkpoints.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/tdd.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/worktree-path-safety.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/executor-examples.md`

## Performance

- **Duration:** ~55 min (not machine-timestamped at start; estimated from session extent)
- **Completed:** 2026-09-18T18:35Z
- **Tasks:** 2
- **Files modified:** 6 (5 modified + 1 created, exactly the plan's own `files_modified` list)

## Accomplishments

- `findSiblingBinary()`'s return shape gained a third field, `refusal: string | null`, carrying
  the seam's own `resolveTool()` refusal verbatim when the file layer rejects a named `tools.json`
  entry, stored at every one of the five memo-set points so a memoised answer replays the same
  message a fresh one would.
- The `c1541` and `petcat.decode` refusal branches in `buildHostToolArgv()` now branch on that
  field before the existing null-path branch: a refusal is quoted verbatim with no remedy
  appended (mirroring `buildHostToolArgv()`'s own pre-existing ACME branch); the true not-found
  case keeps today's generic sentence and its `withRemedy()` call unchanged.
- `findSiblingBinary()`'s header now records the `WR-02` decision in this file's own established
  voice for a considered-and-not-taken correction: the memo's caching of a `tools.json` answer is
  inconsistent with the seam's own no-memo rationale, the roadmap's cross-cutting constraint for
  this phase requires the memo keep its current semantics, the one observable consequence (a
  process restart is needed for an edited entry to take effect for these two tools only) is
  stated plainly, and the trigger for revisiting it (the sibling mechanism moving inside the seam)
  is named -- recorded as an open tension, with no guard claimed.
- Six new tests, each prefixed `Plan 60-07`, added to `host-tool.test.ts`; the pre-existing "Plan
  60-04 Test 7" was rewritten because its own scenario (a tools.json entry naming a nonexistent
  path) became, under this plan's own fix, a refusal rather than a not-found case.
- `resources/host-tool.mjs` regenerated and committed; `resources-sync.test.ts` green.
- A second `LOC-03` full-suite failing-set-difference evidence note committed, re-measuring the
  unchanged-behaviour claim against plan 60-06's widened environment layer for the second time in
  this phase, finding zero regressions after fixing seven stale documentation citations (two
  traced to this plan's own Task 1, four to plan 60-06, one pre-existing and unrelated to either).

## Task Commits

Each task was committed atomically; Task 2's own required measurement surfaced a regression that
was fixed in its own dedicated commit before the evidence note itself was committed:

1. **Task 1: The seam's own reason reaches the c1541 and petcat refusals a user reads, end to end
   through the built artifact** - `d7d5a151` (feat)
2. **Deviation fix: repair citation-ledger line drift surfaced by the full-suite regression
   measurement** - `e3beb3f5` (fix) -- found by Task 2's own required full-suite comparison,
   fixed within this plan per its own acceptance criterion and plan 60-05's precedent
3. **Task 2: the unchanged-behaviour claim re-measured as a failing-set difference, with the one
   deliberate contract change named** - `6a7b64fa` (docs)

**Plan metadata:** (this commit, following)

_Task 1 carries `tdd="true"`. RED evidence was gathered by temporarily reverting the old "Plan
60-04 Test 7" text (which the production fix's own scope-change made stale -- see deviation 1
below) back to its pre-fix form and re-running it in isolation against the NEW production code:
it failed with `AssertionError: The input did not match the regular expression /tried:/` on the
exact TARGET assertion for the changed behavior (a malformed-entry refusal no longer carries a
`tried:` list once it is a refusal rather than a not-found case) -- a genuine, intentional RED,
not a syntax error or an unrelated crash. The test text was then restored to its rewritten,
GREEN form -- see TDD Gate Compliance below. No formal `gsd_run check tdd-red-evidence`
invocation was run: `workflow.tdd_mode` is `false` in this project's config, so the plan-level
TDD gate enforcement in `tdd.md` (which requires that check) does not bind this `type: execute`
plan; the task-level `tdd="true"` attribute was honoured in spirit via the manual
revert/confirm/restore cycle described above._

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `findSiblingBinary()`'s `refusal` field, the two refusal-first
  call-site branches, the `WR-02` header note.
- `src/mcp/vice/host-tool.test.ts` - six new `Plan 60-07` tests; "Plan 60-04 Test 7" rewritten.
- `src/mcp/vice/resources/host-tool.mjs` - regenerated compiled artifact.
- `docs/phase58-declaration-provenance.md` - four `host-tool.mts` citation line numbers repaired,
  one `.planning/ROADMAP.md` citation line number repaired, a new "Corrected again (Phase 60,
  plan 60-07, WR-01)" paragraph, one new ledger entry for the paragraph's own new citation.
- `docs/phase59-tool-location-placement.md` - two citations (`backend-detect.mts`,
  `tool-location.mts`) repaired after plan 60-06's environment-layer rewrite shifted them.
- `.planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md` -
  new committed evidence note.

## Decisions Made

- The old "Plan 60-04 Test 7" scenario (a tools.json entry naming a nonexistent path) is now
  classified as a refusal by this plan's own fix, not a not-found case -- rewritten to use a
  genuinely-absent entry instead, so it keeps testing the behavior its name describes.
- All seven citation-ledger regressions Task 2's required measurement surfaced were fixed within
  this plan (documentation-only, no production or test source touched), rather than reported and
  left open, since this task's own acceptance criterion requires an empty regression list and
  this is the gap-closure wave's last plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan 60-04 Test 7's own scenario became a refusal under this plan's fix**
- **Found during:** Task 1, while verifying the full `host-tool.test.ts` suite after the
  production change.
- **Issue:** "Plan 60-04 Test 7" asserted a `tools.json` entry naming a nonexistent path for
  `c1541`/`petcat` produces the generic not-found sentence plus the declaration's remedy. Under
  this plan's own WR-01 fix, `tool-location.mts`'s own file layer classifies "named but absent on
  disk" as a REFUSAL (`buildFileLayerRefusal()`), so `findSiblingBinary()` now carries that
  refusal verbatim with NO remedy -- exactly the fix this plan exists to make -- and the old test's
  assertions (`tried:`, the remedy sentence) genuinely failed against it. Confirmed as genuine,
  intentional RED (not a syntax error or unrelated crash) by temporarily reverting the test text
  after the production fix and re-running it in isolation before restoring the fix.
- **Fix:** Rewrote the test to use a genuinely-absent tools.json entry (`writeToolsJson(dir, {})`)
  instead of a named-but-nonexistent path, keeping the test's own stated intent (the not-found +
  remedy shape) intact and accurate to the new contract.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** `node --test host-tool.test.ts` 139/139 pass, including the rewritten test.
- **Committed in:** `d7d5a151` (Task 1 commit)

**2. [Rule 1 - Bug] Four `docs/phase58-declaration-provenance.md` citations into `host-tool.mts`
drifted when this plan's Task 1 inserted code above them**
- **Found during:** Task 2's own required full-suite comparison, whose first pass (against
  `d7d5a151`, before this fix) was NOT empty -- two `phase58-citation-ledger.test.ts` subtests
  failed, absent from the baseline (`ce890041`).
- **Issue:** The WR-01 refusal branches and the WR-02 memo header comment this plan's Task 1
  added shifted every line number below them in `host-tool.mts` by up to ~40 lines. Four
  citations in `docs/phase58-declaration-provenance.md` (the `c1541`/`petcat` refusal sentences,
  `ACME_LIB_MARKER`, `ORACLE_ENV_VARS`) pointed at the wrong line after the shift.
- **Fix:** Updated each citation's line number to the current source, re-verified against the
  live file by re-running `phase58-citation-ledger.test.ts` itself. Added a "Corrected again
  (Phase 60, plan 60-07, WR-01)" paragraph explaining the refusal-message change the earlier
  "Corrected" paragraph no longer fully described, citing the ACME branch precedent
  (`host-tool.mts:1396-1409`) by line range -- and added that citation's own new ledger entry,
  since the citation-ledger test enforces that every body citation has a matching entry.
- **Files modified:** `docs/phase58-declaration-provenance.md`
- **Verification:** `phase58-citation-ledger.test.ts` 11/11 pass; full suite regression list
  empty (see evidence note).
- **Committed in:** `e3beb3f5`

**3. [Rule 1 - Bug] One `.planning/ROADMAP.md` citation had drifted from unrelated edits,
unrelated to either this plan or plan 60-06**
- **Found during:** Same Task 2 measurement as deviation 2.
- **Issue:** A citation into `.planning/ROADMAP.md` (Phase 61's own Success Criterion 1 prose)
  no longer pointed at the right line range -- accumulated drift from ROADMAP.md progress-table
  updates across this phase's plans, not caused by any single plan's source diff.
- **Fix:** Updated the citation's line range to the current location of the same prose.
- **Files modified:** `docs/phase58-declaration-provenance.md` (same file as deviation 2, listed
  separately since the cause is distinct)
- **Verification:** Same as deviation 2.
- **Committed in:** `e3beb3f5`

**4. [Rule 1 - Bug] Two `docs/phase59-tool-location-placement.md` citations drifted when plan
60-06 retired a hardcoded literal these citations quoted**
- **Found during:** Same Task 2 measurement as deviations 2-3.
- **Issue:** Plan 60-06 removed the hardcoded `viceBin = "x64sc";` literal from
  `backend-detect.mts` (retiring the display-name literal the code review flagged as IN-01) and
  moved `resolveOnPath()`'s definition in `tool-location.mts` as part of its own environment-layer
  rewrite. Two citations in `docs/phase59-tool-location-placement.md` pointed at text that no
  longer existed at the cited location (one anchor's literal text had been removed entirely).
- **Fix:** Updated the `backend-detect.mts` citation to a still-true anchor in the same PD-01
  branch ("it keeps no ordering of its own", matching the doc's own existing claim), and updated
  the `tool-location.mts` citation's line range to `resolveOnPath()`'s new location.
- **Files modified:** `docs/phase59-tool-location-placement.md`
- **Verification:** Same as deviation 2.
- **Committed in:** `e3beb3f5`

---

**Total deviations:** 4 auto-fixed (1 test-rewrite necessitated by this plan's own intended
behavior change, 3 citation-drift repairs -- 1 from this plan's own edit, 2 from plan 60-06's
prior edit -- surfaced by this task's own required measurement). **Impact on plan:** All four
were necessary for the plan's own tasks to be considered done under their own stated acceptance
criteria (a passing test suite for Task 1; an empty regression list for Task 2). No scope creep:
deviations 2-4 touch only `docs/*.md` files, no production or test source, and were fixed rather
than merely reported because this is the gap-closure wave's last plan (per plan 60-05's own
precedent for the identical situation).

## TDD Gate Compliance

Task 1 carries `tdd="true"`. Gate evidence:

- **RED:** After the production change (the `refusal` field and the two refusal-first call-site
  branches) landed, the pre-existing "Plan 60-04 Test 7" -- whose own scenario (a `tools.json`
  entry naming a nonexistent path) the fix reclassified from "not found" to "refused" -- was
  re-run in its original, unmodified form against the new production code. It failed on the
  target assertion (`AssertionError: The input did not match the regular expression /tried:/`),
  a genuine, intentional RED on the exact behavior this task changes -- not a load/fixture crash,
  not an unrelated test.
- **GREEN:** The test was rewritten to use a genuinely-absent `tools.json` entry (preserving its
  own stated not-found + remedy intent), and the six new `Plan 60-07` tests were added alongside
  it. Full `host-tool.test.ts` run: 139/139 pass.
- **REFACTOR:** None needed -- the production change (a new struct field, two call-site branches,
  one header comment) required no cleanup pass after GREEN.

This plan commits per TASK (matching every other plan in this phase), not per RED/GREEN/REFACTOR
micro-commit -- Task 1's single `feat(60-07)` commit carries the production change, the call-site
branches, the header note, and all seven tests (six new plus the one rewrite) together, since the
RED evidence above was gathered by a temporary, uncommitted revert-and-confirm cycle rather than
by an intermediate RED commit.

## Issues Encountered

- Node 24.20.0's default `node --test` reporter on this host is the spec-style reporter
  (`✔`/`✖`), not TAP, even when stdout is redirected to a file -- a bare `npm test > file 2>&1`
  produces no `# tests`/`# pass`/`# fail` summary and no `not ok` lines to grep for. Worked
  around by invoking `node --test --test-reporter=tap '*.test.*'` directly (the reporter flag
  must precede the glob argument; placed after, it is parsed as a second glob, not a flag).
  Documented in the evidence note's own "Reporter note" so a future reader of this note's
  commands is not misled by a bare `npm test` producing no TAP markers on this host.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- this plan's production change (`findSiblingBinary()`'s `refusal` field) widens what an
existing refusal message says; it adds no new network endpoint, auth path, file-access pattern,
or schema change, and echoes only a path the user themself wrote in their own `tools.json`,
exactly as the pre-existing file-layer refusals already do (per this plan's own threat register,
T-60-18/T-60-19).

## Next Phase Readiness

- `LOC-03`, `LOC-04` and `DECL-03` are all now `Complete` in `REQUIREMENTS.md` -- `LOC-03` was
  the last of this phase's five requirement IDs still `Gaps Found`.
- `WR-01` (code review) is closed by this plan. `WR-02` is recorded as an open, deliberately
  carried-forward tension per `PD-18`, not closed -- its own trigger for revisiting (the sibling
  mechanism moving inside the seam) is named in `findSiblingBinary()`'s own header.
- The two human-verification items carried forward from plans 60-03 and 60-05 (the `ACME_BIN`
  refusal-message check, and the real systemd-launched broker's argv check) remain NOT run by
  this plan -- per `workflow.human_verify_mode: end-of-phase`, they are deferred to the
  end-of-phase UAT flow, and the phase must not seal with them forgotten (restated verbatim in
  this plan's own `<human-check>` block).
- No blockers for Phase 60's own closure or for Phase 61.

## Self-Check: PASSED

- `src/mcp/vice/host-tool.mts` - FOUND, contains `refusal: string | null` and the `WR-02` header note
- `src/mcp/vice/host-tool.test.ts` - FOUND, 12 `Plan 60-07` matches (6 tests x 2 TAP lines) in a fresh run
- `src/mcp/vice/resources/host-tool.mjs` - FOUND, regenerated, `resources-sync.test.ts` 2/2 pass
- `docs/phase58-declaration-provenance.md` - FOUND, citation lines repaired
- `docs/phase59-tool-location-placement.md` - FOUND, citation lines repaired
- `.planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md` - FOUND
- Commit `d7d5a151` - FOUND in `git log --oneline`
- Commit `e3beb3f5` - FOUND in `git log --oneline`
- Commit `6a7b64fa` - FOUND in `git log --oneline`
- Re-ran every `<acceptance_criteria>` item from both tasks: all pass.
- Re-ran the plan-level `<verification>` block: `node --test host-tool.test.ts` (139/139),
  `npm run typecheck` (clean), `node build.ts` + `resources-sync.test.ts` (2/2), no reset hatch
  in `host-tool.mts`, full `node --test --test-reporter=tap '*.test.*'` (4020/3939/0 fail/81
  skipped, no live broker) -- all green.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*
