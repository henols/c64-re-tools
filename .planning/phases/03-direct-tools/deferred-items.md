# Deferred Items -- Phase 3 (Direct Tools)

Items discovered during execution that are out of scope for the task that
found them. Logged, not fixed.

## repo-root.test.ts's "path agreement ... not under .claude" assertion fails
when the checkout itself lives under `.claude/worktrees/<id>/`

**Found during:** 03-01, Task 3 (`npm run test:automated` full-suite run).

**Symptom:** `repo-root.test.ts`'s "path agreement (D-3, D-6, THE regression
this task exists to catch)" test fails with:

```
the agreed directory must not sit under .claude -- got
<worktree>/.vice-supervisor (the exact regression a naive move would
introduce)
```

**Root cause:** Claude Code's `isolation="worktree"` execution mode checks
out each parallel executor's worktree at
`<repo>/.claude/worktrees/agent-<id>/`. `repoRoot()`'s `.git`-walk finds
`.git` at that worktree root first (a worktree has its own `.git` file), so
the resolved repo root -- correctly, by the function's own contract -- IS
the worktree directory, which itself sits under a `.claude/` segment
(`<repo>/.claude/worktrees/...`). The test's own assertion ("the agreed
directory must not sit under `.claude`") was written against the assumption
that a repo checkout never nests under its own `.claude/`; that assumption
is false specifically for this parallel-worktree execution mode.

**Verified pre-existing, not caused by this plan's changes:** the identical
test file, run unmodified against the same commit (`d1429b4`) checked out to
a path OUTSIDE `.claude/worktrees/` (a scratch detached worktree), passes
cleanly. The failure is 100% a function of checkout path, not of any code
this plan (03-01) touched (`stock-runstate.ts`, `stock-address.ts`,
`stock-handler.ts`, `stock-dispatch.ts`).

**Disposition:** out of scope for 03-01 (Scope Boundary: "Only auto-fix
issues DIRECTLY caused by the current task's changes"). Not fixed here.

**Suggested follow-up:** either (a) the test's assertion needs an
allowance for "the checkout root's OWN path happens to contain a `.claude`
segment because IT is a worktree nested under one" (distinct from the
regression it actually guards -- the derived STATE directory living under
`.claude` relative to a normally-nested repo), or (b) the parallel-worktree
harness should avoid the requirement entirely by not asserting this
particular invariant when `isolation="worktree"` is active. Not something to
resolve inside a phase-execution plan; needs its own investigation.

**Independently reproduced by:** 03-02, 03-03, 03-04 and 03-05, each of which
hit the identical failure from its own worktree and confirmed in isolation
that the failure follows the checkout path, not the plan's changes. Confirmed
absent on the merged main checkout (see the phase's post-merge test gate).
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

## 3. `build-atomic.test.ts` transient failure during a full-suite run (03-06)

**Found during:** 03-06, `npm run test:automated` full-suite run (after Task
2's changes).

**Symptom:** one run showed `not ok - the private temp directory is cleaned
up on both the success and the failure path, leaving no sibling of the
out-dir behind` in `build-atomic.test.ts`; an immediate re-run of the same
`npm run test:automated` command showed 0 failures in that file (only the
already-documented item #1 above remained). `node --test
build-atomic.test.ts` in isolation also passed cleanly (6/6).

**Root cause:** matches the identical class of flake already documented in
`02-07-SUMMARY.md` ("One transient failure in `build-atomic.test.ts`'s own
'concurrent builds' test... consistent with a timing-sensitive, pre-existing
test (it spawns multiple real `tsc` processes concurrently)"). Not caused by
`stock-memory.ts`/`stock-protocol.ts` (this plan's only source changes),
which `build-atomic.test.ts` does not exercise.

**Disposition:** out of scope (Scope Boundary), not investigated further --
same pre-existing, timing-sensitive flake class as 02-07's.
