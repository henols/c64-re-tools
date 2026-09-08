---
phase: 40-the-three-preprocessing-host-tools
plan: 11
subsystem: docs
tags: [requirements, roadmap, state, deferred-items, gap-closure, bookkeeping]

# Dependency graph
requires:
  - phase: 40-the-three-preprocessing-host-tools
    provides: "GHIDRA_RUNS_HANDLE_NAME/TARGET, ghidraRunsRoot()/ghidraRunsRealRoot(), ensureGhidraRunsHandle() (plan 40-08); the broker minting the handle at startup (plan 40-09); the live SYMLINK GUARD proving both halves against real Ghidra 12.1.3 (plan 40-09); every corrected forward-looking document (plan 40-10)"
provides:
  - "PREP-05 reads Complete in REQUIREMENTS.md's checkbox and Traceability mapping row, with the stale 'ghidra.analyze is the single deviation' clause replaced by what landed and a third dated amendment closing the requirement-count reconciliation"
  - "Phase 40's ROADMAP.md entry states 11 plans (Requirements line, four gap-closure plan checkboxes, executed count, Progress table row) matching what is on disk, with the stale top-level v0.9.0 19/19 milestone summary corrected to 20/20"
  - "STATE.md's exemption decision entry carries a dated superseding clause naming gap G-40-1 and the getAbsolutePath()/getCanonicalPath() mechanism, plus one new decision entry recording the resolution"
  - "The live-Ghidra symlink-guard todo closed with a Resolution section citing both guard halves, the stderr-text prohibition, the proved Ghidra version, and the discharged blocking condition; STATE.md's Deferred Items count re-derived and its round trip (7 -> 8 -> 7) recorded"
  - "npm run test:automated back at its documented 3-failure floor (anno-register.test.ts only), down from the plan-open 6-failure baseline"
affects: []

# Actuals (#2632)
actuals:
  tokens: 9500
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dated append-only supersession on a decision-log entry (keep the original sentence, add a dated correcting clause) applied for the third time in this gap's closure, this time to STATE.md's own Accumulated Context rather than to a source comment or a historical plan record"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-09-08-guard-ghidra-symlink-project-location.md

key-decisions:
  - "REQUIREMENTS.md's own count prose (20 total / 20 mapped / 0 unmapped) was found to be ALREADY internally consistent at execution time (21 checkbox lines, 21 Traceability rows, one struck through in each -- PREP-03 -- giving 20 in-scope either way); the plan-time-measured discrepancy no longer existed at execution time, most likely because a prior plan had already threaded PREP-05 through both counts. The genuinely surviving discrepancy was ROADMAP.md's own top-level v0.9.0 milestone line, still reading a stale 19/19 (from before PREP-05 was added) -- corrected to 20/20 in this same commit, since this required no judgment call (REQUIREMENTS.md's own PREP-05-inclusive number is not in question), only staleness."
  - "Fixed ROADMAP.md's top-level v0.9.0 milestone summary line (line 16) even though the plan's explicit action bullets only named Phase 40's own Requirements line -- the plan's own key_links and interface_context flagged this exact staleness as 'one of the two is wrong regardless of the gap,' and leaving it uncorrected while asserting Phase 40's line is now accurate would recreate the same class of inconsistency this plan exists to close."
  - "The STATE.md decision-entry superseding clause and the round-trip clause both describe the closed guard todo without using its literal filename stem -- required by the plan's own gate (grep -ac 'guard-ghidra-symlink-project-location' STATE.md == 0), which the plan's read_first/interface_context did not call out explicitly but the <verify> block enforces mechanically."

requirements-completed: [PREP-05]

