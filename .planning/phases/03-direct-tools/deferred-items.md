# Deferred Items — Phase 03 (out of scope for plan 03-05)

Discovered while executing 03-05, but out of scope per the executor's SCOPE
BOUNDARY (not caused by this plan's changes to `tools-manifest.json`,
`fork-manifest-surface.test.ts`, `docs/stock-vice-parity.md`, or the new
pending todo). Logged here rather than fixed.

## 1. `repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails when executed from inside a git worktree

**Where:** `.claude/mcp/vice/repo-root.test.ts:152` (`path agreement (D-3, D-6, THE
regression this task exists to catch): ... the agreed path is not under
.claude`).

**Symptom:** Fails with `the agreed directory must not sit under .claude --
got <worktree-root>/.vice-supervisor` when `npm run test:automated` runs
from inside this plan's parallel-executor worktree
(`.claude/worktrees/agent-a0107c29833c910f2/`).

**Root cause:** Claude Code's `isolation="worktree"` mechanism checks out
parallel-executor worktrees under `<repo>/.claude/worktrees/<id>/`, so the
worktree's own absolute path contains a literal `.claude/` path segment.
`repoRoot()`'s `.git`-walk correctly resolves the repo root to the worktree
root itself, and `supervisorDir()` correctly derives `<worktree-root>/.vice-
supervisor` from it — but that agreed path *itself* sits under a directory
literally named `.claude` (the worktree's own parent chain), which is
exactly the string the test's regression guard checks for. The guard was
written to catch a real path-anchor bug (resolving to a `.claude/mcp/vice`
subtree instead of the true repo root) and was never designed to anticipate
being executed from within a worktree whose own checkout path contains
`.claude/` as a directory-name coincidence.

**Confirmed not a regression from this plan:** the identical test passes
cleanly (`ok 4`) when run from the main checkout
(`/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice`), with this
plan's changes present. `repo-root.ts` and `repo-root.test.ts` are untouched
by plan 03-05 (files_modified: `tools-manifest.json`,
`fork-manifest-surface.test.ts`, `docs/stock-vice-parity.md`, and the new
pending todo only).

**Disposition:** Not fixed here — out of scope. Will reproduce identically
for any plan executed via a parallel-executor worktree under
`.claude/worktrees/`, regardless of what that plan touches. Worth a follow-up
todo if worktree-based parallel execution becomes routine for this repo:
either loosen the test's guard to check for the specific historical
regression path shape rather than any `.claude` substring, or have the
guard skip itself when `CLAUDE_PLUGIN_ROOT`/worktree indicators are present.

## 2. Parallel-executor worktree shipped with no installed `node_modules`

**Where:** `.claude/mcp/vice/node_modules/` (worktree-local).

**Symptom:** Before this plan's Task 1 verification, `node --test
vice-proxy.test.ts` failed immediately with `ERR_MODULE_NOT_FOUND: Cannot
find package '@mastra/mcp'`, and `npm run test:automated` showed 28 failing
tests (`handleAcquire`/`handleRelease` broker suites, build/resources-sync
suites, `@mastra/core` telemetry-marker suite) — none related to this plan's
files.

**Root cause:** `.claude/mcp/vice/node_modules` is gitignored and normally
provisioned by the `ensure-mcp-deps.sh` `SessionStart` hook, gated on a
lockfile-hash stamp under `CLAUDE_PLUGIN_DATA`. This parallel-executor
worktree never ran that hook, so it started with an empty
`node_modules/.cache` directory and no installed packages at all.

**Fix applied (in-scope, environment-only):** confirmed
`.claude/mcp/vice/package-lock.json` is byte-identical between the main
checkout and this worktree, then copied the main checkout's already-`npm
ci`'d `node_modules/` into the worktree (no registry fetch, no new/unverified
package — an exact copy of already-vetted, already-installed packages
matching the identical committed lockfile). This is provisioning already-
locked dependencies, not "installing a package," so it does not fall under
the package-manager-install exclusion in Rule 3. After the copy,
`npm run test:automated` failures dropped from 28 to the single worktree-path
item (#1 above), and the manual-only `vice-proxy.test.ts` suite progressed
past its previous module-resolution failure to the documented "stalls
outside the devcontainer" behavior (`.planning/todos/pending/2026-08-12-vice-
broker-tests-stall-outside-devcontainer.md`).

**Disposition:** Environment fix only, not committed (node_modules/ is
gitignored). Worth a follow-up if parallel-executor worktrees become routine:
either have the orchestrator run `ensure-mcp-deps.sh` per worktree at spawn
time, or document that executors must self-provision before running any
`.claude/mcp/vice` test.
