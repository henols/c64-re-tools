---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 09
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning, blind-spot-pass]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over
      anno-coverage.test.ts)."
provides:
  - "The third giant file (5,016 lines, not flagged in the ROADMAP census) no longer imports
    shipped-modules.ts and no longer asserts on any module's source text."
  - "The verbatim removed-case-name list for this file's share of D-16's SUMMARY deliverable,
    including an eleven-case cluster neither the D-14 scanner nor the plan's own candidate list
    could see."
affects: [56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 12000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used twice in this plan
      (once per task): 3 lost / 0 gained, 13 lost / 0 gained -- every change matched the
      recorded intent, zero unexpected loss or gain. TAP name count: 126 -> 123 -> 110."
    - "The blind-spot pass (grep for readFileSync of a sibling .ts/.mts across the WHOLE file,
      not just the plan's named candidates) found an entire self-contained scanning
      sub-infrastructure -- a local functionBodyFromSource()/coverageSource() helper pair and
      eleven cases built on it (nine PIN-style structural counts/orderings plus a helper
      self-test and a call-site consultation pin) -- that references zero shipped-modules.ts
      symbol and was therefore fully invisible to the symbol-anchored D-14 scanner AND to the
      plan's own line-proximity candidate list. This is the largest single blind-spot find of
      the phase to date. Prior plans found one extra case each. This plan found eleven."
    - "D-02's exemption test applied to a candidate whose case NAME and own comments explicitly
      describe a 'BEHAVIOURAL half' driven through a real production call
      (`reportFor`/`computeLabelRatio`). Read closely, that behavioural loop's SELECTION target
      is itself derived from the same source-text partition the case's name promises to prove,
      so the production call is scaffolding FOR the text claim, not an independent proof --
      D-02's own worked warning ('a call to a real coverage function used only as scaffolding
      for a text claim does not earn the exemption'). Removed whole under D-01, not stripped."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.test.ts

key-decisions:
  - "Task 1's three scanner hits were hand-read at their own paren-matched boundaries. The
    first ('derived agreement: every member of the store's label-kind vocabulary appears as a
    literal in the census's source') has a real-report-driven loop inside it that LOOKS like an
    independent D-02 behavioural exemption, but its own comments frame that loop as proof that
    the SOURCE-TEXT partition ('spelled' vs 'inferred', both derived from `source.includes`)
    correctly predicts routing -- i.e. the production call exists to corroborate the text claim,
    not to stand on its own. All three scanner hits removed whole under D-01. No module-scope
    helper was orphaned. `CENSUS_FORBIDDEN_BLOCK_LITERALS` has a genuine surviving caller (the
    derived-union non-vacuity case at what is now line 764 pre-cut / unaffected by this plan).
    `oneSymbolAs` was a case-local const, not module scope."
  - "Task 2's three named candidates resolved as: two whole removals under D-01 ('the coverage
    module contains no file-write call...' -- pure source-text absence confirmation with zero
    production call, 'CR-05 (F, one decode two callers)' -- reads anno-cli.ts, a SIBLING module,
    as text, zero production call) and one confirmed FALSE POSITIVE ('the witness is PURE over
    its four arguments: two calls on one payload return the same answer' -- a pure idempotency
    confirmation against the `reachesGateInterior` test witness, zero readFileSync/codeOnly/
    sibling-text reference anywhere in its body. The planner's line-proximity attribution was
    wrong here, exactly as `scanner_protocol` warned it could be 8 times in 10 elsewhere in this
    phase).
    Left byte-identical, no rename -- it is not a source-scanning case."
  - "The mandated blind-spot pass (grep for readFileSync of a sibling .ts/.mts, whole file) found
    an eleven-case cluster spanning what was then lines ~4057-4498 (sections 9's tail, 9b, 9c):
    a dedicated `functionBodyFromSource()`/`coverageSource()`/`scanBodyText()`/`censusBodyText()`
    helper family and eight 'PIN N: ...' -style tests plus 'the declared shape count equals the
    number of true-returning sites...', 'EVERY true-returning site...consults the PAIRING...',
    and 'functionBodyFromSource() THROWS naming the signature...'. Every one of the eleven counts,
    places, or orders occurrences inside anno-coverage.ts's own stripped source text (call-site
    counts, publication-site counts, predicate declaration/call counts, byte-offset orderings).
    None calls a production function to assert behaviour. Removed the whole cluster (helpers
    included -- grepped every helper/constant name individually and confirmed zero surviving
    caller outside the cluster) under D-01. Also removed the now-empty '11. Read-only by
    construction' section header along with its one case (organisational scaffolding for content
    that no longer exists, not independent prose -- left the resulting 10 -> 12 section-number
    gap untouched rather than renumbering, per D-10's 'write no new prose')."
  - "Two orphaned production imports discovered and removed as part of Task 2's helper cleanup:
    `LABEL_KINDS` (from ./anno-types.ts, its sole caller was Task 1's removed case) and
    `PROVEN_TARGET_SOURCES` (from ./anno-coverage.ts, its sole caller was the blind-spot
    cluster's PIN 3). Both confirmed orphaned by a whole-file occurrence count of exactly 1
    (the import line itself) before removal, and every other imported symbol in both import
    blocks re-confirmed the same way to have a real surviving caller."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "Task 1: the three D-14-scanner-flagged cases in the census-vocabulary region
      (label-kind literal-agreement, and the two WR-09/WR-12 absence-of-literal SUPPLEMENT
      cases) removed whole under D-01. The label-kind case's real-report loop was hand-judged
      as scaffolding for its own text claim (per its name and comments), not an independent
      D-02 exemption."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "anno-coverage.test.ts (TAP name-set diff, /tmp/56-09-t1-lost.txt /
          -gained.txt -- lost 3, gained 0, all three named)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: two named raw-source candidates removed whole under D-01 (read-only
      construction's source-absence confirmation, CR-05 F's anno-cli.ts source read), one named
      candidate ('the witness is PURE...') hand-confirmed a false positive and left untouched.
      The mandated whole-file blind-spot pass then found and removed an entire eleven-case
      source-scanning cluster (a local functionBodyFromSource()/coverageSource() helper family
      and its PIN-style tests) that neither the D-14 scanner nor the plan's candidate list could
      see -- zero reference to any shipped-modules.ts symbol in any of the eleven. Removed the
      cluster's helpers too (confirmed zero surviving caller for each by individual grep)."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "anno-coverage.test.ts (TAP name-set diff, /tmp/56-09-t2-lost.txt /
          -gained.txt -- lost 13, gained 0, all recorded: 2 named + 11 blind-spot)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "The doomed `import { codeOnly, shippedTsModules } from \"./shipped-modules.ts\"`
      removed after the last case that needed it was gone, along with two now-orphaned
      production imports (LABEL_KINDS, PROVEN_TARGET_SOURCES) discovered during the same
      whole-file occurrence-count sweep. The full automated suite run once for the whole plan."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "grep -c 'from \"./shipped-modules.ts\"' anno-coverage.test.ts -- returns 0"
        status: pass
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- first run EXIT=1 with exactly one failure
          in text-protocol.test.ts (an untouched file, 'Control 2 (planted RED, without the
          fix)'). Reran that file alone (EXIT=0, 34/34 pass) and reran the full gate (EXIT=0,
          tests 3658, pass 3649, fail 0, skipped 9), confirming a pre-existing flake unrelated
          to this plan's edits, per prior-wave guidance to rerun once before concluding anything
          about an unrelated file"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno-coverage.test.ts is neither empty nor setup-only after the cut: it lost
      exactly sixteen case names net (126 before this plan, 110 after -- 3 and 13 across the two
      tasks), carries no doomed import and no codeOnly()/shippedTsModules()/readFileSync-of-a-
      sibling-.ts-or-.mts call anywhere, while every behavioural case -- including the one
      confirmed false positive and the file's entire widened-dispatch-scan, committed-controls,
      and reproducibility-seal cores -- remains untouched. 448 assert. calls survive."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -ac 'from \"./shipped-modules.ts\"' returns 0, grep -ac '(codeOnly|
          shippedTsModules|extractCommentSpans|commentByteTotal|shippedScanSurface) *\\(' returns
          0 (comments excluded), grep -ac 'readFileSync\\(join\\(HERE, ...\\.(ts|mts)' returns 0,
          grep -ac 'assert\\.' returns 448, and the TAP set count moved from 126 to 110 (net -16)"
        status: pass
    human_judgment: false

# Metrics
duration: 31min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 09: Cut anno-coverage.test.ts's Source-Scanning Cases Summary

**Removed sixteen whole source-scanning cases from anno-coverage.test.ts -- including an
eleven-case cluster invisible to both the D-14 scanner and the plan's own candidate list -- while
one plan-flagged candidate hand-read as a pure false positive and stayed byte-identical. The
whole suite stays green.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-15T08:12:00Z
- **Completed:** 2026-09-15T08:43:19Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits, zero false
  positives on comments/strings/regex-after-return) before trusting it, per `scanner_protocol`.
  Ran it over `anno-coverage.test.ts`: three genuine `test(` hits at lines 957, 1040, 1069,
  matching the plan's stated count exactly (a fourth apparent hit at line 1083 resolved to a
  nested `.test()` regex-method call inside the third hit's own body, not a separate case).
