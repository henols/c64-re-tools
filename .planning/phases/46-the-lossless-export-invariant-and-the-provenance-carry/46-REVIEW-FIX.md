---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
fixed_at: 2026-09-11T17:51:05Z
review_path: .planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry/46-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 46: Code Review Fix Report

**Fixed at:** 2026-09-11T17:51:05Z
**Source review:** .planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry/46-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (`fix_scope: all` -- both warnings and both info findings)
- Fixed: 3 (WR-01, WR-02, IN-01)
- Skipped (accepted, not fixed -- reasoned decision, not silence): 1 (IN-02)

## Fixed Issues

### WR-01: `splitTableRow()` silently converts a genuine NUL byte in the ledger file into a literal pipe

**Files modified:** `src/mcp/vice/anno-provenance-ledger.ts`, `src/mcp/vice/anno-provenance-ledger.test.ts`
**Commit:** `76ff4564`
**Applied fix:** `splitTableRow()` now takes the ledger path and the row's
1-based line number, and refuses -- via a new named `ProvenanceLedgerError` --
any row-shaped line (one that starts with `|` once trimmed) that already
contains a raw NUL byte, BEFORE the `\|`-escape placeholder substitution
runs. This closes the exact gap the review named: previously, a raw NUL
already present in a cell (e.g. a hand-corrupted Evidence/Reason column)
would collide with the function's own internal NUL placeholder and get
silently restored into an extra, unescaped `|` by the unconditional
`cell.split(PLACEHOLDER).join("|")` step, without changing the cell count or
being refused anywhere downstream. The fix follows the module's existing
"reject rather than repair" contract and its permitted-fact vocabulary --
the refusal names only the path and the line number, never the byte or any
cell text. The deliberate placeholder mechanism itself
(`String.fromCharCode(0)` protecting a genuinely escaped `\|`) is untouched,
and well-formed input (including the existing escaped-pipe round-trip test)
behaves identically to before.

Added one new test, `"refusal: a data row containing a raw NUL byte is
refused rather than silently turned into an extra unescaped pipe (WR-01)"`,
which builds its fixture the way every other malformed-fixture test in this
file does -- one documented string mutation applied to `renderLedger()`'s
own real output (a real NUL byte, via `String.fromCharCode(0)`, injected
into row B's Evidence cell, which already carries this file's
`DISCLOSURE_TOKEN`) -- and asserts: the refusal is a `ProvenanceLedgerError`
naming the correct line number and the path; the message names "NUL" by
name; and the message contains neither the raw NUL byte itself nor the
disclosure token. All 22 tests in `anno-provenance-ledger.test.ts` pass,
`tsc --noEmit` is clean, and the edited source file was verified to contain
no raw NUL byte itself (`indexOf(0) === -1`) both before and after editing.

### WR-02: `export-asm`'s CLI summary line never surfaces `excludedRangeCount`

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `44b8a553`
**Applied fix:** Added `${result.excludedRangeCount} exclusion(s) marked` to
the end of the existing summary line at the `export-asm` verb's success
path in `anno-cli.ts`, in the same list-of-figures style already used for
`blocks.length`, `symbolCount`, `autoNamedSymbolCount`, `unexpressibleCount`,
`midInstructionLabelCount`, and `enumSubstitutionCount`. No existing test
asserted the summary line's exact full text (only a `/^export-asm: wrote /`
prefix match and a couple of substring checks), so nothing needed
re-baselining. Added one new CLI-level test that records an exclusion via
`addExcludedRange()` on the store before exporting, then asserts the printed
summary line matches `/1 exclusion\(s\) marked/`. All 95 tests in
`anno-cli.test.ts` pass and `tsc --noEmit` is clean.

### IN-01: No test exercises a version-4 store being refused under `SCHEMA_VERSION` 5

**Files modified:** `src/mcp/vice/anno-durability.test.ts` (test-only change)
**Commit:** `9059d265`
**Applied fix:** Added a new test, `"SCHEMA_VERSION 5: a store whose
anno_meta.schema_version is 4 is refused by name, naming both versions,
with its bytes and mtime unchanged"`, placed immediately after the existing
version-3 fixture it mirrors. It forges `anno_meta.schema_version = 4` on a
freshly opened store the same way the version-3 test forges `3`, then
asserts `openStore()` throws `AnnoStoreCorruptError` naming `schema_version
4` / `expected 5`, and that the file's bytes and mtime are left completely
unchanged by the refusal -- the same three assertions the version-3 test
already makes, kept deliberately parallel so the two fixtures cannot
silently drift apart. This closes the coverage gap the review named: the
`reaffirm-refusal` doc comment in `anno-types.ts` for `SCHEMA_VERSION` 5
explicitly states "a version-4 store does not open under this
SCHEMA_VERSION" as part of its own decision basis, but until now no
committed fixture exercised that specific claim (only version-3 was
covered). All 13 tests in `anno-durability.test.ts` pass and `tsc --noEmit`
is clean. This was a coverage gap, not a behavior defect -- the shipped
`!==` comparison in `openStore()`'s schema-mismatch branch already refused a
version-4 store correctly before this test existed; the test only makes
that already-correct behavior observable and regression-proof.

## Skipped Issues (accepted, with reasoned disposition -- not silence)

### IN-02: `PROVENANCE LEDGER` marker line format is ambiguous when a `key=value` field's value contains a space

