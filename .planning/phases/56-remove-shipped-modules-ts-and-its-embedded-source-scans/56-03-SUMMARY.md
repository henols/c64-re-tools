---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 03
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over each of
      this plan's three files)."
provides:
  - "Three more of the seventeen files that imported shipped-modules.ts no longer do:
    block-class.test.ts, anno-join.test.ts, anno-overlap.test.ts."
  - "The verbatim four-case removed-case-name list for this plan's share of D-16's SUMMARY
    deliverable."
affects: [56-04, 56-05, 56-06, 56-07, 56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 2813
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used three times in this
      plan, each landing exactly on the named set with zero unexpected loss or gain."
    - "anno-overlap.test.ts's TAP name count (36) exceeds its static test( declaration count (21)
      because two loop sites generate case families -- confirmed as the expected, harmless gap
      named in the plan's key_links rather than a scanner miscount."

key-files:
  created: []
  modified:
    - src/mcp/vice/block-class.test.ts
    - src/mcp/vice/anno-join.test.ts
    - src/mcp/vice/anno-overlap.test.ts

key-decisions:
  - "anno-join.test.ts's second candidate-looking case, 'the structural proof's non-vacuity
    assertion is itself non-vacuous...' (line 373), was NOT removed. It reads no module source
    text at all -- its entire body operates on a hardcoded empty array literal to hand-confirm a
    property of the removed case's own guard logic. The cut_rule's IN SCOPE test is 'a case whose
    SUBJECT is the source TEXT of a module.' This case's subject is an assertion-logic
    demonstration, not source text, so it falls outside scope even though its prose now refers to
    a scan that no longer exists in this file. Left byte-identical, consistent with D-13's
    stale-comment-stays-stale reasoning extended to a stale but still-passing assertion."
  - "block-class.test.ts's files[] inclusion case (line 412 pre-cut) was confirmed NOT IN SCOPE:
    it reads package.json parsed as JSON, which the cut_rule explicitly excludes even though it
    uses readFileSync. Left untouched."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "block-class.test.ts loses its two whole source-scanning cases (import-purity
      scan, module-level-mutable-binding scan). Fourteen behavioural cases and the files[]
      inclusion case survive untouched. No shipped-modules import remains."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "block-class.test.ts (TAP name-set diff, /tmp/56-03-t1-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "anno-join.test.ts loses its one whole source-scanning case (module-graph
      import/spawn/queue scan), plus the importSpecifiers() helper and two constants that were
      its only callers. The setComment MAX_COMMENT_BYTES refusal case (RESEARCH Q3, wholly
      behavioural) and the unrelated non-vacuity demonstration case both survive byte-identical."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "anno-join.test.ts (TAP name-set diff, /tmp/56-03-t2-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno-overlap.test.ts loses its one whole source-scanning case (adjacency
      STRUCTURAL scan). The behavioural adjacency case and every other of the file's 21 static
      declarations (36 TAP names via two loop-generated families) survive untouched."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "anno-overlap.test.ts (TAP name-set diff, /tmp/56-03-t3-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole automated suite is green and typecheck exits 0 at the end of the
      plan, after all three files' cuts land."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3723, pass 3714, fail 0,
          skipped 9"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck -- EXIT=0"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 03: Cut block-class.test.ts, anno-join.test.ts and anno-overlap.test.ts Summary

**Removed four whole source-scanning cases across three mechanical files (two in block-class.test.ts, one each in anno-join.test.ts and anno-overlap.test.ts). Each was reached by a single scanner hit or helper-indirected hit per file. The whole suite stays green.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-15T07:34:00Z
- **Completed:** 2026-09-15T07:40:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits) before
  trusting it against any real file, per the plan's `scanner_protocol`.
- Cut `block-class.test.ts`'s two whole source-scanning cases (import-purity scan,
  module-level-mutable-binding scan), both scanner hits over the module's own stripped source.
  The files[] inclusion case (reads `package.json` as JSON, explicitly NOT IN SCOPE) survives
  untouched, as do all fourteen behavioural cases.
- Cut `anno-join.test.ts`'s one whole source-scanning case (module-graph import/spawn/queue scan,
  reached via the `importSpecifiers()` helper), and removed `importSpecifiers()`,
  `SCANNED_MODULES` and `CHILD_PROCESS_SPAWN_NAMES` once grep-confirmed their only remaining
  caller was the removed case. Kept the `setComment` MAX_COMMENT_BYTES refusal case
  byte-identical (RESEARCH Q3: wholly behavioural). Also identified and deliberately left
  untouched a second case that superficially looked related (the non-vacuity demonstration at
  line 373) because its subject is not module source text at all -- see Decisions Made.
- Cut `anno-overlap.test.ts`'s one whole source-scanning case (adjacency STRUCTURAL scan over
  `anno-store.ts`'s own stripped source). Confirmed the file's 36 post-cut TAP names against its
  21 static declarations is the expected loop-family gap named in the plan, not a scanner miss.
- Ran the two mandated blind-spot passes (raw `readFileSync` of a sibling `.ts`/`.mts`,
  `*_SOURCE` module-scope constants, suspicious case-name skim) over all three files. Found no
  case the scanner missed in any of the three files.
- `npm run test:automated`: `EXIT=0`, `tests 3723`, `pass 3714`, `fail 0`, `skipped 9` -- matching
  the 56-02 baseline (`tests 3727`) minus exactly the 4 cases this plan removed. `npm run
  typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cut block-class.test.ts** - `8fe4110a` (test)
2. **Task 2: Cut anno-join.test.ts** - `da3c88c2` (test)
3. **Task 3: Cut anno-overlap.test.ts and close the plan with the full automated gate** - `03947156` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/block-class.test.ts` - lost its two source-scanning cases and the doomed
  `codeOnly` import. `readFileSync`, `dirname`, `fileURLToPath`, `join` and `HERE` all stay --
  the surviving files[] inclusion case still uses them.
