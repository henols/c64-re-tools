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