**File:** `src/mcp/vice/anno-export-asm.ts:1512-1515`
**Disposition:** Accepted as-is; no code change made.
**Reasoning:** The review itself classifies this as purely cosmetic --
"it does not affect assembled bytes, the export never re-parses its own
output" -- and explicitly states "None required for correctness" in its own
Fix section. The emitted `; PROVENANCE LEDGER: ...` line format is pinned by
several of this phase's own tests (`anno-export-asm.test.ts`) that assert on
its exact shape; touching the format to add quoting/escaping for a
hypothetical future space-containing Verdict/Confidence/Kind value would
churn those pinned assertions today for a value shape `renderLedger()`'s own
current vocabulary never produces (every value it writes today is a single
space-free token). Per this task's guidance, "accepting it with a recorded
rationale is a legitimate outcome" for this finding, and doing so avoids
weakening or re-baselining any existing test for no present correctness
gain. If `renderLedger()`'s vocabulary ever grows a value containing a
space, the review's own suggested remedy (quote each field) should be
applied at that time, together with updating the tests that pin the current
unquoted format.
**Original issue:** The emitted line embeds `verdict=`, `confidence=`,
`kind=`, and `agreeing=` values verbatim (per the module's "no invention"
contract) with no quoting or escaping, so a value containing a space (or the
literal substring ` confidence=`) would make the line visually ambiguous to
a human reader. Only the trailing `evidence=` field goes through
`assertExportableCommentText`, which forbids embedded line breaks but not
spaces.

## Verification

All work and all test/typecheck runs reported in this document ran inside the
isolated git worktree `.claude/worktrees/rf-46-*` this fixer created per its
own isolation protocol (branch `gsd-reviewfix/46-*`, fast-forwarded onto
`main` and torn down after this run) -- not in the main checkout. `npm test`'s
full glob was NOT run (it hangs on `vice-proxy.test.ts`, per this project's
own documented floor note); `npm run test:automated` and per-file
`node --test` runs were used instead, per this task's testing notes.

- `docs-review-disposition.test.ts`: **GREEN** after this REVIEW-FIX.md was
  written (all 7 sub-tests pass; the finding-id/disposition-source guard the
  task's `<why_all_four_ids_must_appear_in_the_report>` block names is
  satisfied by WR-01/WR-02/IN-01/IN-02 all appearing verbatim above).
- `audit-integrity.test.ts`'s "no milestone audit declares a gated status
  while any docs guard is red (D-12-02)": **still red**, but NOT because of
  this phase's findings. Its own failure message lists NINE red docs guards
  (`docs-absorbed-decisions`, `docs-core-value-decision`,
  `docs-dangling-refs`, `docs-deferred-ledger`, `docs-fork-decision`,
  `docs-linerefs`, `docs-review-disposition`, `docs-uat-abstention`,
  `docs-worktree-isolation`), of which `docs-review-disposition` is the ONLY
  one this phase's REVIEW targets and it is now green on its own terms. The
  other eight, and therefore the D-12-02 cascade itself, were independently
  confirmed **identically red on `main` before any change in this
  REVIEW-FIX run** (same guard-name list, same failing milestone-audit set),
  by running `node --test audit-integrity.test.ts` directly against the main
  checkout. This is pre-existing repo-wide backlog noise outside phase 46's
  scope, not a regression this run introduced and not something this run's
  three fixes could close -- fixing it would mean touching eight unrelated
  docs guards this phase never reviewed, which the hard constraints against
  laundering unrelated backlog signals rule out.
- Full `npm run test:automated`: 4224 tests, 4198 pass, 12 fail (up from
  the documented baseline's "4221 tests, 4 fail" only because this run
  executed inside an isolated worktree; the fail SET, not the count, is
  the correct comparison per this project's own testing note). All four
  baseline failures are present unchanged
  (`annoRegisterEntryFor()`/`anno-import.test.ts:352`, `DIRECTION 5 (basis
  integrity)`/`anno-register.test.ts:385`, `planted violation (the negative
  control)`/`anno-register.test.ts:479`, and the intermittent
  `audit-root-args.test.ts:982` sub-check -- this run's instance names
  `check-skill-fork-honesty`, a different sub-check than usual, which is
  exactly the "varying" behaviour the baseline note already describes).
  The remaining eight failures are all environment artifacts of running
  inside the isolated worktree, each independently confirmed to PASS on
  `main`: four in `dxa-seam.test.ts` (the vendored `dxa` binary is built
  only in the main checkout's `vendor/dxa/`, not copied into a fresh
  worktree), one in `repo-root.test.ts` (its own assertion is literally
  "the agreed path is not under `.claude`" -- true on `main`, false by
  construction inside `.claude/worktrees/...`), and two in
  `docs-deferred-ledger.test.ts` (a pre-existing, unrelated stale
  `capability-registry-manifest-claim-stale` STATE.md entry, confirmed
  identically red on `main`). None of these twelve failures are caused by
  or related to the WR-01/WR-02/IN-01 changes in this report.
- `npm run typecheck`: clean, both per-file (`tsc --noEmit` scoped to each
  edited file, run immediately after each edit) and for the whole project
  (`npm run typecheck` in `src/mcp/vice`, run last).

---

_Fixed: 2026-09-11T17:51:05Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
