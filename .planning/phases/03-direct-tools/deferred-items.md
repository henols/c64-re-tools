# Phase 3 — Deferred Items

## Pre-existing, out-of-scope test failure observed during 03-03 execution

**Test:** `repo-root.test.ts` — "path agreement (D-3, D-6, THE regression this
task exists to catch): the launcher's own repo_root (resources/ and tools/
copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the agreed
path is not under .claude"

**Observed failure:** `the agreed directory must not sit under .claude -- got
.../.claude/worktrees/agent-afcb392446dd03a9c/.vice-supervisor`

**Why deferred:** This is a property of running the test suite from inside a
git worktree checked out at `.claude/worktrees/<agent-id>/`, which is itself
nested under a `.claude/` directory — exactly the path shape the test's own
regression guard checks for and refuses. It is not caused by, or related to,
`stock-condition.ts` / `stock-condition.test.ts` (03-03's only files). Fixing
it would mean changing `repo-root.ts`'s `.claude` boundary detection or the
worktree layout itself, both out of scope for plan 03-03 and out of scope for
Phase 3's `repo-root.ts`, which no 03-03 task touches.

**Disposition:** Not fixed. Confirmed pre-existing/environment-caused, not a
regression introduced by this plan. Revisit only if it also reproduces outside
a `.claude/worktrees/` checkout.
