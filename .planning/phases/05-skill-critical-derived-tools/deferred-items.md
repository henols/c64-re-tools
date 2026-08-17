# Deferred Items -- Phase 5

Out-of-scope discoveries logged during plan execution, per the executor's
scope-boundary rule (do not fix, do not re-run builds hoping they resolve).

## 05-02: pre-existing `repo-root.test.ts` failure in a nested worktree

**Discovered during:** 05-02, running `npm run test:automated` after Task 3.

**Test:** `repo-root.test.ts` -- "path agreement (D-3, D-6, THE regression this
task exists to catch): the launcher's own repo_root (resources/ and tools/
copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the
agreed path is not under .claude"

**Failure:**
```
error: 'the agreed directory must not sit under .claude -- got
<repo>/.claude/worktrees/agent-ad543494a9010b56c/.vice-supervisor (the exact
regression a naive move would introduce)'
```

**Cause:** This execution runs inside a git worktree checked out at
`.claude/worktrees/agent-ad543494a9010b56c/` -- itself nested under the main
repo's own `.claude/` directory. `repoRoot()`'s `.git`-ancestor walk (branch
2) finds the worktree's own `.git` FILE at that nested location and returns
it as the repo root, which is legitimately under `.claude/worktrees/...`.
The test's own assertion ("the agreed directory must not sit under .claude")
was written assuming the repo is checked out at a normal top-level location,
not nested inside another checkout's `.claude/` directory -- a property of
this parallel-execution environment, not of `repo-root.ts`'s logic or of any
file this plan touches.

**Scope:** Confirmed unrelated to 05-02's changes -- `stock-symbols.ts` and
`stock-symbols.test.ts` neither import nor modify `repo-root.ts`, and the
failure reproduces identically running `repo-root.test.ts` in isolation, with
no other test file loaded. Not auto-fixed per the scope-boundary rule (fixes
are confined to files the current task's changes directly touch).

**Disposition:** Left unfixed. Will very likely resolve itself once this
worktree is merged back to `main` and the resulting checkout is no longer
nested under `.claude/worktrees/`. If it recurs against a non-worktree
checkout, it is a genuine regression worth its own investigation.