- **Task 1 (census-vocabulary region):** hand-read all three scanner hits at their own
  paren-matched boundaries. "derived agreement: every member of the store's label-kind
  vocabulary appears as a literal in the census's source" contains a `reportFor`-driven loop its
  own comments call "The BEHAVIOURAL half" -- but that loop's selection target (`spelled`/
  `inferred`) is itself derived from the same source-text partition the case's NAME promises to
  prove, so the production call corroborates the text claim rather than standing independently.
  Judged NOT exempt under D-02's own worked warning and removed whole. "SUPPLEMENT (not the
  proof): the census module's source carries no production block-type literal" and "SUPPLEMENT
  (WR-12): no shipped module passes CoverageOptions.blockClassifier" are pure source-text
  absence confirmations with zero production call each -- removed whole. Grepped every
  helper/constant used inside the three cases for other callers. `CENSUS_FORBIDDEN_BLOCK_LITERALS`
  survives (a real caller in the unrelated derived-union non-vacuity case). `oneSymbolAs` was
  case-local, not module scope, so it needed no separate removal.
- **Task 2 (remaining candidates, blind-spot pass, import, full gate):** hand-read the plan's
  three named candidates at their own paren-matched boundaries. "the coverage module contains no
  file-write call, no project-save call and no live-session import" and "CR-05 (F, one decode two
  callers): anno-cli.ts's cross-reference byte source delegates to this loader rather than
  re-parsing" are pure source-text confirmations (the second reads a SIBLING module,
  `anno-cli.ts`, not even the coverage module itself) -- removed whole. "the witness is PURE over
  its four arguments: two calls on one payload return the same answer" hand-confirmed a FALSE
  POSITIVE: a pure idempotency confirmation against the `reachesGateInterior` test witness with
  zero source-text reference anywhere in its body -- exactly the kind of line-proximity misattribution
  `scanner_protocol` warned was measured wrong 8 times in 10 elsewhere in this phase. Left
  byte-identical.