- `src/mcp/vice/anno-join.test.ts` - lost its one source-scanning case and the module-scope
  bindings that only it used (`importSpecifiers()`, `SCANNED_MODULES`,
  `CHILD_PROCESS_SPAWN_NAMES`, the doomed `codeOnly` import). The `setComment` refusal case and
  the standalone non-vacuity demonstration case both stay byte-identical.
- `src/mcp/vice/anno-overlap.test.ts` - lost its one source-scanning case and the doomed
  `codeOnly` import. `readFileSync`, `join`, `HERE` stay -- used by several surviving behavioural
  cases elsewhere in the file.

## Decisions Made
- Treated `anno-join.test.ts`'s "the structural proof's non-vacuity assertion is itself
  non-vacuous..." case (line 373 pre-cut) as **out of scope** even though it sits immediately
  after the removed case and its own prose references the removed case's `SCANNED_MODULES`
  constant by name. Its entire body operates on a hardcoded empty array literal
  (`emptyScanSpecifiers: string[] = []`) -- it never calls `readFileSync`, never calls
  `codeOnly`, and never reads any module's source text. The cut_rule's IN SCOPE test is
  explicit ("a case whose SUBJECT is the source TEXT of a module"). This case's subject is a
  hand-confirmed property of assertion logic, not source text. Its now-stale reference to
  `SCANNED_MODULES` in a comment is left as-is, per D-13's stale-comment-stays-stale reasoning
  extended to this still-passing, still-meaningful (if now orphaned in cross-reference) case.
  This was also confirmed independently: the D-14 scanner (symbol-anchored, would need a doomed
  symbol reference to fire) did not flag it, and RESEARCH's own count for this file (1 hit at
  L334) matches -- both signals agree this case was never a candidate.
- Confirmed `block-class.test.ts`'s files[] inclusion case (`package.json's files[] array`,
  survives at original line 412) as NOT IN SCOPE under the cut_rule's explicit JSON-data-file
  exclusion, despite using `readFileSync` -- the same reasoning 56-01 and 56-02 applied to their
  own `package.json` files[] survivors.

## Deviations from Plan

None - plan executed exactly as written. Task 3's action text anticipated the anno-overlap.test.ts
loop-family TAP-count gap (36 names vs 21 declarations) explicitly, and the measured gap matched
that anticipation exactly, so no deviation is recorded for it.

## Removed Cases (D-16, this plan's share)

### `src/mcp/vice/block-class.test.ts` (2 removed, whole-case, D-01)
1. `"block-class.ts imports nothing census-side, disassembler-side, transport-side or
   path-translation-side"` -- entire subject was a `codeOnly()`-stripped import-specifier scan
   plus a dynamic-`import(` regex scan, both over the module's own source. Made no production
   call. Scanner direct hit.
2. `"block-class.ts declares no module-level mutable binding, including a const mutable
   container"` -- entire subject was a line-by-line scan of the module's own `codeOnly()`-stripped
   source for mutable-binding patterns. Made no production call. Scanner direct hit.

### `src/mcp/vice/anno-join.test.ts` (1 removed, whole-case, D-01)
1. `"the join's module graph (anno-join.ts, memmap-lookup.ts, anno-import.ts) imports nothing
   under the skills tree, spawns no child process, and references no queue module"` -- entire
   subject was a scan of five modules' own `codeOnly()`-stripped source (import specifiers,
   forbidden identifiers, spawn-function calls), reached through the module-scope
   `importSpecifiers()` helper. Made no production call. Scanner hit via helper indirection.

### `src/mcp/vice/anno-overlap.test.ts` (1 removed, whole-case, D-01)
1. `"adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the
   store's code"` -- entire subject was a `codeOnly()`-stripped scan of `anno-store.ts`'s own
   source for three forbidden substrings (`coalesc`, `merg`, `splitter`). Made no production call.
   Scanner direct hit. The behavioural half of the same adjacency concept (`"adjacency,
   BEHAVIOURAL: two adjacent same-type ranges stay TWO rows..."`) survives untouched, unaffected
   by this removal.

---

**Total deviations:** 0
**Impact on plan:** None -- plan executed exactly as written, including the one anticipated
measurement (the anno-overlap.test.ts loop-family TAP-count gap).

## Issues Encountered

None. The BEFORE TAP name set was captured before editing began for all three files, per prior
wave context's Item 3.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Six of seventeen importing files are now clear (three from 56-01, three from this plan).
  Eleven remain, minus `anno-seam.test.ts` which 56-02 already reduced without removing the file
  or its import status is separately tracked: `capture-predicate.test.ts`,
  `evid-report-keys.test.ts`, `anno-derive.test.ts`, `anno-index.test.ts`, `vsf-slice.test.ts`,
  `stock-dispatch.test.ts`, `anno-store.test.ts`, `anno-export-asm.test.ts`,
  `anno-coverage.test.ts`, plus `shipped-modules.ts` + `shipped-modules.test.ts` themselves
  (D-09, final wave only after every regular file loses its import).
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline) and typecheck is
  clean. The next plan in this phase's wave sequence can proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/block-class.test.ts`
- FOUND: `src/mcp/vice/anno-join.test.ts`
- FOUND: `src/mcp/vice/anno-overlap.test.ts`
- FOUND commit `8fe4110a` (Task 1)
- FOUND commit `da3c88c2` (Task 2)
- FOUND commit `03947156` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (2/0, 1/0, 1/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0 for all three files, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3723` (baseline 3727 minus the 4 cases this plan removed).
  `git log --name-only` for this plan's three commits names only the one file each commit staged.
