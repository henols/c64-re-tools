---
phase: 40-the-three-preprocessing-host-tools
plan: 07
subsystem: planning-bookkeeping
tags: [decisions-doc, roadmap-amendment, requirements-amendment, deferred-ledger, todo-fold]

requires:
  - phase: 40-01
    provides: "The .c64-re-tools/ consolidation and WR-03's two closed holes -- both todos this plan folds"
  - phase: 40-06
    provides: "The .d64 supersession executed in code (d64-parse.mjs and anno-d64.ts deleted, d64-single-route.test.ts committed) -- this plan records the decision in place of the deferred text it reverses"
provides:
  - "docs/phase40-preprocessing-tools-decisions.md -- the dated decision record for the d64-parser supersession and the cartconv/PREP-03 removal"
  - "ROADMAP.md and REQUIREMENTS.md amended in place with dated riders: two reversed locked statements, one struck requirement, two Excluded-table rows, corrected coverage counts (20->19)"
  - "Three pending todos folded into .planning/todos/completed/ with Resolution sections; STATE.md's Deferred Items ledger corrected to 7 open"
  - "PREP-01 marked Complete (shared-ID gate cleared, last declaring plan); PREP-03 struck as Removed, never marked Complete"
affects: []

actuals:
  tokens: 12333
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Amend-in-place with a dated rider, never delete -- ~~struck text~~ followed by a bold **AMENDED/REVERSED/REMOVED <date>** rider pointing at the decisions document, following the v0.8.0 milestone's eleven corrected-id precedent"
    - "A withdrawn requirement gets its own Excluded-table row PLUS a struck requirement line PLUS a struck traceability row -- three separate records, not one merged edit -- while a pre-existing row that merely referenced the withdrawn id gets its own separate dated rider rather than being folded into the new row"

key-files:
  created:
    - docs/phase40-preprocessing-tools-decisions.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md
    - .planning/todos/completed/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md
    - .planning/todos/completed/2026-09-07-installer-must-self-ignore-its-deployed-tools-in-the-consumer-repo.md

key-decisions:
  - "PREP-03 is amended in place (struck, dated) everywhere it occurs -- REQUIREMENTS.md's requirement line, its Excluded-table row, its Traceability row, and REQUIREMENTS.md/ROADMAP.md's coverage/requirements-mapped counts -- never deleted outright, per D-29/D-31 and this project's own v0.8.0 precedent of eleven amended ids."
  - "The bank-qualified-addressing Excluded row (which justified itself by reference to PREP-03) got its OWN separate dated rider rather than being merged with the new cartconv-removal row -- two independent facts, not one."
  - "requirements.mark-complete was run for PREP-01 only, not PREP-03 -- PREP-01 was implemented (shared-ID gate cleared, this being the last of five declaring plans to finish); PREP-03 was withdrawn, not implemented, and its correct final state (struck/Removed) was already written by hand."
  - "The three folded todos were moved and their ledger rows removed in ONE commit (Task 3) -- docs-deferred-ledger.test.ts fails in both directions on a half-finished fold."
  - "The installer self-ignore todo is resolved as MOOT rather than fixed as originally scoped: the .c64-re-tools/ consolidation (plan 40-01) moved deployed launcher artifacts under a root that is now wholly gitignored by one stanza, eliminating the mixed-directory problem the todo's proposed per-entry tools/.gitignore existed to solve."

patterns-established:
  - "Decisions document mirroring docs/phaseNN-*-findings.md's frontmatter shape, for a design decision rather than a gate verdict"

requirements-completed: [PREP-01]

