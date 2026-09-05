---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 04
subsystem: annotation-store
tags: [memmap-lookup, planted-violation, observed-red, pitfall-23, auto-02]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-03's three separately-named, separately-mutable comparison steps (narrowestWidthSurvivors/symbolSurvivors/orderWinner) in memmap-lookup.ts, each a single textual-replacement target"
provides:
  - "Three committed red transcripts, each proving one of AUTO-02's own controls genuinely fails against the real committed memmap.json"
  - "memmap-lookup-controls.test.ts: three planted-violation test cases (first-match, longest-description, reversed symbol tie-break), sharing one scratch-tree helper, that re-check each red mechanically on every future run"
affects: []

# Actuals (#2632)
actuals:
  tokens: 8977
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A test-local, unexported copy of a production module's own private helper (inclusiveWidthOf, mirroring memmap-lookup.ts's own inclusiveWidth) so a control can measure an expected winner from real data without importing a private symbol"
    - "Byte-identity re-assertion of the two UNCHANGED comparison steps, both before and after a scratch mutation's .replace() call, so a mutation that accidentally touched more than its own named target would be caught by the test itself rather than shipping silently"

key-files:
  created:
    - src/mcp/vice/memmap-lookup-controls.test.ts
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-first-match-red.md
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-longest-desc-red.md
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-symtiebreak-reversed-red.md
  modified: []

key-decisions:
  - "Each mutation replaces exactly ONE named function's body (narrowestWidthSurvivors for controls 1/2, symbolSurvivors for control 3) as a whole-function textual .replace(), never a partial-line edit -- keeps the committed-vs-mutated constants trivially diffable and the mutation attributable to a single named step."
  - "Control 3 additionally asserts the WIDTH and residual ORDER steps are byte-identical in the scratch copy, both before AND after the .replace() call, so the observed difference is provably attributable to the SYMBOL step alone rather than an accidental side effect of the string replacement."
  - "Every expected 'wrong answer' and every expected 'correct answer' is measured programmatically against the real, loaded memmap.json at test-run time (never pinned as a literal copied from the plan), so a later map edit fails the assertion loudly rather than silently asserting a stale number. Plan 37-03's re-measured $0000 contender count (3, not the research document's 2) is used, per the plan's own instruction."
  - "The processor-port address plan 37-04's Task 3 names is $0000 (the data-direction register, 'Processor port data direction register' / '6510 On-chip Data Direction Register') -- matching 37-03-SUMMARY.md's own key-decisions verbatim ('$0000 has 3 contenders ... index 1 carries sym D6510'), not $0001 (the processor port register proper, which has a different, unrelated three-entry set with only one carrying no sym)."

requirements-completed: [AUTO-02]

coverage:
  - id: D1
    description: "First-match selection is observed producing a wrong, wider-than-one-byte answer for $D020, recorded as a committed transcript, and encoded as a test case"
    requirement: "AUTO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup-controls.test.ts#PLANTED VIOLATION: switching selectMemmapEntry's WIDTH step to first-match selection makes \"$D020 resolves to the 1-byte border-colour entry\" go RED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Longest-description selection is observed producing a second, order-independent wrong answer for the same $D020 address, with the transcript stating why it is not redundant with D1's control, recorded and encoded"
    requirement: "AUTO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup-controls.test.ts#PLANTED VIOLATION: switching selectMemmapEntry's WIDTH step to longest-description selection makes \"$D020 resolves to the 1-byte border-colour entry\" go RED"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reversing the symbol tie-break is observed producing a wrong, sym-less answer for the equal-width $0000 case, with the committed selection's own tieBrokenBy proving the tie-break was genuinely exercised, recorded and encoded"
    requirement: "AUTO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup-controls.test.ts#PLANTED VIOLATION: reversing selectMemmapEntry's SYMBOL step makes \"$0000 resolves to the sym-bearing entry\" go RED"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 04: Three Observed-Red Controls for AUTO-02's Selection Rule Summary

