---
phase: 03-direct-tools
plan: 17
subsystem: testing
tags: [ci, github-actions, npm-publish, release-on-merge, check-npm-packages, uat-gap-closure]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-15's npm-test timeout fix and 03-16's flag-bit live check, both re-validated here under CI's own env/order"
provides:
  - "A full local reproduction of ci.yml's `build` job (six steps, CI's env vars, CI's order) against HEAD 700daded1fc0b9baf39337d3066baec69574ae37"
  - "An authorised, developer-selected route (pr-branch) for how this tree reaches GitHub Actions, with the release consequence stated up front"
  - "A documented execution-environment finding: worktree checkouts nested under `.claude/` spuriously fail repo-root.test.ts:152 and must be excluded from CI-equivalence gating"
affects: ["03-18"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Local CI-equivalence run as a blocking pre-push gate, run on the primary checkout only (never inside a nested worktree)"]

key-files:
  created: [".planning/phases/03-direct-tools/03-17-SUMMARY.md"]
  modified: []

key-decisions:
  - "Route authorised: pr-branch — push a branch and open a PR against main, running the full `build` job with no publish/tag/release, leaving main untouched until a deliberate later merge"
  - "push-main-skip-release, push-main-release, and defer were all declined"
  - "No push, branch, tag, PR, or publish was performed by this plan — 03-18 executes the authorised route"

patterns-established:
  - "CI-equivalence steps must be run on the primary checkout, not inside a `.claude/worktrees/*` nested checkout — the latter trips a spurious repo-root.test.ts failure unrelated to the code under test"

requirements-completed: [BACK-02]

# Metrics
duration: N/A (evidence-and-decision plan; task 1 execution time not separately tracked)
completed: 2026-08-16
---

# Phase 3 Plan 17: Local CI-Equivalence Evidence and Push Authorisation Summary

**Reproduced all six of ci.yml's `build` job steps locally against HEAD `700daded1fc0b9baf39337d3066baec69574ae37` (5 pass, 1 correctly skipped), then obtained explicit developer authorisation for route `pr-branch` — no push, branch, tag, or publish performed.**

## Performance

- **Tasks:** 2 (Task 1: local CI reproduction — complete; Task 2: blocking decision checkpoint — resolved)
- **Files modified:** 0 (evidence/decision-only plan, plus this SUMMARY)

## Accomplishments

- Ran every step of `ci.yml`'s `build` job locally, in ci.yml's own order, under ci.yml's own env vars (`CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH`), each under an explicit timeout.
- Confirmed the working tree is clean after `package.sh`, apart from gitignored `dist/*` output and three pre-existing untracked entries.
- Presented the release-mechanics facts (auto-publish on push to `main` absent `[skip release]`; PR-only `build` job with no publish) and obtained the developer's explicit route selection.
- Diagnosed and documented a worktree-specific false-failure in `repo-root.test.ts` so it does not get mistaken for a real regression in future CI-equivalence runs.

## Local CI-Equivalence Result Table

Run on the primary checkout (`/home/henrik/dev/henrik/git/c64-re-tools`), HEAD
`700daded1fc0b9baf39337d3066baec69574ae37` (subject: `docs(phase-03): update
tracking after wave 2`, no `[skip release]` marker).

Env used for every step:
```
CONTAINER_WORKSPACE_PATH=/home/henrik/dev/henrik/git/c64-re-tools
HOST_WORKSPACE_PATH=/host/home/henrik/dev/henrik/git/c64-re-tools
```

| # | Step (ci.yml name) | Command | Exit | Duration | Result |
|---|---|---|---|---|---|
| 1 | Install MCP server dependencies | `npm ci --no-audit --no-fund` (`.claude/mcp/vice`) | — | — | Skipped — named deviation. `node_modules` present and newer than the unchanged `package-lock.json`; the plan's own condition says skip. |
| 2 | Typecheck | `npm run typecheck` (`.claude/mcp/vice`) | 0 | 1s | PASS |
| 3 | Test | `npm test` (`.claude/mcp/vice`), under `timeout 900` | 0 | 124s | PASS — 1099 tests, 1092 pass, 0 fail, 2 skipped, 5 todo |
| 4 | Smoke-test the MCP server | `npm run smoke` (`.claude/mcp/vice`) | 0 | 1s | PASS — initialize + tools/list handshake completed (server vice, 61 tools advertised) |
| 5 | Validate npm package contents | `node scripts/check-npm-packages.mjs` (repo root) | 0 | 2s | PASS — `check-npm-packages: OK — @henols/vice-mcp@0.1.1 42 files, @henols/c64-re-tools@0.1.1 35 files + 6 skills` |
| 6 | Build installable package | `bash scripts/package.sh` (repo root) | 0 | 1s | PASS — built `dist/c64-re-tools-0.1.1.zip`, 329 files, sha256 `50cd8b31...` |

Six of six accounted for (five run at exit 0, one correctly skipped per the
plan's deviation rule). `check-npm-packages` (step 5) is the artifact this
plan's `must_haves.artifacts` entry requires this SUMMARY to record.

Working tree clean afterwards — only gitignored `dist/*` plus three
pre-existing untracked entries (`.claude/settings.json`, `.claude/worktrees/`,
`.vscode/`).

## Repo State

Local `main` is **237 commits ahead** of `origin/main`, 0 behind
(`git rev-list --left-right --count origin/main...HEAD` → `0  237`).

**Discrepancy noted:** the plan text (03-17-PLAN.md) says "214 ahead" — that
figure was accurate when 03-17 was authored. 23 further commits have landed
since. This SUMMARY records 237 as the current, re-measured figure at the time
this plan was executed.

## Release Mechanics (for the record)

- `release-on-merge` publishes BOTH npm packages (`@henols/vice-mcp` and
  `@henols/c64-re-tools`) on any push to `main` whose head commit subject
  lacks `[skip release]`.
- A `pull_request` targeting `main` runs the `build` job only — no publish, no
  tag, no GitHub release.
- Pushing a branch without opening a PR triggers nothing (`on.push` is
  restricted to `main` and `v*` tags).

## Task Commits

This is an evidence-and-decision plan with `files_modified: []` in its
frontmatter — no repository files were changed by Task 1 or Task 2, so there
is no per-task code commit. The only commit produced by this plan is this
SUMMARY's own metadata commit (see plan-metadata commit hash in the executor's
completion report).

## Decisions Made

**Selected route: `pr-branch`** — push a branch and open a PR against `main`.

Verbatim intent given by the developer: push a branch and open a PR against
`main`. This runs the full `build` job against this exact tree, cannot publish
to npm, and leaves `main` untouched until a deliberate later merge.

Rationale given: milestone v0.2.0 is only 3 of 8 phases done, so publishing
now would ship a partial stock backend to real users.

**Explicitly NOT authorised** by this decision: pushing to `main` (with or
without `[skip release]`), tagging, creating a GitHub release, or
`npm publish`.

The other three options presented (`push-main-skip-release`,
`push-main-release`, `defer`) were declined.

## Deviations from Plan

### Auto-fixed Issues

None in the code-change sense — this plan modifies no repository files.

### Named Deviations (per plan's own rules)

**1. `npm ci` step skipped, as explicitly permitted by the plan**
- **Found during:** Task 1
- **Condition:** Plan step 1 says run `npm ci` "only if `node_modules` is
  absent or `package-lock.json` is newer."
- **Observation:** `node_modules` was present and newer than the unchanged
  `package-lock.json`.
- **Action:** Skipped, recorded as a named deviation per the plan's own
  instruction — not a silent omission.

**2. Worktree-nested checkout produced a spurious `repo-root.test.ts` failure — execution-environment finding, not a code defect**
- **Found during:** A first attempt at this plan, run inside a git worktree
  (`.claude/worktrees/agent-<id>/`).
- **Issue:** Task 1's gate tripped at step 3 (`npm test`): exit 1 with exactly
  one failing test, `repo-root.test.ts:152` ("the agreed directory must not
  sit under .claude").
- **Root cause:** The executor's own checkout was nested under a `.claude/`
  path in that attempt. `repo-root.ts`'s "must not sit under .claude"
  invariant correctly fired against the checkout's own location — this is
  the test doing its job against an environment it was never meant to run
  inside, not a regression in the code under test.
- **Does it reproduce on the primary checkout?** No. The orchestrator
  independently ran the same suite there twice today: 1097/0 fail and 1099/0
  fail. This plan's own Task 1 run (recorded in the table above) also passed
  clean: 1092/0 fail (2 skipped, 5 todo — different pass count reflects test
  suite growth between the two orchestrator runs and this run, not flakiness).
- **Can it occur on GitHub's runner?** No — GitHub Actions' checkout is never
  nested under a `.claude/` path.
- **Match to existing tracking:** This matches deferred-items.md item #1.
- **Resolution:** The gate was **not** overridden. The plan was re-run on the
  primary checkout (`/home/henrik/dev/henrik/git/c64-re-tools`, branch
  `main`, not a worktree) so the gate could be evaluated in a valid
  environment — where it passed cleanly, as recorded in the result table
  above.
- **Action for future plans:** Local CI-equivalence runs must be executed on
  the primary checkout, never inside a nested `.claude/worktrees/*` checkout.

---

**Total deviations:** 1 plan-sanctioned skip (`npm ci`), 1 execution-environment
finding requiring a re-run on the correct checkout (no code change, no gate
override).
**Impact on plan:** None on correctness of the evidence recorded — the
worktree finding is now documented so it isn't mistaken for a regression in
a future CI-equivalence run.

## Issues Encountered

See "Named Deviations" above — both were anticipated/permitted by the plan
(the `npm ci` skip) or resolved by re-running in the correct environment (the
worktree false-failure). No unresolved issues remain.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-18 has its single input ready: the authorised route is `pr-branch`.
- 03-18 must push a branch and open a PR against `main` only — it must NOT
  push to `main`, tag, create a GitHub release, or run `npm publish`.
- This plan performed zero remote git actions (no push, branch, tag, PR, or
  publish) — that work is entirely deferred to 03-18, per the plan's own
  boundary.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-16*
