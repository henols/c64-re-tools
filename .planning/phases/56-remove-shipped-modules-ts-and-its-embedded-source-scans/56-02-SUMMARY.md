---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 02
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here as a narrowing cross-check only (D-06/D-07's locked 21-of-23 judgement was
      authoritative for this file, not the scanner)."
provides:
  - "anno-seam.test.ts kept as a file (not removed, not renamed -- D-06/D-08), reduced from 23
    cases to its two designed survivors."
  - "The verbatim 21-removed-case-name list for this plan's share of D-16's SUMMARY deliverable
    (below, under 'Removed cases')."
  - "A fixed scratch case-removal tool (/tmp/.../scratchpad/remove-cases.mjs) with a found-and-
    fixed paren-matching bug (regex-literal bodies were miscounting parens), documented under
    Deviations for the next plan in this phase that removes cases the same way."
affects: [56-10]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 8919
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used twice in this plan
      (Task 1's 19-case cut, Task 2's 2-case cut), both landing exactly on the named set with
      zero unexpected loss or gain."
    - "A scratch balanced-paren test(...) block remover, re-deriving the same comment/string/
      template-literal-aware masking scope-scan.mjs uses, but additionally BLANKING regex-literal
      bodies (scope-scan.mjs keeps them as 'real code' for symbol detection, which is wrong for
      paren-matching -- a literal `)` inside a regex pattern is not JS syntax and must not be
      counted as a closing paren). Proved on a dry-run copy before touching the real file."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-seam.test.ts

key-decisions:
  - "seamSource() and THE_ONE_SEAM were NOT removed in Task 1 despite being on the plan's own
    'measured candidates' list, because grep-confirmed callers first (the cut_rule Helper rule)
    showed both were still called by the two WR-25 pin cases, which Task 1 does not touch. Removing
    them in Task 1 would have thrown a ReferenceError inside the still-present WR-25 pin cases and
    broken the whole node --test run. Both became genuinely dead once Task 2 removed their last
    two callers, and were removed there instead, along with SEAM_PRIVATE_EXPORTS (dead once its
    sole caller, the removed 'seam-private exports' case, went in Task 1) and commitStatements()
    plus its five fixture constants (dead once the four removed commit-matcher cases went in
    Task 1)."
  - "Section-header separator comments (e.g. '// 1. The real assertion', '// 9-12. Properties of
    the one seam module itself') were left untouched even where every case they once introduced
    is now gone, per D-10/D-13's 'no new prose, leave stale comments stale' instruction. They are
    now visibly orphaned in places, which is the accepted cost of not editorialising beyond what
    the plan names."

requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5]

coverage:
  - id: D1
    description: "anno-seam.test.ts loses 19 of its 23 cases (Task 1) plus 2 more (Task 2) -- all
      21 whose subject was source text or a planted synthetic source for a text scan. The two
      survivors (package.json files[] completeness, WR-25 behavioural refusal) are byte-identical
      to their pre-cut form."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "node --test --test-reporter=tap src/mcp/vice/anno-seam.test.ts (TAP name-set diff,
          both tasks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No doomed import remains: `from \"./shipped-modules.ts\"` is gone from
      anno-seam.test.ts."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "grep -c 'from \"./shipped-modules.ts\"' src/mcp/vice/anno-seam.test.ts == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The suite and typecheck both exit 0 after the cut. The file is neither empty
      nor setup-only (still carries assert. calls)."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3727, pass 3718, fail 0,
          skipped 9"
        status: pass
      - kind: unit
        ref: "npm run typecheck (src/mcp/vice) -- EXIT=0, both tasks"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno-seam.test.ts is neither empty nor setup-only: it still holds 8 assert.
      calls across its two surviving cases."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -c 'assert\\.' src/mcp/vice/anno-seam.test.ts == 8"
        status: pass
    human_judgment: false
  - id: D5
    description: "The WR-25 behavioural refusal case ('WR-25: the guard itself exists -- openStore
      refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied') survives
      byte-identically. It is the only behavioural case in the file and anno-confinement.test.ts
      does not cover this refusal."
    requirement: SC-5
    verification:
      - kind: unit
        ref: "git diff shows zero added lines for this file across both tasks (pure deletion).
          The case's own text is present unchanged in the AFTER TAP set"
        status: pass
    human_judgment: false
---

# Phase 56 Plan 02: Cut anno-seam.test.ts to its two designed survivors Summary

**Removed 21 of anno-seam.test.ts's 23 cases (the `node:sqlite` scanning suite and both WR-25
structural pins), keeping the file and its two source-text-free survivors byte-identical.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-15T05:20:00Z (approx, from prior wave context)
- **Completed:** 2026-09-15T06:15:00Z (approx)
- **Tasks:** 3
- **Files modified:** 1 (`src/mcp/vice/anno-seam.test.ts`)

