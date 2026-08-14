# Deferred Items -- Phase 03 (direct-tools)

Out-of-scope discoveries logged during plan execution, per the executor's
scope boundary (only auto-fix issues directly caused by the current task's
own changes; pre-existing failures in unrelated files are logged here, not
fixed).

## 03-04: `repo-root.test.ts` fails when run from inside a nested worktree checkout

**Found during:** 03-04, Task 2's `npm run test:automated` run.

**Test:** `repo-root.test.ts` -- "path agreement (D-3, D-6, THE regression
this task exists to catch): the launcher's own repo_root (resources/ and
tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE), and
the agreed path is not under .claude"

**Symptom:** `AssertionError: the agreed directory must not sit under
.claude -- got
.../.claude/worktrees/agent-ada736a6fee89eee4/.vice-supervisor`

**Cause:** This test's own repo-root resolution walks up from the test
file's location to find the nearest `.git` ancestor. When the whole
repository checkout itself lives at a path containing a literal `.claude`
segment (a Claude Code parallel-execution worktree, checked out at
`<repo>/.claude/worktrees/agent-<id>/`), the resolved repo root is itself
under a `.claude` directory -- the exact shape the test's own regression
guard was written to catch, but for a reason unrelated to the code under
test: the WORKTREE'S OWN LOCATION, not a bug in `repo-root.ts`.

**Scope:** Neither `repo-root.ts` nor `repo-root.test.ts` is in this plan's
`files_modified` list, and neither file appears in this plan's diff
(`broker-state.mts`, `broker-launch.mts`, `vice-broker.mts`,
`resources/*.mjs`, and the two colocated test files are the only files this
plan touches). Confirmed failing on a run of `repo-root.test.ts` in
isolation, with no other tests interposed.

**Action:** Not fixed -- out of scope for this plan. Re-run this test from
a checkout NOT nested under a `.claude/` path segment (e.g. the merged
worktree in the main repo tree) to confirm it passes there before treating
this as a real regression.
