---
phase: 17-project-identity-and-ledger-close
plan: 01
subsystem: testing
tags: [node-test, docs-guard, deferred-items-ledger, debt-04, planning-docs]

requires:
  - phase: 16-packaging-and-repo-shape
    provides: Discharged both remaining pending todos (PKG-01, PKG-03), which is what let the pending-todo tree reach genuinely empty
provides:
  - "docs-deferred-ledger.test.ts's non-vacuity test now expresses a genuinely empty pending tree as a passing state, instead of asserting a floor of 2"
  - "STATE.md's ## Deferred Items ledger reads 0 (derived, guarded, and agreeing with ### Pending Todos), the true v0.4.0-close count"
affects: [17-02, 17-03, gsd-audit-milestone]

actuals:
  tokens: 2860
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Positive-control-conditional-on-nonempty-set pattern for a doc guard's non-vacuity test, avoiding a synthetic stem when the real repo state is genuinely empty"

key-files:
  created: []
  modified:
    - src/mcp/vice/docs-deferred-ledger.test.ts
    - .planning/STATE.md

key-decisions:
  - "Dropped the non-vacuity test's pending.length >= 2 floor entirely rather than lowering it to a smaller nonzero number, since 0 is now a legitimate, permanent-possible state (RESEARCH.md option (a))."
  - "Made the positive control conditional on pending.length > 0, selecting its control stem from the live pending array instead of a hard-coded filename, so it cannot go stale a third time."
  - "Committed the orchestrator's pre-existing STATE.md frontmatter/position bookkeeping (last_updated, state_head, Current Position) as its own standalone commit before Task 1, so each task's own commit shows a clean, task-scoped diff matching its acceptance criteria."

requirements-completed: [DEBT-04]

coverage:
  - id: D1
    description: "docs-deferred-ledger.test.ts's non-vacuity test and positive control can express a genuinely empty pending tree as a passing state, without losing their non-vacuity teeth (completed floor, section-located/non-empty checks, planted-violation test all unchanged and still asserting)"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts#non-vacuity: the Deferred Items section is located, non-empty, and the scanned sets clear a floor"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts#every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts#no completed todo is still listed as Pending in STATE.md's Deferred Items section (AUDIT-04, direction B)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts#planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither"
        status: pass
    human_judgment: false
  - id: D2
    description: "STATE.md's deferred-items ledger reads the true v0.4.0-close count of 0, with the derivation, the 2 -> 0 transition, the cause (Phase 16 discharging PKG-01/PKG-03), and the excluded categories (Carried forward table, WR-class findings) all stated in the record; the ## Deferred Items table row count and the ### Pending Todos prose figure agree"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts (whole file, 4/4 pass against the edited STATE.md)"
        status: pass
      - kind: other
        ref: "grep/awk checks against .planning/STATE.md's ## Deferred Items and ### Pending Todos sections (see Task 2 acceptance criteria; all passed live during execution)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-23
status: complete
---

# Phase 17 Plan 01: Ledger Guard Zero-Pending Fix and STATE.md True-Count Reconciliation Summary

**Fixed docs-deferred-ledger.test.ts's non-vacuity floor to express a genuinely empty pending-todo tree, then brought STATE.md's Deferred Items ledger down to the true, guarded v0.4.0-close count of 0.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-23 (session start, before the pre-existing STATE.md bookkeeping commit)
- **Completed:** 2026-08-23T08:27:21Z (`e8df776`)
- **Tasks:** 2
- **Files modified:** 2 (`src/mcp/vice/docs-deferred-ledger.test.ts`, `.planning/STATE.md`)

## Accomplishments
- `docs-deferred-ledger.test.ts`'s non-vacuity test went from 1 pass / 3 fail to 4 pass / 0 fail, without weakening, skipping, or tautologising any assertion — the `completed.length >= 5` floor, both section-located/non-empty checks, and the entire planted-violation test are byte-identical to before this plan.
- `STATE.md`'s `## Deferred Items` ledger and `### Pending Todos` prose now both read 0, deriving from and agreeing with `.planning/todos/pending/`'s real (empty) contents, with the `2 → 0` transition, cause, and exclusions all stated in the record.
- DEBT-04's criterion 2 ("still derived and guarded, and lower than the 19 items inherited") is now mechanically satisfiable: `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — make the ledger guard able to express a zero-pending tree, end to end** - `09c097f` (test)
2. **Task 2: Bring STATE.md's deferred-items ledger to the true v0.4.0-close count of 0, table and prose in one edit** - `e8df776` (docs)