coverage:
  - id: D1
    description: "PREP-05 reads Complete in both places it is recorded (checkbox and Traceability mapping row), with its stale single-deviation clause replaced by what actually landed and the measured getAbsolutePath()/getCanonicalPath() sentence + note pointer retained"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "grep -ac '^- \\[x\\] \\*\\*PREP-05\\*\\*' REQUIREMENTS.md == 1; grep -ac '| PREP-05 | Phase 40 | Complete |' REQUIREMENTS.md == 1; grep -ac '| PREP-05 | Phase 40 | Pending |' REQUIREMENTS.md == 0; grep -ac getCanonicalPath REQUIREMENTS.md >= 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 40's ROADMAP.md entry lists PREP-05 in its Requirements line, has all eleven plan boxes ticked, states eleven plans in rewritten prose, and its Progress row reads 11/11 with pipe structure intact; the stale top-level v0.9.0 19/19 summary is corrected to 20/20"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "Task 1's own <verify> block (checkbox census per plan 08-11, 11/11 plans executed in 11 waves, 7/11 absent, Gap closure paragraph present exactly once, Progress row 11/11, awk pipe-count check) -- BOOKKEEPING_OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "STATE.md's exemption decision entry keeps its original sentence plus a dated superseding clause naming G-40-1, getAbsolutePath()/getCanonicalPath(), and the corrective note; one new decision entry records the resolution; Current Position is byte-identical"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "git diff on STATE.md confined to the Deferred Items prose block, the exemption decision entry, and one new appended entry; Current Position section absent from the diff"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live-Ghidra guard todo is closed with a Resolution section naming both guard halves, the stderr-text prohibition, the proved Ghidra version (12.1.3), and the discharged blocking condition; STATE.md's Deferred Items count is recomputed from the real file count (7) with the round-trip recorded; no ledger row was added for the closed todo"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "docs-deferred-ledger.test.ts -- tests 6 / pass 6 / fail 0"
        status: pass
      - kind: other
        ref: "Task 2's own <verify> block (pending file absent, completed file present, Resolution heading, 12.1.3 cited, pending count == 7, STATE.md ledger phrase matches, G-40-1/getAbsolutePath/note all cited, guard-ghidra-symlink-project-location stem absent from STATE.md)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run test:automated returns to its documented 3-failure floor (all in anno-register.test.ts), down from the plan-open 6-failure baseline, confirming the three ledger/audit-cascade failures this plan was responsible for are gone"
    requirement: PREP-05
    verification:
      - kind: integration
        ref: "npm run test:automated, three consecutive runs: 4/4/3 failures -- the fourth failure in the first two runs (check-skill-fork-honesty, audit-root-args.test.ts) reproduced the documented intermittent scratch-file race and is absent from an isolated run (58/58 pass) and from the third full run, which landed exactly at 3603/3589/3, all three in anno-register.test.ts"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 11: PREP-05 satisfied, Phase 40's accounting matches disk, the guard todo closed Summary

