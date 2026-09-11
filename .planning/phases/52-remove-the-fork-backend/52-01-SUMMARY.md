---
phase: 52-remove-the-fork-backend
plan: 01
subsystem: docs
tags: [fork-backend, vice-mcp, decision-reversal, capability-registry, planning-record]

# Dependency graph
requires: []
provides:
  - "FORK-01 reversed in `.planning/PROJECT.md`'s Key Decisions row, with its ISO date, the two collapsed grounds, and a stated re-reversal condition"
  - "`docs/stock-hard-losses.md` — the canonical `docs/`-rooted acceptance record for SID read-back, matrix keyboard, and RESTORE/NMI, cited by the FORK-01 row"
  - "`src/mcp/vice/docs-fork-decision.test.ts` rewritten (not deleted) to pin the reversal, including a new test 7 binding the row to the acceptance record"
  - "A green baseline (unchanged failure set) for every later deletion plan in this phase to run against"
affects: [52-02, 52-03, 52-04, 52-05, 52-06, 52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 6900
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Decision-record reversal pattern: rewrite the row in place (never delete/re-add), preserve the row's own committed guard, and add one non-vacuity test binding the row to any new artifact it now cites"

key-files:
  created:
    - docs/stock-hard-losses.md
  modified:
    - .planning/PROJECT.md
    - src/mcp/vice/docs-fork-decision.test.ts

key-decisions:
  - "FORK-01 (retain the forked VICE MCP backend, decided 2026-08-22) is REVERSED as of 2026-09-12. Answered by the project owner at this plan's Task 0 blocking-human checkpoint: option A, proceed with the reversal. Verbatim basis: two grounds collapsed — the hedge was never exercised (the project's own v0.8.0 close audit recorded this in writing) and the near-zero-carrying-cost premise was withdrawn by the owner, who reports the fork never worked in practice (owner scope call, 2026-09-11)."
  - "SID read-back, matrix keyboard, and RESTORE/NMI are now permanent accepted losses on stock VICE, not hedged ones — recorded in the new docs/stock-hard-losses.md with their hardware reasons migrated verbatim from capability-registry.ts's six hardware-category entries."
  - "The rewritten reversal-trigger phrase set is named RE_REVERSAL_PHRASES (replacing REVERSAL_PHRASES), with values [\"re-reverses only if\", \"reinstates the fork\", \"restores the fork\"] — the condition under which this 2026-09-12 reversal would itself be reversed, i.e. the fork reinstated. Later plans in this phase do not need this name; recorded here per this plan's own <output> instruction."
  - ".planning/PROJECT.md:186 was checked and deliberately left unchanged — the amended FORK-01 row still states its own re-reversal condition, so the citation ('the same way FORK-01's Key Decisions row states its own trigger is') remains true without edit."
  - "Dated milestone-close records at :251 (v0.4.0) and :398 (v0.8.0) were checked and left verbatim, per the plan's own instruction — they correctly describe what was true at their own date, and :398 is load-bearing evidence for the reversal (ground 1)."
  - "The line-933 v0.4.0 close-audit citation ('FORK-01 retain ... coupling as the named reversal criterion') was NOT in this plan's enumerated sweep list (only :186, :251, :398, :1758, :1774 were named) and was left untouched, consistent with the same historical-record rule applied to :251 and :398 — it sits inside the same dated 'Audit verdict' close narrative."
  - "FORKRM-02 and FORKRM-03 are declared in this plan's frontmatter `requirements` field but are NOT yet minted as rows in .planning/REQUIREMENTS.md — ROADMAP.md's Phase 52 section states minting FORKRM-01..07 is plan 52-02's deliverable. `requirements.ready-ids` was run and correctly reported 0/2 ready; `requirements.mark-complete` was therefore not called for this plan. This is expected, not a gap."

requirements-completed: []

coverage:
  - id: D1
    description: "FORK-01 Key Decisions row states the reversal, its ISO date (2026-09-12), the two collapsed grounds, KEYBOARD_MATRIX_SET (literal upper-case), and cites docs/stock-hard-losses.md"
    requirement: FORKRM-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#2. exactly one Key Decisions row names FORK-01"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#3. the FORK-01 row states an ISO YYYY-MM-DD date"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#4. the FORK-01 row names KEYBOARD_MATRIX_SET in its canonical upper-case spelling (case-sensitive)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#5. the FORK-01 row carries at least one named re-reversal-trigger phrase"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#7. the FORK-01 row cites docs/stock-hard-losses.md, and that acceptance record exists and is non-vacuous"
        status: pass
    human_judgment: false
  - id: D2
    description: "Out of Scope fork-backend bullet no longer reads as 'retained as the default hedge' and still cites FORK-01"
    requirement: FORKRM-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#6. the Out of Scope fork-backend bullet cites FORK-01"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/stock-hard-losses.md exists, is tracked, non-vacuous, and free of planning vocabulary"
    requirement: FORKRM-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts#7. the FORK-01 row cites docs/stock-hard-losses.md, and that acceptance record exists and is non-vacuous"
        status: pass
      - kind: other
        ref: "grep -ac '\\.planning/' docs/stock-hard-losses.md → 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole automated suite's failure SET is unchanged from the pre-plan floor"
    requirement: FORKRM-02
    verification:
      - kind: other
        ref: "cd src/mcp/vice && npm run test:automated (run twice for stability)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 01: Reverse FORK-01 and Record Stock's Three Hard Losses Summary

**FORK-01 reversed in place with its ISO date and two collapsed grounds, `docs/stock-hard-losses.md` created as the permanent-acceptance record for SID read-back/matrix keyboard/RESTORE-NMI, and `docs-fork-decision.test.ts` rewritten (not deleted) with a new test binding the row to that record — all green against an unchanged automated-suite failure set.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-11T21:53Z (per orchestrator dispatch)
- **Completed:** 2026-09-12
- **Tasks:** 3 (checkpoint:decision answered + tracer Task 1 + auto Task 2)
- **Files modified:** 3 (1 created, 2 modified)

## Checkpoint: FORK-01 Reversal Decision

**Type:** checkpoint:decision, gate=blocking-human
**Answer:** **A) Proceed with the reversal.**
**Answered by:** the human project owner, via a blocking-human decision gate presented by the orchestrator.
**Date of the answer:** 2026-09-12.
**State at time of answer:** no file had been modified.

