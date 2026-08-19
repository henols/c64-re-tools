---
quick_id: 260819-vie
status: completed
subsystem: ci-release
tags: [github-actions, release-automation, bash, gh-cli]

requires:
  - quick: 260819-tsz
    provides: scripts/version.mjs (VERSION template resolver, stamp/check/resolve subcommands), scripts/package.sh
provides:
  - scripts/release-assets.sh — the one seam that stamps manifests, builds the zip, and attaches release assets
  - Both release paths (release job, release-on-merge job) wired to the seam
  - v0.2.0's missing GitHub Release assets attached retroactively
affects: [ci.yml, future release-cutting quick tasks]

tech-stack:
  added: []
  patterns:
    - "Ephemeral detached git worktree + EXIT trap for isolated stamp-and-build, never touching caller's working tree"
    - "sha256 byte-identity proof of an extracted CI step block, not a regex presence test"

key-files:
  created:
    - scripts/release-assets.sh
  modified:
    - .github/workflows/ci.yml
    - .claude/mcp/vice/host-scripts.test.ts
    - .claude/mcp/vice/ci-guardrails.test.mjs

key-decisions:
  - "One bash seam (scripts/release-assets.sh) owns stamp->zip->attach; both release paths call it with the version as an explicit argument (D-1, D-2)"
  - "Isolation via a throwaway detached git worktree + EXIT trap, not stash-and-restore, so the caller's HEAD/index/working tree are never touched even mid-failure"
  - "D-3's create-or-upload branch kept verbatim, no new branching added"
  - "--dry-run flag added (not in original CONTEXT) so the seam is rehearsable before any live gh call — justified by D-5 requiring a real network write against an existing published release"

requirements-completed: [D-1, D-2, D-3, D-4, D-5]

duration: ~20min
completed: 2026-08-19
---

# Quick Task 260819-vie: Extract release stamp/zip/upload into one seam Summary

**Extracted the stamp-manifests/build-zip/attach-assets sequence into one bash seam (`scripts/release-assets.sh`), wired both CI release paths to call it, and retroactively attached v0.2.0's missing plugin zip to its already-published GitHub Release.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-19T22:52 CEST (plan doc commit)
- **Completed:** 2026-08-19T23:12 CEST
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified) + 1 untracked build artifact (`dist/c64-re-tools-0.2.0.zip`, gitignored)

## Accomplishments

- `scripts/release-assets.sh` is now the single authoritative place that stamps the six R-2 derived version strings, builds the installable plugin zip via `git archive` inside a throwaway detached worktree, and attaches it (+ `.sha256` sidecar) to the matching GitHub Release — taking the version as an explicit argument, never reading `GITHUB_REF_NAME`/`GITHUB_SHA` itself.
- Both `release` (tag path) and `release-on-merge` (merge path) jobs in `ci.yml` now call the seam; the merge path previously had no equivalent step at all, which is exactly how v0.2.0 shipped with `{"assets": []}`.
- The `[skip release]` gate step, and the entire `build` and `publish-npm` jobs, are proven byte-identical to `v0.2.0`'s copy via sha256 of the content-anchored extracted block — not a regex presence check.
- v0.2.0's GitHub Release now carries `c64-re-tools-0.2.0.zip` + `.sha256`, verified from the **downloaded** artifact (not the local build) to contain `0.2.0` in `plugin.json`, `marketplace.json`'s top-level `version`, and `marketplace.json`'s `plugins[0].version`.

## Task Commits

1. **Task 1: The one seam — scripts/release-assets.sh, provably isolated** - `bca1be8` (feat)
2. **Task 2: Wire both release paths to the seam, with the [skip release] gate byte-frozen** - `e861aee` (refactor, tdd: RED asserted before ci.yml edit, GREEN after)
3. **Task 3: Attach v0.2.0's missing asset for real** - no tracked-file commit (deliverable is a GitHub Release API write; `dist/c64-re-tools-0.2.0.zip` is gitignored build output, not a tracked change)

