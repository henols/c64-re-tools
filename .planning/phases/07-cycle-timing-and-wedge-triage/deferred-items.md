# Deferred Items — Phase 07 (cycle-timing-and-wedge-triage)

## 07-01: pre-existing worktree-path test failure (out of scope)

`npm run test:automated` reports 1 failure out of 1429 tests:

```
not ok 375 - path agreement (D-3, D-6, THE regression this task exists to catch): the
launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

This is the same `repo-root.test.ts` worktree-path artifact already documented as
deferred for `04-01` (commit `5499f10`) and the `260817-n6p` quick task (commit
`ff87d94`) — a property of running inside a Claude Code git worktree
(`.claude/worktrees/agent-*`), not caused by this plan's changes to
`stock-connect.ts` / `stock-connect.test.ts`. Not fixed here; scope boundary
excludes pre-existing failures unrelated to the current task's files.
