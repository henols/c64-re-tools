---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 05
subsystem: analysis
tags: [hazard-report, cross-check, non-vacuity-control, runtime-evidence, dxa, ghidra, acme]

requires:
  - phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
    provides: "plan 48-03's completed four-class detector set and HAZARD_LIMITS, plan 48-04's purpose-built subject carrying all four planted hazard classes plus the deliberately-undetected second self-modification"
provides:
  - "crossCheckHazardFixture() and its HazardCrossCheckExpectation/HazardCrossCheckResult shapes -- a three-outcome comparator (detected/missed/false-positive against an explicit denominator, three sorted address arrays, no boolean/score/rate/percentage) that joins a built HazardReport against a hand-declared, fixture-bytes-derived expectation, joined on blockedAddress only (never anchorAddress) so a legitimate anchor/blocked-address split never manufactures a false positive"
  - "a sixteen-row expectation table (four independently-sourced fixtures times four hazard classes) with every positive row's address read from that fixture's own committed source, and a named assertion that fails by fixture/class/address on any negative-control false positive"
  - "a structural proof that runtime evidence only ever strengthens: a two-run finding-set identity test (empty vs full observation coverage), an absent-vs-empty-array equivalence, a source-text assertion barring any never-observed arithmetic, and a new HAZARD_LIMITS entry naming the asymmetry"
  - "CROSS-CHECK.md, the committed cross-check record: the provenance table, the transcribed sixteen-row table, the plain statement that indexed-dispatch and cycle-exact-raster have no independently-sourced positive example, the recorded deliberate miss, and a test holding the document consistent with the live expectation table"
affects: [48-06]

actuals:
  tokens: 9990
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The cross-check comparator joins on blockedAddress only, never anchorAddress -- the expectation names the address that cannot move, and counting a finding's anchor as a second reportable address would manufacture a false positive out of every real detection whose anchor and blocked address legitimately differ (an operand-byte hit, a table dispatch, a register-pinned charset base)."
    - "A 'no-example' expectation kind returns an explicit all-zero marker rather than being omitted -- the same 'nothing to measure' vs 'measured and found nothing' distinction HazardRegionOutcome's own three-way split already preserves one layer up."
    - "The classes-with-no-independent-positive set is computed FROM the expectation table (a filter over CROSS_CHECK_EXPECTATIONS), never hand-listed a second time, so the test and the committed record cannot silently drift apart from the data that is supposed to justify them."

key-files:
  modified:
    - src/mcp/vice/anno-hazard-report.ts
    - src/mcp/vice/anno-hazard-report.test.ts
  created:
    - src/mcp/vice/fixtures/hazard-subject/CROSS-CHECK.md

key-decisions:
  - "The comparator's reported-address set is built from HazardFinding.blockedAddress only. An early draft that also added anchorAddress produced a spurious false positive on both of this plan's own positive rows (smc.prg's self-modification anchor at $0801 vs its blocked operand at $0802; charset-phantom.prg's memory-control store anchor at $0817 vs its blocked base at $1000) -- caught by running the comparator against real fixtures before writing the committed record, exactly the kind of measurement-before-assertion this plan's whole method depends on."
  - "The never-observed-proves-nothing limit is a NEW HAZARD_LIMITS entry (hazardClass: null), not a restatement of plan 48-01/48-03's existing null-class entry ('no detection is not evidence of safety'). That entry is about a REGION with no finding; this one is about an ADDRESS with no execution observation -- two different absences, so two different limits, both worth stating rather than folding one into the other's wording."
  - "The self-modifying-code strength-promotion test uses two independent hand-built findings at two distinct anchors ($0800, $0806) rather than driving it from the subject fixture, so the covered-vs-uncovered distinction is asserted directly against a construction this test controls end to end, rather than depending on the subject's own finding count and ordering staying exactly as they are."

requirements-completed: [BUILD-04]

