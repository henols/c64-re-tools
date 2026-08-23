# Deferred Items — quick task 260823-kf6

Out-of-scope discoveries found during plan execution, logged per the executor's
scope-boundary rule rather than fixed inline.

## Task 3: pre-existing `npm test` failure, unrelated to this task's file scope

**Found during:** Task 3's full `npm test` run in `src/mcp/vice`.

**Observed:** 2395 tests / 2350 pass / **1 fail** / 39 skipped / 5 todo (24 suites).

**Failing test:** `audit-integrity.test.ts` — "the frontmatter scan reads only the
frontmatter, not prose (T-12-04)" — asserts a hardcoded `statusCounts.tech_debt === 3`
across all `*MILESTONE-AUDIT*.md` files on disk. Actual: `{"tech_debt":4,"gaps_found":2,
"passed":1}`.

**Root cause:** `.planning/v0.4.0-MILESTONE-AUDIT.md` (status `tech_debt`) was added by
commit `76f7b15` — landed on `main` before this quick task began. That file is the fourth
`tech_debt`-status milestone audit on disk (alongside `.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`,
`v0.2.0-MILESTONE-AUDIT-round1-2026-08-19.md`, `v0.3.0-MILESTONE-AUDIT-round1-2026-08-21.md`), so
the test's pinned count of 3 is stale. This task's plan explicitly names
`.planning/v0.4.0-MILESTONE-AUDIT.md` as a non-goal ("a dated point-in-time audit record ...
a later audit round reflects the fix"), and does not touch `audit-integrity.test.ts`.

**Confirmed NOT caused by this task's changes:** this task modified only `.planning/STATE.md`
and `.planning/REQUIREMENTS.md`; neither file is scanned by this test (it scans
`*MILESTONE-AUDIT*.md` files only). The six required `docs-*.test.ts` guards
(`docs-deferred-ledger`, `docs-dangling-refs`, `docs-linerefs`, `docs-core-value-decision`,
`docs-fork-decision`, `docs-review-disposition`) were run in isolation and are all green
(36/36 pass, 0 fail).

**Disposition:** Out of scope for `260823-kf6` (`files_modified` is `.planning/STATE.md`,
`.planning/REQUIREMENTS.md` — neither is `audit-integrity.test.ts` or a `*MILESTONE-AUDIT*.md`
file). Not fixed here. Whoever next runs a v0.4.0 audit round or updates
`audit-integrity.test.ts`'s pinned counts should account for the fourth `tech_debt` audit.
