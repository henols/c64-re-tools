---
quick_id: 260819-tsz
status: completed
subsystem: infra
tags: [semver, npm-publish, ci, version-resolution, mcp-server]

requires: []
provides:
  - "VERSION -- the single hand-edited version template (0.2.-)"
  - ".claude/mcp/vice/version.ts -- the one resolver seam (parseTemplate, resolveVersion, compareVersions, readTemplate, runtimeVersion)"
  - "scripts/version.mjs -- resolve/stamp/check CLI over the seam"
  - "release-on-merge and release CI jobs wired to the seam"
affects: [release-mechanics, npm-publish, ci]

tech-stack:
  added: []
  patterns:
    - "Template-resolution algorithm: 3-component VERSION template with '-' auto-managed slots, four rules (pinned/no-published/prefix-differs/prefix-matches)"
    - "Single-seam pattern applied to version resolution (D-5): CLI, MCP server, and CI all call into .claude/mcp/vice/version.ts, none re-derive it"
    - "Self-evident dev placeholder (0.0.0-dev) for all publishable-but-not-yet-published version fields, pinned by a test"

key-files:
  created:
    - VERSION
    - .claude/mcp/vice/version.ts
    - .claude/mcp/vice/version.test.ts
    - scripts/version.mjs
  modified:
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/package.json
    - installer/package.json
    - installer/bin/cli.mjs
    - .claude-plugin/plugin.json
    - .claude-plugin/marketplace.json
    - .github/workflows/ci.yml
    - scripts/check-npm-packages.mjs

key-decisions:
  - "R-1: VERSION stays a template forever; release-on-merge resolves in its ephemeral checkout and commits nothing back to main"
  - "R-2: the six derived, publishable version strings become the self-evident placeholder 0.0.0-dev, not a number"
  - "R-3: the pending v0.2.0 release goes through release-on-merge (push main only); the local unpushed v0.2.0 tag has no role and must not be pushed"

requirements-completed: [D-1, D-2, D-3, D-4, D-5]

duration: ~25min
completed: 2026-08-19
---

# Quick 260819-tsz: Single VERSION template + resolver seam Summary

**One hand-edited `VERSION` template (`0.2.-`) plus one resolver seam (`version.ts`) replace six mutually-inconsistent hand-maintained version strings; `release-on-merge` now resolves from it and `PROXY_VERSION` is no longer twelve patches stale.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed (task 1 and 2 each ran as their own RED/GREEN TDD cycle)
- **Files modified:** 12 (4 created, 8 modified) -- matches the plan's `files_modified` list exactly

## Accomplishments

- `VERSION` (repo root) is now the only hand-edited version string in the repo, holding the template `0.2.-`.
- `.claude/mcp/vice/version.ts` is the ONE implementation of D-2's four-rule resolution algorithm and D-4's runtime precedence. All six CONTEXT.md worked examples pass as offline unit tests, verified by value AND by rule.
- `scripts/version.mjs` (`resolve` / `stamp` / `check`) is a thin CLI over the seam -- pinned by a test that greps its own source (comments stripped) for the rule literal `prefix-matches` and fails if found.
- The six R-2 derived strings (`.claude/mcp/vice/package.json` `.version`, `installer/package.json` `.version` + its `@henols/vice-mcp` dependency pin, `.claude-plugin/plugin.json` `.version`, `.claude-plugin/marketplace.json` `.version` and `.plugins[0].version`) all carry `0.0.0-dev`, pinned by a placeholder-consistency test.
- `vice-proxy.ts`'s `PROXY_VERSION` no longer holds a literal -- it calls `runtimeVersion()`, so a published tarball reports its real npm version and a dev checkout reports `0.2.0-dev`.
- `release-on-merge`'s version computation is now `node scripts/version.mjs resolve --github-output`; its `[skip release]` gate step is **byte-for-byte unchanged** (verified by sha256 hash before/after the edit, per the plan-checker's required strengthened verification).
- The `release` job (v* tag) now stamps the real version into the plugin manifests and commits that change locally (never pushed) before `scripts/package.sh` builds the zip via `git archive HEAD` -- closing the gap where the artifact filename and the `plugin.json` inside it could disagree.
- `publish-npm` is untouched, also verified byte-for-byte identical by the same sha256 technique.
- `check-npm-packages.mjs` gained tarball-leak assertions: neither published package may contain `scripts/` or a `VERSION` file, and `version.ts` is now a required derived module (tagged `D-5`).
- **Live external check, run against the real npm registry:** `npm view @henols/vice-mcp version` returned `0.1.12`; `node scripts/version.mjs resolve --published 0.1.12` returned `0.2.0` -- plain semver, strictly greater. The strictly-greater guard was also exercised negatively (`--published 0.9.9` exits 1, refusing to resolve backwards).

