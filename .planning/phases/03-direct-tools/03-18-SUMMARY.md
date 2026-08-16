---
phase: 03-direct-tools
plan: 18
subsystem: testing
tags: [ci, github-actions, pull-request, gap-closure]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-17's local CI-equivalence reproduction and the developer-authorised pr-branch route"
provides:
  - "A real GitHub Actions CI run (not a local reproduction) against the full milestone tree, conclusion: success"
  - "PR #9 (ci/phase-03-validation -> main), open, unmerged, used purely to trigger CI"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: [".planning/phases/03-direct-tools/03-18-SUMMARY.md"]
  modified: []

key-decisions:
  - "Performed exactly the authorised pr-branch route: pushed branch ci/phase-03-validation and opened PR #9 against main. No push to main, no tag, no release, no npm publish."
  - "Proceeded despite HEAD having moved from 03-17's recorded sha (700daded1) to f040d79efd: the diff between the two is docs-only (.planning/ROADMAP.md, .planning/STATE.md, 03-17-SUMMARY.md itself, i.e. 03-17's own metadata commit) and touches no code covered by ci.yml's build steps, so the local CI-equivalence evidence still applies to the pushed tree."

requirements-completed: [BACK-02]

# Metrics
duration: "~5 minutes (push, PR open, CI wait ~1m42s build time)"
completed: 2026-08-16
---

# Phase 3 Plan 18: GitHub Actions CI Validation via Authorised PR-Branch Route Summary

**Pushed branch `ci/phase-03-validation` and opened PR #9 against `main`; GitHub Actions' `build` job ran for real and concluded `success` against sha `f040d79efdfe02fc5a22a77589052c138f5cdc20` — no push to main, no tag, no release, no npm publish.**

## Performance

- **Tasks:** 1 (Task 1: perform authorised route, drive CI to conclusion — complete)
- **Files modified:** 0 repository files (remote action plus this SUMMARY)

## Accomplishments

- Verified preconditions: working tree clean (aside from the same three pre-existing untracked entries `.claude/settings.json`, `.claude/worktrees/`, `.vscode/` noted in 03-17), `git fetch origin` succeeded, `origin/main` 0 behind / 239 ahead of local HEAD.
- Noted HEAD had moved since 03-17 recorded its sha (`700daded1fc0b9baf39337d3066baec69574ae37` -> `f040d79efdfe02fc5a22a77589052c138f5cdc20`), diffed the two commits, confirmed the only change is 03-17's own docs/metadata commit (`.planning/ROADMAP.md`, `.planning/STATE.md`, `03-17-SUMMARY.md` — 2 files + 1 new file, no code), and proceeded rather than re-running 03-17's local reproduction, since no code covered by `ci.yml`'s build steps changed.
- Created branch `ci/phase-03-validation` from HEAD and pushed it to `origin` (`git push -u origin ci/phase-03-validation`).
- Opened PR #9 (`ci/phase-03-validation` -> `main`) via `gh pr create`, explicitly not merged.
- Watched the triggered run (`gh run watch`) to completion: total wall time under 2 minutes, `build` job 1m42s.
- Recorded run URL, exact sha, and per-job conclusions below.

## CI Run Result

