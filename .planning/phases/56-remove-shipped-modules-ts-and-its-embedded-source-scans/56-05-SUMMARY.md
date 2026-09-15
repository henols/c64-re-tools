---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 05
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over each of
      this plan's two files)."
provides:
  - "Two more of the seventeen files that imported shipped-modules.ts no longer do:
    anno-index.test.ts, vsf-slice.test.ts."
  - "The verbatim seven-case removed-case-name list for this plan's share of D-16's SUMMARY
    deliverable."
affects: [56-06, 56-07, 56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 4222
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used twice in this plan,
      each landing exactly on the named set with zero unexpected loss or gain."
    - "anno-index.test.ts's oracle-independence case ('the linear-scan oracle shares no code
      path with the production paint index') read its OWN test file as text via
      readFileSync(join(HERE, 'anno-index.test.ts')), not a production module -- the shape a
      production-module-only scan misses. It was still an assertion on source TEXT under the
      cut_rule and went whole under D-01."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-index.test.ts
    - src/mcp/vice/vsf-slice.test.ts

key-decisions:
  - "vsf-slice.test.ts's 'Structural SUPPLEMENT' section header comment and its two
    helpers (CLI_MARKER const, libraryRegion() function) were removed as a block along with
    the three cases they existed to support (imports-nothing scan, library-region I/O scan,
    guarded-CLI-entry-point scan), after grep-confirming libraryRegion()/CLI_MARKER had no
    caller outside those cases. MODULE_PATH stayed: it is also used by four surviving
    behavioural CLI-subprocess cases."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "anno-index.test.ts loses its three whole source-scanning cases (own-file
      oracle-disjointness scan, no-module-level-mutable-binding scan, exactly-one-import scan),
      all reached through the module-scope indexSource() helper. The single-row resolution
      case and every other behavioural case survive untouched. No shipped-modules import
      remains, and indexSource() plus its now-unused readFileSync/fileURLToPath/dirname/join
      imports and HERE const are gone."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "anno-index.test.ts (TAP name-set diff, /tmp/56-05-t1-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "vsf-slice.test.ts loses its four whole source-scanning cases (imports-nothing
      scan, library-region I/O scan, guarded-CLI-entry-point scan, exported-function-signature
      scan), all direct scanner hits over vsf-slice.ts's own source via codeOnly(). The
      sliceC64Mem copy-semantics case and the behavioural 'importing vsf-slice.ts runs nothing'
      child-process case, plus every CLI-subprocess and refusal case, survive untouched. The
      now-orphaned CLI_MARKER const and libraryRegion() helper, and the doomed codeOnly
      import, are gone."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "vsf-slice.test.ts (TAP name-set diff, /tmp/56-05-t2-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "The whole automated suite is green and typecheck exits 0 at the end of the
      plan, after both files' cuts land."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3712, pass 3703, fail 0,
          skipped 9"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck -- EXIT=0"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 05: Cut anno-index.test.ts and vsf-slice.test.ts Summary

**Removed seven whole source-scanning cases across two files. anno-index.test.ts loses three cases, one of which reads the test file's own source rather than a production module. vsf-slice.test.ts loses four cases, including its whole "Structural SUPPLEMENT" section. The whole suite stays green.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-15T06:34:00Z
- **Completed:** 2026-09-15T06:54:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits, zero false
  positives on comments/strings/regex-after-`return`) before trusting it against either real
  file, per the plan's `scanner_protocol`.
- Cut `anno-index.test.ts`'s three whole source-scanning cases, all reached through the
  module-scope `indexSource()` helper: the linear-scan oracle's own-file disjointness scan
  (which reads `anno-index.test.ts` itself, not a production module -- the blind spot a
  production-module-only scan would miss), the no-module-level-mutable-binding scan over
  `anno-index.ts`, and the exactly-one-import scan over `anno-index.ts`. Removed the now-orphaned
  `indexSource()` helper, the doomed `codeOnly` import, and the `readFileSync`/`fileURLToPath`/
  `dirname`/`join` imports plus the `HERE` const whose only callers were the removed cases. Kept
  `"a single-row index resolves that row inside its span and NO_ROW one step either side"`
  byte-identical (RESEARCH Q3: wholly behavioural).
- Cut `vsf-slice.test.ts`'s four whole source-scanning cases, all direct scanner hits over
  `vsf-slice.ts`'s own source via `codeOnly()`: the imports-nothing-from-this-repo scan, the
  library-region no-filesystem/subprocess/network-I/O scan, the guarded-CLI-entry-point scan
  (all three inside the file's "Structural SUPPLEMENT" section), and a fourth standalone case,
  the exported-function-signature scan. Removed the now-orphaned `CLI_MARKER` const and
  `libraryRegion()` helper (grep-confirmed no caller outside the two removed cases that used
  them) and the doomed `codeOnly` import. Kept `"sliceC64Mem: the returned image is a COPY"` and
  the behavioural `"importing vsf-slice.ts runs nothing"` child-process case byte-identical
  (RESEARCH Q3: both wholly behavioural), along with every CLI-subprocess and refusal case.
- Ran the mandated blind-spot passes (raw `readFileSync` of a sibling `.ts`/`.mts`, module-scope
  `*_SOURCE` constants, suspicious case-name skim) over both files. Found no case the scanner
  missed in either file. Every other `readFileSync` call in both files reads a `.vsf` fixture,
  a CLI-produced binary output, a `.json` fixture, or `package.json` -- all explicitly NOT IN
  SCOPE.
- `npm run test:automated`: `EXIT=0`, `tests 3712`, `pass 3703`, `fail 0`, `skipped 9` -- matching
  the 56-04 baseline (`tests 3719`) minus exactly the 7 cases this plan removed. `npm run
  typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cut anno-index.test.ts** - `71265498` (test)
2. **Task 2: Cut vsf-slice.test.ts and close the plan with the full automated gate** - `69d086bd` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/anno-index.test.ts` - lost its three source-scanning cases and the
  `indexSource()` helper plus its supporting imports (`readFileSync`, `fileURLToPath`,
  `dirname`, `join`, `HERE`) and the doomed `codeOnly` import. `IndexableRange`,
  `AnnoAddressError` and every behavioural case stay.
- `src/mcp/vice/vsf-slice.test.ts` - lost its four source-scanning cases, the "Structural
  SUPPLEMENT" section header comment, the `CLI_MARKER` const, the `libraryRegion()` helper, and
  the doomed `codeOnly` import. `MODULE_PATH`, `readFileSync`, `spawnSync` and every
  CLI-subprocess/refusal/copy-semantics case stay -- all still used by surviving cases.

## Decisions Made
- Confirmed `anno-index.test.ts`'s oracle-disjointness case as IN SCOPE despite reading the test
  file's own source rather than a production module: the cut_rule's IN SCOPE test is about the
  SUBJECT (source text), not which file is scanned. See prior-wave item 2 in the dispatch
  context, and the key-decisions/patterns.added note above.
- Removed `vsf-slice.test.ts`'s "Structural SUPPLEMENT" section as a whole block (header comment
  + two helpers + three cases) rather than leaving the header comment behind: the header
  describes exactly the removed content and nothing else, so leaving it would document a scan
  that no longer exists. See key-decisions in frontmatter.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' scanner runs (3 hits in anno-index.test.ts,
4 hits in vsf-slice.test.ts), blind-spot passes and helper grep-confirmations matched the plan's
action text exactly.