coverage:
  - id: D1
    description: "The d64-parser supersession and cartconv/PREP-03 removal decisions are recorded in one dated document with measured evidence, three accepted costs, the acknowledged fixture circularity and its mitigation location, two deliberate divergences, and a dated cartridge-removal section"
    requirement: PREP-03
    verification:
      - kind: unit
        ref: "git ls-files -- docs/phase40-preprocessing-tools-decisions.md (1); grep -ac '2026-09-08' docs/phase40-preprocessing-tools-decisions.md (7); node --test docs-dangling-refs.test.ts docs-linerefs.test.ts (21/21 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four locked statements (ROADMAP goal, success criteria 1/3/4, requirements line; REQUIREMENTS.md's two affected Excluded rows) are amended in place with dated riders; coverage corrected to 19 total/19 mapped/0 unmapped in both documents; no row re-sorted, no criterion renumbered, the two genuine plan-count rows left untouched"
    requirement: PREP-03
    verification:
      - kind: unit
        ref: "grep -ac PREP-03 REQUIREMENTS.md+ROADMAP.md (6, 7 -- nonzero in both); grep -ac '19 total'/'Mapped to phases: 19' REQUIREMENTS.md (1, 1); grep -ac '20/20 requirements mapped' ROADMAP.md (0); grep -ac '19/19 requirements mapped' ROADMAP.md (2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three pending todos folded (file move + ledger row removal in the same commit each); the fourth candidate (vicerc scratch-dir reaping) deliberately left pending; STATE.md's stated pending count matches the tree"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "node --test docs-deferred-ledger.test.ts (6/6 pass); ls .planning/todos/pending/*.md | wc -l (7); grep -c reap-vicerc-scratch-dirs .planning/todos/pending/ (1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PREP-01 marked Complete via the shared-ID gate; full automated suite settles at its documented pre-existing floor"
    requirement: PREP-01
    verification:
      - kind: unit
        ref: "npm run test:automated settles at 3584 tests / 3570 pass / 3 fail (all anno-register.test.ts, pre-existing) on the clean re-run; an earlier run showed a 5th, confirmed-transient audit-root-args.test.ts scratch-file race"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 07: The Decisions Doc, the In-Place Amendments, and the Three Todo Folds Summary

**One dated decisions document records the `d64-parse.mjs` → `c1541` supersession and the `cartconv`/`PREP-03` removal; four locked statements across ROADMAP.md and REQUIREMENTS.md are amended in place with dated riders rather than deleted, correcting requirement coverage from 20/20 to 19/19; three resolved todos fold into the completed tree with the deferred-items ledger corrected in the same commits; PREP-01 flips Complete on the last declaring plan.**

## Performance

- **Duration:** 28 min
- **Started:** ~2026-09-08T12:28:00Z
- **Completed:** 2026-09-08T12:52:00Z
- **Tasks:** 3
- **Files modified:** 7 (across 5 commits)

## Accomplishments

- `docs/phase40-preprocessing-tools-decisions.md` created: the `.d64` supersession's measured evidence (per-sector BAM, richer `-entry` output), its three accepted costs, the acknowledged synthetic-fixture circularity with its real-corpus mitigation location, the two deliberate divergences (dropped version probing, no mutating verb ships), and a dated `cartconv`/`PREP-03` removal section.
- `ROADMAP.md`'s Phase 40 goal sentence, success criteria 1/3/4, requirements line, and version-probe notes bullet all amended in place with `~~struck~~` text plus a dated rider — never deleted. Its milestone-summary line, goal-section prose, and closing summary line (the three requirements-mapped claims) all corrected 20→19, cross-checked mechanically.
- `REQUIREMENTS.md`'s `PREP-03` line struck with a dated rider; a new Excluded-table row records the removal; the pre-existing bank-qualified-addressing row (which referenced `PREP-03`) got its own separate rider; the `.d64` parser-supersession row is reversed in place; the traceability row is struck; the coverage block reads 19 total / 19 mapped / 0 unmapped.
- Three pending todos folded into `.planning/todos/completed/` with `## Resolution` sections, each citing plan 40-01's commits: `WR-03`'s two never-throw holes, the `.c64-re-tools/` path consolidation, and the installer self-ignore gap (resolved as moot by the consolidation). `STATE.md`'s Deferred Items ledger table lost the matching three rows in the same commit; the pending-count paragraph was recomputed from the tree (10 → 7) rather than adjusted by subtraction.
- `STATE.md`'s Current Position now names Phase 40 complete; the Decisions section gained seven new entries covering the phase's key calls (the supersession/removal decisions, the clean-break path migration, the six per-capability tool ids, the positive-shape oracle, the named-decline verdict shape, the dropped version-probe divergence, and the corrected nine-skill total).
- `PREP-01` marked Complete via `requirements.mark-complete` (the shared-ID gate cleared — this is the last of five declaring plans to finish); `PREP-03` was deliberately excluded from that call since it was withdrawn, not implemented, and its correct final state (struck, "Removed") was already written by hand.

