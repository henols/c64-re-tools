# Deferred Items — Phase 08.2

Out-of-scope discoveries logged during plan execution, per the executor's
SCOPE BOUNDARY rule (fix only what the current task's changes directly
caused). Nothing here is fixed by this phase.

## D-1: `repo-root.test.ts`'s "not under .claude" assertion false-fails when executed from inside a Claude Code worktree

**Found independently by both wave-1 plans** (08.2-01 Task 2 and 08.2-02), which
reached the same root cause from different entry points. Recorded once here.

- **Found during:** 08.2-01, Task 2 (measurement task: `node test-gate.mjs` /
  `npm test`); independently reproduced by 08.2-02.
- **Test:** `repo-root.test.ts:152` — "path agreement (D-3, D-6, THE regression this
  task exists to catch): ... the agreed path is not under .claude"
- **Root cause (confirmed by direct inspection, not inferred):** `repoRoot()`
  walks up from the caller's location looking for the nearest `.git` entry
  (file or directory). Executed from inside a Claude Code parallel-executor
  worktree, the worktree checkout itself lives at
  `<repo>/.claude/worktrees/agent-<id>/`, and that directory's own `.git`
  *file* is the nearest ancestor — so `repoRoot()` correctly (per its own
  documented resolution ladder) returns a path that contains the literal
  substring `.claude`. Verified directly:
  ```
  $ node --input-type=module -e "import { repoRoot } from './repo-root.ts'; console.log(repoRoot());"
  /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a7b71e4317f8cb341
  ```
  Plan 08.2-02 reached the same conclusion via the downstream consumer:
  `supervisorDir()`'s agreed directory resolves to
  `<worktree>/.vice-supervisor`, which the assertion (correctly, for a normal
  checkout) rejects as "under .claude".

  This is not a bug in `repoRoot()` or in the test's intent (the assertion
  correctly guards against a regression where the *real* repo/plugin-consumer
  layout resolves under `.claude`) — it is an artifact of where the parallel
  worktree itself is checked out, which the test predates and does not
  account for.
- **Why out of scope for both plans:** Not caused by either plan's change.
  08.2-01 confirmed it present both before and after Task 1's commit; 08.2-02
  confirmed it by re-running the identical test against the already-committed
  HEAD state with no working-tree changes present, which fails identically.
- **Why it will not surface in CI or the merged main checkout:** GitHub
  Actions checks out the repo at a plain path with no `.claude/worktrees/`
  segment (`.github/workflows/ci.yml` line 75 runs bare `npm test` from a
  fresh `actions/checkout`), and the main repo checkout at
  `/home/henrik/dev/henrik/git/c64-re-tools` likewise contains no `.claude`
  substring. This failure is provably specific to running the suite from
  inside a nested worktree agent's own directory.
- **Not fixed:** `repo-root.test.ts` and `repo-root.ts` left untouched, per
  08.2-01 Task 2's explicit "do not modify any test file... in this task"
  instruction and the general SCOPE BOUNDARY rule.
- **Orchestrator follow-up:** re-run `cd .claude/mcp/vice && node test-gate.mjs`
  and `npm test` from the merged main checkout (non-worktree) after wave 1
  merges, to get the true 0-failure confirmation both plans' acceptance
  criteria describe. Hardening the test itself against worktree execution
  (e.g., special-casing a `.git/worktrees/` ancestor) is new scope.
- **Per-worktree tallies observed:** 08.2-01's worktree reported 1 failure
  (this artifact, after its own `host-scripts.test.ts` fix went green);
  08.2-02's worktree reported 2 (this artifact plus the still-unmerged
  `08.1-d-checklist.sh` tracked-shell-script drift that is I-3/plan 01's
  territory). Both resolve on merge — to be confirmed by the follow-up above.
