---
phase: 52-remove-the-fork-backend
fixed_at: 2026-09-12T14:23:38Z
review_path: .planning/phases/52-remove-the-fork-backend/52-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 52: Code Review Fix Report

**Fixed at:** 2026-09-12T14:23:38Z
**Source review:** .planning/phases/52-remove-the-fork-backend/52-REVIEW.md
**Iteration:** 1

**Scope note:** Per explicit instruction, this fix pass covers only the three Round 2
gap-closure findings — **WR-04, IN-02, IN-03** — all of which live in
`src/mcp/vice/docs-fork-absence.test.ts`. Round 1 findings WR-01, WR-02, WR-03, and IN-01
were out of scope (already dispositioned elsewhere) and were left untouched; their
sections in `52-REVIEW.md` are byte-identical to before this pass, and none of
`broker-launch.mts`, `vice-broker-client.ts`, or `docs/stock-vice-parity.md` were touched.

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-04: `DELETED_MODULE_CITATION_RE` only enforced a leading word-boundary, not a trailing one

**Files modified:** `src/mcp/vice/docs-fork-absence.test.ts`
**Commit:** `7bfc3e8b`
**Applied fix:** Added the same trailing boundary assertion `(?:$|[^A-Za-z0-9_.-])` that its
sibling `STALE_MANIFEST_CITATION_RE` already carries to `DELETED_MODULE_CITATION_SOURCE`, so a
match now requires a non-identifier/non-dot character (or end of string) on *both* sides of a
cited deleted-module filename. Updated the doc comment above the constant to state the
trailing-boundary rationale explicitly (a filename that merely *starts with* a deleted module's
name — `vice.tsx`, `vice.ts.bak`, a markdown anchor like `vice.ts#history` — must not be
conflated with a real citation of the deleted `vice.ts`). Added a new planted-violation control
test asserting `findDeletedModuleCitations()` reports nothing for an in-memory body containing
only `vice.tsx`, mirroring the existing `device.ts` (leading-side) control.
**Verification:** Ran `node --test docs-fork-absence.test.ts` directly (not by reading the code)
— all tests pass, including the pre-existing planted-violation suite and the new trailing-side
control. Confirmed both directions the review asked for by running the real
`findDeletedModuleCitations()` predicate: it still reports `vice.ts` for a real citation
(`findDeletedModuleCitations("The transport seam lives in \`src/mcp/vice/vice.ts\`.")` →
`["vice.ts"]`), and now also correctly reports nothing for the merely-adjacent name `vice.tsx`,
which prior to this fix would have incorrectly matched.

### IN-02: `findDeletedModuleCitations` was the only predicate in the file exported with no consumer

**Files modified:** `src/mcp/vice/docs-fork-absence.test.ts`
**Commit:** `3d1db161`
**Applied fix:** Dropped the `export` keyword from `findDeletedModuleCitations`, matching every
sibling predicate in the file (`findForbiddenIdentifiers`, `scanTextForForbiddenIdentifiers`,
`scanTextForDeletedModuleCitations`, `findStaleTransportPhrases`,
`scanTextForStaleTransportPhrases`), all of which are plain, unexported `function`s per the
file's own documented convention that planted-violation tests drive the exact function from
within the same module. A repo-wide grep across `src/` and `scripts/` (re-run after the edit)
confirmed no importer anywhere else in the codebase, so no external consumer was broken.
**Verification:** Ran `node --test docs-fork-absence.test.ts` — all tests still pass (the
function is still called from within the same module by its planted-violation tests and by
`scanTextForDeletedModuleCitations`).

### IN-03: Non-vacuity floor comment overstated its own headroom

**Files modified:** `src/mcp/vice/docs-fork-absence.test.ts`
**Commit:** `c6bd9c99`
**Applied fix:** Reworded the comment above the `proseScanned >= 18` assertion from "the floor
is set well under that with headroom" to "the floor is set 2 files below today's count" —
matching the measured reality (README.md + CLAUDE.md + 18 skill markdown files = 20 today,
floor 18, so exactly 2 files of headroom). Chose the "tighten the prose" option from the
review's two suggested remedies rather than lowering the floor further, since the floor still
correctly catches a fully-emptied population and changing its numeric value was not necessary
to resolve the documentation-accuracy nit.
**Verification:** Re-counted the population directly (`README.md` + `CLAUDE.md` + `find
src/skills -name "*.md" | wc -l` = 18, total 20) to confirm the corrected comment's "2 files
below" claim is accurate. Ran `node --test docs-fork-absence.test.ts` — all tests still pass
(this was a comment-only change with zero effect on the assertion's runtime behavior).

## Skipped Issues

None — all three in-scope findings (WR-04, IN-02, IN-03) were fixed.

## Verification Summary

All edits were made and verified inside an isolated git worktree
(`.claude/worktrees/rf-52-*`), not the main checkout, per this workflow's isolation
requirement. `cd src/mcp/vice && node --test docs-fork-absence.test.ts` was run after each of
the three commits; the suite grew from 24 tests (pre-fix) to 25 tests (post-fix, due to the one
new planted-violation control WR-04 added) and all 25 pass with 0 failures at the final state.
This number is reproducible from the worktree's branch (`gsd-reviewfix/52-*`, fast-forwarded
into `main` by the cleanup tail) — not from a state that was torn down before the numbers were
captured.

---

_Fixed: 2026-09-12T14:23:38Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