**Pre-task bookkeeping (not a plan task):** `962e89b` — committed the orchestrator's own pre-existing STATE.md frontmatter/position advance (made before this executor was spawned) as a standalone commit, so both task commits above show clean, task-scoped diffs.

_Note: no plan-metadata commit is separate from Task 2's own commit for STATE.md; this plan's designated "closing" bookkeeping (REQUIREMENTS.md, ROADMAP.md ticks) belongs to plan 17-03 per the phase's own plan split, not this plan._

## Files Created/Modified
- `src/mcp/vice/docs-deferred-ledger.test.ts` - Non-vacuity test: dropped the `pending.length >= 2` floor entirely (zero pending is now a legitimate, intended state); made the positive control conditional on `pending.length > 0`, selecting its stem from the live `pending` array instead of a hard-coded filename; extended the floor-history comment naming Phase 17/DEBT-04.
- `.planning/STATE.md` - `## Deferred Items`: replaced the "Current, as of phase 15 plan 15-12 Task 3" paragraph with a Phase 17 equivalent (0 items, full arithmetic, `2 → 0` transition, named exclusions); deleted the table's two data rows (kept header/separator plus an italic "emptied deliberately" note); reworded two bare-filename-stem historical mentions into prose matching their sibling entries. `### Pending Todos`: updated the opening figure to 0, changed two paragraphs from present-tense "remain pending" to historical past tense, and added a closing paragraph recording Phase 16's closure and restating the standing figure-must-match-table-row-count caution.

## Decisions Made
- Dropped the non-vacuity floor to nothing (not to a smaller nonzero number) since 0 pending is DEBT-04's own success criterion, not an anomaly to tolerate.
- Selected the positive control's stem from the live `pending` array rather than inventing a synthetic one, per RESEARCH.md's option (a) — keeps faith with what a positive control is for (proving the real matcher finds something real) while never manufacturing a fake stem.
- Committed the pre-existing STATE.md bookkeeping diff (orchestrator's phase-transition frontmatter update, already present and uncommitted at session start) separately before Task 1, so each task's own `git diff --name-only` check — an explicit acceptance criterion for both tasks — reported exactly the one file each task was scoped to touch.

## Deviations from Plan

None - plan executed exactly as written. The one wrinkle (a pre-existing uncommitted STATE.md diff from the orchestrator's own phase-transition step, unrelated to any task in this plan) was handled by committing it standalone before Task 1 rather than folding it into either task's commit — this is bookkeeping hygiene, not a deviation from the plan's instructions, since neither task's `<action>` was affected and both tasks' acceptance criteria (which check `git diff --name-only` for exactly one file) were satisfied cleanly as a result.

## Issues Encountered

One transient authoring issue, self-corrected before commit: the first draft of the new `## Deferred Items` paragraph wrapped the required arithmetic phrase (`0 pending todo files ... + 0 UAT-gap rows = 0`) across a Markdown line break, so the acceptance criterion's single-line `grep -E` pattern did not match. Fixed by keeping that specific clause on one physical line; re-ran the acceptance-criteria greps to confirm before committing Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs-deferred-ledger.test.ts` is green in both directions against a genuinely empty pending tree; the guard is ready to stay in that state through the rest of Phase 17 and into `/gsd-audit-milestone`.
- `.planning/todos/pending/` is empty and STATE.md agrees. Per this plan's own Hazard 2 (noted in 17-RESEARCH.md), if this phase's own post-execution code review or plan-check gate files a new pending todo, whoever closes this phase (17-03, the designated closer) must re-check `.planning/todos/pending/` is still empty and re-run the guard before recording the phase complete — that check was explicitly deferred to the closer, not performed here, since this plan's own tasks are what could file such a finding in the first place.
- `.planning/REQUIREMENTS.md`'s DEBT-04 checkbox and closure note, and `.planning/ROADMAP.md`'s Phase 17 `**Plans**:`/outcome-Notes fields, are intentionally untouched by this plan — they belong to plan 17-03 per this phase's own plan split (17-02 owns CORE-01; 17-03 is the closer).
- Ready for 17-02 (CORE-01) and then 17-03 (the phase's designated closer, which ticks both requirements and closes the phase record).

---
*Phase: 17-project-identity-and-ledger-close*
*Completed: 2026-08-23*
