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
16-08..16-11 in this wave. Until every finding id carries a disposition,
`docs-review-disposition.test.ts` stays red for `16-REVIEW.md`'s findings
specifically, and `audit-integrity.test.ts`'s D-12-02 fails as a downstream
cascade of that one red guard (the other four docs guards pass standalone —
verified by the orchestrator).

**Confirmed NOT caused by this plan's changes:** `git stash` (reverting
`installer/scripts/sync-skills.mjs` and `scripts/check-npm-packages.mjs` to their
committed state) and re-running both test files in isolation reproduces the
identical 1-fail-each result. This is a pre-existing condition, not a regression
introduced by 16-08.

**Disposition:** Out of scope for 16-08 (`files_modified` is
`installer/scripts/sync-skills.mjs`, `scripts/check-npm-packages.mjs`,
`.github/workflows/ci.yml`, `src/mcp/vice/ci-suite-coverage.test.ts` — none of
which touch the disposition ledger or `16-REVIEW.md`). Not fixed here.

**Actual closure (orchestrator correction, 2026-08-23).** This entry originally
predicted closure by 16-11. That attribution was wrong: the two failures cascaded
from the two then-undispositioned `16-REVIEW.md` findings, so they were closed by
the plans that dispositioned those findings — 16-09 (the hop-chain comment finding)
and 16-10 (the reuse-advice finding). Both guards went green when 16-10 landed,
before 16-11 ran. Measured after 16-10: 2386 tests / 2342 pass / 0 fail / 39 skipped
/ 5 todo / 24 suites. Corrected here rather than left standing, because an
inaccurate ledger entry is the same class of documentation-consistency gap this
round exists to close.

- **Status:** acknowledged
- **Acknowledged at:** v0.4.0 milestone close (2026-08-23) — recorded in
  `.planning/STATE.md` → `## Deferred Items`. Written by hand because
  `query audit-open acknowledge` refuses this file's heading-delimited
  (#3457) entry shape (`unsupported_heading_shape`); the marker is the
  per-entry `status:` field itself, so it is self-invalidating in the
  usual way — edit the field away and the entry resurfaces at the next
  `audit-open` scan.
