# Deferred Items — Phase 08.2

Out-of-scope discoveries logged during plan execution, per the executor's
SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current
task's changes).

## D-1: `repo-root.test.ts`'s "not under .claude" assertion false-fails when executed from inside a Claude Code worktree

- **Found during:** 08.2-01, Task 2 (measurement task: `node test-gate.mjs` / `npm test`)
- **Test:** `repo-root.test.ts:152` — "path agreement (D-3, D-6, THE regression this
  task exists to catch): ... the agreed path is not under .claude"
- **Root cause (confirmed by direct inspection, not inferred):** `repoRoot()`
  walks up from the caller's location looking for the nearest `.git` entry
  (file or directory). Executed from inside a Claude Code parallel-executor
  worktree, the worktree checkout itself lives at
  `<repo>/.claude/worktrees/agent-<id>/`, and that directory's own `.git`
  *file* is the nearest ancestor — so `repoRoot()` correctly (per its own
  documented resolution ladder) returns a path that contains the literal
  substring `.claude`. Verified directly in this session:
  ```
  $ node --input-type=module -e "import { repoRoot } from './repo-root.ts'; console.log(repoRoot());"
  /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a7b71e4317f8cb341
  ```
  This is not a bug in `repoRoot()` or in the test's intent (the assertion
  correctly guards against a regression where the *real* repo/plugin-consumer
  layout resolves under `.claude`) — it is an artifact of where the parallel
  worktree itself is checked out, which the test predates and does not
  account for.
- **Why out of scope for 08.2-01:** Not caused by this plan's change (the
  `08.1-d-checklist.sh` untrack). Confirmed present both before and after
  Task 1's commit; the tally (1650 pass / 1 fail / 5 todo) is identical to
  the pre-fix baseline's tally except that the single failure is now this
  test instead of `host-scripts.test.ts` (which is now green).
- **Why it will not surface in CI or the merged main checkout:** GitHub
  Actions checks out the repo at a plain path with no `.claude/worktrees/`
  segment (`.github/workflows/ci.yml` line 75 runs bare `npm test` from a
  fresh `actions/checkout`), and the main repo checkout at
  `/home/henrik/dev/henrik/git/c64-re-tools` likewise contains no `.claude`
  substring. This failure is provably specific to running the suite from
  inside a nested worktree agent's own directory.
- **Not fixed:** left `repo-root.test.ts` and `repo-root.ts` untouched, per
  Task 2's explicit "do not modify any test file... in this task" instruction
  and the general SCOPE BOUNDARY rule.
- **Recommendation:** the orchestrator (or `/gsd-verify-work`) should re-run
  `cd .claude/mcp/vice && node test-gate.mjs` and `npm test` from the merged
  main checkout (non-worktree) after this wave merges, to get the
  true 0-failure confirmation this plan's acceptance criteria describe. If a
  future phase wants to harden the test itself against worktree execution
  (e.g., special-casing a `.git/worktrees/` ancestor), that is new scope, not
  a fix that belongs to this plan.
