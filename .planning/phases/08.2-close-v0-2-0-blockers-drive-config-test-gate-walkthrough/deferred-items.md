# Deferred Items — Phase 08.2

Out-of-scope discoveries logged during plan execution, per the executor's
scope-boundary rule (fix only what the current task's changes directly
caused). Not fixed here.

## From plan 08.2-02

- **`repo-root.test.ts`'s "path agreement ... is not under .claude" test fails
  when run inside this worktree.** The worktree lives at
  `.claude/worktrees/agent-aabf21854605be5ce/` — a path that itself contains a
  `.claude` segment before the repo's true logical root — so
  `supervisorDir()`'s agreed directory resolves to
  `<worktree>/.vice-supervisor`, which the test's own assertion (correctly,
  for a normal checkout) rejects as "under .claude". This is a pre-existing
  environmental artifact of running tests from inside a nested Claude Code
  worktree, not something plan 02's `broker-launch.mts`/`broker-launch.test.ts`
  changes touch or introduce — confirmed by re-running the identical test
  against the already-committed HEAD state with no working-tree changes
  present, which fails identically. Out of scope for this plan; not
  auto-fixed. `test-gate.mjs`'s full-suite run therefore reports 2 failures in
  this worktree rather than the 1 plan 02 itself expects (the pre-existing
  `08.1-d-checklist.sh` tracked-shell-script drift, I-3's territory) — the
  second is this worktree-path artifact, not a plan 02 regression.
