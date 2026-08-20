# Deferred Items — Phase 11

Out-of-scope discoveries logged during execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 11-01: `repo-root.test.ts` fails when the repo is checked out under `.claude/worktrees/`

**Found during:** Task 3 verification (`npm test` full-suite run).

**Test:** `repo-root.test.ts` — "path agreement (D-3, D-6, THE regression this task exists to
catch): the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude"

**Failure:** `the agreed directory must not sit under .claude -- got
<repo>/.claude/worktrees/agent-a53fced8950fd70fd/.vice-supervisor`

**Cause:** This plan's executor runs inside a git worktree that Claude Code checked out at
`.claude/worktrees/agent-a53fced8950fd70fd/` inside the main repo tree. The test's own
`.git`-walk repo-root resolution correctly walks up to that worktree's own root — which itself
sits under a path containing `.claude/` — so the "not under .claude" assertion fails purely as
an artifact of the worktree's location on disk, not because of any behavior change in
`repo-root.ts` or `vice-launcher.sh`. This is completely disjoint from all three files this plan
modifies (`r2000-launch.test.ts`, `r2000-verify.ts`/`.test.ts`, `r2000-test-gate.ts`).

**Verified pre-existing / environmental, not introduced by this plan:** none of plan 11-01's
changes touch `repo-root.ts`, `vice-launcher.sh`, or any host-path resolution code; the failure
reproduces identically running `repo-root.test.ts` alone, unrelated to the r2000 changes.

**Action:** Not fixed — out of scope for plan 11-01. Left for whoever next runs the suite from a
normal (non-`.claude/worktrees/`) checkout to confirm it passes there, or for a future plan to
harden the test/resolution against a worktree nested under `.claude/`.
