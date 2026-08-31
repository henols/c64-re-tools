# Phase 32 — deferred items (out of scope for the plan that found them)

Discoveries that are NOT caused by this phase's changes. Logged rather than
fixed, per the executor scope boundary.

---

## 1. `repo-root.test.ts`'s `.claude` assertion cannot pass inside a GSD worktree

**Found by:** plan 32-01, task 2, while running `npm run test:automated` for its
zero-failure acceptance criterion.

**Symptom:** exactly one failure out of 2941 tests:

```
not ok 1472 - path agreement (D-3, D-6, THE regression this task exists to catch):
  the launcher's own repo_root (resources/ and tools/ copies) agrees with Node's
  supervisorDir()/dirname(EPOCH_FILE), and the agreed path is not under .claude
```

**Cause (measured, not inferred).** `src/mcp/vice/repo-root.test.ts:248-251`
asserts:

```js
  assert.ok(
    !nodeVals.supervisorDir.includes(".claude"),
    `the agreed directory must not sit under .claude -- got ${nodeVals.supervisorDir} ...`
  );
```

A GSD worktree executor runs with its repository root **inside** `.claude`:

```
$ node --input-type=module -e 'import { supervisorDir, repoRoot } from "./src/mcp/vice/repo-root.ts"; ...'
repoRoot:       /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e
supervisorDir:  /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc0e44067665a83e/.vice-supervisor
includes .claude: true
```

So the assertion is structurally unsatisfiable in a worktree whose path is
`<repo>/.claude/worktrees/agent-*`, which is the path Claude Code's
`isolation="worktree"` always uses. The test is measuring the environment, not
the code.

**Attribution.** Nothing in plan 32-01 touches `repo-root.ts`, `vice.ts`,
`install-resources.ts` or `resources/vice-launcher.sh`. The five files it adds
are `scripts/lib/audit-root.mjs`, `scripts/check-guard-fates.mjs`,
`scripts/audit-mutation-harness.mjs`, `scripts/check-guard-fates.d.mts`,
`scripts/lib/audit-root.d.mts` and `src/mcp/vice/guard-fates.test.ts`. The
remaining 2940 tests pass.

**Why it is left alone.** The assertion is deliberate — its own name calls it
"THE regression this task exists to catch", and the regression it guards
(`.vice-supervisor` migrating under `.claude`) is real. Loosening it to
accommodate a worktree path would blunt a guard this milestone is otherwise
busy sharpening, and doing that inside a phase whose subject is guard vacuity
would be the wrong trade made in the worst possible place.

**Consequence for this phase.** Every plan in phase 32 that runs
`npm run test:automated` from a worktree will see this same single failure, and
should attribute it here rather than re-diagnosing it. The zero-failure
criterion is met **modulo this one environment-bound assertion** — confirm by
re-running the suite from the merged main checkout, where the repository root is
not under `.claude`.

**Suggested owner.** Not phase 32. Either (a) the test grows a documented
worktree carve-out — assert the agreed path is not under `<repo>/.claude` *as a
state directory* rather than not containing the substring `.claude` anywhere —
or (b) it joins the `MANUAL_ONLY_TESTS` set with the reason recorded. Both are
changes to a guard's semantics and belong in a plan that owns that guard.