## Task Commits

Each task ran as its own TDD RED/GREEN cycle:

1. **Task 1: VERSION template plus the one resolver seam**
   - `test`: `38a56ac` -- failing `version.test.ts` (module absent)
   - `feat`: `7bd7726` -- `version.ts` implemented, `VERSION` created, 13/13 tests pass
2. **Task 2: CLI over the seam; route six derived strings and PROXY_VERSION through it**
   - `test`: `5847d5b` -- 3 new failing tests (placeholder consistency, single-implementation guard, PROXY_VERSION guard)
   - `feat`: `e338e32` -- `scripts/version.mjs`, six strings stamped to `0.0.0-dev`, `vice-proxy.ts` wired, `installer/bin/cli.mjs` documented, `version.ts` added to `files[]`; 16/16 tests pass
3. **Task 3: wire the resolver into CI, prove it against the real registry**
   - `feat`: `07b652b` -- `ci.yml` and `check-npm-packages.mjs` edited; gate step and `publish-npm` job verified byte-identical by sha256

**Plan doc commit (pre-existing, before this execution):** `12bb48d`

_TDD Gate Compliance: `test(...)` precedes `feat(...)` for both TDD tasks, confirmed in `git log 12bb48d..HEAD`. No RED test passed unexpectedly._

## Files Created/Modified

- `VERSION` -- the single hand-edited template, `0.2.-`
- `.claude/mcp/vice/version.ts` -- the resolver seam (D-5)
- `.claude/mcp/vice/version.test.ts` -- offline coverage of all six worked examples plus guards
- `scripts/version.mjs` -- `resolve` / `stamp` / `check` CLI, read-only against npm, no git/publish code path
- `.claude/mcp/vice/vice-proxy.ts` -- `PROXY_VERSION` now derived via `runtimeVersion()`
- `.claude/mcp/vice/package.json` -- version placeholder, `version.ts` added to `files[]`
- `installer/package.json` -- version + `@henols/vice-mcp` dependency placeholder
- `installer/bin/cli.mjs` -- `SELF_VERSION` unchanged logic, now documents why it stays step-1-only
- `.claude-plugin/plugin.json` -- version placeholder
- `.claude-plugin/marketplace.json` -- version + `plugins[0].version` placeholders
- `.github/workflows/ci.yml` -- `release-on-merge` resolves from the template; `release` job stamps before zipping; `publish-npm` untouched
- `scripts/check-npm-packages.mjs` -- new leak assertions + `version.ts` in `REQUIRED_DERIVED_MODULES`

## Decisions Made

- **R-1** (VERSION never changes in git): implemented as specified -- no consumer writes back to `VERSION`.
- **R-2** (six strings -> one placeholder): implemented as specified -- `0.0.0-dev` everywhere, pinned by test.
- **R-3** (release path for v0.2.0): documented below, unchanged from the plan's recommendation.

## Deviations from Plan

**1. [Scope discipline, no rule needed] Split task 1's initial test file to keep its own TDD gate green on its own behaviors.**
The plan's task 2 `<behavior>` section describes three NEW tests ("New in version.test.ts: ...") that depend on consumers task 2 creates (`scripts/version.mjs`, the six derived strings, `vice-proxy.ts`'s wiring). During task 1's RED-authoring pass these three tests were initially drafted alongside task 1's own tests in the same file-write, which would have left task 1's own GREEN gate red (those three tests fail for real assertion reasons, not "module absent", once `version.ts` exists but its consumers don't). Corrected before task 1's GREEN commit: the three tests were held back and re-added as task 2's own RED gate (commit `5847d5b`), immediately before task 2's implementation. No functional difference in the final code; this only affected which commit each test's RED/GREEN pairing landed in.

