# Deferred Items -- Phase 05 (skill-critical-derived-tools)

Out-of-scope discoveries logged during plan execution, per the executor's
scope-boundary rule (only auto-fix issues directly caused by the current task's
changes; do not fix, do not re-run builds hoping they resolve).

## `repo-root.test.ts` path-agreement test fails inside a worktree nested under `.claude/`

**Discovered by:** all five wave-1 plans independently (05-01, 05-02, 05-03,
05-04, 05-05), each running `npm run test:automated` from its own parallel
executor worktree.

**Test:** `repo-root.test.ts` -- "path agreement (D-3, D-6, THE regression this
task exists to catch): the launcher's own repo_root (resources/ and tools/
copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the agreed
path is not under .claude"

**Failure:**
```
error: 'the agreed directory must not sit under .claude -- got
<repo>/.claude/worktrees/agent-<id>/.vice-supervisor (the exact regression a
naive move would introduce)'
```

**Cause:** GSD parallel executors run in git worktrees checked out at
`.claude/worktrees/agent-<id>/` -- itself nested under the main repo's own
`.claude/` directory. `repoRoot()`'s `.git`-ancestor walk (branch 2) finds the
worktree's own `.git` FILE at that nested location and correctly returns it as
the repo root, which legitimately sits under `.claude/worktrees/...`. The
assertion was written assuming a normal top-level checkout, so it trips on the
test environment's own location rather than on any code change. `repo-root.ts`'s
logic is not implicated, and `repo-root.test.ts` has not been touched since the
initial plugin commit (`b0975f4`).

**Scope:** Confirmed unrelated to every wave-1 plan's changes. None of
`stock-memory-search.ts`, `stock-symbols.ts`, `stock-vicii.ts`, `stock-cia.ts`
or `stock-sprites.ts` imports or modifies `repo-root.ts`, and the failure
reproduces running `repo-root.test.ts` in isolation with no other test file
loaded. Also previously logged as deferred under quick task `quick-260817-n6p`
(commit `ff87d94`), which independently establishes it as pre-existing.

**Disposition:** Left unfixed. Expected to disappear once the work is merged
back to `main`, where the checkout is no longer nested under
`.claude/worktrees/` -- the orchestrator's post-merge test gate is the
confirmation point. If it recurs against a non-worktree checkout, it is a
genuine regression worth its own investigation.