- **The mandated blind-spot pass** (grep for `readFileSync` of a sibling `.ts`/`.mts` across the
  WHOLE file, then a name-prose skim for STRUCTURAL/SUPPLEMENT/non-vacuity/contains-no language)
  surfaced a cluster neither the D-14 scanner nor the plan's candidate list named at all: an
  entire self-contained source-scanning sub-infrastructure built on local helpers
  `coverageSource()`, `functionBodyFromSource()`, `withoutComments()`, `trueReturnGuardChains()`,
  `countOccurrences()`, `scanBodyText()`, `censusBodyText()` and six signature/anchor constants,
  none of which references any `shipped-modules.ts` symbol -- the exact structural blind spot the
  symbol-anchored scanner cannot see by construction. Eleven cases sat on top of it: "the declared
  shape count equals the number of true-returning sites in hasDispatchContext()'s own source",
  "functionBodyFromSource() THROWS naming the signature when the function it is asked for does
  not exist" (a self-test of the doomed helper itself, going with its cluster), "EVERY
  true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the
  window", and "PIN 1" through "PIN 8" (call-site counts, publication-site counts, declared-source
  agreement, statement-order pins, decodability-predicate declaration/call-site/flag-read counts
  and orderings). Every one counts, places, or orders raw occurrences in `anno-coverage.ts`'s own
  stripped source text. None calls a production function to assert behaviour. Grepped every
  helper and constant name individually across the whole file and confirmed zero surviving caller
  outside the cluster before removing it, together with the now-empty "11. Read-only by
  construction" section header (left the resulting section-number gap, 10 -> 12, untouched rather
  than renumbering, per D-10). The second blind-spot pass (name-prose skim for SUPPLEMENT/
  STRUCTURAL/non-vacuity/contains-no/imports-nothing language) found five more name matches, all
  hand-confirmed genuinely behavioural (fixture-byte confirmations and production-report/witness
  calls, zero sibling-source reads) -- no further removal candidate.
