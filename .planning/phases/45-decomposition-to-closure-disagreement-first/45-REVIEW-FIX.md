---
phase: 45-decomposition-to-closure-disagreement-first
fixed_at: 2026-09-11T00:00:00Z
review_path: .planning/phases/45-decomposition-to-closure-disagreement-first/45-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 45: Code Review Fix Report

**Fixed at:** 2026-09-11
**Source review:** `.planning/phases/45-decomposition-to-closure-disagreement-first/45-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 critical + 2 warnings + 1 info)
- Fixed: 3 (CR-01, WR-01, WR-02)
- Skipped/declined: 1 (IN-01, accepted with reason -- the review's own Fix
  text already says "optional, no action required now")

**Where this ran:** the main checkout (`workflow.use_worktrees: false` for
this repair pass), not an isolated worktree. Every commit below is directly
reachable from `git log` on `main`.

**Verification method per fix:** `npx tsc --noEmit` (clean after every
commit) plus a scoped `node --test` of the affected file(s), including
`anno-decomp-closure.test.ts`'s full 9-fixture closure suite and
`completeness-report.test.mjs`'s 24-test suite (both still green after every
fix in this file). CR-01 and WR-02 were additionally proven **non-vacuous**:
CR-01 via a real-ACME byte-diff oracle run over both fixed branches (absent
register / present-but-incomplete register); WR-02 by re-running its new
test against the pre-fix `anno-cli.ts` via `git stash` and confirming it
fails exactly as predicted, then re-confirming green after `git stash pop`.

## Fixed Issues

### CR-01: Hardware-register decomposition is attempted by enum-NAME SHAPE alone, with no check that the register has a curated table entry -- breaks any hand-authored register-shaped enum for a register `anno-regbits.json` does not cover (e.g. `$D020`/`$D021`)

**Files modified:** `src/mcp/vice/anno-enum-gen.ts`, `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-tools.ts`, plus their `.test.ts` siblings
**Commit:** `382445d5`

**Applied fix:** added `hasRegBitsEntry()` -- the ONE shared table-membership
predicate, exported from `anno-enum-gen.ts` (the decoder's own owning
module) -- and gated both D-16 render surfaces
(`anno-export-asm.ts`, `anno-tools.ts`'s `renderDisassembleListing()`) on
`REGISTER_ENUM_NAME_RE.test(usage.enumName) && hasRegBitsEntry(...)` instead
of the shape test alone. A register genuinely absent from
`anno-regbits.json` (e.g. `$D020`) now falls through to the pre-existing
single-symbol path with **no substitution counted** -- never a throw. A
register present in the table but not fully covered by its fields (the
disclosed `$DD00` case) still refuses loudly: T-45-21's invariant (never
swallow a throw to fall back to a hex literal while still counting a
substitution that did not happen) is unaffected, because that invariant was
never about the absent-register case to begin with -- it was collateral from
a shape test standing in for a membership test.

**Verified non-vacuous, both branches, both render surfaces:**
- `anno-export-asm.test.ts`'s "CR-01 Fix Test A" (`$D020`, absent) proves the
  fallback path renders `lda #D020_BLACK`, counts `enumSubstitutionCount: 1`
  / `enumDecompositionCount: 0`, and round-trips byte-identically through
  real ACME 0.97 (`verdict.outcome === "ok"`, `byteDiff.equal === true`).
- `anno-export-asm.test.ts`'s "CR-01 Fix Test B" (`$DD00`, present but
  incomplete) proves the refusal still fires, naming the register and "not
  fully covered."
- `anno-tools.test.ts`'s "CR-01 Fix Test C"/"CR-01 Fix Test D" prove the
  identical two branches through the second renderer.
- `anno-enum-gen.test.ts` adds a direct unit-test suite for
  `hasRegBitsEntry()` itself: true for every real committed table key
  (exhaustive, not hand-picked), false for `$D020`/`$D021` (confirmed
  absent), true for `$DD00` (present but partially covered -- a genuinely
  different case from absent-entirely), and honours the test-only cache
  reset.

89/89 (`anno-export-asm.test.ts`), 93/93 (`anno-tools.test.ts`), 47/47
(`anno-enum-gen.test.ts`) pass. `tsc --noEmit` clean.

### WR-01: `anno-store-export.ts`'s `importStoreDocument()` silently discards every row's `bank` field instead of validating it is null or round-tripping it

**Files modified:** `src/mcp/vice/anno-store-export.ts`, `src/mcp/vice/anno-store-export.test.ts`
**Commit:** `a892d8bf`

**Judged on the merits and fixed**, even though `docs-review-disposition.test.ts`'s
own guard already treats this id as dispositioned via an unrelated existing
mention -- disclosing what was actually done rather than leaving the fix
implicit.

**Applied fix:** took the review's own option (a), the "minimal safe fix"
its own Fix text names -- `exportStoreDocument()` faithfully exports `bank`
for every row kind, but no `anno-store.ts` write call
(`setDataType`/`setLabel`/`setComment`/`applyEnumUsage`/`putXref`) accepts a
`bank` argument (every fresh insert hard-codes `bank: null`). Threading a
real value through five write calls with no bank-carrying writer anywhere in
the codebase to prove it against would be a speculative widening this
project's own conventions refuse elsewhere. Added
`assertExportBankIsNull()`, called for every row kind that carries `bank`
(ranges, labels, comments, enumUsage, xrefs), refusing by name
(`AnnoStoreExportError`, naming the offending row and the value) rather than
silently importing a document whose `bank` would be lost.

