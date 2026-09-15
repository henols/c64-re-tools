---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 10
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning, comment-repair, anno-seam]

# Dependency graph
requires:
  - phase: 56-02
    provides: "anno-seam.test.ts's declared list of test files naming the persistence
      specifier removed, dropping anno-derive.test.ts from that list before this plan
      could safely cut anno-derive.test.ts's own cases."
  - phase: 56-04
    provides: "Reduced capture-predicate.test.ts's section 5 (module posture) to its
      two surviving behavioural cases, making capture-predicate.ts's structural-absence
      enforcement clause at line ~97 -- as well as the plan-named one at line ~40 --
      now-false."
provides:
  - "anno-derive.test.ts no longer imports shipped-modules.ts and no longer scans any
    module's source text. Seventeen of seventeen importing files are now clear except
    shipped-modules.ts's own test, left for plan 56-11's final wave."
  - "D-11's five named production modules (anno-store.ts, dxa-blocks.ts,
    evid-ingest.ts, memmap-lookup.ts, capture-predicate.ts) keep every constraint
    sentence and credit no removed test with enforcing it."
  - "The verbatim removed-case-name list for this plan's share of D-16's SUMMARY
    deliverable, plus the full list of repaired comment clauses (13 clauses across
    the five modules -- 5 more than the plan's action text enumerated)."
affects: [56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 4805
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the coverage-preservation gate for Task 1, per D-15."
    - "Blanket grep as the mandated completeness gate for Edit Kind 3 (D-11) comment
      repairs, not just the plan's own named line list -- verified necessary here
      exactly as prior-wave guidance warned (56-06's precedent): the plan's action
      text named 5 clauses across the five modules, but the mandated blanket grep
      (grep -c 'anno-seam.test.ts'/'capture-predicate.test.ts' == 0, an acceptance
      criterion in the plan itself) found 13."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-derive.test.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/dxa-blocks.ts
    - src/mcp/vice/evid-ingest.ts
    - src/mcp/vice/memmap-lookup.ts
    - src/mcp/vice/capture-predicate.ts

key-decisions:
  - "Task 1's five scanner hits matched the plan's five named cases exactly (lines
    477, 486, 497, 592, 604 pre-edit), verified by the D-14 scanner's planted-fixture
    proof (GREEN) run immediately before scanning the real file. The kept case at
    line 407 ('repeated derived queries leave the store byte-identical') is
    verified present in the post-cut TAP set, byte-identical. HERE/dirname/
    fileURLToPath became orphaned once strippedSource (their only caller) was
    removed, and were removed too, along with the codeOnly/shippedTsModules import
    (both symbols' only callers were inside the removed block)."
  - "Task 2's action text named exactly four anno-seam.test.ts credit clauses in
    anno-store.ts (lines ~70, ~1192, ~1376, ~1896), but the task's own mandated
    verify block (grep -ac 'anno-seam.test.ts' anno-store.ts, required to read 0)
    is unconditional over the whole file. A pre-edit whole-file grep found EIGHT
    occurrences, not four. Repaired all eight under D-11's general shape (keep the
    constraint, drop only the credit clause and any dangling connective), including
    a header-paragraph credit (line 15) and a docstring credit for
    SNAPSHOT_FILE_PATTERN (line ~742) the action text never named. One occurrence
    (a historical note at ~line 1811 explaining that an OLD anno-seam.test.ts
    word-count control was already superseded by a different mechanism, phrased in
    the past tense) was not a now-false enforcement credit -- it already correctly
    states the old enforcement is gone -- so only its test-file citation was
    trimmed ('in anno-seam.test.ts' removed), leaving the historical narrative
    intact, per D-10's own precedent of minimal trimming over composed prose."
  - "The added-lines acceptance criterion for Task 2 ('at most four lines, all
    re-flowed remainders') was written assuming the plan's undercounted four-clause
    list. The real eight-clause repair adds six lines, all of them re-flowed
    remainders of an edited sentence and zero composed prose. Documented as a
    deviation below rather than silently satisfying a numeric threshold calibrated
    to the wrong count."
  - "Task 3's capture-predicate.ts also carried one more occurrence than the plan
    named: 'capture-predicate.test.ts' at line ~97 (the filesystem-PATH-parameter
    trap), crediting a structural-absence case that plan 56-04 already removed from
    capture-predicate.test.ts's section 5. Verified by reading that section
    directly -- it now holds only the two surviving behavioural cases (report
    vocabulary, formatComparison's negative-limit refusal), no source-scanning
    case. Repaired under the same D-11 shape as the plan-named line-40 occurrence.
    Task 3's own added-lines threshold (at most eight) was NOT exceeded (five
    added), so no numeric-threshold deviation is owed here."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "Task 1: anno-derive.test.ts's five structural source-scanning
      cases (the never-cached control's structural half, plus MCP-02's import
      scan) removed whole under D-01. The behavioural half (repeated derived
      queries leave the store byte-identical) stays byte-identical. Dead helpers
      (strippedSource, sqlWriteSites, enclosingDeclaration) and their module-scope
      constants removed. The doomed shipped-modules.ts import and the now-orphaned
      HERE/dirname/fileURLToPath removed."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "anno-derive.test.ts (TAP name-set diff, /tmp/56-10-t1-lost.txt /
          -gained.txt -- lost 5, gained 0, all five named)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: all eight now-false anno-seam.test.ts enforcement
      credits in anno-store.ts removed (the plan named four -- a mandated blanket
      grep found four more). Every constraint sentence -- the SQLite-extension
      trap, the single-commit-site rule (both mentions), applyWriteWithoutCommit's
      export rationale (both mentions), the confinement-path comment, the frozen
      RegExp module-scope-state fact, and the header confinement claim -- stays.
      Line 57's manifest-completeness sentence, not in D-11's set, is untouched."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "grep -ac 'anno-seam.test.ts' anno-store.ts -- returns 0"
        status: pass
      - kind: unit
        ref: "grep -ac 'the shipped-module assertion scans' anno-store.ts -- returns 1"
        status: pass
      - kind: unit
        ref: "grep -ac 'commitTransaction' anno-store.ts -- returns 6"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "Task 3: dxa-blocks.ts, evid-ingest.ts, memmap-lookup.ts (one
      credit clause each, as named) and capture-predicate.ts (two credit clauses --
      the plan named one, a mandated blanket grep found a second) all repaired.
      Every constraint sentence in all four modules survives. The full automated
      suite and typecheck both exit 0."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "grep -ac 'anno-seam.test.ts' dxa-blocks.ts evid-ingest.ts
          memmap-lookup.ts -- 0, 0, 0"
        status: pass
      - kind: unit
        ref: "grep -ac 'capture-predicate.test.ts' capture-predicate.ts -- returns 0"
        status: pass
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- first run EXIT=1 with one
          failure in anno-tools.test.ts (a file this plan never touches), reran
          that file alone (105/105 pass excl. 1 opt-in skip) and reran the full
          gate (EXIT=0, tests 3653, pass 3644, fail 0, skipped 9), verifying a
          pre-existing flake in a TOCTOU race test unrelated to this plan's
          comment-only edits"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno-derive.test.ts is neither empty nor setup-only after the
      cut: it lost exactly five case names (29 before, 24 after), carries no
      doomed import, no dead helper, and its one behavioural STORE-06 case
      survives byte-identical."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -ac 'from \"./shipped-modules.ts\"' returns 0, grep -ac
          '(codeOnly|shippedTsModules|extractCommentSpans|commentByteTotal|
          shippedScanSurface) *\\(' (comments excluded) returns 0, grep -ac
          '(strippedSource|sqlWriteSites)' (comments excluded) returns 0, and the
          byte-identical case's name is present exactly once"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 10: Cut anno-derive.test.ts and Repair D-11's Five Production Modules Summary

**Cut anno-derive.test.ts's five source-scanning cases, then removed thirteen
now-false "asserted by X" enforcement clauses across D-11's five named production
modules -- five more than the plan's own action text enumerated, all found by the
plan's own mandated blanket-grep completeness gate and repaired under the same
keep-the-constraint-drop-the-credit rule.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-15T08:45:00Z
- **Completed:** 2026-09-15T09:20:03Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, exactly the 2
  expected hits) before trusting it, then ran it over `anno-derive.test.ts`: five
  hits at lines 477, 486, 497, 592, 604, matching the plan's five named cases
  exactly.
