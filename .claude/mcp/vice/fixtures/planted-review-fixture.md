---
phase: planted-fixture-not-a-real-phase
reviewed: 2026-08-21T00:00:00Z
depth: standard
---

# Planted fixture -- NOT a real code review

This file exists only as a committed input to
`docs-review-disposition.test.ts`'s planted-violation test (AUDIT-01, plan
11.1-07 Task 4). It carries a synthetic finding heading, `### WR-99:`, in the
exact shape a real `*-REVIEW.md` uses, so the test can prove the parser
(`parseFindingIds()`) actually sees it -- and, in a companion test, that the
disposition checker (`isDispositioned()`) correctly reports it as
undispositioned when no disposition source names it.

This file is deliberately NOT placed under `.planning/phases/` and is never
matched by `scanAllReviewFindings()`'s real scan (which only reads
`.planning/phases/*/[0-9]*-REVIEW.md`) -- it is read directly, by path, only
from within the test file itself. Committing it here means the real scan's
"0 undispositioned findings" result is never at risk of including this
synthetic id.

## Warning

### WR-99: a synthetic finding that exists only to prove the guard is not vacuous

**File:** nowhere -- this finding does not describe real code.
**Issue:** none. This heading exists solely so a parser proven to find it can
be trusted, and so a disposition checker proven to report it as
undispositioned (when nothing names it) can be trusted too.
**Fix:** not applicable.

---

_Reviewed: 2026-08-21_
_Reviewer: none -- planted fixture_