coverage:
  - id: D1
    description: "crossCheckHazardFixture() and its two exported shapes exist: an explicit denominator, three counts, three sorted-ascending address arrays, a fixture name, a hazard class, an expectation kind and a positiveClass field -- no boolean, score, rate or percentage anywhere. A sixteen-row expectation table (four fixtures times four classes) is declared in the test file with every positive address read from the fixture's own committed source, and a named assertion fails by fixture/class/address on any negative-control false positive."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: crossCheckHazardFixture() returns a shape with a denominator, three counts and three sorted address arrays, and no boolean, score, rate or percentage field"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: the expectation table covers four fixtures times four classes -- sixteen rows, each with an expectation kind"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: every negative-control fixture has a false-positive count of zero across all four classes -- fails by name, naming fixture, class and addresses, otherwise"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: the self-modifying fixture's class-2 row shows one detected and zero missed"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: the character-set fixture's alignment row shows at least one detected and zero missed"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: a no-example expectation returns the marker -- every count and the denominator at zero, contributing nothing to any measurement"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: an expected address the report found lands in detected, an expected address not found lands in missed, and a reported address no expectation named lands in false-positive"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: two comparator runs over identical input return deeply equal results"
        status: pass
    human_judgment: false
  - id: D2
    description: "Runtime evidence is proven structurally one-directional: the same input built with an empty observation list and with observations covering every finding's anchor produces identical finding sets differing only in strength/corroboration; absent vs empty-array observations produce deeply equal reports; observations at addresses with no finding change nothing; a source-text assertion bars any never-observed arithmetic in the module; and a new HAZARD_LIMITS entry states that never having been observed proves nothing about safety."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: the same input built twice -- once with an empty observation list and once with observations covering every finding's anchor address -- produces finding sets identical in class, anchor address, blocked address and mechanism, differing only in strength and corroboration"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: building the same input with the observation field absent entirely and with it present but empty produces deeply equal reports"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: observations covering addresses where no finding exists add no finding and change no count"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: the module's source contains no arithmetic over the never-observed population -- no identifier containing 'neverObserved' and no field computed as a covered-minus-observed difference"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: a finding whose anchor carries an observation reports the corroborated strength token and the runtime-observed corroboration field; one whose anchor carries none reports its static token and the none corroboration field"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard evidence: the report's emitted limits contain an entry stating that an address never observed executing proves nothing about whether moving it is safe"
        status: pass
    human_judgment: false
  - id: D3
    description: "CROSS-CHECK.md is committed: a provenance table for the four independently-sourced fixtures, the sixteen-row cross-check table transcribed from the comparator's live output, an explicit statement that indexed-dispatch and cycle-exact-raster have no independent positive example (and what that limits), the deliberate self-modification miss recorded as a known false negative, and a closing section on what a table of four negative controls alone would not have proved -- with no planning vocabulary and no requirement-anchor column. A test holds the document consistent with the live expectation table."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard crosscheck: CROSS-CHECK.md is consistent with the comparator's live output -- every fixture and class named in the expectation table appears in the document, and the document's own no-positive-example statement is present for exactly the classes with no positive row and absent for the classes with one"
        status: pass
      - kind: other
        ref: "grep -acE '\\.planning/|/gsd-|\\bD-[0-9]|\\bBUILD-[0-9]|Phase [0-9]' CROSS-CHECK.md (count 0)"
        status: pass
      - kind: other
        ref: "grep -ac 'no independent positive example' CROSS-CHECK.md (count 3, >= 2 required)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full automated suite (npm run test:automated) shows exactly the same six pre-existing failing test names the measured baseline records, and no seventh; typecheck exits zero."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "npm run test:automated -- failing set {annoRegisterEntryFor..., DIRECTION 5 (basis integrity)..., planted violation (the negative control)..., no milestone audit declares a gated status..., every pending todo has a row..., planted violation: both predicates fire...}"
        status: pass
      - kind: integration
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-13
status: complete
---

# Phase 48 Plan 05: The Cross-Check Against Fixtures This Phase Did Not Author Summary