No other deviations. Plan executed as written, including the plan-checker's required strengthening of task 3's ci.yml verification (byte-level sha256 hashing of the gate step and the `publish-npm` job body, both before and after editing -- confirmed identical).

## Issues Encountered

None. All verification commands in the plan, including the strengthened byte-level CI check and the live external registry check, passed on the first attempt after implementation.

## Completion Gate Results (actual numbers)

- `cd .claude/mcp/vice && npm run typecheck` -- clean.
- `cd .claude/mcp/vice && npm run test:automated` -- **1687 pass / 0 fail / 5 todo** (baseline was 1671/0/5; +16 new tests, no regressions).
- `node scripts/version.mjs resolve --published 0.1.12` -- prints exactly `0.2.0`.
- Live external check: `npm view @henols/vice-mcp version` returned `0.1.12`; `node scripts/version.mjs resolve --published 0.1.12` returned `0.2.0`, valid semver strictly greater.
- `bash scripts/package.sh` -- succeeds; six-way manifest equality check passes on the placeholder `0.0.0-dev`.
- `node scripts/check-npm-packages.mjs` -- passes; `scripts/version.mjs` and `VERSION` do not appear in either tarball; `version.ts` is present in the vice tarball.
- No `.mts` files were touched in this plan, so `build.ts` / `resources-sync.test.ts` were not re-run.
- Byte-level CI check (plan-checker requirement): sha256 of the "Decide whether to release" step block and the entire `publish-npm` job body, extracted content-anchored (not line-number-anchored, since the `release` job's inserted stamp step shifts every line number after it), matched exactly before and after editing.
- Negative guard check: `node scripts/version.mjs resolve --published 0.9.9` exits 1.
- `git status --porcelain` after all commits shows only pre-existing, unrelated untracked files (`.claude/settings.json`, `.vscode/`) that predate this execution and are out of this plan's scope.
- Nothing was pushed, tagged, published, or merged. `git log origin/main..HEAD --oneline | wc -l` grew by exactly 5 (the 5 commits this execution made); no other commits landed on `main`.

## User Setup Required

None -- no external service configuration required.

## Release Guidance for v0.2.0 (per R-3, restated for the user)

- **The local annotated tag `v0.2.0` (sitting on `93df581`, which predates this work) has NO role in shipping this release. Do not push it.** Pushing it alongside `main` would race `release-on-merge` and the tag-triggered `publish-npm` for the same version and one side would fail with a registry 409.
- **Recommended path, once this work is merged/landed:** push `main`. With `VERSION` = `0.2.-` and npm `latest` = `0.1.12`, rule 3 (`prefix-differs`) fires and `release-on-merge` alone resolves `0.2.0`, publishes both packages via OIDC, creates tag `v0.2.0` at the merge commit, and opens a GitHub release with generated notes. One push, zero manual version handling.
- **Alternative, only if the GitHub release must carry the plugin zip asset** (auto-releases attach no assets -- a pre-existing gap this task does not close): land this work, push `main` with `[skip release]` in the tip commit subject, then create and push a fresh `v0.2.0` tag at that tip, which runs `publish-npm` + the now-stamping `release` job.
- **Nothing was pushed, tagged, or published by this execution.** All five commits above are local only.

## Next Phase Readiness

- The version-resolution seam and CLI are ready for use by any future automation that needs "what version am I" or "what should the next release be" without re-deriving the algorithm.
- `installer/` risk (documented in the plan, not closed by this task): a bare `cd installer && npm install` will fail to resolve `@henols/vice-mcp@0.0.0-dev` until a real release publishes that version. Escape hatch: `node scripts/version.mjs stamp <a published version>`, install, then `git checkout` the manifests back to the placeholder.
- No blockers for the next work. The v0.2.0 release itself remains a separate, user-authorized step (see Release Guidance above).

---
*Quick task: 260819-tsz*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 5 created/modified files verified present (`VERSION`, `.claude/mcp/vice/version.ts`,
`.claude/mcp/vice/version.test.ts`, `scripts/version.mjs`, this summary). All 6 commit
hashes (`38a56ac`, `7bd7726`, `5847d5b`, `e338e32`, `07b652b`, `12bb48d`) verified present
in `git log`.