## Task Commits

1. **Task 1: Write the supersession decision down with its measured reasoning** - `44216a38` (docs)
2. **Task 2: Amend the four locked statements in place and correct every dependent count** - `6cdf48ff` (docs)
3. **Task 3: Fold the three resolved todos and record the phase's decisions in the project state** - `b31d71b4` (docs)

Plus one requirements-tracking commit not tied to a single plan task:

4. `ed17400a` (docs) - PREP-01 marked Complete via `requirements.mark-complete`, per the standard `update_requirements` workflow step (shared-ID gate cleared on this plan's completion)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `docs/phase40-preprocessing-tools-decisions.md` - new dated decisions document
- `.planning/ROADMAP.md` - Phase 40's goal, requirements line, success criteria 1/3/4, version-probe notes bullet, and three requirements-mapped claims, all amended in place with dated riders
- `.planning/REQUIREMENTS.md` - `PREP-03`'s requirement line, two Excluded-table rows (one amended, one new), traceability row, coverage block, and `PREP-01`'s checkbox/traceability status
- `.planning/STATE.md` - Deferred Items ledger table (3 rows removed) and its stating paragraph, Current Position, Decisions section, Session Continuity, and a new Per-Plan Metrics row
- `.planning/todos/completed/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md` - moved from pending, `## Resolution` added
- `.planning/todos/completed/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md` - moved from pending, `## Resolution` added
- `.planning/todos/completed/2026-09-07-installer-must-self-ignore-its-deployed-tools-in-the-consumer-repo.md` - moved from pending, `## Resolution` added (moot-by-consolidation)

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: `PREP-03` is amended in place everywhere it occurs rather than deleted, and the bank-qualified-addressing exclusion row that referenced it gets its own independent dated rider rather than being merged into the new removal row — keeping the two facts (the exclusion's own reasoning, and `PREP-03`'s fate) separately auditable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, consistency] Two additional stale `cartconv`/"three tools" mentions outside the plan's named locations**
- **Found during:** Task 2, while amending the named goal/criteria locations
- **Issue:** ROADMAP.md's milestone-overview phase-list bullet (`- [ ] **Phase 40: ...**`) restated the same "`c1541`, `petcat` and `cartconv`" phrasing as the Goal sentence the plan explicitly named for amendment, and STATE.md's Current Position block separately named `cartconv` in its own Phase 40 parenthetical. Leaving these stale while the Goal sentence itself was corrected would have left an obvious first-read inconsistency.
- **Fix:** Both amended in place with the same dated-rider discipline (struck/corrected text, `2026-09-08`, pointing at the decisions document).
- **Files modified:** `.planning/ROADMAP.md` (phase-list bullet), `.planning/STATE.md` (Current Position)
- **Verification:** Manual re-read; no verify command in the plan specifically covers either line, so this is a discretionary consistency fix, not a graded criterion.
- **Committed in:** `6cdf48ff` (ROADMAP.md bullet), `b31d71b4` (STATE.md)

**Total deviations:** 1 auto-fixed (consistency-only, no functional or scope change). **Impact:** none — purely eliminates a first-read inconsistency the plan's own amendments would otherwise have left behind.

### Acceptance Criteria Not Met