- **Task 1:** Captured the BEFORE TAP name set (29 names) before editing. Removed
  the five structural cases whole under D-01, plus the now-dead helpers
  `strippedSource`/`sqlWriteSites`/`enclosingDeclaration` and their module-scope
  constants (`SQL_WRITE_VERB`, `FS_WRITE_CALLS`, `HOST_PATH_SEAMS`,
  `DERIVATION_MODULES`, `EXPECTED_SQL_WRITE_SITES`), verified via whole-file grep
  that none had a surviving caller outside the removed block. Removed the doomed
  `import { codeOnly, shippedTsModules } from "./shipped-modules.ts"` and the
  now-orphaned `HERE`/`dirname`/`fileURLToPath` (their only caller,
  `strippedSource`, was gone). The kept behavioural case at line 407 ("repeated
  derived queries leave the store byte-identical") stays byte-identical. Removed
  the now-empty "4. The never-cached control, structural half (task 2)" section
  header along with its content, following 56-09's precedent, leaving the
  resulting section-number gap (3 -> 5) untouched rather than renumbering. TAP
  name-set diff: lost exactly the five named cases, gained 0.
- **Task 2:** Read `anno-store.ts` at the four locations the plan named and
  repaired all four -- the SQLite-extension trap (line 70), the single-commit-site
  comment (line ~1192), and `applyWriteWithoutCommit`'s doc comment (both
  mentions, lines ~1376 and ~1896). A whole-file grep for `anno-seam.test.ts`
  run BEFORE any edit in this file found eight occurrences, not four. Repaired
  the four extras too, under the same D-11 shape: a header-paragraph credit
  (line 15, "a CONFINEMENT THAT IS ASSERTED... `anno-seam.test.ts` scans the
  shipped module set..."), a docstring credit for the module-derived-path
  confinement note (line ~448), a docstring credit for `SNAPSHOT_FILE_PATTERN`'s
  frozen-RegExp claim (line ~742), and a historical note (line ~1811) that already
  states, in the past tense, that the old `anno-seam.test.ts` word-count control
  was superseded -- only its test-file citation ("in `anno-seam.test.ts`") was
  trimmed, its historical claim left intact. Left line 57's manifest-completeness
  sentence untouched, exactly as instructed. Post-edit whole-file grep for
  `anno-seam.test.ts` in `anno-store.ts` returns 0.
- **Task 3:** Repaired the plan's one named clause each in `dxa-blocks.ts`,
  `evid-ingest.ts`, and `memmap-lookup.ts` (minimal reword, per PATTERNS.md's own
  suggested wording, to state the constraint without naming a test file --
  "`anno-store.ts` is the one module permitted to name that dependency"). Repaired
  `capture-predicate.ts`'s plan-named clause (line ~40) plus a second, undercounted
  occurrence (line ~97, the filesystem-PATH-parameter trap) found by the same
  blanket grep -- verified by reading `capture-predicate.test.ts`'s section 5
  directly that the structural-absence case it credited no longer exists there
  (plan 56-04 already removed it, leaving only the two surviving behavioural
  cases). All four constraint-sentence greps return exactly 1. Added lines: 5
  (within the plan's stated ceiling of 8).
- `npm run test:automated`: first run reported `EXIT=1` with one failure, in
  `anno-tools.test.ts` (a file this plan never touches) -- a TOCTOU race test
  ("the store file replaced between the existence check and the open refuses by
  name, writing nothing"). Reran that file alone (`105/105` pass, one unrelated
  opt-in live case skipped) and reran the full gate (`EXIT=0`, `tests 3653`,
  `pass 3644`, `fail 0`, `skipped 9`), verifying a pre-existing, unrelated flake.
  `3653` matches the pre-plan baseline (`3658`) minus this plan's five net removed
  case names (3658 - 5 = 3653, verified arithmetically). `npm run typecheck`
  exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cut anno-derive.test.ts's five source-scanning cases** - `8c3c8b97` (test)
2. **Task 2: Drop anno-store.ts's now-false anno-seam.test.ts enforcement clauses (all eight)** - `07b9f123` (docs)
3. **Task 3: Repair the other four production modules and run the full automated gate** - `9c6b3ffe` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/anno-derive.test.ts` - lost five whole source-scanning cases and
  the module-scope bindings (three helpers, five constants, the doomed
  `shipped-modules.ts` import, and `HERE`/`dirname`/`fileURLToPath`) whose only
  callers were those cases. 29 TAP names before, 24 after. One behavioural case
  survives byte-identical.
- `src/mcp/vice/anno-store.ts` - lost eight now-false `anno-seam.test.ts`
  enforcement credits (the plan named four, a mandated blanket grep found four
  more). Every constraint sentence, including line 57's manifest-completeness
  rationale, stays byte-identical.
- `src/mcp/vice/dxa-blocks.ts` - one credit clause reworded to state the same
  constraint without naming the removed test file.
- `src/mcp/vice/evid-ingest.ts` - one credit clause dropped. The surrounding
  "imports nothing from `anno-store.ts`... dispatch arm" constraint stays.
- `src/mcp/vice/memmap-lookup.ts` - one credit clause reworded, same shape as
  `dxa-blocks.ts`.
- `src/mcp/vice/capture-predicate.ts` - two now-false `capture-predicate.test.ts`
  credits removed (the plan named one, a mandated blanket grep found a second).
  Both surrounding NEVER-traps stay.

## Removed Cases (D-16, this plan's share)

### `src/mcp/vice/anno-derive.test.ts` (5 removed, whole-case, D-01)
1. `"STORE-06 never-cached control: the derivation modules' stripped source
   carries no SQL write verb"` -- entire subject was a regex scan over
   `strippedSource()`'s `codeOnly()`-stripped output of `anno-derive.ts`/
   `anno-details.ts`. No production call.
2. `"STORE-06 never-cached control: the derivation modules name no filesystem
   write call and no SQLite binding"` -- entire subject was substring scans over
   the same stripped source. No production call.
3. `"MCP-02: the derivation modules import none of the three host-path seam
   modules"` -- entire subject was a substring scan over the same stripped
   source for three banned import specifiers. No production call.
4. `"STORE-06 never-cached control: the tree's SQL write sites are exactly the
   named expected set"` -- entire subject was a directory-wide census (via
   `sqlWriteSites()`/`shippedTsModules()`) of SQL-write-verb regex matches
   against a named expected set. No production call.
5. `"STORE-06 never-cached control: the census can actually SEE a planted write
   site"` -- a non-vacuity self-test of the census's own regex/helper pair
   against a hand-planted source string. No production call.

## Repaired Clauses (D-11, all thirteen)

### `src/mcp/vice/anno-store.ts` (8 clauses -- plan named 4, blanket grep found 4 more)
1. **Line 15** (header, "WHY THIS FILE EXISTS"): dropped "`anno-seam.test.ts`
   scans the shipped module set and fails if any second module names the
   specifier, through any of its four working access routes." Kept "...a
   blast radius of exactly one file -- and, more to the point, a CONFINEMENT
   THAT IS ASSERTED rather than promised." *(not named by the plan's action text)*
2. **Line 70** (SQLite-extension trap): dropped "`anno-seam.test.ts` asserts all
   three names are absent from this module's code." Kept the trap instruction.
   *(named)*
3. **Line ~448** (module-derived-path confinement note): dropped ", and
   `anno-seam.test.ts` pins that no other shipped module names the option at
   all." Kept "Every such site below carries a one-line comment naming the
   module-derived value that produced its path." *(not named)*
4. **Line ~742** (`SNAPSHOT_FILE_PATTERN` docstring): dropped "the scan in
   `anno-seam.test.ts` matches `new Map|Set|WeakMap|WeakSet` and array/object
   initialisers, so this constant sits outside it by construction rather than
   by exemption." Kept "A frozen `RegExp` literal is NOT module-level mutable
   state." *(not named)*
5. **Line ~1192** (single-commit-site comment): dropped "`anno-seam.test.ts`
   asserts this module contains exactly ONE such statement, because the
   durability proof's planted violation must have a single site -- a second
   literal would split that planting and let half of it survive." Kept "It
   must be `commitTransaction` and never a second `handle.db.exec` of the bare
   word." *(named)*
6. **Line ~1376** (`applyWriteWithoutCommit` doc comment, first mention):
   dropped "`anno-seam.test.ts` asserts that no shipped module other than this
   one so much as names it -- the same bound `applyWriteWithoutCommit` carries,
   by the same mechanism rather than a second one." Kept the "EXPORTED FOR
   EXACTLY ONE REASON" rationale. *(named)*
7. **Line ~1811** (historical note, single-commit-site's superseded word-count
   control): trimmed only "in `anno-seam.test.ts`" -- the sentence already
   states, in the past tense, that this old control was replaced. The
   historical claim itself is untouched. *(not named, and not a now-false
   credit -- a minimal citation trim, not a constraint-clause removal)*
8. **Line ~1896** (`applyWriteWithoutCommit` doc comment, second mention):
   dropped ", and `anno-seam.test.ts` asserts that no shipped module other than
   this one so much as names it." Kept the `files[]`-absence clause (a separate,
   still-true fact). *(named)*

Line 57's manifest-completeness sentence ("the shipped-module assertion scans
`shippedTsModules()`...") was read and verified untouched -- it is not in D-11's
set (D-07's surviving `anno-seam.test.ts:238` case still enforces `files[]`
completeness).

### `src/mcp/vice/dxa-blocks.ts` (1 clause, named)
Reworded "`anno-store.ts` is the one module `anno-seam.test.ts` allows to name
that dependency" to "`anno-store.ts` is the one module permitted to name that
dependency" -- same constraint, no test-file citation.

### `src/mcp/vice/evid-ingest.ts` (1 clause, named)
Dropped "which is what keeps this module out of `anno-seam.test.ts`'s
single-consumer set (`anno-store.ts` remains the one module naming
`node:sqlite`)." Kept "This module imports nothing from `anno-store.ts` and
touches no filesystem, transport or child-process -- the write happens in
`anno-tools.ts`'s dispatch arm."

### `src/mcp/vice/memmap-lookup.ts` (1 clause, named)
Same rewording as `dxa-blocks.ts`.

### `src/mcp/vice/capture-predicate.ts` (2 clauses -- plan named 1, blanket grep found 1 more)
1. **Line ~40**: dropped "`capture-predicate.test.ts` asserts it from this
   module's own source rather than trusting this paragraph." Kept the
   NO-filesystem/NO-network claim and the `prg-image.ts`/`vsf-slice.ts`
   design-parity cross-reference. *(named)*
2. **Line ~97** (filesystem-PATH-parameter trap): dropped "Both absences are
   asserted structurally by `capture-predicate.test.ts`, not merely stated
   here." Kept "Never give any function here a filesystem PATH parameter, and
   never import either of this repo's host/container path-translation seams."
   *(not named -- verified by reading `capture-predicate.test.ts`'s section 5:
   plan 56-04 already removed the structural case this credited, leaving only
   the two surviving behavioural cases)*

No file was removed. No sentence was added anywhere -- every edit is a deletion
or a minimal, no-new-claim rewording of an existing sentence (per D-10).

## Decisions Made
See key-decisions in frontmatter: the eight-vs-four anno-store.ts occurrence
count, the historical-note minimal-trim treatment (not a constraint removal),
the added-lines-threshold deviation for Task 2, and the second capture-predicate.ts
occurrence found and verified by reading the test file directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, cut-rule completeness gate] anno-store.ts had eight
now-false enforcement credits, not the four the plan's action text named**
- **Found during:** Task 2
- **Issue:** The plan's action text enumerated exactly four clauses to remove
  from `anno-store.ts` (lines ~70, ~1192, ~1376, ~1896). The task's OWN mandated
  verify block requires `grep -ac 'anno-seam.test.ts' anno-store.ts` to return 0
  -- an unconditional, whole-file completeness gate. A pre-edit whole-file grep
  found eight occurrences. Completing the task as verified (not merely as
  literally described) required repairing all eight, matching the phase's own
  documented pattern (prior-wave guidance: 56-06's candidate list undercounted by
  3, caught only by its own blanket grep gate).