## Removed Cases (D-16, this plan's share)

### `src/mcp/vice/anno-index.test.ts` (3 removed, whole-case, D-01)
1. `"the linear-scan oracle shares no code path with the production paint index"` -- entire
   subject was a `codeOnly()`-stripped scan of `anno-index.test.ts`'s OWN source (not a
   production module) for the oracle's body, confirmed absent for four forbidden production
   identifiers. Made no production call. Scanner direct hit on the test file's own text.
2. `"anno-index.ts declares no module-level mutable binding, including a const bound to a
   mutable container"` -- entire subject was a `codeOnly()`-stripped scan of `anno-index.ts`'s
   own source via the `indexSource()` helper, filtering lines for `let`/`var`/mutable-container
   `const` declarations. Made no production call. Scanner hit via helper indirection.
3. `"anno-index.ts imports from exactly one module, anno-types.ts, and uses no dynamic import"`
   -- entire subject was a `codeOnly()`-stripped import-specifier scan of `anno-index.ts`'s own
   source via `indexSource(true)`, plus a second `indexSource()` call checking for a dynamic
   `import(` shape. Made no production call. Scanner hit via helper indirection (two call sites
   inside one case).

### `src/mcp/vice/vsf-slice.test.ts` (4 removed, whole-case, D-01)
1. `"vsf-slice.ts imports nothing from this repo -- only node: builtins, and only in the CLI
   region"` -- entire subject was a `codeOnly()`-stripped import-specifier scan of the whole
   file and, via the `libraryRegion()` helper, of the library region alone. Made no production
   call. Scanner direct hit.
2. `"vsf-slice.ts's LIBRARY region performs no filesystem, subprocess or network I/O"` -- entire
   subject was a `codeOnly()`-stripped scan of the library region (via `libraryRegion()`) for
   five forbidden-call-shape regexes. Made no production call. Scanner direct hit.
3. `"the CLI entry point is guarded: main() is only reachable behind the entry-point check"` --
   entire subject was a `codeOnly()`-stripped scan of the whole file's source for
   `process.exit(` call-site count and two structural regex matches. Made no production call.
   Scanner direct hit.
4. `"no exported function takes a filesystem path -- both take a byte array"` -- entire subject
   was a `codeOnly()`-stripped scan of the whole file's source for `export function` signatures,
   compared against a pinned two-entry array. Made no production call. Scanner direct hit.

---

**Total deviations:** 0
**Impact on plan:** None -- plan executed exactly as written.

## Issues Encountered

None. The BEFORE TAP name set was captured before editing began for both files, per prior wave
context's Item 4.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ten of seventeen importing files are now clear (three from 56-01, three from 56-03, two from
  56-04, two from this plan). Seven remain, minus `anno-seam.test.ts` which 56-02 already
  reduced without removing the file: `anno-derive.test.ts`, `stock-dispatch.test.ts`,
  `anno-store.test.ts`, `anno-export-asm.test.ts`, `anno-coverage.test.ts`, plus
  `shipped-modules.ts` + `shipped-modules.test.ts` themselves (D-09, final wave only after every
  regular file loses its import).
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline minus this plan's 7
  removed cases) and typecheck is clean. The next plan in this phase's wave sequence can proceed
  independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-index.test.ts`
- FOUND: `src/mcp/vice/vsf-slice.test.ts`
- FOUND commit `71265498` (Task 1)
- FOUND commit `69d086bd` (Task 2)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (3/0, 4/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0 for both files, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3712` (baseline 3719 minus the 7 cases this plan removed).
  `git log --name-only` for this plan's two task commits names only the one file each commit
  staged.
