---
phase: quick-260915-hwe
plan: 01
subsystem: planning-records
tags: [planning-hygiene, roadmap, concerns, todos, state]

requires: []
provides:
  - "19 empty, untracked `.planning/vice-proxy-evidence-test-*` directories deleted"
  - "The 2026-09-13 scratch-dir-leak todo moved to completed/ with a Resolution section"
  - "STATE.md's Deferred Items ledger row for that todo deleted, preamble count corrected to 14 open"
  - "The matching CONCERNS.md entry rewritten in place and marked resolved"
  - "ROADMAP.md's stale paragraph above the Progress table replaced with an accurate reason to keep it"
affects: [planning-hygiene, roadmap-maintenance]

actuals:
  tokens: 1911
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - .planning/codebase/CONCERNS.md
    - .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md
    - .planning/STATE.md

key-decisions:
  - "Left the v0.9.0 close footnote below the Progress table byte-identical. It is a dated 2026-09-10 record. It was true when written. It is out of scope for this plan (correction C2)."
  - "Did not correct the already-wrong '10 pending' figure in STATE.md's ### Pending Todos section (near line 1458). That figure was wrong before this task. Correcting it was out of scope."
  - "Closed the todo as MOOT, not as corrected. The defect it described has no live mechanism. The writer that caused it is already deleted. There was nothing left to correct, only to check as gone."

patterns-established: []

requirements-completed: [QUICK-260915-hwe]

coverage:
  - id: D1
    description: "Delete the 19 empty, untracked vice-proxy-evidence-test-* residue directories"
    verification:
      - kind: other
        ref: "find .planning -maxdepth 1 -name 'vice-proxy-evidence-test-*' | wc -l -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Move the 2026-09-13 todo to completed/ with a Resolution section naming d8ed053e and all three moot remedies"
    requirement: QUICK-260915-hwe
    verification:
      - kind: other
        ref: "grep -q '^## Resolution' + grep -q 'd8ed053e' on the completed todo file"
        status: pass
    human_judgment: false
  - id: D3
    description: "Delete STATE.md's Deferred Items row for the retired todo. Correct the ledger preamble to 14 open."
    verification:
      - kind: other
        ref: "grep -c slug .planning/STATE.md -> 3, grep -q '14 open' .planning/STATE.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rewrite the CONCERNS.md entry in place. Mark it resolved with the closing commit hash and a pointer to the completed todo."
    verification:
      - kind: other
        ref: "grep -q 'd8ed053e' .planning/codebase/CONCERNS.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replace the ROADMAP.md paragraph above the Progress table with an accurate reason to keep it. Name 276c15c9 as the commit that deleted the former test consumer."
    verification:
      - kind: other
        ref: "grep -q '276c15c9' .planning/ROADMAP.md, sed -n '/^## Progress/,$p' .planning/ROADMAP.md | grep -c '^| [0-9]' -> 60"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-15
status: complete
---

# Quick Task 260915-hwe: Retire Two Stale Planning Records Summary

**Deleted 19 residue directories. Closed a moot test-leak todo with a full closure record. Replaced a ROADMAP paragraph that cited a deleted test as its reason to keep the Progress table.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 4 (`.planning/ROADMAP.md`, `.planning/codebase/CONCERNS.md`, the retired todo, `.planning/STATE.md`)
- **Directories deleted:** 19 (untracked, produce no git diff)

## Accomplishments

- Deleted all 19 `.planning/vice-proxy-evidence-test-*` directories. Checked each one empty individually first. Zero skipped.
- Checked again that the writer `tmpWorkspaceIncidentsDir()` is absent from the tree (grep over `*.ts`/`*.mts`/`*.mjs`, zero hits). Checked that no `mkdtemp` call is rooted at `.planning` anywhere. Both checks ran before any deletion.
- Moved `.planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` to `completed/` via `git mv`. Kept its original body byte-identical. Appended a `## Resolution` section naming commit `d8ed053e` and all three now-moot candidate remedies (startup reap, relocated base, gitignore rule).
- Made exactly two targeted line edits to `.planning/STATE.md`. Deleted the Deferred Items row for the retired todo. Corrected the ledger preamble from "15 open" to "14 open". Left the three historical mentions of the slug (lines 247, 267, 1460) untouched. The slug count is now exactly 3.
- Rewrote the matching `CONCERNS.md` entry in place. Did not move it into the "Resolved Since The Last Audit" table, which covers only the superseded 2026-08-11 audit. Marked it resolved with the date 2026-09-15 and the closing commit hash.
- Replaced the ROADMAP.md paragraph above the `## Progress` table. It previously claimed `comment-phase-pointers.test.ts` parses the table and enforces it. Commit `276c15c9` deleted that test. The new paragraph states the accurate reason to keep the table: it is the only current, complete per-phase record. Archived milestone ROADMAPs are frozen cumulative snapshots. `v0.9.0` stops at 47 rows with nothing for Phases 45-56. The new paragraph also states plainly that no test reads the table today.
- All 60 live `## Progress` table rows survive unchanged, including the cut/dissolved rows (`6.`, `20.`, `21.`, `22.`, `25.`).
- All seven archived `.planning/milestones/v0.*-ROADMAP.md` files are untouched (`git status --porcelain .planning/milestones/` prints nothing).

## Task Commits