- **Fix:** Repaired the four extra occurrences (a header-paragraph credit, a
  module-derived-path docstring credit, a `SNAPSHOT_FILE_PATTERN` docstring
  credit, and a historical note needing only a citation trim) under D-11's
  general shape -- keep the constraint, drop only the credit clause and any
  dangling connective, write no new prose.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `grep -ac 'anno-seam.test.ts' anno-store.ts` returns 0. Every
  named constraint-sentence grep (`the shipped-module assertion scans` -> 1,
  `commitTransaction` -> 6) returns the expected non-zero count. `npm run
  typecheck` exits 0.
- **Committed in:** `07b9f123` (the same commit that repairs the four named
  occurrences)

**2. [Rule 3 - Blocking, cut-rule completeness gate] capture-predicate.ts had a
second now-false credit the plan did not name**
- **Found during:** Task 3
- **Issue:** The plan named one clause (line ~40). Its own verify block requires
  `grep -ac 'capture-predicate.test.ts' capture-predicate.ts` to return 0. A
  pre-edit grep found two occurrences. The second (line ~97, the
  filesystem-PATH-parameter trap) credits a structural-absence case that plan
  56-04 already removed from `capture-predicate.test.ts`'s section 5.
- **Fix:** Verified by reading `capture-predicate.test.ts`'s section 5 directly
  (only the two surviving behavioural cases remain, no source-scanning case),
  then repaired the second clause under the same D-11 shape as the first.