## Accomplishments

- `anno-seam.test.ts` cut from 23 test cases to 2, in two atomic commits (19 cases, then 2 more),
  each gated by a per-file TAP name-set diff that landed exactly on the named set with zero
  unexpected loss or gain.
- The doomed `import { codeOnly, shippedTsModules } from "./shipped-modules.ts"` is gone, along
  with every module-scope helper and constant that became dead as a direct result: `namesNodeSqlite`,
  `stripForSpecifierScan`, `sqliteImporters`, `TEST_FILES_NAMING_SQLITE`, `SEAM_PRIVATE_EXPORTS`,
  `commitStatements` and its five fixture constants (`BARE_SPELLING_LINES`, `SEMICOLON_SPELLING_LINES`,
  `SIX_SPELLINGS_FIXTURE`, `MULTI_STATEMENT_FIXTURE`, `NO_STATEMENT_FIXTURE`), `testFilesNamingSqlite`,
  `ESCAPE_AT_A_CALL_SITE`, `ENUMERATED_DERIVED_OPENS`, `seamSource()`, and `THE_ONE_SEAM`.
- The file was kept (not removed) and its name was kept (not renamed) per D-06/D-08 -- both are
  reversible-but-not-reversed decisions this plan simply carries out.
- The two survivors -- `package.json files[] ships every anno-* production module on disk and no
  anno-prefixed test file or test-only helper` and `WR-25: the guard itself exists -- openStore
  refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied` -- are present in
  the final AFTER TAP set and their bodies carry zero diff lines across both commits (pure
  deletion around them, nothing added or edited inside them).
- The full automated suite (`npm run test:automated`) exits 0 with `fail 0` after the cut: 3727
  tests / 3718 pass / 0 fail / 9 skipped, down from the orchestrator's pre-dispatch measurement of
  3748 tests / 3739 pass -- exactly 21 fewer tests both ways, matching the 21 cases removed with
  no collateral loss anywhere else in the suite. `npm run typecheck` exits 0 after every commit.

## This plan removes no file and adds no prose to the source tree

Confirmed directly: `git diff --diff-filter=D --name-only` after each commit returned nothing (no
file was deleted), and `git diff` for both commits shows **zero added lines** in
`src/mcp/vice/anno-seam.test.ts` beyond the `+++` diff header -- every line touched is a deletion.
No new note, comment, helper, or test was written anywhere, per D-10.

## Removed cases (21, verbatim, under this file's heading, D-16)

### Task 1 -- the nineteen scanning cases

1. `node:sqlite is named by exactly one module of the shipped module set (STORE-07)` -- the real
   consumer-set assertion. Its subject is a scan of every shipped module's source text for the
   specifier.
2. `planted violation, route (a): a single-line static import is reported by the same predicate the real scan uses`
   -- plants and scans a synthetic source string.
3. `planted violation, route (b): a multi-line static import whose keyword, binding and specifier land on different lines is reported`
   -- plants and scans a synthetic source string.
4. `planted violation, route (c): a dynamic import() is reported` -- plants and scans a synthetic
   source string.
5. `planted violation, route (d): process.getBuiltinModule -- the route a two-regex import detector cannot see -- is reported`
   -- plants and scans a synthetic source string.
6. `negative control: a source whose ONLY mention of the specifier is inside a // comment is NOT reported`
   -- plants and scans a synthetic source string (the comment-only control half of the specifier
   scan).
7. `non-vacuity: the scanned shipped module set is non-empty and contains all three new modules`
   -- asserts over `shippedTsModules()`'s scanned set, a direct consumer of the doomed module.
8. `the seam never touches SQLite's extension-loading surface` -- scans the seam's own stripped
   source text for forbidden identifiers.
9. `the seam declares no module-level mutable binding, including a const bound to a mutable container`
   -- scans the seam's own stripped source text line-by-line.
10. `no shipped module other than the seam names ANY of the declared seam-private exports` --
    scans every other shipped module's source text for leaked export names.
11. `the seam-private export scan is NON-VACUOUS over the code this area added: all three staging transitions are present in the seam's own stripped source`
    -- scans the seam's own stripped source text.
12. `idempotency: re-running the scan over an unchanged tree yields the identical one-element importer list`
    -- re-invokes the doomed-module-backed `sqliteImporters()` scan three times.
13. `the revision compare-and-swap is structurally intact: begin immediate, an UPDATE guarded on the current revision, and a changes count that must equal 1`
    -- scans the seam's own stripped source text for SQL literal fragments.
14. `the seam contains exactly one commit statement, so the single planted-violation site is unique`
    -- scans the seam's own stripped source text via the doomed-module-backed `commitStatements()`.