- Removed two now-orphaned production imports discovered during the same whole-file
  occurrence-count sweep: `LABEL_KINDS` (from `./anno-types.ts`, orphaned by Task 1's removal)
  and `PROVEN_TARGET_SOURCES` (from `./anno-coverage.ts`, orphaned by the blind-spot cluster's
  removal). Every other imported symbol in both import blocks was re-confirmed individually to
  still have a real caller. Removed the doomed
  `import { codeOnly, shippedTsModules } from "./shipped-modules.ts"` last.
- `npm run test:automated`: first run reported `EXIT=1` with exactly one failure, in
  `text-protocol.test.ts` (a file this plan never touches) -- "Control 2 (planted RED, without
  the fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the
  real output". Per prior-wave guidance (never dismiss a failure in a file the plan touched as a
  flake, but rerun once for an unrelated file before concluding anything), reran
  `text-protocol.test.ts` alone (`EXIT=0`, 34/34 pass) and reran the full gate (`EXIT=0`,
  `tests 3658`, `pass 3649`, `fail 0`, `skipped 9`), confirming a pre-existing, unrelated flake.
  `3658` matches the 56-08 baseline (`tests 3674`) minus this plan's sixteen net removed case
  names (3674 - 16 = 3658, confirmed arithmetically). `npm run typecheck` exits 0 after every
  commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: The three scanner hits in the census-vocabulary region** - `f7a0dfab` (test)
