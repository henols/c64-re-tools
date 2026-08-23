# Deferred Items — Phase 16 gap closure

Out-of-scope discoveries found during plan execution, logged per the executor's
scope-boundary rule rather than fixed inline.

## 16-08: pre-existing `npm test` failures, unrelated to this plan's file scope

**Found during:** Task 1's baseline re-run (`cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test`).

**Observed:** 2356 tests / 2310 pass / **2 fail** / 39 skipped / 5 todo (23 suites) —
two fewer passes than the plan's stated pre-existing baseline (2312 pass / 0 fail).

**Failing tests:**
- `docs-review-disposition.test.ts` — "every REVIEW.md finding id anywhere in
  `.planning/phases/` has a recorded disposition (AUDIT-01, self-applied)" — fails
  because `16-REVIEW.md`'s own findings (CR-01, IN-01, WR-01, WR-02, WR-03, WR-04)
  have no recorded disposition yet.
- `audit-integrity.test.ts` — "no milestone audit declares a gated status while any
  docs guard is red (D-12-02)" — fails as a direct downstream consequence of the
  above (four milestone audits declare a gated status while
  `docs-review-disposition.test.ts` is red).

**Root cause:** This IS the phase's own gap-closure sequence. `16-REVIEW.md`'s
findings (including this plan's own WR-01/WR-04 pair) are being closed across
16-08..16-11 in this wave; ROADMAP/phase context names 16-11 as "closes the ledger
last" — i.e. the plan that transcribes each 16-REVIEW.md verdict into the
disposition ledger. Until that plan runs, `docs-review-disposition.test.ts` is
expected to stay red for `16-REVIEW.md`'s findings specifically.

**Confirmed NOT caused by this plan's changes:** `git stash` (reverting
`installer/scripts/sync-skills.mjs` and `scripts/check-npm-packages.mjs` to their
committed state) and re-running both test files in isolation reproduces the
identical 1-fail-each result. This is a pre-existing condition, not a regression
introduced by 16-08.

**Disposition:** Out of scope for 16-08 (`files_modified` is
`installer/scripts/sync-skills.mjs`, `scripts/check-npm-packages.mjs`,
`.github/workflows/ci.yml`, `src/mcp/vice/ci-suite-coverage.test.ts` — none of
which touch the disposition ledger or `16-REVIEW.md`). Not fixed here. Expected to
be closed by 16-11 per this wave's own ordering.
