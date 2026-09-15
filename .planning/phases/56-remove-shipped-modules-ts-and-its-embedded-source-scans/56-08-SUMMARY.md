---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 08
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning, blind-spot-pass]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over
      anno-export-asm.test.ts)."
provides:
  - "One more of the seventeen files that imported shipped-modules.ts no longer does:
    anno-export-asm.test.ts -- the phase's largest single helper-indirection population (five of
    seven scanner hits reached the doomed helper only through blockConstructionSlice), plus a
    second scanning cluster the symbol-anchored scanner could not see at all, built on
    EXPORTER_PATH and a locally written comment stripper."
  - "The verbatim eleven-case removed-case-name list, plus three confirmed false-positive
    attributions left byte-identical and one blind-spot-pass find the scanner missed entirely,
    for this plan's share of D-16's SUMMARY deliverable."
affects: [56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 5052
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used three times in this
      plan (once per task): 1 lost / 0 gained, 7 lost / 0 gained, 3 lost / 0 gained -- every
      change matched the task's own recorded intent, zero unexpected loss or gain."
    - "The plan named three candidates as needing a D-02/D-03 hand judgement (two in Task 1, one
      in Task 3). All three resolved as pure false positives instead -- confirmed by hand-read to
      carry ZERO source-text assertion, so each was left completely untouched rather than
      stripped-and-renamed. Two read a RegExp's own `.source` property and `.test()` behaviour
      (a runtime value of an imported production symbol, not any file's text). One is a genuine
      exportAsm()+ACME round trip with no file read anywhere in its body. This is the same
      look-alike pattern prior-wave plans in this phase measured -- 'source' in a case name can
      mean the exporter's own PRODUCED OUTPUT string or a regex's `.source` property, neither of
      which is the module source TEXT the cut_rule targets."
    - "The mandated Task 3 blind-spot pass (grep for readFileSync of a sibling .ts or .mts) found
      one case neither the D-14 scanner nor the plan's own candidate list named: '30-REVIEW IN-04'
      reads acme-gate.ts AND make-export-asm-fixtures.mjs as text with zero doomed-symbol
      reference in its chain. Removed it whole under D-01. This is the second time in this phase
      the mandated blind-spot pass, not the scanner, caught a genuine in-scope case (56-01's
      finding was the first)."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "Task 1's candidate 1 ('the auto-name prefix set is parsed from AUTO_NAME_PREFIX_RE's own
    alternation') and candidate 3 ('every one of the parsed prefixes round-trips as a label
    name') were both named in the plan as needing a D-02 hand judgement. Hand-read at their own
    paren-matched boundaries found ZERO reference to EXPORTER_PATH, readFileSync, or any sibling
    .ts/.mts file in either body. Candidate 1 only calls parseAutoNamePrefixes() (which parses
    AUTO_NAME_PREFIX_RE.source -- the imported REGEX'S OWN pattern string, not any file's text)
    and asserts .test() behaviour against literal label strings. Candidate 3 builds a real store,
    calls exportAsm(), inspects the produced result.source (the exporter's own OUTPUT text, which
    is exactly what this whole file exists to confirm), and round-trips it through real ACME. Both
    left completely untouched, byte-identical, no rename -- neither is a source-scanning case."
  - "The helper rule then forced an asymmetric outcome inside the same cluster: parseAutoNamePrefixes
    survives (both untouched candidates still call it), while stripComments, regexLiteralBodies,
    and restatesAutoNamePrefixes are all orphaned once the one genuinely-scanning case
    ('STRUCTURAL SCAN, all three directions') is removed, and were removed with it. Grepped the
    whole file for each of the four helper names before deciding."
  - "Task 3's candidate 2 ('the exporter hands decode() the INCLUSIVE bound, 30-REVIEW WR-07') DID
    assert on source text -- a single readFileSync + assert.match against anno-export-asm.ts's own
    source, with no other assertion in the case -- so it was removed whole, unlike Task 1's two
    look-alikes. Candidate 3 ('ROUND TRIP: the ALIASED store still reassembles byte-identically')
    is the plan's third named 'may be behavioural' item and, like Task 1's two, resolved to a
    genuine false positive: a real exportAsm() + verifyExport() round trip with no file read at
    all. Left untouched."
  - "The Task 3 blind-spot pass (grep for readFileSync of a sibling .ts or .mts across the WHOLE
    file) surfaced a case named nowhere in this plan: '30-REVIEW IN-04', which compares
    acme-gate.ts's and make-export-asm-fixtures.mjs's own source text for a probe-ladder pattern.
    Zero doomed-symbol reference, so the D-14 scanner could not see it -- exactly the blind spot
    56-01 first measured in this phase. Removed whole under D-01: every assertion in its body is
    a regex match against one of the two read source strings."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "Task 1: the auto-name prefix scanning cluster's one genuinely source-scanning
      case ('STRUCTURAL SCAN, all three directions') removed under D-01, along with its
      now-orphaned helpers stripComments, regexLiteralBodies, and restatesAutoNamePrefixes. The
      cluster's other two named candidates were hand-read, found to assert on no module source
      text (a RegExp's own .source property and a real exportAsm()+ACME round trip
      respectively), and left byte-identical -- parseAutoNamePrefixes stays because both still
      call it."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts (TAP name-set diff, /tmp/56-08-t1-lost.txt /
          -gained.txt -- lost 1, gained 0, recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: the BUILD-07 guard cluster's seven whole source-scanning cases removed
      under D-01 (the filtering-variant identifier case, the codeOnly() non-vacuity case, the
      STRUCTURAL GUARD case, and four guard-predicate non-vacuity cases), along with their five
      now-orphaned helpers (blockConstructionSlice, pinsUnconditionalBlockMap, hasRangeListFilter,
      hasBlockListFilter, referencesProvenanceField). The package.json files[] absence case
      survives byte-identical -- its subject is a manifest, not source text."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts (TAP name-set diff, /tmp/56-08-t2-lost.txt /
          -gained.txt -- lost 7, gained 0, all recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "Task 3: the child_process-import case and the WR-07 INCLUSIVE-bound case removed
      whole under D-01. The plan's third named candidate (ROUND TRIP: the ALIASED store) was
      hand-read and confirmed a false positive -- left untouched. The mandated blind-spot pass
      additionally found and removed 'the fixture generator's ACME probe ladder matches the
      gate's (30-REVIEW IN-04)', a case neither the scanner nor the plan's candidate list named.
      The now-orphaned EXPORTER_PATH constant and the file's last
      `import { codeOnly } from \"./shipped-modules.ts\"` were removed."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts (TAP name-set diff, /tmp/56-08-t3-lost.txt /
          -gained.txt -- lost 3, gained 0, all recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3674, pass 3665, fail 0,
          skipped 9"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno-export-asm.test.ts is neither empty nor setup-only after the cut: it lost
      exactly eleven case names net (206 before this plan, 195 after -- 1, 7, and 3 across the
      three tasks), carries no doomed import and no codeOnly()/readFileSync-of-a-sibling-.ts-or-
      .mts call anywhere, while every behavioural case -- including the three confirmed false
      positives, the file's whole ACME byte-diff verification core, and everything not named
      above -- remains untouched."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -c 'from \"./shipped-modules.ts\"' returns 0, grep -c 'readFileSync(.*\\.\\(ts\\|mts\\)'
          returns 0, and the TAP set count moved from 206 to 195 (net -11)"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 08: Cut anno-export-asm.test.ts's Source-Scanning Cases Summary