2. **Task 2: The remaining raw-source candidates, the import, and the full automated gate** - `9891e711` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/anno-coverage.test.ts` - lost sixteen whole source-scanning cases net (126 TAP
  names before this plan, 110 after -- 3 and 13 across the two tasks), lost the eleven-case
  blind-spot cluster's seven local helper functions/pin-support functions (`coverageSource`,
  `functionBodyFromSource`, `withoutComments`, `trueReturnGuardChains`, `countOccurrences`,
  `scanBodyText`, `censusBodyText`) and six of its module-scope signature/anchor constants
  (`COVERAGE_SIGNATURE`, `SCAN_SIGNATURE`, `PROVEN_SIGNATURE`, `CENSUS_SIGNATURE`,
  `PREDICATE_SIGNATURE`, `PREDICATE_CALL`, `ILLEGAL_FLAG_READ`, `CLASS_ZERO_MARKING`,
  `SWEEP_ANCHOR`), lost the now-orphaned `LABEL_KINDS` and `PROVEN_TARGET_SOURCES` imports, and
  lost the `import { codeOnly, shippedTsModules } from "./shipped-modules.ts"`.
  `CENSUS_FORBIDDEN_BLOCK_LITERALS` survives (a real surviving caller). Every other case --
  including the confirmed false positive, the file's entire widened-dispatch-scan section,
  committed-controls core, and reproducibility-seal core -- stays untouched. File shrank from
  5,016 to 4,268 lines.

## Decisions Made
See key-decisions in frontmatter: the D-02 hand-judgement resolving the label-kind case's
apparent behavioural loop as scaffolding for its own text claim rather than an independent
exemption, the "the witness is PURE" false-positive confirmation, the eleven-case blind-spot
cluster find and its helper-orphaning confirmation, the orphaned-section-header removal choice (leaving
the section-number gap per D-10), and the two orphaned-import discoveries.

## Deviations from Plan

### Auto-fixed Issues

None in the Rule 1-3 sense -- no bug, missing-critical-functionality, or blocking issue was found
or fixed. The items below are all applications of the plan's own cut-rule hand-judgement and
mandated blind-spot-pass instructions, going considerably further than the plan's three-plus-
three named candidates because the mandated whole-file grep surfaced far more than any prior
plan in this phase.

**1. [Cut-rule hand judgement] Task 2's third named candidate resolved as a false positive**
- **Found during:** Task 2
- **Issue:** The plan's action text named "the witness is PURE over its four arguments: two
  calls on one payload return the same answer" as a candidate needing D-02 hand judgement,
  implying it might carry a source-text assertion to strip.
- **Fix:** Hand-read at its own paren-matched boundary. The case calls `reachesGateInterior`
  (a local test witness that decodes bytes with the real `decode()` production function) twice
  on identical inputs and asserts the results are equal -- pure idempotency, zero
  `readFileSync`/`codeOnly`/sibling-source reference anywhere in the body. Left completely
  untouched, byte-identical.
- **Files modified:** None (no change to this case).
- **Verification:** Present, unchanged, in the Task 2 after-set. TAP name-set diff shows it was
  never in the lost list.
- **Committed in:** `9891e711` (the commit removing the genuinely-scanning cases alongside it)

**2. [Mandated blind-spot pass, far larger than any prior plan's find] An eleven-case cluster
neither the scanner nor the plan's candidate list named**
- **Found during:** Task 2
- **Issue:** The mandated whole-file grep for `readFileSync` of a sibling `.ts`/`.mts` surfaced a
  dedicated source-scanning sub-infrastructure (a `coverageSource()`/`functionBodyFromSource()`
  helper family and eleven cases built on it) that references zero `shipped-modules.ts` symbol,
  so the symbol-anchored D-14 scanner could not see it by construction, and the planner's
  line-proximity heuristic also missed the entire cluster.
- **Fix:** Hand-read all eleven cases and every helper. Every case counts, places, or orders raw
  occurrences in `anno-coverage.ts`'s own stripped source text. None calls a production function
  to assert behaviour. Removed the whole cluster under D-01, plus its now-orphaned helpers
  (confirmed zero surviving caller for each by individual whole-file grep) and the now-empty
  "11. Read-only by construction" section header.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** TAP name-set diff for Task 2 lists all eleven names among the thirteen lost.
  The post-cut file-wide grep for `readFileSync(join(HERE, "...\.(ts|mts)"` returns zero matches.
- **Committed in:** `9891e711`

**3. [Cut-rule hand judgement] Two orphaned production imports found and removed**
- **Found during:** Task 2
- **Issue:** `LABEL_KINDS` (orphaned by Task 1's case removal) and `PROVEN_TARGET_SOURCES`
  (orphaned by the blind-spot cluster's removal) were left as dead imports after their sole
  callers went. TypeScript's configured strictness does not flag an unused named import, so
  `typecheck` alone would not have caught either.
- **Fix:** Re-confirmed every symbol in both import blocks by whole-file occurrence count.
  Removed the two whose count was exactly 1 (the import line itself).
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** Post-removal occurrence-count sweep confirmed every remaining imported
  symbol has a real caller. `npm run typecheck` exits 0.
- **Committed in:** `9891e711`

---

**Total deviations:** 3 (one false-positive confirmation, one large mandated blind-spot find,
one orphaned-import cleanup -- no bug/blocker/missing-feature fixes in the Rule 1-3 sense).
**Impact on plan:** Strictly conservative in judgement (one candidate kept exactly because the
plan's own D-02 warning applied) and strictly more thorough in scope (the mandated blind-spot
pass, taken seriously across the whole file rather than just near the named candidates, found
more than three times as many extra cases as any prior plan in this phase). No scope creep
outside `anno-coverage.test.ts`, no behavioural coverage lost, no case removed on a description
mismatch.

## Issues Encountered

One transient failure in `text-protocol.test.ts` (a file this plan never touches) on the first
`npm run test:automated` run of the whole-gate confirmation -- "Control 2 (planted RED, without the
fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the real
output". Reran that file alone (34/34 pass) and reran the full gate (fail 0), confirming a
pre-existing, unrelated flake rather than a regression from this plan's edits. The BEFORE TAP
name set was captured before editing began for each of the two tasks, per prior-wave context
item 5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fourteen of seventeen importing files are now clear (three from 56-01, three from 56-03, two
  from 56-04, two from 56-05, one from 56-06, one from 56-07, one from 56-08, and now
  `anno-coverage.test.ts` from this plan). Three remain: `anno-derive.test.ts`, plus
  `shipped-modules.ts` + `shipped-modules.test.ts` themselves (D-09, final wave only after every
  regular file loses its import), minus `anno-seam.test.ts` which 56-02 already reduced without
  removing the file.
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline minus this plan's
  sixteen net removed case names) and typecheck is clean. The next plan in this phase's wave
  sequence can proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-coverage.test.ts`
- FOUND commit `f7a0dfab` (Task 1)
- FOUND commit `9891e711` (Task 2)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (3/0, 13/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0, `grep -ac '(codeOnly|shippedTsModules|extractCommentSpans|commentByteTotal|
  shippedScanSurface) *\('` returns 0, `grep -ac 'readFileSync(join(HERE, "...\.(ts|mts)"'`
  returns 0, the file still contains 448 `assert.` calls, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3658` (baseline 3674 minus the 16 net cases this plan removed).
  `git log --name-only` for this plan's two task commits names only
  `src/mcp/vice/anno-coverage.test.ts` in each -- never `src/mcp/vice/anno-coverage.ts`.
  `git status --porcelain` confirms the eight pre-existing unrelated paths remain untouched
  throughout this plan, including `src/mcp/vice/anno-coverage.ts` staying modified and unstaged.