This answer was supplied to this executor by the orchestrator (see `<checkpoint_already_answered>` in the execution prompt) rather than re-asked during this run. No file was written before the answer was received; both subsequent tasks proceeded under option A.

## Accomplishments
- Reversed the `FORK-01` Key Decisions row in `.planning/PROJECT.md` in place: states **REVERSED** with the 2026-09-12 date, names the original 2026-08-22 retain decision and that it was taken at a human blocking checkpoint, states the two collapsed grounds (hedge never exercised per the v0.8.0 close audit; near-zero-cost premise withdrawn by the owner), notes the `KEYBOARD_MATRIX_SET` reversal trigger is now moot, cites `docs/stock-hard-losses.md`, and states a re-reversal condition ("re-reverses only if...").
- Rewrote the `### Out of Scope` fork-backend bullet to reflect removal rather than a retained hedge, while keeping its bolded-subject shape (`fork backend` inside `**...**`) and its `FORK-01` citation.
- Created `docs/stock-hard-losses.md` (3,363 bytes): three sections (SID read-back, Matrix keyboard, RESTORE/NMI), each stating ACCEPTED/2026-09-12, the verbatim hardware `reason` text from `capability-registry.ts`'s six `hardware`-category entries, the affected tool names, and the `KEYBOARD_ALTERNATIVE` text where the registry carries one. Contains no `.planning/*` path, no `Phase 52` mention, and no bare `D-NN`/`G-NN-N` id.
- Rewrote `src/mcp/vice/docs-fork-decision.test.ts` (rewritten in place, never deleted): kept tests 1–4 and 6 structurally identical (the ≥20-row floor, exactly-one-FORK-01-row, ISO-date match, case-sensitive `KEYBOARD_MATRIX_SET` literal, Out-of-Scope cross-citation); repointed test 5's phrase set from `REVERSAL_PHRASES` to `RE_REVERSAL_PHRASES` with reversal-vocabulary the rewritten row actually uses; added test 7 asserting the row cites `docs/stock-hard-losses.md` and that the file exists, is non-vacuous (>1000 bytes), and mentions `SID`, `RESTORE`, and `vice_keyboard_matrix`. All 7 tests pass.
- Annotated the two live present-tense `FORK-01` citations at (formerly) `:1758` and `:1774` with dated reversal/superseded notes, without deleting the original historical text they annotate. Left the dated historical records at `:251` and `:398` verbatim, and left `:186` unchanged (its citation remains true against the amended row). `:933` was outside this plan's enumerated five-citation sweep and was likewise left untouched as another dated historical close-audit record.
- Confirmed no file under `.planning/milestones/` or `.planning/phases/` was touched (`git diff --name-only -- .planning/milestones .planning/phases` → 0 lines).
- Ran `cd src/mcp/vice && npm run test:automated` twice after landing all changes; the failure SET matched the pre-plan floor both times (7 of the 8 baseline members reproduced consistently; the 8th, `check-skill-tool-coverage: every spelling that RESOLVES to the repository root is accepted`, is documented as one of the two known flaky members of `audit-root-args.test.ts` and passed cleanly in both post-change runs). One run additionally showed a transient `SEAM-05, non-vacuity: the packed-tarball scope...` failure that was NOT present in the second run and passed 18/18 when re-run in isolation — a `skill-external-spawn-gate.test.ts`-internal race with the concurrently-running `sync-skills.mjs` prepack step (the file's own header documents this hazard: "a rebuild here deletes a directory that tests running in parallel read"), not a regression caused by this plan's edits (no skill files or installer files were touched).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "the fork decision is reversed and still pinned"** — `85368a3f` (feat)
2. **Task 2: Retire the three remaining live `FORK-01 = retain` readings in PROJECT.md** — `39484011` (docs)

_Checkpoint (Task 0) required no commit — no file was written prior to the owner's answer._

## Files Created/Modified
- `docs/stock-hard-losses.md` — new permanent-acceptance record for SID read-back, matrix keyboard, and RESTORE/NMI
- `.planning/PROJECT.md` — FORK-01 row reversed, Out of Scope bullet rewritten, two historical citations annotated with dated reversal/superseded notes
- `src/mcp/vice/docs-fork-decision.test.ts` — rewritten (not deleted); repointed test 5, added test 7

## Decisions Made
See `key-decisions` in frontmatter above for the full, verbatim record. In short: FORK-01 reversed 2026-09-12 per owner decision at the checkpoint; three hard losses now permanent; `docs-fork-decision.test.ts`'s phrase-set const renamed to `RE_REVERSAL_PHRASES`; `:186` left unchanged by design; FORKRM-02/03 not yet mintable in REQUIREMENTS.md (deferred to plan 52-02, confirmed via `requirements.ready-ids` reporting 0/2 ready).

## Deviations from Plan

None - plan executed exactly as written. The checkpoint's answer was supplied by the orchestrator per the execution prompt's explicit instruction rather than re-asked, which is the specified continuation path for an already-answered blocking-human checkpoint, not a deviation from the plan's own tasks.

## Issues Encountered
None. One transient test flake (`SEAM-05, non-vacuity: the packed-tarball scope...`) was observed on one of two post-change full-suite runs and did not reproduce on rerun or in isolation (18/18 passing) — documented above under Accomplishments rather than as an issue requiring action, since it is internal to `skill-external-spawn-gate.test.ts`'s own documented parallel-run race with `sync-skills.mjs`, unrelated to any file this plan touched.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every later plan in this phase (52-02 through 52-10) now has a green, reversal-recorded baseline to delete fork-backend code against.
- Plan 52-02 still needs to mint `FORKRM-01..07` in `.planning/REQUIREMENTS.md` with Traceability rows (per `ROADMAP.md`'s Phase 52 section) — FORKRM-02 and FORKRM-03 are satisfied in substance by this plan's artifacts but cannot be marked `Complete` in `REQUIREMENTS.md` until those rows exist.
- No blockers.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