**Verified:** new test asserts one throw case per row kind, each naming the
offending row (`ranges[0]`, `labels[0]`, etc.) and the cause ("bank must be
null"), plus the whole-document validate-before-write invariant (Test 4's
own property) holds for this refusal too -- zero rows land on a refused
import. A second, explicit non-vacuity control proves `bank: null` (every
committed fixture's real shape, confirmed by iterating all seven row arrays)
still imports cleanly after the fix. `anno-store-export.test.ts` 9/10 pass
(1 opt-in LIVE test skipped, as designed), `anno-decomp-closure.test.ts`
23/23 still green (all nine fixtures' real `bank: null` documents still
import). `tsc --noEmit` clean.

### WR-02: `decomp-completeness`'s image fallback fabricates a phantom `$0000` entry point when the fixture image cannot be located

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-decomp-closure.test.ts`
**Commit:** `c1248c3f`

**Applied fix:** `buildEntryPoints()`/`buildReferencedAddresses()` now
accept a **nullable** image and, when it is `null`, decode zero instructions
and add no `image.origin` candidate -- the placeholder
`{ origin: 0, bytes: [] }` object is gone entirely, replaced by threading
`null` straight through. The report carries a new `imageUnavailable: boolean`
field (both the `--json` answer and the plain-text fallback renderer name
the condition explicitly, per the review's own suggested fix), rather than
requiring a reader to infer it from a suspiciously-empty
`entryPoints`/`referencedAddresses` census.

**Verified non-vacuous the review's own way -- reproduced the defect BEFORE
declaring it fixed, and re-confirmed the fix catches it:** the new test
builds the trigger condition from scratch (a manifest entry pointing at a
fixture path that genuinely does not exist under `src/mcp/vice/fixtures/`,
since this path is unreachable through any of the nine real committed
fixtures -- all nine images exist), asserts `imageUnavailable === true`,
asserts `entryPoints` carries the address of a REAL stored xref (proving the
fix removes only the fabricated `$0000` candidate, not all evidence), and
asserts no entry point address is `0`. Re-ran this exact test against the
pre-fix `anno-cli.ts` via `git stash push -- anno-cli.ts`: **it failed**,
confirming the test genuinely catches the regression the review described.
`git stash pop` restored the fix; the test is green again.
`anno-decomp-closure.test.ts` 24/24 pass (23 pre-existing + 1 new),
`anno-cli.test.ts` 112/112 pass, `completeness-report.test.mjs` 24/24 pass
(unaffected -- it defaults `entryPoints` to `[]` for any unrecognised
report shape and ignores the new field). `tsc --noEmit` clean.

## Skipped Issues

### IN-01: Two independent, hand-copied definitions of `SURVIVOR_EXTRA_RE`/`isSurvivorLabelName()` (and of `typedByFor()`) must be kept in sync by inspection, not by import

**File:** `src/mcp/vice/anno-cli.ts:188-197` vs. `src/skills/routine-queue-walker/scripts/completeness-report.mjs:95-121`
**Reason:** Accepted, no code or test change made. The finding's own Fix
text states this explicitly: "Optional -- no action required now; consider
a mechanical cross-package drift check if this pattern is repeated for a
third value in a later phase." The finding is itself candid that this is a
**deliberate, disclosed tradeoff** (both files' own header comments already
state the duplication and why -- `src/mcp/vice/**` and `src/skills/**`
publish as separate npm packages and cannot import each other), not a
defect this phase introduced silently. Re-reading both cited regions
confirms the duplication is real and exactly as small as described (one
frozen regex, one small precedence function), and that a mechanical
cross-package drift check (e.g. a CI script diffing the two literal
patterns, or a shared JSON-literal data file both packaging steps could
inline) would close the gap mechanically rather than by discipline -- but
building that guard now, for a pattern that has not yet repeated a third
time, would be exactly the kind of speculative infrastructure this
project's own conventions warn against elsewhere (see WR-01's own reasoning
above, same shape: no second consumer exists yet to prove the guard
against). **Original issue:** nothing mechanically fails if a future edit
updates one copy and not the other, beyond a careful reviewer noticing the
drift.

## Notes on commit granularity

Each of the three fixed findings is its own commit (`382445d5`, `a892d8bf`,
`c1248c3f`), plus a fourth, unrelated commit in this same repair session
(`42820042`, dropping the `DD00` bonus enum from the `charset-phantom`
fixture per the phase's own already-disclosed `docs/phase45-closure-gate.md`
gap -- not a `*-REVIEW.md` finding, so it carries no CR/WR/IN id and is not
dispositioned here). Every fixed finding id appears in its own commit
message.

## Verification

- `npx tsc --noEmit`: clean, re-run after every commit.
- `anno-export-asm.test.ts` 89/89, `anno-tools.test.ts` 93/93,
  `anno-enum-gen.test.ts` 47/47, `anno-store-export.test.ts` 9/10 (1 opt-in
  LIVE skip), `anno-cli.test.ts` 112/112, `anno-decomp-closure.test.ts`
  24/24, `completeness-report.test.mjs` 24/24 -- all green after the full
  set of fixes.
- CR-01 and WR-02 additionally verified by planted-violation / pre-fix
  re-run: CR-01 via real ACME byte-diff oracles proving both branches;
  WR-02 via `git stash` confirming the new test fails against the pre-fix
  source.
- `docs-review-disposition.test.ts`: this file is the disposition source
  that turns it green for CR-01/WR-02/IN-01 (WR-01 was already
  guard-satisfied by an unrelated existing mention, per that guard's own
  design -- "mentioned," not "correctly described").

---

_Fixed: 2026-09-11_
_Fixer: Claude Sonnet 5_
_Iteration: 1_