**A three-outcome comparator (`crossCheckHazardFixture()`) measures all four hazard detectors against four programs built weeks before this phase for unrelated questions, with the result committed as `CROSS-CHECK.md` -- and the record states plainly, rather than hiding, that two of the four classes have no independently-sourced positive example at all.**

## Performance

- **Duration:** 55 min (estimated)
- **Started:** 2026-09-12T23:08:33Z
- **Completed:** 2026-09-12T23:23:00Z (approximate)
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- `crossCheckHazardFixture()` and its `HazardCrossCheckExpectation`/`HazardCrossCheckResult` shapes: a denominator, three counts (detected/missed/false-positive), three sorted-ascending address arrays, a fixture name, a hazard class, an expectation kind (`positive`/`negative`/`no-example`) and a `positiveClass` field -- no boolean, no score, no rate and no percentage anywhere, mirroring `dxa-proof01-compare.ts`'s own comparator shape.
- The comparator joins on `blockedAddress` only, never `anchorAddress` -- a decision reached by running it against the real fixtures during development and observing a spurious false positive on both positive rows before correcting the join.
- A sixteen-row expectation table (four independently-sourced fixtures -- `tracer.prg`, `bank.prg`, `smc.prg`, `charset-phantom.prg` -- times four hazard classes), every positive address read from the fixture's own committed source, with a named assertion that fails by fixture, class and address on any negative-control false positive. All sixteen rows measure zero false positives.
- A structural proof that runtime evidence only ever strengthens, never suppresses: a two-run finding-set identity test, an absent-vs-empty-array equivalence, a per-anchor strength/corroboration distinction, a source-text assertion barring any never-observed arithmetic, and a new `HAZARD_LIMITS` entry stating the asymmetry.
- `CROSS-CHECK.md`: the committed record, naming plainly that `indexed-dispatch` and `cycle-exact-raster` have no independently-sourced positive example among the four fixtures, recording the subject's deliberate self-modification miss as a known false negative, and held consistent with the live expectation table by its own test.

## Task Commits

Each task was committed atomically:

1. **Task 1: The three-outcome comparator and the expectations read from each fixture's own bytes** - `e6990b52` (feat)
2. **Task 2: Prove runtime evidence strengthens and never suppresses** - `5edd7d91` (feat)
3. **Task 3: Commit the cross-check record, including the classes with no independent positive example** - `8cac2728` (docs)

**Plan metadata:** committed below via `docs(48-05)`.

## Files Created/Modified

- `src/mcp/vice/anno-hazard-report.ts` - `crossCheckHazardFixture()`, `HazardCrossCheckExpectation`, `HazardCrossCheckResult`, a new `HAZARD_LIMITS` entry (never-observed proves nothing), and an extended `HazardFinding.strength` doc comment stating the strengthen-only asymmetry
- `src/mcp/vice/anno-hazard-report.test.ts` - the sixteen-row expectation table, eleven `hazard crosscheck:` tests, six `hazard evidence:` tests, and the CROSS-CHECK.md consistency test (64 tests total in the file, up from 60)
- `src/mcp/vice/fixtures/hazard-subject/CROSS-CHECK.md` - the committed cross-check record

## Decisions Made

