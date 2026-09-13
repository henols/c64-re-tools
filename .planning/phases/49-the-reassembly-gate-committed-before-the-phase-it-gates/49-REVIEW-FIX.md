---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
fixed_at: 2026-09-13T13:30:46Z
review_path: .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 49: Code Review Fix Report

**Fixed at:** 2026-09-13T13:30:46Z
**Source review:** `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (CR-01)
- Fixed: 1
- Skipped: 0

This record exists because `docs-review-disposition.test.ts` recognises five
disposition sources for a review finding, and `49-REVIEW.md` itself is not one
of them. The applicable source for this phase is the established
`*-REVIEW-FIX.md` convention already used by `02-REVIEW-FIX.md` and
`07-REVIEW-FIX.md`; phase 49 had no such file until this record, which is the
entire gap the guard was flagging — the finding's substance was already fixed,
only the disposition record was missing.

## Fixed Issues

### CR-01: This phase's own new code introduces planning-vocabulary citations into `src/mcp/vice/*.ts`

**Files named:** `src/mcp/vice/acme-verify.ts:413`, `src/mcp/vice/acme-verify.test.ts:811`
**Commit:** `29d4c467` ("fix(49): state the mechanism instead of citing planning vocabulary")

**Verified before writing this disposition:** re-read both files' current text.
Neither citation is present anymore:

- `src/mcp/vice/acme-verify.ts`'s `TEST-ONLY seam` comment no longer carries the
  bare `(plan 49-03)` citation the finding named — the sentence keeps its
  mechanism ("A caller may supply its own directory for the assembled output
  file instead of this function's own fresh one.") and drops the planning-tree
  pointer.
- `src/mcp/vice/acme-verify.test.ts`'s tree file-inclusion-order comment no
  longer carries the bare `(D47-D)` id — the sentence already stated the
  mechanism in full ("`unscoped.a` LAST regardless of address") and the
  citation was removed as carrying nothing the prose did not.

Commit `29d4c467` is a comment-only change (2 files, 1 line each) that landed
before this disposition record was written; it removed both citations CR-01
named. **What was actually missing here was the disposition record, not a
code fix** — that is the lesson for the next reader of this file: a finding
can be fixed and still show up as an open, undispositioned review comment if
the fix never gets a record in a source this guard recognises.

**Scope note:** CR-01 scoped itself explicitly to citations this phase's own
commits (`f681e76a`, `49-02`/`49-03`) freshly introduced. Other
planning-vocabulary citations that may survive elsewhere in these two files
from earlier phases are a different question and are out of scope for this
disposition.