- **Files modified:** `src/mcp/vice/capture-predicate.ts`
- **Verification:** `grep -ac 'capture-predicate.test.ts' capture-predicate.ts`
  returns 0. `grep -ac 'NO filesystem and NO network'` returns 1. `npm run
  typecheck` exits 0.
- **Committed in:** `9c6b3ffe`

**3. [Numeric-threshold miscalibration, disclosed not silently satisfied] Task
2's "added at most four lines" acceptance criterion does not hold against the
real eight-clause repair**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criteria state the diff over `anno-store.ts`
  "adds at most four lines, all of them re-flowed remainders" -- a threshold
  sized to the plan's undercounted four-clause list. The real, correctly
  complete eight-clause repair adds six lines.
- **Fix:** None applicable -- the six added lines are, without exception,
  re-flowed remainders of an edited sentence (verified by reading the full
  diff), not composed prose. D-10's "no new prose" rule is satisfied. The
  plan's own numeric ceiling is not, because it was calibrated to an incomplete
  count. Disclosed here rather than silently treated as passing.
- **Files modified:** None beyond the Task 2 commit already covered above.
- **Verification:** `git diff` read in full. Every `+` line is a direct
  continuation of a sentence whose credit clause was removed, none introduces a
  new claim.
- **Committed in:** `07b9f123`

