# Deferred Items -- Phase 03 (direct-tools)

## Out-of-scope pre-existing failure observed during plan 03-02 execution

**Test:** `repo-root.test.ts` -- "path agreement (D-3, D-6, THE regression this
task exists to catch): the launcher's own repo_root (resources/ and tools/
copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the
agreed path is not under .claude"

**Symptom:** Fails with `the agreed directory must not sit under .claude --
got <repo>/.claude/worktrees/agent-<id>/.vice-supervisor`.

**Cause:** This is an artifact of running the executor inside a GSD
worktree, whose own filesystem path is
`.claude/worktrees/agent-<id>/`. The test's own invariant (the resolved
supervisor dir must not sit under a literal `.claude/` path segment) is
tripped by the worktree's path shape itself, not by any code this plan
touched -- `stock-protocol.ts`/`stock-protocol.test.ts` have no relationship
to `repo-root.ts`'s path-agreement logic.

**Verified pre-existing:** Ran `node --test repo-root.test.ts` in isolation;
same single failure reproduces with identical output. Not introduced by
plan 03-02's changes.

**Action taken:** None -- out of scope per the executor's SCOPE BOUNDARY rule
(pre-existing failures in unrelated files are logged, not fixed). Left for
the phase orchestrator / a future plan to address if it recurs outside a
worktree-nested execution context.
