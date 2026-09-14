# Deferred Items — Phase 51

Out-of-scope discoveries surfaced while executing this phase's plans, logged
here per the executor's scope-boundary rule rather than fixed inline.

## 51-04: STATE.md Deferred Items drift (pre-existing, unrelated to this plan)

**Found during:** Plan 51-04's full-gate run (`npm run test:automated`), after
sweeping `broker-launch.mts`/`broker-control.mts`/`broker-epoch.mts` to zero.

**Issue:** `docs-deferred-ledger.test.ts` fails twice: two pending todos
(`.planning/todos/pending/installer-skill-provenance-stamp.md` and
`.planning/todos/pending/stale-six-skills-count.md`) have no row in
`STATE.md`'s `## Deferred Items` section. `audit-integrity.test.ts` then fails
as a downstream consequence (it refuses a `gated` milestone-audit status while
any docs guard is red).

**Not caused by this plan.** Both pending-todo files were added in commit
`e5e03fd5` ("docs: capture exploration — skill-installer-routes"), timestamped
2026-09-14 14:29:03 — five minutes AFTER plan 51-03's own closing commit
(`6d251df1`, 14:23:55) and before this plan (51-04) started. 51-03's own
SUMMARY self-check reported the full gate as `fail 0` at that point. This
plan's tasks touch only `broker-launch.mts`, `broker-control.mts`,
`broker-epoch.mts`, their generated `resources/*.mjs` siblings, and
`skills-planning-vocabulary.test.ts` — none of which this drift concerns.

**Resolution:** Left unfixed, per the executor's scope boundary (do not
auto-fix pre-existing issues unrelated to the current task's changes). Add a
`STATE.md` Deferred Items row for each of the two named todos in a future
plan or a dedicated quick task.