---

**Total deviations:** 3 (two blanket-grep-completeness auto-fixes matching this
phase's own documented undercount pattern, one disclosed numeric-threshold
miscalibration with zero prose added). **Impact on plan:** Conservative in every
judgement call (the historical note at anno-store.ts:~1811 was deliberately NOT
treated as a constraint-removal case, only a citation trim, because it does not
credit anno-seam.test.ts with CURRENTLY enforcing anything) and strictly more
complete in scope than the plan's own line-numbered enumeration, matching the
mandated blanket-grep gates the plan itself specifies as the authoritative check.
No scope creep outside the five D-11-named files, no constraint sentence lost, no
new prose composed anywhere.

## Issues Encountered

One transient failure in `anno-tools.test.ts` (a file this plan never touches,
comment-only edits elsewhere cannot affect it) on the first `npm run
test:automated` run of the whole-gate verification -- a TOCTOU race test
("the store file replaced between the existence check and the open refuses by
name, writing nothing"). Reran that file alone (105/105 pass, one unrelated
opt-in live case skipped) and reran the full gate (fail 0), verifying a
pre-existing, unrelated flake rather than a regression from this plan's edits.
The BEFORE TAP name set for `anno-derive.test.ts` was captured to
`/tmp/56-10-t1-before.set` before any edit began, per prior-wave context item 5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sixteen of the sixteen regular files that imported `shipped-modules.ts` are now
  clear (this plan closes the last one, `anno-derive.test.ts`). Only
  `shipped-modules.ts` and `shipped-modules.test.ts` themselves remain, deferred
  to plan 56-11's final wave by D-09.