**Removed eleven whole source-scanning cases from anno-export-asm.test.ts -- including one the
D-14 scanner could not see at all -- while three plan-flagged candidates hand-read as pure
false positives and stayed byte-identical. The whole suite stays green.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-15T07:38:00Z
- **Completed:** 2026-09-15T08:11:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits, zero false
  positives on comments/strings/regex-after-return) before trusting it, per `scanner_protocol`.
  Ran it over `anno-export-asm.test.ts`: seven hits, matching the plan's stated count exactly
  (five reaching `codeOnly` only through `blockConstructionSlice`, two direct).
- **Task 1 (auto-name prefix cluster):** hand-read all three named candidates at their own
  paren-matched boundaries. Removed "STRUCTURAL SCAN, all three directions" whole under D-01 --
  its entire body reads `anno-export-asm.ts` via `readFileSync`/`stripComments` and scans for a
  restated prefix regex. The other two candidates ("the auto-name prefix set is parsed from
  `AUTO_NAME_PREFIX_RE`'s own alternation" and "every one of the parsed prefixes round-trips as a
  label name") were confirmed FALSE POSITIVES: the first only inspects the imported
  `AUTO_NAME_PREFIX_RE` regex's own `.source` property and `.test()` behaviour (a runtime value,
  not any module's file text). The second builds a real store, calls `exportAsm()`, and
  round-trips the result through real ACME -- zero file reads anywhere in its body. Both left
  completely untouched. Grepped the whole file for each of the four local helpers before
  deciding. Removed `stripComments`, `regexLiteralBodies`, and `restatesAutoNamePrefixes` (all
  orphaned once the one genuine case was gone). Kept `parseAutoNamePrefixes` (both surviving
  candidates still call it).
- **Task 2 (BUILD-07 guard cluster):** hand-read and removed whole under D-01 all seven named
  cases -- "the filtering variant's identifier never reaches...", "guard non-vacuity:
  `codeOnly()`'s own extraction...", "STRUCTURAL GUARD (BUILD-07)", and the four "guard
  non-vacuity: `pinsUnconditionalBlockMap`/`hasRangeListFilter`/`hasBlockListFilter`/
  `referencesProvenanceField` fires..." cases -- every one asserting over
  `anno-export-asm.ts`'s own source text (directly, or through `blockConstructionSlice`), with no
  production-behaviour assertion anywhere in any of the seven bodies. Removed their five
  now-orphaned helpers (`blockConstructionSlice`, `pinsUnconditionalBlockMap`,
  `hasRangeListFilter`, `hasBlockListFilter`, `referencesProvenanceField`) after confirming, by a
  whole-file grep on each name, that every caller was itself among the seven removed cases. Kept
  the "anno-export-asm.test.ts is absent from package.json's files[] array" case byte-identical --
  its subject is a manifest parsed as JSON, not source text.
- **Task 3 (remaining candidates, the import, and the full gate):** hand-read and removed whole
  under D-01: "anno-export-asm.ts imports nothing from node:child_process" (reads the exporter's
  source via `readFileSync`+`codeOnly`, asserts an absence) and "the exporter hands `decode()` the
  INCLUSIVE bound (30-REVIEW WR-07)" (a single `readFileSync`+`assert.match` against the
  exporter's own source, no other assertion in the case). Hand-read the plan's third candidate,
  "ROUND TRIP: the ALIASED store still reassembles byte-identically", and confirmed it a FALSE
  POSITIVE -- a genuine `exportAsm()`+`verifyExport()` round trip with zero file reads. Left
  untouched, exactly as the plan's own contingency text anticipated. Ran the two mandated
  blind-spot passes over the WHOLE file. Pass one (grep for `readFileSync` of a sibling `.ts`/
  `.mts`, for `EXPORTER_PATH`, and for any `*_SOURCE` constant) surfaced a case named NOWHERE in
  this plan and invisible to the D-14 scanner: "the fixture generator's ACME probe ladder matches
  the gate's (30-REVIEW IN-04)", which reads `acme-gate.ts` AND `make-export-asm-fixtures.mjs` as
  text and asserts on regex-pattern presence/absence in both -- zero doomed-symbol reference, zero
  production-behaviour assertion. Removed it whole under D-01. Pass two (skim every surviving case
  NAME for STRUCTURAL/non-vacuity/imports-nothing/never-reaches prose) found ten remaining
  "non-vacuity"-named cases elsewhere in the file, all hand-confirmed genuinely behavioural (real
  `exportAsm()`/ACME fixtures, none reading any sibling `.ts`/`.mts` as text) -- no further
  candidate. Removed the now-orphaned `EXPORTER_PATH` constant and the file's last
  `import { codeOnly } from "./shipped-modules.ts"`, together with its now-dead explanatory
  comment.
- `npm run test:automated`: `EXIT=0`, `tests 3674`, `pass 3665`, `fail 0`, `skipped 9` -- matching
  the 56-07 baseline (`tests 3685`) minus exactly this plan's eleven net removed case names
  (1, 7, 3 across the three tasks: 3685 - 11 = 3674, confirmed arithmetically). `npm run
  typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: The auto-name prefix scanning cluster and its four local helpers** - `bb7bc8a6` (test)
2. **Task 2: The BUILD-07 guard cluster and its five helpers** - `0c338eeb` (test)
3. **Task 3: The remaining candidates, the import, and the full automated gate** - `f112e287` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/anno-export-asm.test.ts` - lost eleven whole source-scanning cases net (206 TAP
  names before this plan, 195 after), lost eight now-orphaned local helper functions
  (`stripComments`, `regexLiteralBodies`, `restatesAutoNamePrefixes`, `blockConstructionSlice`,
  `pinsUnconditionalBlockMap`, `hasRangeListFilter`, `hasBlockListFilter`,
  `referencesProvenanceField`), lost the `EXPORTER_PATH` module-scope constant, and lost the
  `import { codeOnly } from "./shipped-modules.ts"`. `parseAutoNamePrefixes` survives (called by
  two confirmed-behavioural cases). Every other case -- including all three confirmed false
  positives, the "BEHAVIOURAL COMPANION (BUILD-07)" case, the files[] manifest case, and the
  file's entire ACME byte-diff verification core -- stays untouched.

## Decisions Made
See key-decisions in frontmatter: the two Task 1 false positives resolved by hand-read
(a RegExp's own `.source` property vs. a module's file text, and the exporter's own produced
OUTPUT text vs. its own source CODE text), the asymmetric helper-survival outcome inside that same
cluster, the Task 3 false positive confirming the plan's own contingency text, and the blind-spot
pass's one genuinely new find (30-REVIEW IN-04) that neither the scanner nor the plan's candidate
list surfaced.

## Deviations from Plan

### Auto-fixed Issues

None in the Rule 1-3 sense -- no bug, missing-critical-functionality, or blocking issue was
found or fixed. The deviations below are all applications of the plan's own D-02 hand-judgement
instruction, resolving three named candidates to a different verdict than the plan's own
provisional description suggested, plus one additional whole-case removal the plan's mandated
blind-spot pass required but did not itself name.

**1. [Cut-rule hand judgement] Task 1's candidates 1 and 3 resolved as false positives, not D-02
exemptions**
- **Found during:** Task 1
- **Issue:** The plan's action text described candidate 1 ("...parsed from AUTO_NAME_PREFIX_RE's
  own alternation...") as parsing "a regex out of the exporter's source text", and flagged
  candidate 3 ("...round-trips as a label name...") as "genuinely mixed", both implying a D-02
  hand judgement would find a source-text assertion to strip.
- **Fix:** Hand-read at each case's own paren-matched boundary. Candidate 1's only source is
  `AUTO_NAME_PREFIX_RE.source` -- the imported REGEX OBJECT's own pattern property, a runtime
  value from `anno-coverage.ts`, never any file's text read via `readFileSync`. Candidate 3's
  "source" is `result.source` -- `exportAsm()`'s own PRODUCED assembly-listing string, checked via
  a real ACME round trip, which is exactly the production behaviour this whole file exists to
  verify. Neither case contains a single `readFileSync`/`EXPORTER_PATH` reference. Both left
  completely untouched, byte-identical.
- **Files modified:** None (no change to either case).
- **Verification:** TAP name-set diff for Task 1 shows both names present, unchanged, in the
  after-set.
- **Committed in:** `bb7bc8a6` (the commit removing the one genuine case alongside them)

**2. [Cut-rule hand judgement] Task 3's blind-spot pass found a case the plan did not name**
- **Found during:** Task 3
- **Issue:** The mandated blind-spot pass (grep the whole file for a raw `readFileSync` of a
  sibling `.ts`/`.mts`) surfaced "the fixture generator's ACME probe ladder matches the gate's
  (30-REVIEW IN-04)" at line 1074 (pre-edit numbering) -- a case reading both `acme-gate.ts` and
  `make-export-asm-fixtures.mjs` as text, with zero reference to any doomed symbol, so the D-14
  scanner could not see it.
- **Fix:** Hand-read the case body. Every assertion is a regex match against one of the two read
  source strings, and no production call appears anywhere. Removed whole under D-01.
- **Files modified:** `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** TAP name-set diff for Task 3 lists this name among the three lost. The
  post-cut file-wide grep for `readFileSync(.*\.(ts|mts)` returns zero matches.
- **Committed in:** `f112e287`

---

**Total deviations:** 2 (both cut-rule hand-judgement outcomes, no bug/blocker/missing-feature
fixes). **Impact on plan:** Strictly conservative -- one deviation KEPT two cases the plan's
provisional text suggested might need stripping, the other REMOVED one case the plan's own
candidate list omitted but its own mandated blind-spot pass required finding. No scope creep, no
behavioural coverage lost, no case removed on a description mismatch.

## Issues Encountered

None. The BEFORE TAP name set was captured before editing began for each of the three tasks, per
prior-wave context item 5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Thirteen of seventeen importing files are now clear (three from 56-01, three from 56-03, two
  from 56-04, two from 56-05, one from 56-06, one from 56-07, and one -- `anno-export-asm.test.ts`
  -- from this plan). Four remain: `anno-derive.test.ts`, `anno-coverage.test.ts`, plus
  `shipped-modules.ts` + `shipped-modules.test.ts` themselves (D-09, final wave only after every
  regular file loses its import), minus `anno-seam.test.ts` which 56-02 already reduced without
  removing the file.
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline minus this plan's
  eleven net removed case names) and typecheck is clean. The next plan in this phase's wave
  sequence can proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-export-asm.test.ts`
- FOUND commit `bb7bc8a6` (Task 1)
- FOUND commit `0c338eeb` (Task 2)
- FOUND commit `f112e287` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (1/0, 7/0, 3/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0, `grep -c 'readFileSync(.*\.(ts|mts)'` returns 0, the package.json files[] absence
  case is present in the post-cut TAP set, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3674` (baseline 3685 minus the 11 net cases this plan removed).
  `git log --name-only` for this plan's three task commits names only
  `src/mcp/vice/anno-export-asm.test.ts` in each -- never `src/mcp/vice/anno-export-asm.ts`.
  `git status --porcelain` confirms the eight pre-existing unrelated paths remain untouched
  throughout this plan.