**Three separate scratch-copy mutations of `memmap-lookup.ts` -- first-match selection, longest-description selection, and a reversed symbol tie-break -- are each observed producing a specific, named wrong answer against the real committed `memmap.json`, each recorded as its own committed transcript, and each encoded as its own passing planted-violation test case, with the committed module never touched.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-05T~06:45:00Z (estimated, immediately after 37-03's closing commit)
- **Completed:** 2026-09-05T07:19:12Z
- **Tasks:** 3
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `memmap-lookup-controls.test.ts` created with a shared scratch-tree helper (`buildScratchMemmapModule()`) that mirrors the real repo shape three levels deep (`src/mcp/vice` next to `src/skills/c64-memory-mapping`) under one `mkdtempSync` root per case, copies the REAL, unmutated `memmap.json` bytes alongside a mutated copy of `memmap-lookup.ts`, and dynamically imports the mutated copy with a cache-busting query -- the committed `memmap-lookup.ts` is read-only throughout, never opened for writing
- **Control 1 (first-match):** the `narrowestWidthSurvivors()` WIDTH step is replaced with a first-match rule; MEASURED at execution time, `$D020`'s first containing entry in `entries` order is index 438, `"6566 Video Interface Chip, VIC II"`, inclusive width 46 -- a wrong answer wider than one byte, asserted by name (index, width, label), not merely "different"
- **Control 2 (longest-description):** the same WIDTH step is replaced with a rule that prefers the containing entry with the longest `desc`; MEASURED programmatically (not assumed from the plan), the winner is index 441 (295-character description), inclusive width 4095 -- and the transcript states explicitly why this is not redundant with control 1: an enumeration that happened to be narrowest-first would survive control 1 by accident while still failing control 2, since longest-description selection does not depend on scan order at all
- **Control 3 (reversed symbol tie-break):** the `symbolSurvivors()` step is reversed to prefer the entry WITHOUT a `sym`; re-measured at execution time, `$0000` (the processor-port data-direction register, matching plan 37-03's own re-measured fixture, correcting `37-RESEARCH.md`'s stale figure of 2 contenders to the real 3) resolves under the mutation to the sym-less `entries[0]`, while the committed, unmutated selection is confirmed to resolve to the sym-bearing entry with `tieBrokenBy: "symbol"` -- proving the tie-break was genuinely exercised, not merely coincidentally bypassed by the width or order steps
- All three mutations are single whole-function `.replace()` calls on one named step (`narrowestWidthSurvivors` for controls 1/2, `symbolSurvivors` for control 3); control 3 additionally asserts the WIDTH and residual ORDER steps stay byte-identical in the scratch copy, both before and after the replace, so the observed difference is attributable to the SYMBOL step alone
- Three separate evidence transcripts committed under this phase's `evidence/` directory, each recording: the step replaced (fenced, both forms), the observed wrong selection (index/width/label), the correct selection for comparison, the working-tree porcelain check (0 lines before and after), the date, and a closing note naming the test file that re-checks the observation mechanically

## Task Commits

Each task was committed atomically:

1. **Task 1: Control — first-match selection reddens narrowest-range-wins at the border-colour register** - `ed7250f4` (test)
2. **Task 2: Control — longest-description selection reddens narrowest-range-wins at the same address** - `58bd0c86` (test)
3. **Task 3: Control — reversing the symbol tie-break reddens the equal-width case** - `8636df20` (test)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-04):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/memmap-lookup-controls.test.ts` - three planted-violation cases (first-match, longest-description, reversed symbol tie-break) sharing one scratch-tree helper and one dynamic-import helper
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-first-match-red.md` - control 1's transcript
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-longest-desc-red.md` - control 2's transcript, including the not-redundant-with-control-1 argument
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-symtiebreak-reversed-red.md` - control 3's transcript, including the re-measured $0000 contender count that corrects the research document, and the closing three-cases/three-transcripts count