15. `the commit-statement matcher counts all six of SQLite's spellings, so neither a synonym nor a trailing semicolon can hide a second commit site`
    -- asserts over local fixture source-text strings via `commitStatements()`.
16. `the commit-statement matcher counts a commit sharing an exec() with a preceding statement, which the whole-literal matcher counted as zero`
    -- asserts over a local fixture source-text string via `commitStatements()`.
17. `the commit-statement matcher counts neither commit-ish identifiers, nor an exec() taking a bare identifier, nor user-facing prose about a commit (28-18 P1)`
    -- asserts over a local fixture source-text string via `commitStatements()`.
18. `node:sqlite is bounded in the TEST tree too: the set of test files naming it is a DECLARED list`
    -- scans every test file's source text for the specifier.
19. `non-vacuity of the test-tree scan: a planted test file naming the specifier IS reported by the same predicate`
    -- plants and scans synthetic source strings.

### Task 2 -- the two WR-25 pin cases

20. `WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens`
    -- scans the seam's own stripped source text (call-site count) and every other shipped
    module's source text (leak scan).
21. `WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped source still contains openStore`
    -- scans the seam's own stripped source text for a symbol.

## Kept (2, byte-identical, D-07)

- `package.json files[] ships every anno-* production module on disk and no anno-prefixed test file or test-only helper`
  (line 238 pre-cut) -- reads `package.json` as JSON, `readdirSync(HERE)` as a directory listing,
  and a local 3-element constant. Never scans source text. Never touched the doomed module.
- `WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied`
  (line 743 pre-cut) -- the file's only behavioural case, asserted through `openStore`'s entry
  point rather than against source text. Success criterion 5.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the nineteen scanning cases between line 146 and line 661** - `e04f185a` (test)
2. **Task 2: Remove the two WR-25 pin cases and the doomed import** - `70a103f6` (test)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-seam.test.ts` -- cut from 770 lines / 23 cases to 143 lines / 2 cases.

## Decisions Made

- **`seamSource()` and `THE_ONE_SEAM` were deliberately NOT removed in Task 1**, contrary to their
  presence on the plan's own "measured candidates" list, because the cut_rule's own Helper rule
  ("grep the whole file for that identifier. Confirm the only remaining code-line matches sat
  inside removed cases") failed for both: the two WR-25 pin cases (not touched until Task 2) still
  called them. Removing them in Task 1 would have broken `node --test` outright (ReferenceError
  inside a still-present case), which would have failed the far more load-bearing
  EXIT=0/lost=19/gained=0 verifications in the same task. Both were removed in Task 2 instead, once
  grep-confirmed to have zero remaining callers.
- **Section-header separator comments were left untouched**, even where every case they introduced
  is now gone (e.g. `// 1. The real assertion` now precedes nothing but the next stale header).
  D-10 forbids new prose and the cut_rule says stale comments stay stale. Editing or removing these
  banners was not named by either task's action text, so they were left exactly as they were.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's `dead_helpers` automated verification reported a non-zero count (7) that does not indicate a bad cut**
- **Found during:** Task 1, after the 19-case removal and the six confirmed-dead helper removals
  (`namesNodeSqlite`, `stripForSpecifierScan`, `sqliteImporters`, `TEST_FILES_NAMING_SQLITE`,
  `SEAM_PRIVATE_EXPORTS`, `commitStatements` + its 5 fixtures, `testFilesNamingSqlite`)
