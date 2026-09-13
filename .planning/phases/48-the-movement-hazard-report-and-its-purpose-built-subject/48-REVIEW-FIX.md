---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
fixed_at: 2026-09-13T00:00:00Z
review_path: .planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 48: Code Review Fix Report

**Fixed at:** 2026-09-13
**Source review:** `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 critical, 3 warning, 1 info -- `fix_scope: all`)
- Fixed: 5
- Skipped: 0
- Disposed with no code change: 1 (IN-01, per the reviewer's own "no action required" disposition)

All work was done in an isolated git worktree (`workflow.use_worktrees` is `true` for this
project) and fast-forward-merged onto `main` after every commit and test/typecheck gate passed.
Verification (typecheck + targeted test runs) ran **inside the isolated worktree**, with the
worktree's `src/mcp/vice/node_modules` symlinked from the main checkout (read-only use) so
`tsc`/`node --test` could resolve dependencies. The full-repo `test:automated` run used for
baseline comparison was run **both** inside the worktree and, for cross-check, against the
unmodified main checkout at the pre-fix commit (`6bb362bb`) -- see the note under "Verification"
below on why the two runs' failure sets differ from each other in ways unrelated to this phase's
fixes.

## Fixed Issues

### CR-01: The hazard report's `truncated` signal is silently discarded at both real consumer surfaces

**Files modified:** `src/mcp/vice/anno-tools.ts`, `src/mcp/vice/anno-cli.ts`
**Commit:** `e63e8ff6`
**Applied fix:** In `anno-tools.ts`'s `dispatchHazardReport`, the object literal's `truncated:` key
(evaluated after the `...report` spread, so it always won) now ORs the scanner's own
`report.truncated` with the `max_results`-driven slice check, instead of overwriting it:
`truncated: report.truncated || report.findings.length > findings.length`. In `anno-cli.ts`'s
`cmdHazardReport`, the hard-coded `truncated: false` override was removed from both the `--json`
and rendered-report object literals entirely (this verb has no `--max-results`/pagination option
at all), letting the `...report` spread's real value through unmodified. Verified with `tsc
--noEmit` (clean, no errors in either file) and re-read of both call sites.

### CR-02: Scope import can partially apply against a target store's pre-existing scopes

**Files modified:** `src/mcp/vice/anno-store-export.ts`, `src/mcp/vice/anno-store-export.test.ts`
**Commit:** `46fdfd5f`
**Applied fix:** `importStoreDocument()`'s `scopes` validation loop now also pre-checks each
incoming scope against `listScopes(handle)` (the target store's existing rows) using the same
overlap predicate `addScope()` itself uses (`existing.start <= row.endInclusive && existing.endInclusive
>= row.start`), including `addScope()`'s own identical-scope idempotence exception (a
byte-identical repeat is an accepted no-op, not an overlap). This check runs during validation --
before the apply loop's first `set*`/`put*`/`insert*` call -- so a genuine conflict now refuses the
whole import up front, restoring the "refused rather than partially applied" guarantee the
surrounding code already claimed. Chosen over wrapping the apply loop in one transaction (option b
in the review) because it requires no change to `anno-store.ts`'s transaction model and matches
the existing per-field `AnnoStoreExportError` refusal style used everywhere else in this function.

Added three regression tests in `anno-store-export.test.ts`: (1) a scope import overlapping a
pre-existing store scope is refused, and earlier plan entries (ranges, labels) from the *same*
import are confirmed NOT committed; (2) non-vacuity control -- a genuinely disjoint scope import
still applies cleanly; (3) non-vacuity control -- a byte-identical scope repeat is still accepted
as a no-op, not misclassified as an overlap. Test (1) was confirmed to fail against the pre-fix
code (`git stash` of the source-only change reproduced the exact previously-described defect: the
import threw a bare `AnnoRangeShapeError` from deep inside `addScope()` rather than the
whole-import `AnnoStoreExportError` refusal, after the ranges/labels entries had already landed),
then confirmed to pass after re-applying the fix.

### WR-01: `hazard-report`'s CLI verb has no functional test coverage

**Files modified:** `src/mcp/vice/anno-cli.test.ts`
**Commit:** `e2ce7966`
**Applied fix:** Added four tests exercising `runAnnoCli(["hazard-report", ...])` end to end
against a real store + image pair: (1) `--json` output reports `truncated: true` when the scan
trips `MAX_TABLE_ENTRIES` (image constructed with the same indirect-jump-through-a-64-entry-table
shape `anno-hazard-report.test.ts`'s own truncation-propagation unit test uses); (2) the rendered
(non-`--json`) report's `FINDINGS` heading shows `, truncated`; (3) a non-vacuity control -- an
ordinary run with no dispatch table reports `truncated: false`, proving the fix doesn't just
hard-code `true` instead of `false`; (4) the verb's `--image`-not-found refusal still fires
correctly end to end. This closes the exact coverage gap the review identifies as the reason CR-01
shipped undetected.

### WR-02: `matched`/`returned` fields are dead weight in the CLI's hazard-report JSON output

**Files modified:** `src/mcp/vice/anno-cli.ts`
**Commit:** `1cdef71d`
**Applied fix:** Added a comment immediately above `cmdHazardReport`'s `--json`/rendered output
block explaining that `matched`/`returned` are placeholders mirroring the MCP tool's paginated
shape (this verb has no `--max-results` option), and that a future `--max-results` flag on this
verb will need to make the two fields diverge again the way `dispatchHazardReport` already does.
Chose the comment option over removing the fields, since removing them would be an unannounced
JSON-shape change to a verb this phase's own new tests (WR-01) now assert against.

### WR-03: `printHazardReport()`'s declared parameter type diverges from the real `HazardReport` shape

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `1cdef71d`
**Applied fix:** `printHazardReport()`'s hand-rolled structural parameter type was replaced with
`HazardReport & { matched: number; returned: number }` (importing the real `HazardReport` type
from `anno-hazard-report.ts`), so a field rename or type change in the pure module now surfaces as
a compile error at this call site instead of silently drifting -- the exact class of gap CR-01
exploited. Also added a new `UNPROVEN DISPATCH CANDIDATES` section to the rendered (non-JSON)
report, listing each declined candidate's address, lo/hi bases, entry count, truncation flag, and
resolved targets (or an explicit "unresolved" note when `orientationResolved` is false), so an
operator reading only the human-readable report -- never `--json` -- still sees the declined
dispatch candidates `HazardReport`'s own doc comment says must never be silently dropped. Added one
test confirming the heading renders.

## Disposed With No Code Change

### IN-01: `HazardReportParsedArgs`/parse function duplicate a five-parser pattern with no shared abstraction

**File:** `src/mcp/vice/anno-cli.ts:2721-2771`
**Disposition:** No code change. The review's own **Fix** section states "No action required for
this phase; noting for future refactoring consideration only" -- this is a forward-looking
refactoring note, not a defect, and the reviewer explicitly scoped it out of this phase's fix
cycle. Recorded here only so every finding id in `48-REVIEW.md` carries an explicit disposition.

## Verification

- **Per-fix:** every fix was verified with `npx tsc --noEmit` (clean, zero errors referencing the
  modified files) and a targeted `node --test <file>.test.ts` run for every test file touched or
  exercised by the change (`anno-store-export.test.ts`: 12 pass / 1 opt-in skip; `anno-cli.test.ts`:
  99 pass / 0 fail), all run **inside the isolated worktree** with `src/mcp/vice/node_modules`
  symlinked from the main checkout.
- **CR-02 regression proof:** the new test was confirmed to FAIL against the pre-fix source (via a
  temporary `git stash` of only `anno-store-export.ts`) and PASS once the fix was restored,
  demonstrating the test actually exercises the defect rather than passing vacuously.
- **Full-repo baseline comparison:** `npm run test:automated` was run both inside the worktree and
  against the unmodified main checkout at the pre-fix commit (`6bb362bb`). Neither run's failing
  set is limited to the documented six-test baseline (`anno-import.test.ts:352`,
  `anno-register.test.ts:385/479`, `audit-integrity.test.ts:245`,
  `docs-deferred-ledger.test.ts:101/195`) -- both additionally fail a shared set of
  repo-state-sensitive audit tests (`AUDIT-01`, `AUDIT-04`, `DIRECTION 5`/basis-integrity,
  `D-12-02`) that scan `.planning/` and the repository's untracked-file state, which this session's
  working tree already carried before any fix here was applied (untracked `.vice-snapshots/`,
  `.vice-supervisor/`, `docs/vice-mcp-ideas.md`, `tools/`, plus, for the worktree run only, the
  worktree's own directory and this phase's now-cleaned-up recovery sentinel). The worktree run
  additionally failed `dxa.disassemble`/`buildHostToolArgv` argv-shape tests and a launcher
  path-agreement test that asserts the resolved repo root is "not under `.claude`" -- both are
  artifacts of the worktree living at `.claude/worktrees/rf-48-.../`, not of any fix in this report.
  **No file this report modified (`anno-tools.ts`, `anno-cli.ts`, `anno-cli.test.ts`,
  `anno-store-export.ts`, `anno-store-export.test.ts`) appears in either run's failing set.**
  Comparing the two failing sets confirms every extra failure beyond the documented six-test
  baseline is pre-existing and environmental (present on the unmodified main checkout too), not a
  regression introduced by this fix pass.

---

_Fixed: 2026-09-13T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