**Task 2's verify command** `grep -ac '20/20 plans' .planning/ROADMAP.md` **expects exactly 2, actually reports 1.** Measured directly before making any edit: the whole file contains exactly ONE literal occurrence of the string `20/20 plans` (Phase 19's progress-list entry, `- [x] Phase 19: ... (20/20 plans) — completed 2026-08-25`); the plan's own citation of a second occurrence at `:1166` does not resolve to any `20/20`-bearing line in the current file (that area of the file is now unrelated Progress-table-parser prose). This criterion's expected count of 2 is a pre-existing drift in the plan's own measurement — most likely taken before plans 40-01 through 40-06 each ran their own `roadmap.update-plan-progress` call against this same file, which does not preserve exact prose byte-offsets or line counts between commits. Per the plan's own instruction ("re-verify these line numbers against the file rather than trusting them" — stated for the three requirements-mapped citations, and the same caution clearly applies here too), the file was re-verified rather than the stale expectation trusted. No edit was made to either `20/20 plans` occurrence (there being only the one, and it correctly describes a DIFFERENT quantity — Phase 19's plan count, not a requirements count) — this criterion cannot be satisfied without fabricating a second occurrence that does not exist in the document, which would corrupt rather than preserve the file. Logged rather than silently passed over, per the executor's hard-gate discipline.

## Issues Encountered

- `gsd_run query roadmap.update-plan-progress 40` (run before this SUMMARY existed, to preview its effect) reported the phase still at `6/7` (correct — the SUMMARY did not exist yet) but reproduced the known pipe-spacing bug (`roadmap-progress-row-pipe-spacing.md`): the row rendered `| 40. ... | v0.9.0 | 6/7 | In Progress|  |` (lost the space before/after the trailing pipe and the `-` placeholder). That preview write was reverted (`git checkout -- .planning/ROADMAP.md`) before this SUMMARY was written; the tool is re-run and its output hand-repaired as part of this plan's final metadata commit, after this SUMMARY exists on disk so the count reads `7/7`.
- `npm run test:automated`'s first run this session showed 5 failures (the usual 3 in `anno-register.test.ts` plus a `check-skill-fork-honesty`/`audit-root-args.test.ts` failure referencing a `zz-scratch-mkE4QB` directory). A clean re-run settled at exactly 3 — confirming the documented, pre-existing `audit-root-args.test.ts` concurrent-scratch-file race (`WINDOWS.md` entry 54) rather than a regression from this plan's edits (which touched no test file and no production code).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 40 is complete: 7/7 plans, `PREP-01`/`PREP-02`/`PREP-04` Complete, `PREP-03` withdrawn and struck (never Complete, never silently deleted).
- `docs/phase40-preprocessing-tools-decisions.md` is the one place a later reader goes to understand why the struck ROADMAP/REQUIREMENTS lines read the way they do.
- Phase 41 (The Text Channel, Its Serialization Authority, and the Contention Verdict) depends on Phase 39's `go`/`R15` verdict, not on anything in this plan; nothing here blocks it.
- The Deferred Items ledger reads 7 open pending todos, one of which (`vicerc-scratch-dirs`) is explicitly eligible for a future broker-lifecycle phase.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: docs/phase40-preprocessing-tools-decisions.md
- FOUND: .planning/phases/40-the-three-preprocessing-host-tools/40-07-SUMMARY.md
- FOUND commit: 44216a38 (Task 1)
- FOUND commit: 6cdf48ff (Task 2)
- FOUND commit: b31d71b4 (Task 3)
- FOUND commit: ed17400a (PREP-01 mark-complete)
- Acceptance criteria re-verified: `grep -ac PREP-03 REQUIREMENTS.md ROADMAP.md` = 6, 7 (nonzero both); `grep -ac '19 total'`/`'Mapped to phases: 19'` REQUIREMENTS.md = 1, 1; `grep -ac '20/20 requirements mapped'` ROADMAP.md = 0; `grep -ac '19/19 requirements mapped'` ROADMAP.md = 2; `node --test docs-deferred-ledger.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts` = 27/27 pass; `ls .planning/todos/pending/*.md | wc -l` = 7; `grep -c reap-vicerc-scratch-dirs .planning/todos/pending/` = 1; `npm run test:automated` settles at 3/3584 failing (documented floor, confirmed on a clean re-run after one transient 5-failure run).
- One acceptance criterion NOT met, documented above as "Acceptance Criteria Not Met": `grep -ac '20/20 plans' .planning/ROADMAP.md` expects 2, reports 1 — a pre-existing measurement drift in the plan's own citation, not caused by this plan's edits (verified: the file has exactly one such literal, and it was not touched).