- D-11's five-module repair set is complete: every named module keeps its
  constraint sentences and credits no removed test with enforcing them. D-12's
  accepted gap (a stale enforcement claim outside the five named modules may
  survive) is unaffected -- this plan's extra finds were all INSIDE the five
  named modules, not outside them, so D-12 was never invoked.
- No blockers. The suite is green (`fail 0`, `skipped 9`, `tests 3653` matching
  baseline `3658` minus this plan's five net removed case names) and typecheck is
  clean. Plan 56-11 (deleting `shipped-modules.ts` and its own test wholesale) can
  proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-derive.test.ts`
- FOUND: `src/mcp/vice/anno-store.ts`
- FOUND: `src/mcp/vice/dxa-blocks.ts`
- FOUND: `src/mcp/vice/evid-ingest.ts`
- FOUND: `src/mcp/vice/memmap-lookup.ts`
- FOUND: `src/mcp/vice/capture-predicate.ts`
- FOUND commit `8c3c8b97` (Task 1)
- FOUND commit `07b9f123` (Task 2)
- FOUND commit `9c6b3ffe` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree. The
  Task 1 TAP name-set diff matches the recorded lost/gained names (5/0). Task 2's
  `seam_credits`/`manifest_line`/`commit_constraint` greps return 0/1/6. Task 3's
  `seam_credits` (three files) and `cp_credit` greps all return 0, and all four
  constraint-sentence greps return 1. `npm run typecheck` exits 0 after every
  commit.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with
  `fail 0`, `skipped 9` (same as baseline), `tests 3653` (baseline 3658 minus the
  5 net cases this plan removed). `grep -c 'from "./shipped-modules.ts"'
  anno-derive.test.ts` returns 0. `grep -c 'anno-seam.test.ts'` returns 0 for all
  four sqlite-confinement modules. `grep -c 'capture-predicate.test.ts'
  capture-predicate.ts` returns 0. `git log --name-only` for this plan's three
  task commits names only the six files in `files_modified`, never an adjacent
  untouchable path. `git status --porcelain` verifies the eight pre-existing
  unrelated paths remain untouched throughout this plan.
