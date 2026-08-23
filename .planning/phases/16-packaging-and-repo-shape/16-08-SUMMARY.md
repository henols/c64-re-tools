---
phase: 16-packaging-and-repo-shape
plan: 08
subsystem: packaging
tags: [npm-pack, ci, github-actions, node-test, installer, skills]

# Dependency graph
requires:
  - phase: 16-packaging-and-repo-shape
    provides: the relocated src/mcp/vice and src/skills/ trees (plans 16-01/16-04), the newly-committed installer/wire-mcp.test.mjs and skill CLI test suites (plans 16-03/16-06) this plan wires into CI
provides:
  - a filtered installer/scripts/sync-skills.mjs copier (no test files, fixtures/, or test-corpus.mjs reach the published tarball)
  - a shared, package-agnostic leak assertion (assertLeanTarball()) invoked from inside scripts/check-npm-packages.mjs's packFiles() seam, plus a pinned packed-package-name invariant
  - two new CI build-job steps ("Test the installer", "Test the skills") so installer/wire-mcp.test.mjs and the four src/skills/*/scripts/*.test.mjs suites run on every PR
  - src/mcp/vice/ci-suite-coverage.test.ts, a mechanical guard against a committed test suite living in a directory CI does not execute
affects: [16-09, 16-10, 16-11]

# Actuals (#2632)
actuals:
  tokens: 7400
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leak/coverage assertions promoted into the single seam that produces the artifact being checked (packFiles(), ci-suite-coverage's build-job extraction), rather than remembered per-instance"
    - "Registry-driven CI-coverage guard: a frozen exact-match registry for named packages plus a generalized regex rule for a directory family (src/skills/*/scripts), so a new skill needs no registry edit"

key-files:
  created:
    - src/mcp/vice/ci-suite-coverage.test.ts
    - .planning/phases/16-packaging-and-repo-shape/deferred-items.md
  modified:
    - installer/scripts/sync-skills.mjs
    - scripts/check-npm-packages.mjs
    - .github/workflows/ci.yml
    - src/mcp/vice/ci-guardrails.test.mjs

key-decisions:
  - "Leak assertions promoted into assertLeanTarball(), called from inside packFiles() so no packed package can be added without being checked; the packed-package name set is pinned to exactly two names so a third package cannot be packed unchecked either"
  - "sync-skills.mjs's exclusion rule is re-expressed independently of check-npm-packages.mjs's rule (not shared/imported) so the gate can still catch the producer being wrong"
  - "ci-suite-coverage.test.ts's skill-directory coverage is a REGEX RULE (src/skills/*/scripts) against the Task 2 glob proof, not a hand-typed per-skill list, matching the plan's promote decision"
  - "Fixed a regression this plan's own CI change caused in ci-guardrails.test.mjs: its findRunStepBlocksForNpmTest() assumed exactly one 'npm test' step existed repo-wide; scoped it to working-directory: src/mcp/vice so the new legitimate installer 'npm test' step does not double-match"
  - "Two pre-existing npm-test failures (docs-review-disposition.test.ts, audit-integrity.test.ts, both tripping on 16-REVIEW.md's own undispositioned findings) confirmed via git stash to predate this plan and left unfixed as out of scope; logged to deferred-items.md, expected closure at 16-11 (the wave's designated ledger closer)"

requirements-completed: [PKG-01, PKG-02]