- **Issue:** The plan's Task 1 `<verify>` block greps for zero occurrences of
  `(namesNodeSqlite|stripForSpecifierScan|sqliteImporters|seamSource|commitStatements|testFilesNamingSqlite|THE_ONE_SEAM|TEST_FILES_NAMING_SQLITE)`
  in code lines. `seamSource` and `THE_ONE_SEAM` are on that list, but at the Task 1 checkpoint
  they are legitimately still ALIVE -- called by the two WR-25 pin cases, which are Task 1's own
  `<done>` criterion says survive to Task 2 ("anno-seam.test.ts holds four cases: the files[] case,
  the two WR-25 pins, and the WR-25 behavioural case"). The action text's own Helper-rule caveat
  ("grep first, confirm the only remaining matches sat inside removed cases") correctly identifies
  both as not-yet-removable. The automated grep pattern does not encode that same caveat, so it
  flags 7 genuinely-alive code lines (`THE_ONE_SEAM`'s definition and 4 uses inside the two
  surviving WR-25 pin cases, `seamSource`'s definition and 2 calls inside those same cases) as if
  they were dead.
- **Fix:** Kept `seamSource()` and `THE_ONE_SEAM` alive through Task 1 (per the Helper-rule
  caveat), let Task 1's `dead_helpers` verification read 7 rather than 0, and removed both in Task 2 once
  grep-confirmed genuinely dead (their last two callers, the WR-25 pin cases, were gone). Verified
  by direct inspection: `grep -av '^\s*[*/]' anno-seam.test.ts | grep -nE '(namesNodeSqlite|...)'`
  after Task 1 showed exactly 7 lines, all inside `THE_ONE_SEAM`'s/`seamSource`'s own definitions
  or the two surviving WR-25 pin cases -- none inside a removed case, and none a sign of an
  incomplete cut. The far more load-bearing verifications (TAP name-set diff: lost 19, gained 0,
  typecheck EXIT=0) passed cleanly in the same task.
- **Files modified:** `src/mcp/vice/anno-seam.test.ts` (no additional files touched to work around
  this. The fix was sequencing the removal correctly rather than editing the plan's verify script,
  which this executor does not modify)
- **Verification:** After Task 2 removed the WR-25 pin cases, `grep -av '^\s*[*/]' anno-seam.test.ts
  | grep -acE '(namesNodeSqlite|stripForSpecifierScan|sqliteImporters|seamSource|commitStatements|testFilesNamingSqlite|THE_ONE_SEAM|TEST_FILES_NAMING_SQLITE)'`
  read 0, satisfying the same verification at the correct checkpoint.
- **Committed in:** `e04f185a` (Task 1 commit. The 7-count was observed and accepted at this
  point, not silently worked around), resolved in `70a103f6` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed a paren-matching bug in the scratch case-removal tool before trusting its output**
- **Found during:** Task 1, dry-run validation (never reached the real file)
- **Issue:** A hand-written scratch tool (`/tmp/.../scratchpad/remove-cases.mjs`, adapted from
  56-01's `scope-scan.mjs` masking logic) is used to remove named `test(...)` blocks by exact name
  via balanced-paren matching. Its first version reused `scope-scan.mjs`'s masking, which keeps
  regex-literal BODIES as "real code" (correct for that script's symbol-detection purpose). For
  THIS tool's purpose (paren-matching to find a `test(...)` call's true end), that is wrong: the
  test named `the revision compare-and-swap is structurally intact...` contains
  `assert.match(kept, /changes\) !== 1|changes !== 1/, ...)`, and the escaped `\)` inside that
  regex literal was counted as a real closing paren, corrupting the detected boundary for that
  test and truncating it mid-body on a dry-run copy.
- **Fix:** Changed the regex-literal branch to BLANK the regex body (fill with spaces) instead of
  preserving it, consistent with how strings and comments are already masked, since this tool only
  needs accurate paren-matching and never needs to see inside a regex literal for symbol detection.
- **Files modified:** `/tmp/claude-1000/.../scratchpad/remove-cases.mjs` (scratch tool, never
  committed, not under `scripts/`, not listed in `files_modified`)
- **Verification:** Re-ran the dry-run removal after the fix. `grep -n "rollback\|revision
  compare-and-swap\|changes) !== 1" dry-run.test.ts` returned nothing (no corrupted fragment),
  `node --test` on the dry-run copy was not itself run (real-file verify covered this), and the
  full diff against the original showed exactly 19 clean case removals with zero stray edits.
  Confirmed by a full manual read of the resulting diff before it was ever applied to the real file.
- **Committed in:** not applicable (scratch tool only. The real-file commit is `e04f185a`, produced
  only after this fix was verified on the dry-run copy)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in scratch tooling)
**Impact on plan:** Neither affected the final cut's correctness. Both are documented per D-16's
own spirit -- long enough that a reader can confirm the claim without re-running anything.

## Issues Encountered

None beyond the two deviations above, both resolved within this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `anno-seam.test.ts` is done for this phase: 2 cases, no doomed import, byte-identical survivors.
- The cross-file coupling this plan's Task 3 was asked to watch for did not fire: removing
  `node:sqlite is bounded in the TEST tree too...` (the only code-level assertion in this
  repository pinning `anno-derive.test.ts`'s name from another file) left every other file green.
  `npm run test:automated` reports `fail 0` across the whole suite. Plan 56-10 (which cuts
  `anno-derive.test.ts`'s matching cases) can proceed after this plan as planned.
- Ready for the next plan in this phase's wave sequence.

## Self-Check: PASSED

- `src/mcp/vice/anno-seam.test.ts` exists on disk. Confirmed.
- Commits `e04f185a` and `70a103f6` exist in `git log --oneline --all`. Confirmed.
- All task-level `<acceptance_criteria>` re-verified against live command output (TAP name-set
  diffs, typecheck, full automated suite) before this SUMMARY was written. All passed.
- The plan-level `<verification>` block's five items all hold: typecheck exits 0, the full suite
  exits 0 with fail 0, the TAP run reports exactly the two survivor names, the doomed import count
  is 0, and `git log --name-only` for this plan's two production commits names only
  `src/mcp/vice/anno-seam.test.ts`.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Plan: 02*
*Completed: 2026-09-15*
