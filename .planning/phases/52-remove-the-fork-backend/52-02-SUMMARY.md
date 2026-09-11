---
phase: 52-remove-the-fork-backend
plan: 02
subsystem: docs
tags: [requirements, traceability, fork-backend, planning-record]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 01)
    provides: "The FORK-01 reversal and docs/stock-hard-losses.md this plan's FORKRM-02/03 text cites"
provides:
  - "FORKRM-01..07 declared in `.planning/REQUIREMENTS.md` under a new `### Fork-Backend Removal (Phase 52)` subsection, one per ROADMAP Phase 52 success criterion, positionally numbered"
  - "Seven new `## Traceability` rows mapping FORKRM-01..07 to Phase 52; Coverage totals recomputed to 22/22/0"
  - "FORKRM-02 marked Complete (checkbox + Traceability) — its substance was delivered by plan 52-01, and this plan's minting is what let `requirements.ready-ids` finally report it ready"
  - "The completed todo `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` annotated SUPERSEDED, so it no longer reads as a live `retain` answer"
affects: [52-03, 52-04, 52-05, 52-06, 52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 1527
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Requirement-id namespace separation: a decision-table id (`FORK-NN` in PROJECT.md) and a milestone-requirement id (`FORKRM-NN` in REQUIREMENTS.md) are kept in disjoint namespaces even when one cites the other in prose, so a requirement can never be mistaken for a decision record"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md

key-decisions:
  - "FORKRM-01..07 declared as unchecked `- [ ]` bullets with `Pending` Traceability status, exactly as the plan specified — this plan mints the ids, it does not implement their substance (that is later plans' job)."
  - "FORKRM-02 marked Complete immediately after minting, via `requirements.mark-complete`, because plan 52-01 already delivered its substance (the FORK-01 reversal and the rewritten `docs-fork-decision.test.ts` guard) and could not mark it complete at the time only because the id did not yet exist. `requirements.ready-ids` confirmed FORKRM-02 ready (its only two declaring plans, 52-01 and 52-02, both have a SUMMARY) while blocking the other six correctly."
  - "FORKRM-03 was NOT marked complete despite plan 52-01 also satisfying its substance (docs/stock-hard-losses.md), because `requirements.ready-ids` reports it blocked: plans 52-08 and 52-09 also declare FORKRM-03 in their frontmatter and have not run yet. The shared-ID gate (#2388) is honored as designed rather than overridden by hand."
  - "The completed todo was annotated with a SUPERSEDED block inserted after the YAML front matter's closing fence, not above it — preserving the file's parseable front matter as the literal first bytes, while still being the first thing a reader of the body sees. The plan's own acceptance criteria (front matter `status`/`disposition` key reset) did not apply: this file carries no such key, stated explicitly in the added block."
  - "**Flagged deviation, not silently worked around:** the plan's own Task 1 acceptance criteria and automated `<verify>` require `grep -ac 'FORK-0[12]' .planning/REQUIREMENTS.md` to return `0`, but the same task's `<action>` mandates the `FORKRM-02` bullet text (lifted near-verbatim from ROADMAP Phase 52 criterion 2) name `FORK-01` by id, and mandates a namespace-rationale paragraph naming both `FORK-01` and `FORK-02`. These two instructions are mutually exclusive — the FORKRM-02 bullet cannot both cite FORK-01 by name (as instructed) and produce a zero grep count for that exact string. Resolved by honoring the `<action>`'s explicit, near-verbatim content requirements (the more specific instruction) and treating the literal grep gate as the plan's own defect; verified instead against the check's stated *purpose* — no `FORK-01`/`FORK-02` bullet or Traceability row was created (`grep -c '\\*\\*FORK-0[12]\\*\\*'` and `grep -c '| FORK-0[12] |'` both return `0`), which is what the prohibition's own wording (\"the historical decision ids were not copied in\") actually describes."

requirements-completed: [FORKRM-02]

coverage:
  - id: D1
    description: "FORKRM-01..07 declared under a new REQUIREMENTS.md subsection, one per ROADMAP Phase 52 success criterion, in a namespace disjoint from FORK-01/FORK-02"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -ac 'FORKRM-0[1-7]' .planning/REQUIREMENTS.md -> 15 (>= 14 required)"
        status: pass
      - kind: other
        ref: "per-id bullet+traceability count check (FORKRM-01..07, each >= 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Traceability table extended with seven FORKRM-NN -> Phase 52 rows; Coverage block recomputed to 22/22/0; namespace rationale and Phase-51-exclusion stated in prose"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -a 'requirements: 22 total|Mapped to phases: 22|Unmapped: 0' .planning/REQUIREMENTS.md | wc -l -> 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "No existing v1.0.0 requirement (DECOMP-*, BUILD-*, EQUIV-*), Departures table, Future Requirements, or Out of Scope table text was reworded"
    verification:
      - kind: other
        ref: "git show 0a6d141b -- .planning/REQUIREMENTS.md | grep '^-' -> only Coverage-block lines and the footer date line, all pre-approved by the plan's own action text"
        status: pass
    human_judgment: false
  - id: D4
    description: "The completed todo carries a dated SUPERSEDED block naming the reversal, pointing at the live record, with its original body fully intact (additive-only)"
    requirement: FORKRM-02
    verification:
      - kind: other
        ref: "grep -ac SUPERSEDED / docs/stock-hard-losses.md; ls .planning/todos/pending | grep -c fork -> 0; git diff --numstat -> 20 insertions, 0 deletions"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole automated suite's failure SET stayed within the documented phase floor (no new regression introduced)"
    verification:
      - kind: other
        ref: "cd src/mcp/vice && npm run test:automated"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 02: Mint FORKRM-01..07 and Supersede the Retain Todo Summary

**Seven `FORKRM-*` requirement ids declared and traced to Phase 52 in `REQUIREMENTS.md` (Coverage recomputed to 22/22/0), `FORKRM-02` immediately marked Complete on the strength of plan 52-01's already-landed work, and the archived `retain` todo annotated SUPERSEDED without touching a line of its original body.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-11 (session)
- **Completed:** 2026-09-12
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `### Fork-Backend Removal (Phase 52)` to `.planning/REQUIREMENTS.md` with seven unchecked `FORKRM-01`..`FORKRM-07` bullets, each traceable 1:1 to its positionally-numbered ROADMAP Phase 52 success criterion.
- Extended the `## Traceability` table with seven `| FORKRM-NN | Phase 52 | Pending |` rows and recomputed the Coverage block from `15 total / 15 mapped` to `22 total / 22 mapped / 0 unmapped`, adding a namespace-rationale paragraph (why `FORKRM-*` is disjoint from the `FORK-01`/`FORK-02` decision ids) and an explicit statement that Phase 51's still-`TBD` requirements line is untouched by this plan and excluded from the 22/22 claim.
- Confirmed via diff that no existing `DECOMP-*`/`BUILD-*`/`EQUIV-*` bullet, the Departures table, Future Requirements, or Out of Scope table was reworded — only the Coverage block and the footer date line changed.
- Annotated `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` with a dated SUPERSEDED block (inserted after the YAML front matter, before `## Problem`) stating the retain disposition is reversed, naming the basis, and pointing at `.planning/PROJECT.md`'s `FORK-01` row and `docs/stock-hard-losses.md`. The original body is untouched (`git diff --numstat` shows 20 insertions, 0 deletions). No `status`/`disposition` front-matter key existed to reset, stated explicitly in the added block.
- Marked `FORKRM-02` Complete via `requirements.mark-complete` (checkbox and Traceability status both flipped) — `requirements.ready-ids` reported it ready now that both its declaring plans (52-01, 52-02) have a SUMMARY, while correctly leaving the other six, and `FORKRM-03` (blocked by not-yet-run siblings `52-08`/`52-09`), untouched.
- Re-ran `cd src/mcp/vice && npm run test:automated` against the phase-wide baseline: the same 7 of 8 baseline failures reproduced; the 8th (`check-skill-tool-coverage`, one of `audit-root-args.test.ts`'s two documented flaky members) passed this run, matching the flakiness already documented in plan 52-01's SUMMARY. No new failure appeared. `DIRECTION 5 (basis integrity)` still fails, but for a cause unrelated to this plan — a real `anno-register.ts` entry cites `STORE-06`, an id this plan never touches.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare FORKRM-01..07 and extend the Traceability table** - `0a6d141b` (docs)
2. **Task 2: Mark the superseded `fully-remove-the-forked-vice-mcp-backend` todo as superseded** - `b51dc34a` (docs)

**Requirement follow-up commit** (not a plan task, per `<prior_wave_context>`'s instruction to reflect 52-01's now-mintable requirement): `8c325e5c` (docs) — marks `FORKRM-02` Complete.

**Plan metadata:** committed together with STATE.md/ROADMAP.md updates below.

## Files Created/Modified
- `.planning/REQUIREMENTS.md` — new `### Fork-Backend Removal (Phase 52)` subsection, seven new Traceability rows, recomputed Coverage block, `FORKRM-02` flipped to Complete
- `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` — SUPERSEDED annotation block added, original body untouched

## Decisions Made
See `key-decisions` in frontmatter for the full record. In short: mint all seven as Pending/unchecked per the plan's own instructions; mark only `FORKRM-02` Complete (the shared-ID gate correctly blocks the rest); the annotation lands after the front-matter fence, not before it; and the plan's own `FORK-0[12]` grep gate on Task 1 is flagged as internally self-contradictory (see Deviations) rather than worked around by weakening the mandated bullet text.

## Deviations from Plan

### Flagged (not auto-fixed) — Task 1's own acceptance criteria conflicts with its own action text

**1. [Rule 4-adjacent — flagged, not silently resolved] Task 1's `FORK-0[12]` grep gate cannot pass while implementing Task 1's own mandated bullet text**
- **Found during:** Task 1, running the acceptance-criteria verification loop after implementation.
- **Issue:** Task 1's `<action>` requires the `FORKRM-02` bullet to read `.planning/PROJECT.md`'s `FORK-01` row...` (near-verbatim from ROADMAP criterion 2) and requires a namespace-rationale paragraph naming both `FORK-01` and `FORK-02` explicitly. The same task's acceptance criteria and automated `<verify>` require `grep -ac 'FORK-0[12]' .planning/REQUIREMENTS.md` to equal `0`. Both cannot hold simultaneously: the mandated `FORKRM-02` bullet text alone contains the literal substring `FORK-01`.
- **Resolution:** Implemented the `<action>`'s explicit, specific content requirements (the bullet text and the rationale paragraph) as written. Did not weaken or obfuscate the required prose to force the grep count to `0` — that would have meant deviating from the plan's own more specific, more detailed instruction to satisfy a blunter, self-defeating check. Verified instead against what the prohibition's own wording actually describes ("the historical decision ids were not copied in"): confirmed no `**FORK-01**`/`**FORK-02**` requirement bullet and no `| FORK-01 |`/`| FORK-02 |` Traceability row was created (both zero). This is the same distinction the plan's own prohibition table draws between the historical decision ids and this plan's new requirement ids — the ids are cited, never copied in as requirements.
- **Files affected:** `.planning/REQUIREMENTS.md` (no change needed beyond what was already written for the `<action>`).
- **Verification:** `grep -c '\*\*FORK-0[12]\*\*' .planning/REQUIREMENTS.md` → 0; `grep -c '| FORK-0[12] |' .planning/REQUIREMENTS.md` → 0. Raw `grep -ac 'FORK-0[12]'` → 2 (both from mandated prose, not from a copied-in requirement).
- **Committed in:** `0a6d141b` (Task 1 commit).

---

**Total deviations:** 1 flagged (plan-internal contradiction between a task's `<action>` and its own `<verify>`/acceptance criteria for the same task).
**Impact on plan:** No scope creep, no unauthorized rewording. The substantive prohibition ("FORK-01/FORK-02 not copied in as new requirements") holds; only the plan's own literal grep proxy for that prohibition is unsatisfiable as written. Flagged here for whoever reviews this plan's `must_haves` next, rather than silently declared passing or silently worked around.

## Issues Encountered
None beyond the flagged deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every later plan in this phase (52-03 through 52-10) can now cite `FORKRM-01`..`FORKRM-07` in its own frontmatter `requirements` field — the ids exist and are traced to Phase 52.
- `FORKRM-03`, `FORKRM-04`, `FORKRM-05`, `FORKRM-06`, `FORKRM-07`, and `FORKRM-01` remain `Pending` until the plans that implement their substance (52-03 through 52-10) land and produce SUMMARYs — this is expected, not a gap.
- The completed `retain` todo no longer reads as the project's live answer; a future reader hits the SUPERSEDED block before the original body.
- No blockers.

## Self-Check: PASSED
- `.planning/REQUIREMENTS.md` exists and contains the new subsection, Traceability rows, and recomputed Coverage block — confirmed with `grep`.
- `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` exists and contains the SUPERSEDED block — confirmed with `grep`.
- All three commit hashes (`0a6d141b`, `b51dc34a`, `8c325e5c`) verified present via `git log --oneline`.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