coverage:
  - id: D1
    description: "installer/scripts/sync-skills.mjs filters test files, fixtures/, and test-corpus.mjs out of the published @henols/c64-re-tools tarball"
    requirement: PKG-01
    verification:
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (RED then GREEN, captured verbatim in this SUMMARY)"
        status: pass
      - kind: other
        ref: "cd installer && npm pack --dry-run --json (31 entries, 0 bad, 6 SKILL.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/check-npm-packages.mjs's leak assertions are shared (assertLeanTarball) across both packages, invoked from inside packFiles(), with the packed-package set pinned to exactly two names"
    requirement: PKG-01
    verification:
      - kind: other
        ref: "acceptance-criteria greps: assertLeanTarball inside packFiles (pass), duplicate-message count == 1 (pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "installer/wire-mcp.test.mjs (18 tests) and the four src/skills/*/scripts/*.test.mjs suites (95 tests) run in the build job on every PR"
    requirement: PKG-02
    verification:
      - kind: integration
        ref: "cd installer && npm test (18/18 pass); node --test 'src/skills/*/scripts/*.test.mjs' (95 tests, 87 pass, 8 skipped, 0 fail)"
        status: pass
      - kind: other
        ref: "plant-and-revert demonstration on both new CI steps (captured in this SUMMARY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "src/mcp/vice/ci-suite-coverage.test.ts fails when a committed test suite is not provably covered by a build-job step, proven on three live demonstrations including a brand-new directory"
    requirement: PKG-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/ci-suite-coverage.test.ts (10 tests, all pass)"
        status: pass
      - kind: other
        ref: "three live bite demonstrations against the real .github/workflows/ci.yml (captured in this SUMMARY)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 08: Tarball leak filter, shared leak assertion, and CI test-suite coverage guard Summary

**Filtered the installer tarball's test-file leak at its one copy seam, promoted the leak assertion into the packing seam itself so both packages are checked by construction, wired the phase's two orphaned test suites into CI's `build` job, and shipped a mechanical guard that fails when a future suite is committed without a matching CI step.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `installer/scripts/sync-skills.mjs`'s `cpSync` now takes a `filter` callback excluding `*.test.mjs`/`*.test.js`, `fixtures/` directories, and `test-corpus.mjs`; the published `@henols/c64-re-tools` tarball shrank from 36 to 31 entries with zero leaked test artifacts, 6 `SKILL.md` files intact.
- `scripts/check-npm-packages.mjs`'s leak assertions (no `node_modules/`, no test files, no `fixtures/`, no `test-corpus.mjs`) are now one shared `assertLeanTarball()` function invoked from inside `packFiles()`, so every packed package is checked by construction; the packed-package name set is pinned to exactly `@henols/vice-mcp` and `@henols/c64-re-tools`.
- The RED half of the fix was demonstrated first: with the shared assertion landed and the copier still unfiltered, the checker exited 1 and named all four leaking test files by path plus the shared `test-corpus.mjs` helper.
- `.github/workflows/ci.yml`'s `build` job gained two steps — `Test the installer` (`working-directory: installer`, `npm test`) and `Test the skills` (`node --test 'src/skills/*/scripts/*.test.mjs'`) — placed after the smoke test and before package validation, with no new action, secret, permission, or `needs:` relationship.
- `src/mcp/vice/ci-suite-coverage.test.ts` derives the set of directories holding committed test files from a repository walk, extracts the `build` job as text, and fails when a directory is not provably covered — proven to bite on three live demonstrations (installer step deleted, skills step deleted, a brand-new uncovered directory).
- Fixed a regression the CI change itself introduced: `ci-guardrails.test.mjs`'s `findRunStepBlocksForNpmTest()` assumed exactly one `npm test` step existed in the whole file; the new legitimate `Test the installer` step (also `npm test`, different `working-directory`) doubled that match until scoped.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — no test file reaches the published installer tarball, and the gate that says so is shared by both packages** - `c69497d` (fix)
2. **Task 2: CI's build job runs every committed test suite** - `f55f4eb` (feat)
3. **Task 3: A guard that fails when a committed test suite is not run by CI** - `4f70dfe` (test), `8fd8b5e` (test, describe() grouping follow-up)

## Files Created/Modified

- `installer/scripts/sync-skills.mjs` - `cpSync` copy filter excluding test files/`fixtures/`/`test-corpus.mjs`; header records the two rejected alternatives (`package.json` `files[]`, `.npmignore`)
- `scripts/check-npm-packages.mjs` - shared `assertLeanTarball()` invoked from inside `packFiles()`; pinned packed-package-name invariant; deleted the now-duplicated per-package leak `need()` calls
- `.github/workflows/ci.yml` - two new `build`-job steps: `Test the installer`, `Test the skills`
- `src/mcp/vice/ci-suite-coverage.test.ts` - new guard: walks the repo for test files, extracts the `build` job as text, checks a frozen+rule-based registry, 10 tests grouped under one `describe()`
- `src/mcp/vice/ci-guardrails.test.mjs` - `findRunStepBlocksForNpmTest()` scoped to `working-directory: src/mcp/vice` to disambiguate from the new installer `npm test` step
- `.planning/phases/16-packaging-and-repo-shape/deferred-items.md` - out-of-scope pre-existing failure record (see Deviations)

## Decisions Made

- Leak assertions promoted into `assertLeanTarball()`, called from inside `packFiles()` so no packed package skips the check; the packed-package name set is pinned to exactly two names so a third package cannot be packed unchecked (the plan's `assumption-delta` `promote` decision).
- `sync-skills.mjs`'s exclusion rule is deliberately re-expressed independently of `check-npm-packages.mjs`'s own rule, not shared/imported — the gate must be able to catch the producer being wrong.
- `ci-suite-coverage.test.ts`'s skill-directory coverage is a regex rule (`src/skills/*/scripts`) against the Task 2 glob proof, not a hand-typed per-skill list — a seventh skill needs no registry edit.
- `ci-suite-coverage.test.ts`'s tests were grouped under one `describe()` block (matching `audit-integrity.test.ts`'s established convention) so the file registers as its own suite in the TAP summary (23 → 24 suites) rather than folding into the flat test count.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ci-guardrails.test.mjs`'s `findRunStepBlocksForNpmTest()` double-matched after Task 2's CI change**
- **Found during:** Task 2's post-change full baseline re-run (`VICE_REQUIRE_ACME=1 npm test`)
- **Issue:** The existing guard asserted exactly one `ci.yml` step invokes bare `npm test` (protecting BACK-05's wire proof from a narrowed CI gate). Task 2's new `Test the installer` step also runs `npm test` (a different package's own suite), so the assertion found 2 matches instead of 1 and failed.
- **Fix:** Scoped `findRunStepBlocksForNpmTest()`'s match to blocks that also carry `working-directory: src/mcp/vice`, the same working-directory pairing `ci-suite-coverage.test.ts`'s own registry uses to disambiguate the identical ambiguity.
- **Files modified:** `src/mcp/vice/ci-guardrails.test.mjs`
- **Verification:** `node --test ci-guardrails.test.mjs` — 19/19 pass; full baseline re-run confirmed no new failures.
- **Committed in:** `4f70dfe` (part of Task 3's commit, since it was discovered and fixed alongside the coverage guard's own verification pass)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, caused by this plan's own Task 2 change).
**Impact on plan:** Necessary correctness fix for a self-inflicted regression; no scope creep — the fix stayed inside the guard file the bug was in, using the same disambiguation pattern the new guard already established.

## Non-Vacuity / Bite Demonstrations (recorded per plan requirement)

### Task 1 — RED demonstration (shared assertion added, copier still unfiltered)

```
check-npm-packages: FAIL
  - @henols/c64-re-tools: test files leaked into tarball -- skills/c64-provenance-diff/scripts/diff-images.test.mjs, skills/c64-ram-capture/scripts/d64-parse.test.mjs, skills/c64-ram-capture/scripts/dump-artifacts.test.mjs, skills/c64-ram-capture/scripts/watch-loads.test.mjs
  - @henols/c64-re-tools: test-corpus.mjs (test-only helper) leaked into tarball -- skills/c64-ram-capture/scripts/test-corpus.mjs
```
Exit code: 1. All four named test files present, plus the shared helper. Fixed by the producer filter; re-run after the fix: `check-npm-packages: OK` (73 vice-mcp files, 31 installer files/6 skills), exit 0.

Second bite (companion invariant): the second `packFiles(...)` call (installer) was commented out; the script threw `ReferenceError: inst is not defined` and exited 1. Restored; `git diff --stat scripts/check-npm-packages.mjs` returned to the committed state; `node scripts/check-npm-packages.mjs` passed again.

### Task 2 — plant-and-revert on both new CI steps

**"Test the installer":** inverted `assert.equal(result.action, "added")` → `"NOT-ADDED-plant"` in `installer/wire-mcp.test.mjs`. `cd installer && npm test` exited 1, failing test 1 ("absent consumer config: creates .mcp.json..."). Reverted; `git status --porcelain installer/wire-mcp.test.mjs` clean; re-run 18/18 pass.

**"Test the skills":** inverted `assert.ok(anchors.length > 0, ...)` → `assert.ok(anchors.length < 0, "PLANTED-FAILURE...")` in `src/skills/c64-provenance-diff/scripts/diff-images.test.mjs`. `node --test 'src/skills/*/scripts/*.test.mjs'` exited 1, failing "anchorSearch finds a unique anchor...". Reverted; `git status --porcelain` clean; re-run 95 tests, 87 pass, 8 skipped, 0 fail.

`git diff -U0 .github/workflows/ci.yml | grep -E '^\+' | grep -Ec 'uses:|secrets\.|permissions:|needs:'` → `0`.

### Task 3 — three live bite demonstrations against the real `ci.yml`

**Demonstration 1 (installer step deleted):** removed the `Test the installer` step (and its preceding comment block) from `.github/workflows/ci.yml`. `node --test ci-suite-coverage.test.ts` exited 1; failure: `installer: registered, but its proof substring was not found in the build job's steps.` Restored via `git checkout -- .github/workflows/ci.yml`; `git status --porcelain` clean; guard re-ran green (10/10).

**Demonstration 2 (skills step deleted):** removed the `Test the skills` step. `node --test ci-suite-coverage.test.ts` exited 1; failure named both `src/skills/c64-provenance-diff/scripts` and `src/skills/c64-ram-capture/scripts` as unproven. Restored; clean; green again.

**Demonstration 3 (generalized case — brand-new uncovered directory):** created `src/scratch-throwaway-dir/throwaway.test.mjs` (a real committed-shaped test file). `node --test ci-suite-coverage.test.ts` exited 1; failure: `src/scratch-throwaway-dir: no registry entry -- a committed test suite lives here but nothing in ci-suite-coverage.test.ts knows how to prove CI runs it...`. Deleted the throwaway directory; `git status --porcelain` clean; guard re-ran green (10/10).

## Issues Encountered

**Pre-existing `npm test` failures unrelated to this plan's file scope (2 of 2356+ baseline tests), documented rather than fixed:**

`docs-review-disposition.test.ts` and `audit-integrity.test.ts` both fail because `16-REVIEW.md`'s own findings (CR-01, IN-01, WR-01..WR-04 — including this plan's own WR-01/WR-04 pair) have no recorded disposition yet, and a downstream guard refuses a gated milestone-audit status while any docs guard is red. Confirmed via `git stash` (reverting this plan's own changes and re-running both files in isolation) that this is NOT caused by this plan — it is the phase's own gap-closure sequence in progress, with the wave's own context naming 16-11 as "closes the ledger last." Logged to `.planning/phases/16-packaging-and-repo-shape/deferred-items.md` per the executor's scope-boundary rule; not fixed here.

As a direct consequence, `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` reports 2 fail (not the literal 0 the plan's `<verification>` step 6 names), against 2366 tests total (2320 pass, 39 skipped, 5 todo), 24 suites (up from 23, satisfying Task 3's own suite-count criterion). Every other verification command in the plan passed clean at exit 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Roadmap Success Criterion 1 ("no test files leaked") is now TRUE for both tarballs, checked by one shared, structural assertion rather than a per-package block.
- `installer/wire-mcp.test.mjs` and the four `src/skills/*/scripts/*.test.mjs` suites now run on every pull request via the `build` job.
- `ci-suite-coverage.test.ts` is in place as a standing guard before plan 16-10 (which depends on this plan's work) begins.
- The two pre-existing `16-REVIEW.md`-disposition-related test failures remain open, expected to close at plan 16-11 (the wave's designated ledger closer) — not a blocker for 16-09 or 16-10, which run independently of the disposition ledger.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*

## Self-Check: PASSED

All key files confirmed present on disk (`src/mcp/vice/ci-suite-coverage.test.ts`,
`.planning/phases/16-packaging-and-repo-shape/deferred-items.md`,
`installer/scripts/sync-skills.mjs`, `scripts/check-npm-packages.mjs`,
`.github/workflows/ci.yml`, `src/mcp/vice/ci-guardrails.test.mjs`, this SUMMARY).
All four task commit hashes (`c69497d`, `f55f4eb`, `4f70dfe`, `8fd8b5e`) confirmed
in `git log`. Every acceptance criterion in `16-08-PLAN.md` re-run live and recorded
above with observed output; the two remaining `npm test` failures are pre-existing,
confirmed via `git stash` to predate this plan, and logged to `deferred-items.md`
as explicitly out of scope rather than silently accepted.
