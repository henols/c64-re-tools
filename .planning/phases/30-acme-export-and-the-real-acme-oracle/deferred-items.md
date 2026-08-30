# Phase 30 — deferred items

Out-of-scope discoveries logged during execution. Nothing here was fixed: each
is either pre-existing or environmental, and none was caused by a Phase 30
change.

## 1. `repo-root.test.ts` "path agreement" fails inside a `.claude/worktrees/` worktree

- **Found during:** plan 30-01, first full `npm run test:automated` run.
- **Test:** `repo-root.test.ts:178` — *"path agreement (D-3, D-6, THE regression
  this task exists to catch): the launcher's own repo_root (resources/ and
  tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and the
  agreed path is not under .claude"*.
- **Observed failure:**
  `the agreed directory must not sit under .claude -- got
  /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-<id>/.vice-supervisor
  (the exact regression a naive move would introduce)`
- **Cause:** the assertion is about the resolved supervisor directory, and GSD's
  worktree isolation places the whole checkout at
  `<repo>/.claude/worktrees/agent-<id>/`. The resolver is therefore *correct* —
  the worktree root really is under `.claude` — and the guard fires on the
  location of the checkout, not on anything in the tree.
- **Confirmed not a regression:** the same file was run against the MAIN
  checkout during plan 30-01 and reports `# pass 6 / # fail 0`. It is red only
  under worktree isolation.
- **Why not fixed here:** out of scope (not caused by this plan's changes), and
  the fix is a decision about the guard's subject — whether a worktree checkout
  under `.claude/` should be exempted, or whether GSD worktrees should live
  elsewhere — which is not this phase's concern.
- **Consequence for later plans in this phase:** the phase's stated
  `npm run test:automated` "0 failures" floor is unreachable from inside a
  worktree for this one reason. Read the floor as "0 failures other than
  `repo-root.test.ts`'s path-agreement test", and re-check it in the main
  checkout after the wave merges.