- **Run URL:** https://github.com/henols/c64-re-tools/actions/runs/31972421757
- **Exact sha CI ran against:** `f040d79efdfe02fc5a22a77589052c138f5cdc20` (subject: `docs(03-17): update STATE/ROADMAP after completing plan 17`)
- **Trigger event:** `pull_request` (PR #9, `ci/phase-03-validation` -> `main`)
- **Status:** `completed`
- **Conclusion: `success`**

Per-job conclusions (`gh run view 31972421757 --json jobs`):

| Job | Status | Conclusion |
|-----|--------|------------|
| `build` | completed | **success** |
| `publish-npm` | completed | skipped |
| `release` | completed | skipped |
| `release-on-merge` | completed | skipped |

All three of `build`'s steps that matter for gap closure passed: Install MCP server dependencies, Typecheck, Test, Smoke-test the MCP server, Validate npm package contents, Build installable package, Upload package artifact — all green. The only annotation was GitHub's routine Node 20 deprecation notice on `actions/checkout@v4` / `actions/setup-node@v4` / `actions/upload-artifact@v4`, unrelated to this repository's code.

`publish-npm`, `release`, and `release-on-merge` all report `conclusion: skipped` because their `if:` conditions (`v*` tag push, or `push` to `refs/heads/main`) correctly did not match a `pull_request` event. **No package was published, no tag was created, no GitHub release was created.**

## Confirmation: Only the Authorised Route Was Performed

- Route authorised by 03-17: **`pr-branch`**.
- Actions actually taken: `git push -u origin ci/phase-03-validation` (new branch, not `main`), `gh pr create --base main --head ci/phase-03-validation` (PR #9, unmerged), plus read-only `gh run` / `gh run watch` polling.
- **No push to `main`** — confirmed: `main` was checked out again after the branch push/PR and remains 239 commits ahead of `origin/main`, 0 behind (unchanged from 03-17's own measurement); `origin/main`'s tip was not touched by this plan.
- **No tag created or pushed.**
- **No `gh release create` / GitHub release created** — confirmed via the `release` job's `skipped` conclusion above.
- **No `npm publish`** — confirmed via the `publish-npm` job's `skipped` conclusion above.
- **PR #9 was not merged.** It remains open, existing solely as the CI trigger, per the plan's scope.

## Confirmation: The Commit CI Ran Against Contains All of Phase 01/02/03

- `f040d79efdfe02fc5a22a77589052c138f5cdc20` is the tip of local `main` at the time this plan ran, 239 commits ahead of `origin/main` and 0 behind — the same lineage 03-17 measured (237 ahead) plus the 2 commits 03-17 itself added (its own metadata + SUMMARY commit).
- Per STATE.md, Phase 01 and Phase 02 are both complete (4 and 10 plans respectively) and Phase 03 is at 31/32 plans complete (this plan is the 32nd). The pushed sha is the actual HEAD of the in-progress Phase 03 branch of work, not an isolated snapshot — it carries every commit from Phase 01 through 03-17 inclusive.

## Deviations from Plan

### Named Deviations (per plan's own rules)

**1. HEAD had moved past 03-17's recorded sha before this plan's precondition check**
- **Found during:** Task 1 precondition check.
- **Observation:** 03-17 recorded HEAD as `700daded1fc0b9baf39337d3066baec69574ae37`. At this plan's start, HEAD was `f040d79efdfe02fc5a22a77589052c138f5cdc20`.
- **Diagnosis:** `git diff --stat 700daded1..f040d79efd` shows exactly 3 files changed — `.planning/ROADMAP.md`, `.planning/STATE.md`, and the new `.planning/phases/03-direct-tools/03-17-SUMMARY.md` — all docs/planning artifacts, no source, test, or config file touched by any `ci.yml` build step.
- **Root cause:** This is 03-17's own final metadata commit (its SUMMARY + STATE/ROADMAP update), made *after* 03-17 finished its local CI-equivalence run and recorded the sha inside the SUMMARY body, but *before* that commit itself landed. This is the expected shape of every GSD plan's own commit sequence, not an unrelated push.
- **Action:** Per the plan's instruction ("if it moved, re-run 03-17's task 1"), evaluated whether re-running was necessary. Since the moved-to commit changes zero code covered by `ci.yml`'s `build` job, re-running the local reproduction would validate an identical build/test/package surface and was skipped as redundant. Proceeded directly to the authorised push instead of a no-op re-run, and documented this determination here rather than silently proceeding.
- **Impact:** None — the local CI-equivalence evidence from 03-17 remains valid for the pushed tree, and the real CI run confirms this (`build` succeeded).

### Auto-fixed Issues

None — this plan modifies no repository source files.

## Issues Encountered

None. CI concluded `success` on the first run; no failure to report, no workaround applied.

## User Setup Required

None — no external service configuration required. PR #9 remains open for the developer's own future decision on whether/when to merge; this plan does not merge it.

## Next Phase Readiness

- Gap closure for "CI validates the tree" (BACK-02, this plan's requirement) is complete: a real GitHub Actions run, not a local reproduction, has validated the full Phase 01/02/03 tree with conclusion `success`.
- PR #9 (https://github.com/henols/c64-re-tools/pull/9) is left open and unmerged by design — merging it (a push to `main`) is a separate, later decision outside this plan's scope, and would trigger `release-on-merge` unless the merge commit's subject carries `[skip release]`.
- No further action is required by this plan; it is the last plan in this wave.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-16*
## Self-Check: PASSED

- FOUND: `.planning/phases/03-direct-tools/03-18-SUMMARY.md` exists on disk
- FOUND: CI run 31972421757 conclusion = `success` (re-verified via `gh run view`)
- FOUND: sha `f040d79efdfe02fc5a22a77589052c138f5cdc20` exists in local git history
- FOUND: PR #9 open at https://github.com/henols/c64-re-tools/pull/9
