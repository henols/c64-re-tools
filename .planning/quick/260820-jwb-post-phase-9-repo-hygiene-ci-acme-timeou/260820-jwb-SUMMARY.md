---
phase: quick-260820-jwb
plan: 01
subsystem: infra
tags: [ci, github-actions, gitignore, npm-pack, documentation]

# Dependency graph
requires: []
provides:
  - "CI's ACME install step fails within ~5 minutes on a mirror stall instead of hanging up to 6 hours"
  - "Bounded 3-attempt apt retry (shell-level and apt-level) for transient mirror flakes"
  - ".vice-snapshots/, .vscode/, and .claude/settings.json gitignored, verified not to affect published npm tarballs"
  - "PROJECT.md and STATE.md corrected to the true, non-decaying release position"
affects: [ci, release, publish-npm, release-on-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded retry helper (retry_apt) wrapping apt-get calls with both a shell-level 3-attempt loop and apt's own Acquire::Retries/Timeout options, preserving set -euo pipefail as the final fatal gate"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .gitignore
    - .planning/PROJECT.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md (moved from pending/)

key-decisions:
  - "Release-status corrections describe relationships (in sync with origin/main, every local tag pushed) rather than a commit count or ahead/behind number, so the correction cannot rot the same way the '386 commits ahead' claim did"
  - "retry_apt() wraps both apt-get calls (update, install) in one 3-attempt shell loop plus Acquire::Retries=3/Acquire::http::Timeout=30, so both a hung TCP connection and a repeatedly-failing mirror are bounded"

patterns-established:
  - "Bounded-retry-then-fatal pattern for CI steps that hit an untrusted third-party network (apt) but must still fail loudly on a genuine problem, not silently degrade"

requirements-completed: [HYGIENE-01, HYGIENE-02, HYGIENE-03]

# Metrics
duration: 12min
completed: 2026-08-20
---

# Quick Task 260820-jwb: Post-Phase-9 Repo Hygiene Summary

**Bounded CI's ACME install with a 5-minute timeout and 3-attempt apt retry, gitignored three runtime/local byproducts with tarball-drift verification, and corrected four stale "386 commits ahead at v0.1.10" release claims to the true, non-decaying v0.2.0-shipped position.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-20T12:18:00Z (approx.)
- **Completed:** 2026-08-20T12:30:10Z
- **Tasks:** 3
- **Files modified:** 5 (1 renamed)

## Accomplishments
- CI's `Install ACME cross-assembler` step now carries `timeout-minutes: 5` and a `retry_apt()` helper (3 attempts, apt-level `Acquire::Retries=3`/`Acquire::http::Timeout=30`) around both `apt-get` calls, while `set -euo pipefail`, `command -v acme`, and the banner grep survive verbatim as the fatal gate. The CI-hang todo describing the 25-minute stall is closed (moved to `.planning/todos/completed/`).
- `.gitignore` gained `/.vice-snapshots/`, `/.vscode/`, and `/.claude/settings.json`, each with a WHY comment matching the file's existing convention. Verified per-path with `git check-ignore -q` (a multi-path check-ignore call is documented as broken — exits 128) that all three are now ignored, `git status` is clean of them, `node scripts/check-npm-packages.mjs` still reports both tarballs' file lists exactly correct, and `npm --prefix .claude/mcp/vice run test:automated` passes 1699/1704 (0 fail, 5 todo — matching the pre-existing baseline).
- Four stale release-status claims in `PROJECT.md` (`:129`, `:215-216`) and `STATE.md` (`:36`, `:288-289`) — all built on "386 commits ahead of `origin/main` at tag `v0.1.10`, nothing pushed" — corrected to state that `v0.2.0` is tagged on the remote, an ancestor of `origin/main`, both npm packages are published at 0.2.0, every local tag is pushed, and the tree is in sync with `origin/main`. Phrased as relationships, not a number that will be wrong again in days.

## Task Commits

Each task was committed atomically:

1. **Task 1a: Move the CI-hang todo to completed/** - `393ddf7` (fix) — this commit only landed the todo rename; a `git add` invocation listing a since-renamed path alongside `ci.yml` silently skipped the `ci.yml` staging (Rule 3, blocking issue: git add of a nonexistent path in the same invocation).
2. **Task 1b: Apply the ci.yml timeout/retry edit** - `5fbf66b` (fix) — follow-up commit landing the actual `timeout-minutes: 5` and `retry_apt()` edit that Task 1a's commit missed.
3. **Task 2: Gitignore runtime/local byproducts** - `b86e596` (chore)
4. **Task 3: Correct stale release-status claims** - `828bea4` (docs)

_Task 1 required two commits due to a staging mistake caught and corrected immediately after the first commit; both are documented below as a deviation._

## Files Created/Modified
- `.github/workflows/ci.yml` - ACME install step bounded with `timeout-minutes: 5` and `retry_apt()` (3-attempt retry + apt-level Acquire options); banner/pipefail gates unchanged
- `.gitignore` - added `/.vice-snapshots/`, `/.vscode/`, `/.claude/settings.json` with WHY comments
- `.planning/PROJECT.md` - two paragraphs corrected (`:129` shipping history, `:215-216` release status)
- `.planning/STATE.md` - two locations corrected (`:36` phase-9 trailing clause, `:288-289` operator next-step bullet)
- `.planning/todos/pending/2026-08-19-ci-acme-install-has-no-timeout-or-retry.md` → `.planning/todos/completed/` - closed by relocation, body unedited

## Decisions Made
- Anti-rot phrasing for release-status prose: state the *relationship* to `origin/main` and tag/publish status rather than any commit count or ahead/behind number, per explicit instruction that the previous number had already misled a reader.
- Kept the todo's three-tier fix (timeout-minutes, shell-level retry, apt-level Acquire options) exactly as prescribed rather than picking just one tier — the todo explicitly ranks them "cheapest first" as complementary, not alternative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's `ci.yml` edit was not staged in its intended commit**
- **Found during:** Task 1 (post-commit verification)
- **Issue:** `git add .github/workflows/ci.yml .planning/todos/pending/<file> .planning/todos/completed/<file> 2>/dev/null` was run after the todo had already been `git mv`'d, so one listed path no longer existed; the invocation staged only the rename and silently dropped the `ci.yml` modification, and `2>/dev/null` hid the reason. The commit that followed therefore had a correct message describing a change (`ci.yml`) it did not actually contain.
- **Fix:** Verified via `git show --stat HEAD` that `ci.yml` was absent, staged it explicitly (`git add .github/workflows/ci.yml`), and created a second, honest follow-up commit landing exactly that diff.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** Re-ran the plan's full YAML verification script after the second commit; all assertions (timeout-minutes, retry loop, apt-level bounds, banner/pipefail gates, Test step's `VICE_REQUIRE_ACME`, todo relocation) passed.
- **Committed in:** `5fbf66b`

---

**Total deviations:** 1 auto-fixed (1 blocking, self-caught staging mistake)
**Impact on plan:** No scope change — the intended `ci.yml` content landed exactly as specified, split across two commits instead of one. No plan content was altered.

## Issues Encountered
None beyond the staging mistake documented above, which was caught by this executor's own post-commit verification before moving to Task 2.

## User Setup Required
None - no external service configuration required. All changes are file edits with no remote mutation (no push, tag, or branch operation was performed).

## Next Phase Readiness
- CI's `build` job (which gates `release`, `publish-npm`, and `release-on-merge`) will now fail within ~5 minutes on a genuine apt-mirror stall instead of silently blocking every publish path for hours.
- `git status` is clean of the three previously-untracked runtime/local byproducts, with both npm tarballs and the local test gate verified unaffected.
- PROJECT.md and STATE.md no longer carry a self-contradicting or decaying release-status claim; both now correctly state v0.2.0 has shipped and is in sync with `origin/main`.
- No blockers for Phase 10 planning; this quick task was a hygiene pass independent of the Phase 9→10 transition.

---
*Phase: quick-260820-jwb*
*Completed: 2026-08-20*