## Decisions Made

- **The "processor-port address" plan 37-04's Task 3 names is `$0000`, not `$0001`.** `37-03-SUMMARY.md`'s own key-decisions state the fixture verbatim: "`$0000` has 3 contenders (index 1 carries sym `D6510` -- the SYMBOL step decides)". Re-measured this session against the real, committed `memmap.json` and confirmed exactly: 3 containing entries, all one byte wide, exactly one (`sym: "D6510"`, label `"6510 On-chip Data Direction Register"`) carrying a symbol. `$0001` (the processor port register proper) is a different, unrelated three-entry set at that address with a different symbol (`R6510`) and was not used.
- **Every expected answer is measured programmatically, never pinned as a literal from the plan.** The longest-description winner (`entries[441]`) and the reversed-symbol winner (`entries[0]`) are both computed at test-run time from the real, loaded `memmap.json`, with an assertion on the measured contender count (`8` at `$D020`, `3` at `$0000`) so a later map edit that shifts these numbers fails the test loudly by name rather than silently asserting a stale expectation.
- **Control 3 re-asserts byte-identity of the untouched steps both before and after the `.replace()` call**, not just once — catching the case where a `.replace()` on the SYMBOL step's text could theoretically also match inside the WIDTH or ORDER step's own text (it does not, here, but the assertion makes that a checked fact rather than an assumption).

## Deviations from Plan

None - plan executed exactly as written. All three mutations, observations, and transcripts matched the plan's own described shape; the only pre-measured numbers that needed re-confirming (the $D020 contender count, the $0000 contender count and its sym-bearing entry) matched plan 37-03's own re-measured figures exactly, with no further drift found this session.

## Issues Encountered

None. `pgrep -f vice-broker` initially reported `BROKER_RUNNING` in one verify run; confirmed a false positive (the pattern matched the shell wrapper's own command-line text containing the literal string "vice-broker", not a real process) via `ps -eo pid,cmd | grep -i "vice-broker\|x64sc"`, which found nothing. `npm run test:automated` was run directly with the broker confirmed absent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three of `AUTO-02`'s required observed-red controls are committed transcripts and passing test cases; the requirement's rule (narrowest-range-wins, sym tie-break, stated residual order) is defended by real, mechanically re-checked evidence rather than an assertion that "the fix is present"
- The remaining phase-wide observed-red controls (rows 4-6 in `37-VALIDATION.md`'s table: AUTO-03's in-image skip, AUTO-04's bank decode, AUTO-05's path-dependent decline) are unaffected by this plan and remain for later plans in this phase
- No blockers. One transient full-suite run (not the run recorded above) showed a fourth failure in `audit-root-args.test.ts` from a known `zz-scratch-*` ENOENT race unrelated to this plan's own files (per project memory: "Suite races on repo-tree scratch files"); a clean re-run measured the documented floor exactly: 3468 tests / 3455 pass / 2 fail, both pre-existing in `anno-register.test.ts` (`:385`, `:479`)

## Self-Check: PASSED

- `src/mcp/vice/memmap-lookup-controls.test.ts` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-first-match-red.md` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-narrowest-longest-desc-red.md` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-04-symtiebreak-reversed-red.md` — FOUND
- Commit `ed7250f4` — FOUND in `git log --oneline --all`
- Commit `58bd0c86` — FOUND in `git log --oneline --all`
- Commit `8636df20` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `node --test memmap-lookup-controls.test.ts` — 3/3 pass; `node --test memmap-lookup.test.ts anno-join.test.ts` — 28/28 pass; `git status --porcelain src/mcp/vice/memmap-lookup.ts` — 0 lines; `ls evidence/37-04-*.md | wc -l` — 3; `npm run test:automated` (broker confirmed absent via `ps -eo pid,cmd`) — 3468 tests / 3455 pass / 2 fail, both pre-existing in `anno-register.test.ts`

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