**Plan metadata:** this SUMMARY commit (pending)

Plan doc commit (pre-existing, from planning): `4867535`

## Files Created/Modified

- `scripts/release-assets.sh` - new seam: arg-scan/validate `<version> [<ref>] [--dry-run]`, preflight tool checks, throwaway detached worktree + EXIT trap, `version.mjs stamp`, empty-commit guard, `package.sh` build, exact-filename lookup (never a glob), fail-closed self-check of the zip's own `plugin.json`/`marketplace.json`, copy into caller's `dist/`, then D-3's verbatim create-or-upload via `gh`.
- `.claude/mcp/vice/host-scripts.test.ts` - `EXPECTED_TRACKED_SHELL_SCRIPTS` grown from 3 to 4 entries (adds `scripts/release-assets.sh`), with updated block comment explaining why.
- `.github/workflows/ci.yml` - `release` job's three inline steps collapsed into one `bash scripts/release-assets.sh "${GITHUB_REF_NAME#v}" "${GITHUB_REF_NAME}"` call; `release-on-merge` job gets a new step after `Create tag + GitHub release`, gated `if: steps.gate.outputs.release == 'true'`, calling `bash scripts/release-assets.sh "${{ steps.ver.outputs.version }}" "${{ github.sha }}"`. `build`, `publish-npm`, and the `[skip release]` gate step untouched (verified byte-identical).
- `.claude/mcp/vice/ci-guardrails.test.mjs` - six new assertions: seam invoked in exactly two step blocks; both pass an explicit argument (never bare); merge-path block carries the `[skip release]`-derived gate condition; neither block carries `continue-on-error`; `version.mjs stamp` appears in zero ci.yml steps (only inside the seam itself now); `bash scripts/package.sh` appears in exactly one step block (the `build` job's).

## Decisions Made

- Kept the plan's D-3 instruction literally: the create-or-upload `gh` block in the seam is unchanged from the original `release` job's logic, just moved.
- Used `sha256sum`-based byte-identity proof for D-4 rather than a regex/string-contains check, per the plan-checker's explicit prior feedback that regex presence is insufficient proof of byte-identity on this file.
- Followed the mandatory plan corrections: every `<verify>` pipeline that runs a real test executable is prefixed with `set -o pipefail` so a real test failure cannot be masked by `tail`'s always-zero exit code; Task 1 verify step 2's two assertions are run as independently-checked statements; Task 3's leak spot-check uses an explicit `if/then/exit 1/else` structure instead of the dead `echo "LEAK" || echo "no leak"` idiom that could never fail.

## Deviations from Plan

None beyond the mandatory plan corrections specified in the execution context (all four `pipefail` sites fixed, Task 1 verify step 2's `;`-joined assertions restructured, Task 3's leak spot-check restructured to a real fail-closed gate). No Rule 1-4 deviations were needed — the design was executed as specified.

## Verification Evidence

**D-4 sha256 hashes (gate step, content-anchored, before vs. after):**
```
gate base 1635ef80f739f55866b7110782889e12747a69c04769f3cda023df95daecbc8f
gate cur  1635ef80f739f55866b7110782889e12747a69c04769f3cda023df95daecbc8f
D-4 OK: gate step byte-identical
```
`build` and `publish-npm` jobs also confirmed byte-identical (hashes `cdab0c83f3d2660b224367ad3a30207a8a8b29429778fcd86a1b9fdc6cd5cf03` and `0863e0c837a2e4d21984650ca40606f2ad3ed5f7a990851ddb91637a69fb0f23` respectively, matched exactly against `v0.2.0`'s copy).

**ci.yml parses as YAML**, four jobs unchanged: `build`, `publish-npm`, `release`, `release-on-merge`.

**ci-guardrails.test.mjs:** 19/19 pass (13 pre-existing + 6 new). The 6 new assertions were confirmed RED before the `ci.yml` edit (0 found for the seam wiring, 2 found for `bash scripts/package.sh`, 1 found for `version.mjs stamp`) and GREEN after.

**host-scripts.test.ts:** 4/4 pass with the grown 4-entry frozen script set.

**Completion gates (`.claude/mcp/vice`):**
- `npm run typecheck` — clean, no errors.
- `npm run test:automated` — **1699 pass / 0 fail / 5 todo** (1704 total across 21 suites), up from the 1693-pass baseline by the 6 new `ci-guardrails` cases, zero regressions.

**Repo-root gates:**
- `bash scripts/package.sh` — succeeded, built `c64-re-tools-0.0.0-dev.zip` (594 files) from the working tree's own placeholder version.
- `node scripts/check-npm-packages.mjs` — OK; `@henols/vice-mcp@0.0.0-dev` (59 files), `@henols/c64-re-tools@0.0.0-dev` (35 files, 6 skills). Confirmed via a direct `npm pack --dry-run --json` file-list check: `scripts/release-assets.sh` appears in **zero** files of either tarball.

**D-5 retroactive attach (real, permitted network write):**
- Preflight: `gh release view v0.2.0 --json assets,tagName,targetCommitish` → `{"assets":[],"tagName":"v0.2.0","targetCommitish":"089127ad963aa91ad49e69c4a4dea22bfbbb869f"}`; `git ls-remote origin refs/tags/v0.2.0` → `089127ad963aa91ad49e69c4a4dea22bfbbb869f`. Both matched before uploading.
- Ran: `bash scripts/release-assets.sh 0.2.0 v0.2.0`
- Seam's own output line, confirming D-3's upload branch (not create) fired: `release-assets: attaching to existing release v0.2.0`
- Verified asset list: `gh release view v0.2.0 --json assets` → `["c64-re-tools-0.2.0.zip","c64-re-tools-0.2.0.zip.sha256"]`
- Verified from the **downloaded** artifact (not the local build): `sha256sum -c` against its sidecar passed (`c64-re-tools-0.2.0.zip: OK`); extracted `plugin.json` reads `c64-re-tools@0.2.0`; extracted `marketplace.json` reads `version=0.2.0`, `plugins[0].version=0.2.0`; `unzip -l` shows no `node_modules/` or `tools/` entries.
- Post-upload: `git status --porcelain` clean (only the pre-existing untracked `.claude/settings.json`, `.vscode/`); `git worktree list` shows exactly one entry; `node scripts/version.mjs check` still passes (all 6 derived strings at the dev placeholder in the real working tree); tag `v0.2.0` still resolves to `089127ad963aa91ad49e69c4a4dea22bfbbb869f` both locally and on the remote.

**`[skip release]` marker sweep:** all three local commits ahead of `origin/main` carry the marker in their subject:
```
refactor(quick-260819-vie): one release-assets seam for both release paths [skip release]
feat(quick-260819-vie): add scripts/release-assets.sh, the one stamp->zip->attach seam [skip release]
docs(quick-260819-vie): plan the one release-assets seam [skip release]
```
`git log origin/main..HEAD --pretty=%s | grep -cvF '[skip release]'` → `0`.

**Nothing pushed, tagged, or published.** No `git push`, `git tag`, `npm publish`, `npm version`, or `gh release create` was executed at any point — only the one permitted `gh release upload --clobber` against the pre-existing `v0.2.0` release.

## Known Stubs

None.

## Threat Flags

None — all threat register mitigations (T-VIE-01 through T-VIE-05) were implemented as designed; T-VIE-06 and T-VIE-SC are accepted-risk rows with no new mitigation required.

## Self-Check: PASSED

All created/modified files confirmed present on disk (`scripts/release-assets.sh`, `.github/workflows/ci.yml`, `.claude/mcp/vice/host-scripts.test.ts`, `.claude/mcp/vice/ci-guardrails.test.mjs`). All three referenced commit hashes (`4867535`, `bca1be8`, `e861aee`) confirmed present in `git log --oneline --all`.