1. **Task 1: Delete the 19 empty residue directories** — no commit. The directories were untracked by git. Deletion of untracked, gitignore-uncovered directories produces no git diff to stage. The plan measured this at planning time as B2/B3. The executor re-checked it before deletion.
2. **Task 2: Move the todo, delete its live ledger row** — `57f80e35` (chore, git-mv rename) + `988fc67e` (docs, Resolution section content). See Deviations below for why this task took two commits. `STATE.md`'s edit was made but left unstaged on purpose. STATE.md docs commits are the orchestrator's responsibility.
3. **Task 3: Mark the CONCERNS entry resolved, replace the ROADMAP paragraph** — `d4a5aca5` (docs).

_Note: Task 2 ended up as two commits rather than one because of a staging-order slip. See Deviations._

## Files Created/Modified

- `.planning/ROADMAP.md` — replaced the stale paragraph above `## Progress` (lines 2102-2109) with an accurate reason to keep the table. Named commit `276c15c9`.
- `.planning/codebase/CONCERNS.md` — rewrote the "Test-leaked scratch directories accumulate in `.planning/`" entry in place. Marked it resolved 2026-09-15. Named commit `d8ed053e`.
- `.planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` — moved from `pending/`. Original body preserved. `## Resolution` section appended.
- `.planning/STATE.md` — two targeted line edits (Deferred Items row deleted, ledger preamble corrected to 14 open). **Left unstaged.** Not committed by this plan. The orchestrator's docs commit will pick it up.

## Decisions Made

- Closed the todo as **MOOT**, not as corrected. Nothing needed correcting. The defect's cause, the writer, was already deleted by an unrelated prior commit (`d8ed053e`).
- Left the v0.9.0 close footnote below the Progress table (line 2272, "`comment-phase-pointers.test.ts` parses it, and collapsing it empties the cut-phase set...") byte-identical. It is a dated 2026-09-10 record. It was true at the time it was written. It is out of this plan's authorized scope (correction C2 in the plan).
- Did not correct the pre-existing wrong "10 pending" figure in STATE.md's `### Pending Todos` section (near line 1458). That figure was already wrong before this task. The tree held 15 files, not 10, per the plan's B12 baseline. This task's own change moves the real count from 15 to 14. A later reader must not conflate the two changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Staging-order slip split Task 2 into two commits**
- **Found during:** Task 2, immediately after the first commit.
- **Issue:** `git add <old-pending-path> <new-completed-path>` was run in one command. The pending path no longer existed. `git mv` had already moved it. That pathspec failed with `fatal: pathspec ... did not match any files`. The working-tree edit to the completed file, the `## Resolution` section added via a separate `Edit` call after the `git mv`, was never staged for the first commit. The first commit landed as a pure rename with 0 content change.
- **Fix:** Checked `git status` after the commit. Found the Resolution content still unstaged. Staged it. Made a second commit (`988fc67e`) rather than amending the first, per the rule to create new commits instead of amending.
- **Files affected:** `.planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md`.
- **Verification:** Post-commit `grep -q '^## Resolution'` and `grep -q 'd8ed053e'` both pass against the file on disk after the second commit. `git status --porcelain` shows no remaining diff on that file.
- **Committed in:** `988fc67e`.

---

**Total deviations:** 1 auto-fixed (Rule 1, git-mechanics self-correction, no content or scope impact).
**Impact on plan:** None on outcome. The final file content matches the plan's requirements exactly. Only the commit history shows two commits instead of one for that step.

## Issues Encountered

None beyond the staging-order slip documented above.

## Scope Verification

- `git status --porcelain -- src scripts installer .github` is **not empty**. It shows the same 4 pre-existing modified files (`src/mcp/vice/anno-bank.ts`, `anno-coverage.ts`, `anno-enum-gen.ts`, `anno-tools.ts`) that were already dirty in the working tree before this plan started. This was checked against the orchestrator-supplied initial `git status` snapshot. This plan introduced zero changes under `src/`, `scripts/`, `installer/`, or `.github/`. No path in those trees was touched, staged, or committed by any of this plan's three commits.
- `git status --porcelain .planning/milestones/` is empty. All seven archived milestone ROADMAPs are unchanged.
- Checked that `.planning/quick/260915-hwe-retire-two-stale-planning-records-delete/`, `docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`, `setup-claude-ste100.sh`, and `.claude/settings.json` were left untouched. All are pre-existing per the constraints. None were staged or committed.

## Self-Check

Ran targeted checks against the completed work:

- `find .planning -maxdepth 1 -name 'vice-proxy-evidence-test-*' | wc -l` → `0`. **FOUND: all 19 directories deleted.**
- `test -e .planning/todos/completed/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` → true. **FOUND.**
- `test ! -e .planning/todos/pending/2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` → true. **CHECKED: no longer in pending/.**
- `git log --oneline --all | grep -q 57f80e35` → found. **FOUND.**
- `git log --oneline --all | grep -q 988fc67e` → found. **FOUND.**
- `git log --oneline --all | grep -q d4a5aca5` → found. **FOUND.**
- `sed -n '/^## Progress/,$p' .planning/ROADMAP.md | grep -c '^| [0-9]'` → `60`. **CHECKED: all Progress rows survive.**
- `grep -c 'vice-proxy-test-leaks-scratch-dirs-into-planning-root' .planning/STATE.md` → `3`. **CHECKED: ledger row gone, 3 historical mentions survive.**

## Self-Check: PASSED

## Next Phase Readiness

No next phase. This is a standalone quick task. No blockers. STATE.md holds an intentional, unstaged content edit. The orchestrator's docs commit will pick it up alongside this SUMMARY.

---
*Phase: quick-260915-hwe*
*Completed: 2026-09-15*
