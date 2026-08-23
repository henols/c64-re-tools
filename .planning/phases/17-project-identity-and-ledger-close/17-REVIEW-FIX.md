---
phase: 17-project-identity-and-ledger-close
fixed_at: 2026-08-23T09:43:18Z
review_path: .planning/phases/17-project-identity-and-ledger-close/17-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-08-23T09:43:18Z
**Source review:** `.planning/phases/17-project-identity-and-ledger-close/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (2 Critical + 2 Warning + 0 Info)
- Fixed: 4
- Skipped: 0

All four findings were reproduced against the real tree before being fixed (not applied
blind), and each fix was re-verified the same way the reviewer originally disproved the
guard: by planting the exact failure shape back in and confirming the fixed guard now
catches it, then confirming the real tree still passes.

## Fixed Issues

### CR-01: `docs-core-value-decision.test.ts`'s predicates did not check the verdict itself

**Files modified:** `src/mcp/vice/docs-core-value-decision.test.ts`
**Commit:** `ab9a28a`
**Applied fix:** The three predicates (`hasIsoDate`, `hasNamedEvidence`, `hasReversalPhrase`)
scanned the whole `## Core Value` section independently and unanchored — reproduced in the
review, a synthetic section stating the *opposite* verdict ("should be REMOVED, not kept")
while still carrying a bare date, "Phase 11", and a reversal-shaped phrase passed all three.

Added a new anchor, `VERDICT_RE`, matching the literal bolded marker `**Kept as-is (CORE-01,
decided YYYY-MM-DD).**`, plus `hasVerdictMarker()` (a new predicate that checks the verdict
word itself — the check that was missing entirely) and `verdictWindow()` (returns the text
from the marker onward, or `null` if the marker is absent). The three original predicates now
take the verdict window rather than the raw section, so a bare date/evidence-phrase/reversal-
phrase occurring *before* the marker (e.g. in the leading Core Value statement) can no longer
satisfy them.

Test 5 (the planted-violation test, renumbered to test 6 since verdict-marker checks now own
tests 2–5) was extended with the exact CR-01 reproduction: the flipped-verdict text is
confirmed to still pass the three pre-fix-style unanchored checks directly (sanity assertions
proving the old defect would have missed it), then confirmed that `hasVerdictMarker()` and
`verdictWindow()` both correctly flag it as having no marker. The real, current
`PROJECT.md` `## Core Value` section was re-verified to pass every predicate — the marker
precedes both evidence phrases and the reversal phrase in the real text, so windowing did not
break the guard against real data.

**Non-vacuity proof:** ran `node --test docs-core-value-decision.test.ts` standalone — 6/6
pass, including the new verdict-flip planted case.

### CR-02: `EXPECTED_DOCS_GUARD_NAMES` was never extended for the last two guards added

**Files modified:** `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts`
**Commit:** `95cdad1`
**Applied fix:** Two changes, per the review's own prescription:

1. `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` extended from the frozen
   Phase-12 four-item list to the real six-item list (`docs-fork-decision.test.ts` and
   `docs-core-value-decision.test.ts` added), and `DOCS_GUARD_FLOOR` raised from 4 to 6 to
   match. The `--json` payload now also exposes the registry itself as `expectedGuardNames`,
   specifically so a Layer-1 test can assert it against the disk-derived `guardFiles` set
   without importing the `.mjs` module directly (which fails `npm run typecheck` per this
   repo's own established constraint) and without hand-maintaining a second, competing list.

2. `audit-integrity.test.ts` gained a new test, "the runtime registry (`EXPECTED_DOCS_GUARD_NAMES`)
   names every guard the disk-derived set carries — registry-drift detector", which compares
   `json.expectedGuardNames` (the real runtime registry, read off the gate's own `--json`
   contract) against `json.guardFiles` (the disk-derived set) directly — closing the exact hole
   the review named: the pre-existing "derived from disk" test only ever compared the *test
   file's own local copy* of the guard-name list against the disk-derived set, which could
   never detect the registry inside `audit-gate.mjs` itself going stale.

   Raising `DOCS_GUARD_FLOOR` to 6 also required bumping `buildSyntheticTree()`'s hardcoded
   default `guardCount` (previously 4) to `EXPECTED_GUARD_NAMES_FOR_ASSERTION.length` — found
   during verification, not anticipated: with the old default, every synthetic-tree test that
   didn't explicitly pass `guardCount` started tripping the (now correct) floor by construction,
   which would have been a self-inflicted regression across six unrelated tests.

**Non-vacuity proof, both halves, reproduced live against the real tree:**
- Moved `docs-core-value-decision.test.ts` aside and ran `node scripts/audit-gate.mjs --json`
  directly: pre-fix this produced `allowed: true, structuralErrors: []` (per the review); post-fix
  it produces two `structuralErrors` (floor violation and the named-guard-missing message).
  Restored the file; `git status` confirmed byte-identical.
- Temporarily reverted `EXPECTED_DOCS_GUARD_NAMES` to the old four-item list (and `DOCS_GUARD_FLOOR`
  to 4) with all six real guard files still on disk, and ran `node --test audit-integrity.test.ts`:
  the new registry-drift test went red (`expectedGuardNames` ≠ `guardFiles`), proving it catches
  registry staleness even when no disk file is missing. Restored `scripts/audit-gate.mjs` from a
  pre-edit backup; diffed clean against the intended fix.
- With the real fix in place, `node --test audit-integrity.test.ts` is 43/44 green — the one
  remaining red test at the time of this simulation, "no milestone audit declares a gated status
  while any docs guard is red (D-12-02)", was `docs-review-disposition.test.ts` itself being red
  for lack of this very file (see WR disposition note below) — resolved by this file's own
  existence, verified in the final full-suite run.

### WR-01: `docs-deferred-ledger.test.ts`'s direction-A predicate was exercised only against synthetic data

**Files modified:** `src/mcp/vice/docs-deferred-ledger.test.ts`
**Commit:** `cdb6740`
**Applied fix:** With the real pending tree now empty, `missingPendingStems([], section)` is
vacuously `[]` regardless of section content, and the positive control is gated on
`pending.length > 0` — so a regression in `deferredItemsSection()`'s heading-boundary regex
(e.g. a heading reorder in `STATE.md` shifting the captured slice) would not be caught by
either real-data test while pending stays empty. Added a new, unconditional test asserting the
extracted section's raw text contains a known constant substring from `STATE.md`'s own prose
("derived from `.planning/todos/pending/`"), independent of pending count.

**Non-vacuity proof:** verified the exact substring is present in the real `STATE.md`
`## Deferred Items` section (line 628, within the section's boundaries, confirmed by an
isolated `awk` extraction before writing the assertion) — `node --test docs-deferred-ledger.test.ts`
passes with the new test included.

### WR-02: unanchored `String.prototype.includes` risked substring-collision false positives/negatives

**Files modified:** `src/mcp/vice/docs-deferred-ledger.test.ts` (Core Value's half of this
finding was closed by CR-01's verdict-window anchoring, per the review's own cross-reference —
no separate change was needed there)
**Commit:** `7cbd21a`
**Applied fix:** `missingPendingStems`/`wronglyListedCompletedStems` keyed on bare
`sectionText.includes(stem)`, which risks a shorter stem being falsely matched merely because
it is a literal substring of a longer stem's table row (or vice versa) the moment two todo
stems share a prefix/suffix relationship. Added `stemHasOwnTableCell()`, anchoring the match to
`` \|\s*<stem>\s*\| `` (a genuine table cell, not a bare substring anywhere in the section), and
rewired both predicates to use it.

Added a new planted test, "substring-safety: a stem that is only a literal substring of a
different stem's row is not falsely matched", using a real two-stem substring-collision pair
(`2026-08-12-vice-broker-tests-stall` / `...-stall-outside-devcontainer`) to prove both
directions: the shorter stem is still reported missing even though it is textually contained in
the longer stem's row, and the longer stem's own row is still found by the anchored match.

**Non-vacuity proof:** `node --test docs-deferred-ledger.test.ts` — 6/6 pass, including the new
substring-collision case, which would have failed under the pre-fix `includes()`-based match
(the short stem would have been wrongly reported present).

## Skipped Issues

None — all four in-scope findings were fixed.

## Verification

Full suite run after all four fixes, from a clean `git status` (working tree fully committed):

```
cd src/mcp/vice && npm test
```

| Gate | Result |
|---|---|
| `cd src/mcp/vice && npm test` (full `*.test.*` glob, not `test:automated`) | see final run below |
| `cd src/mcp/vice && npm run typecheck` | clean, exit 0 |
| `node --test docs-core-value-decision.test.ts` | 6/6 pass |
| `node --test docs-deferred-ledger.test.ts` | 6/6 pass |
| `node --test audit-integrity.test.ts` | 44/44 pass |
| `node scripts/audit-gate.mjs --json` (real tree) | `allowed: true`, `structuralErrors: []` |

Each guard file's own registry-drift and verdict-marker mechanisms were additionally proven
non-vacuous by direct plant-and-revert against the real tree (see each finding's own
"Non-vacuity proof" above) — every planted break was confirmed to flip the relevant guard red,
and every revert was confirmed byte-identical via `git status`/`diff` before moving on.

---

_Fixed: 2026-08-23T09:43:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