See `key-decisions` in this file's frontmatter for the full list. The load-bearing one: the comparator's join uses `blockedAddress` only, never `anchorAddress` -- an early draft that added both produced a real, measured false positive on the smc.prg and charset-phantom.prg positive rows (the anchor of a real detection legitimately differs from the address it blocks), caught by running the comparator against the real fixtures before writing the committed record rather than assuming the join logic was right.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The comparator's reported-address set initially included the finding's anchor address, manufacturing a false positive on both positive rows**
- **Found during:** Task 1, first live dump of the comparator's output against the real fixtures
- **Issue:** The first draft of `crossCheckHazardFixture()` added both `anchorAddress` and `blockedAddress` to the reported-address set for each finding of the measured class. Against `smc.prg` (self-modifying-code, expected `$0802`) this produced `detected: [$0802]` correctly but ALSO `falsePositive: [$0801]` (the finding's anchor, the `lda #$00` the write patches). Against `charset-phantom.prg` (page-alignment, expected `$1000`) it produced `falsePositive: [$0817]` (the `sta $d018` anchor). Both are real detections; the false positive was an artifact of the join counting an anchor as a second reportable address.
- **Fix:** Restricted the reported-address set to `blockedAddress` only (skipping `null`). The expectation names the address that cannot move -- the anchor is where the write that blocks it is issued from, not itself a claim the expectation makes or needs to make.
- **Files modified:** `src/mcp/vice/anno-hazard-report.ts`
- **Verification:** Re-running the comparator against all sixteen expectation rows after the fix shows zero false positives everywhere, including both positive rows (`detected: 1, missed: 0, falsePositive: 0` for both `smc.prg` and `charset-phantom.prg`).
- **Committed in:** `e6990b52` (Task 1 commit) -- the fix landed before the commit; no separate follow-up commit was needed.

**2. [Rule 2 - Missing critical] A comment referencing decision id `D48-G` leaked into the test file's section header, discovered during a planning-vocabulary self-scan**
- **Found during:** Post-Task-2 self-review, cross-checking the diff against the phase's own no-planning-vocabulary rule for `src/**`
- **Issue:** The `hazard evidence:` section header comment initially read `// hazard evidence: runtime observation strengthens, never suppresses (D48-G)` -- a bare decision-id citation inside a test file that ships under `src/mcp/vice/**`.
- **Fix:** Removed the `(D48-G)` citation, leaving the header as plain prose describing what the section proves.
- **Files modified:** `src/mcp/vice/anno-hazard-report.test.ts`
- **Verification:** `grep -nE '\.planning/|/gsd-|\bD-?48-[A-Za-z]|\bD-[0-9]|\bBUILD-[0-9]|\bPhase [0-9]'` across all three files this plan touched returns zero hits.
- **Committed in:** `5edd7d91` (Task 2 commit) -- caught and fixed before the commit landed.

---

**Total deviations:** 2 auto-fixed (1 bug in this plan's own new comparator, 1 missing-critical planning-vocabulary cleanup)
**Impact on plan:** Both were necessary for the plan's own acceptance bar to hold -- a correct false-positive count on the two positive rows, and compliance with the phase's own shipped-source rule. No scope creep: no capability beyond what the three tasks already specified was added.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The non-vacuity control this whole phase depends on is now committed and mechanically self-checking: `CROSS-CHECK.md` cannot silently drift from the expectation table (a test reads both and asserts consistency), and the expectation table itself cannot silently drift from the fixtures' own bytes (every positive address is cited in a comment naming where it was read).
- Two of the four hazard classes (`indexed-dispatch`, `cycle-exact-raster`) are now explicitly and honestly flagged as having no independently-sourced positive example -- this is recorded as an open question for future work, not smoothed over.
- No blockers. Plan 48-01's own readiness note named this plan (the cross-check formalisation) and plan 48-06 (the multi-file reassembly) as the phase's remaining work; this plan's own scope is complete.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-13*

## Self-Check: PASSED

- All three files found on disk (`anno-hazard-report.ts`, `anno-hazard-report.test.ts`, `CROSS-CHECK.md`).
- All 3 task commits found in git log (`e6990b52`, `5edd7d91`, `8cac2728`).
- `npm run typecheck` exits 0.
- `node --test anno-hazard-report.test.ts` reports 64/64 passing.
- `npm run test:automated` shows exactly the same 6 pre-existing failing test names the plan's measured baseline records, and no others.
- Every negative-control fixture (`tracer.prg`, `bank.prg`, and the negative rows of `smc.prg`/`charset-phantom.prg`) has a false-positive count of zero across all four hazard classes.
- `CROSS-CHECK.md` contains zero planning-vocabulary hits and three occurrences of "no independent positive example" (>= 2 required).
- No leaked `zz-scratch-*` directory found in the repo tree at completion.
- Full diff scan for planning vocabulary across all three commits' added/modified lines returns zero hits.