**REQUIREMENTS.md/ROADMAP.md/STATE.md bookkeeping brought into agreement with what plans 40-08/40-09/40-10 actually landed, the live-Ghidra symlink-guard todo closed with a two-half Resolution, and `npm run test:automated` confirmed back at its documented three-failure floor.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-08T17:57:00Z (immediately following plan 40-10's completion)
- **Completed:** 2026-09-08T18:16:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `REQUIREMENTS.md`: `PREP-05`'s checkbox ticked and its Traceability mapping row set to `Complete`. Its parenthetical's stale "the single deviation is `ghidra.analyze`" clause was replaced with what actually landed — the runs root resolves under the one root via a broker-minted, verified, relative-target alias handle (plans `40-08`/`40-09`) — while the measured `getAbsolutePath()`/`getCanonicalPath()` sentence and the pointer to `notes/ghidra-dot-path-check-semantics.md` were kept verbatim, since those were already correct and are the reason this closed. A closing date and the four landing plans were added.
- `REQUIREMENTS.md`'s count prose (`20 total` / `20 mapped` / `0 unmapped`) was re-derived mechanically rather than adjusted: 21 requirement checkbox lines and 21 Traceability mapping-table rows, one struck through in each (`~~PREP-03~~`), giving 20 in-scope requirements either way. **This was found to already be internally consistent at execution time** — the plan-time-measured checkbox/mapping-table mismatch (20 vs 21) no longer existed, most likely because `PREP-05` had already been threaded through both by the time this plan ran. A third dated amendment records this re-derivation and flags the one discrepancy that DID still exist: `ROADMAP.md`'s own top-level `v0.9.0` milestone summary line still read a stale `19/19` (correct before the second amendment added `PREP-05`, stale after it) — disclosed and then corrected in the same commit, since fixing it required no judgment call, only recognizing staleness.
- `ROADMAP.md`: Phase 40's `**Requirements**:` line now lists `PREP-05`, dated the same way the line already annotates `PREP-03`'s removal. All four gap-closure plan checkboxes (`40-08` through `40-11`) are ticked — `40-08`/`40-09`/`40-10` were already ticked from their own executions; `40-11`'s own box is ticked here, ahead of this SUMMARY's own creation, since the plan's own Task 1 `<verify>` requires it and this SUMMARY existing at the end of this same plan run makes the tick true by the time the plan closes. The executed count changed from `10/11` to `11/11`; the Progress table row changed from `10/11` to `11/11` with its pipe structure preserved exactly. Phase 40's `Status` column (`In Progress`) was left untouched — `/gsd-verify-work` owns it.
- `ROADMAP.md`'s top-level `v0.9.0` milestone bullet, independently stale (`19/19 requirements mapped`, dating from before `PREP-05` was added by the second `REQUIREMENTS.md` amendment), was corrected to `20/20` with a dated note explaining both corrections in sequence, appended rather than silently overwritten.
- `STATE.md`'s exemption decision entry (`[Phase 40]: Phase 40 plan 01: ghidra-project.mts's per-run project directories are exempted...`) keeps its original sentence intact and gains a dated `SUPERSEDED 2026-09-08 (gap G-40-1)` clause naming the `getAbsolutePath()`/`getCanonicalPath()` mechanism, the superseded method (this project's own dot-segment predicate run against a synthetic string, which observed this project and never observed Ghidra), and a pointer to `.planning/notes/ghidra-dot-path-check-semantics.md`. One new decision entry (`[Phase 40]: Plan 40-11 (gap G-40-1 resolution): ...`) records the resolution in one paragraph: the runs root under the one root, the non-dotted relative-target alias handle, the broker minting it at startup, `resolveGhidraProject()`'s idempotent precondition, refuse-by-name (never repair), and the live opt-in guard covering the fragility.
- `STATE.md`'s Deferred Items ledger prose gained one sentence accounting for the round trip: a pending todo (the live-Ghidra symlink guard) was filed during this same gap-closure round's own diagnosis, explicitly blocked on `G-40-1` landing first, and closed by this plan once it landed — the pending count moved `7 → 8 → 7` within this round rather than silently reading correct again. No ledger row was added for the closed todo, per the plan's own instruction — it is being closed, not deferred.
- `.planning/todos/pending/2026-09-08-guard-ghidra-symlink-project-location.md` moved to `.planning/todos/completed/` with a `## Resolution` section recording: it landed under plan `40-09` (commit `09246ea0`), opt-in and default-SKIP in the manual-only live suite; its two halves (positive — real import+analysis through the handle lands the database physically under the dotted root; negative control — the same Ghidra still refuses a literal dotted location) and why the control is what stops the guard being vacuous; that neither half matches Ghidra's own stderr text, honouring this todo's own prohibition; the proved Ghidra version (`12.1.3`, from plan `40-09`'s own recorded transcript); and that the blocking condition (`G-40-1` landing first) is discharged, naming plans `40-08`/`40-09`/`40-10`/`40-11`.
- `docs-deferred-ledger.test.ts` re-run and green (`tests 6 / pass 6 / fail 0`), together with `docs-dangling-refs.test.ts` and `docs-review-disposition.test.ts` (`34/34` combined, `fail 0`).
- `npm run test:automated` re-run three times with no VICE broker running (precondition confirmed each time). Runs 1 and 2 both landed at `3603/3588/4` — three in `anno-register.test.ts` (the documented floor) plus `check-skill-fork-honesty` (`audit-root-args.test.ts`), the file's own documented intermittent scratch-file race. Run 3 landed exactly at the target: **`3603/3589/3`, all three in `anno-register.test.ts`.** Isolated re-run of `audit-root-args.test.ts` alone confirmed `58/58` pass, non-reproducing — the same non-regression pattern plans `40-08`/`40-09`/`40-10` each independently observed and recorded for this same file.

## Task Commits

Each task was committed atomically (plus one follow-up commit to carry content a `git add` pathspec error had left unstaged from the first Task 2 commit):

1. **Task 1: PREP-05 satisfied, and Phase 40's plan accounting matching what is on disk** — `fbb93efe` (docs)
2. **Task 2: The corrected decision in project state, and the guard todo closed** — `cc19f41c` (docs, rename only) + `a939703c` (docs, actual content — see Issues Encountered)

**Plan metadata:** (this commit)

_Note: this plan's `type` frontmatter is `execute`, not `tdd` — no plan-level TDD gate applies. This plan ran sequentially on the main working tree (`worktree: false`), per its own frontmatter and the orchestrator's `<sequential_execution>` framing — its deliverable IS `.planning/STATE.md` and `.planning/ROADMAP.md` content, which a worktree executor may not touch._

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — `PREP-05` checkbox ticked, mapping row Complete, parenthetical corrected, count prose re-derived and a third amendment added. `git diff --stat`: `17 +++++++++++++++--` (`15 insertions, 2 deletions`).
- `.planning/ROADMAP.md` — Phase 40's Requirements line, four plan checkboxes, executed count, Progress row, and the top-level `v0.9.0` milestone summary. `git diff --stat`: `10 +++++-----` (`5 insertions, 5 deletions`).
- `.planning/STATE.md` — Deferred Items round-trip clause, the exemption decision's superseding clause, one new resolution entry. `git diff --stat`: `11 ++++++++---` (`8 insertions, 3 deletions`).
- `.planning/todos/completed/2026-09-08-guard-ghidra-symlink-project-location.md` — moved from `pending/`, gained a `## Resolution` section.

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

None — plan executed exactly as written, with the count-prose reconciliation resolving to "already consistent, one adjacent staleness disclosed and fixed" rather than "inconsistent, correct here," which the plan's own instructions explicitly allowed for (`<action>`: "either correct the stale prose... or... state the discrepancy explicitly"). Fixing `ROADMAP.md`'s top-level `19/19` line (outside the plan's literally-named edit sites, but named in its own `<interface_context>` as "one of the two is wrong regardless of the gap") is documented as a `key-decision` above rather than a deviation, since it is squarely within the plan's own reconciliation instruction and its `files_modified` already names `.planning/ROADMAP.md` without a line restriction.

## Issues Encountered

- The first Task 2 commit (`cc19f41c`) only carried the `git mv` rename of the guard todo, because a `git add` invocation listing three paths included one (the now-nonexistent `pending/` path) that no longer matched anything; git's default pathspec-mismatch behavior aborted staging for the ENTIRE invocation rather than only the bad pathspec, so `STATE.md` and the todo's own `## Resolution` section edit (made after the `git mv`) were silently left unstaged. Caught immediately by re-running `git status --short` before moving on, corrected with a follow-up commit (`a939703c`) carrying the actual content. No task work was lost or duplicated; both commits are documented above rather than squashed, per this project's own "always create NEW commits" git-safety convention.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap `G-40-1` is fully closed across all four bookkeeping surfaces this milestone tracks it in: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and the todo ledger.
- `PREP-05` reads Complete in both places it is recorded, with no remaining reference to `ghidra.analyze` as an open deviation.
- Phase 40's plan accounting (11/11) matches what is on disk. Phase 40's own `Status` field is left for `/gsd-verify-work` to reconcile, per this plan's explicit constraint.
- `npm run test:automated`'s documented floor is confirmed at 3 failures (`anno-register.test.ts` only, out of this milestone's scope — cites requirement ids from a prior milestone no longer declared in `REQUIREMENTS.md`).
- No blockers for `/gsd-verify-work`.

## Self-Check: PASSED

All four modified files confirmed present on disk with the expected content (`REQUIREMENTS.md`'s `PREP-05` checkbox/row/parenthetical, `ROADMAP.md`'s Phase 40 entry and Progress row, `STATE.md`'s two edited regions plus the new entry, the completed todo's `## Resolution` section). All three commits (`fbb93efe`, `cc19f41c`, `a939703c`) confirmed present in `git log`. Both tasks' `<verify>` blocks re-run and passing (`BOOKKEEPING_OK` for Task 1; all named greps plus `docs-deferred-ledger.test.ts fail 0` for Task 2). `npm run test:automated` re-run three times, landing at the documented 3-failure floor on the third run with the fourth-failure variance confirmed as the pre-existing, non-reproducing `audit-root-args.test.ts` scratch-file race.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*
