# Deferred Items -- Phase 05 (skill-critical-derived-tools)

Items discovered during execution that are out of scope for the plan that
found them (per the executor's scope-boundary rule: only auto-fix issues
directly caused by the current task's changes).

## From 05-01

- **`repo-root.test.ts` line 152 ("path agreement ... the agreed path is not
  under .claude") fails when run inside a worktree nested under
  `.claude/worktrees/<agent-id>/`.** `npm run test:automated` reports 1
  failure out of 1227 tests; every other test (including all 32 new
  `stock-memory-search.test.ts` tests) passes. Root cause: the assertion
  checks that `supervisorDir()`'s resolved path does not sit under a
  directory literally named `.claude`, but this parallel-executor's own
  worktree lives at
  `.claude/worktrees/agent-a6fbc6047a5154e49/.vice-supervisor`, so the
  check trips on the test environment's own location, not on any code
  change. Confirmed pre-existing: `repo-root.test.ts` has not been touched
  since the initial plugin commit (`b0975f4`) and 05-01 touched only
  `stock-memory-search.ts`/`stock-memory-search.test.ts`. Not fixed here --
  out of scope for DERIV-01. Re-run `test:automated` from a non-worktree
  checkout (or a worktree not nested under `.claude/`) to confirm this does
  not reproduce outside the parallel-executor environment.
