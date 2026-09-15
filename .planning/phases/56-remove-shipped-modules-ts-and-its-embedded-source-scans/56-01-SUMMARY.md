---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 01
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires: []
provides:
  - "A proven D-14 scratch scanner (re-derived codeOnly()-equivalent regex-vs-division state
    machine, symbol-anchored, one level of helper indirection, proved against a five-case
    planted fixture) at /tmp/gsd-56-scope-scan/scope-scan.mjs, reusable by every later
    Phase 56 plan."
  - "Three of the seventeen files that imported shipped-modules.ts no longer do:
    prg-image.test.ts, anno-graphics.test.ts, anno-types.test.ts."
  - "The verbatim removed-case-name list for this plan's share of D-16's SUMMARY deliverable."
affects: [56-02, 56-03, 56-04, 56-05, 56-06, 56-07, 56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 4979
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15."
    - "A comment/string-masking scanner that preserves original byte offsets (space-fills
      stripped spans instead of dropping them) so a hit maps straight back to its
      enclosing test(...) call by offset, with no separate position table."

key-files:
  created: []
  modified:
    - src/mcp/vice/prg-image.test.ts
    - src/mcp/vice/anno-graphics.test.ts
    - src/mcp/vice/anno-types.test.ts

key-decisions:
  - "anno-graphics.test.ts's 'the module header states...' case was NOT in the D-14 scanner's
    symbol-anchored hit list (it uses a raw readFileSync with no shipped-modules symbol in its
    chain) but was found by the mandated blind-spot pass and removed under D-01 -- its removal
    is what let REAL_ANNO_GRAPHICS_PATH become a removable module-scope binding, matching the
    file's approx-2-scanning-case census in CONTEXT.md/ROADMAP.md."
  - "anno-types.test.ts's SCHEMA_VERSION case was resolved as genuinely mixed under D-02. The
    assert.equal(SCHEMA_VERSION, 5, ...) call is real production behaviour and was kept
    byte-for-byte. The seven assert.match calls against the module's own raw doc-comment text
    were stripped, and the case was renamed per D-03, because the old name promised both halves."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "prg-image.test.ts loses its two whole source-scanning cases. Six behavioural
      cases survive untouched, including the decodeRawData round-trip. No shipped-modules
      import remains."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "prg-image.test.ts (TAP name-set diff, /tmp/56-01-t1-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "anno-graphics.test.ts loses its two whole source-scanning cases. The scanner
      found one. The mandated raw-readFileSync blind-spot pass found the other. Its behavioural
      cases survive untouched, including the two-store cross-reference-derivation proofs."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "anno-graphics.test.ts (TAP name-set diff, /tmp/56-01-t2-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno-types.test.ts loses its one whole source-scanning case. Its one genuinely
      mixed case (SCHEMA_VERSION) is stripped in place and renamed. The twelve-member pin, the
      split-layout derivations, and every other behavioural case survive untouched."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "anno-types.test.ts (TAP name-set diff, /tmp/56-01-t3-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "The D-14 scratch scanner is built, proved against a planted fixture (RED for
      naive grep, GREEN for the scanner), and left untracked outside the repository tree for
      reuse by every later plan in this phase."
    verification:
      - kind: other
        ref: "node /tmp/gsd-56-scope-scan/scope-scan.mjs /tmp/gsd-56-scope-scan/planted-fixture.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole automated suite (all 17 files, none of them empty or setup-only) is
      green, and typecheck exits 0, at the end of the plan."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- tests 3748, pass 3739, fail 0, skipped 9"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 1: End-to-end cut of prg-image.test.ts, anno-graphics.test.ts and anno-types.test.ts Summary

**Proved the whole Phase 56 cut pipeline on prg-image.test.ts. Then applied it to anno-graphics.test.ts and anno-types.test.ts: 5 whole-case removals, 1 strip-in-place-and-rename, 0 collateral loss, whole suite still green.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-15T04:44:08Z
- **Completed:** 2026-09-15T04:58:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Built and proved the D-14 scratch scanner (re-derived `codeOnly()`-equivalent regex-vs-division
  masking, symbol-anchored, one level of helper indirection) against a five-case planted
  fixture: RED for a naive substring grep (4 of 5 cases wrongly flagged, including both false
  positives), GREEN for the scanner (exactly the 2 genuinely-consuming cases, one direct, one
  via helper).
- Cut `prg-image.test.ts`'s two whole source-scanning cases end-to-end through the full pipeline
  (scanner narrow -> hand-read -> whole-case removal -> module-scope-binding cleanup -> TAP
  name-set diff -> typecheck -> explicit-path commit), proving the pattern before scaling it.
- Cut `anno-graphics.test.ts`'s two whole source-scanning cases -- one found by the scanner, one
  found only by the mandated raw-`readFileSync` blind-spot pass (the scanner's symbol-anchored
  construction cannot see a case with zero doomed-symbol reference).
- Cut `anno-types.test.ts`'s one whole source-scanning case, and stripped-in-place-and-renamed
  its one genuinely mixed case (the `SCHEMA_VERSION` pin), per D-02/D-03.
- Removed the module-scope bindings (imports, path constants, one small helper function, one
  constant array) whose only remaining callers were the removed cases, in all three files.
- `npm run test:automated`: `EXIT=0`, `tests 3748`, `pass 3739`, `fail 0`, `skipped 9` --
  matching the pre-cut baseline (`tests 3753`, `fail 0`) minus exactly the 5 net cases this plan
  removed (6 lost, 1 gained via rename).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end cut of prg-image.test.ts, whole pipeline, committed** - `5334e21c` (test)
2. **Task 2: Cut anno-graphics.test.ts** - `285155ad` (test)
3. **Task 3: Cut anno-types.test.ts and close the plan with the full automated gate** - `20cccbb5` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/prg-image.test.ts` - lost its two source-scanning cases and the module-scope
  bindings that only they used (`codeOnly` import, `readFileSync` import, `MODULE_PATH`). Six
  behavioural cases and the file's header paragraph stay byte-identical.
- `src/mcp/vice/anno-graphics.test.ts` - lost its two source-scanning cases (one scanner hit,
  one blind-spot hit) and the module-scope bindings that only they used (`codeOnly` import,
  `readFileSync` import, `REAL_ANNO_GRAPHICS_PATH`, `extractImportSpecifiers`,
  `BANNED_IMPORT_SUBSTRINGS`, and the now-orphaned `HERE`/`dirname`/`fileURLToPath`). Ten
  behavioural cases survive untouched.
- `src/mcp/vice/anno-types.test.ts` - lost its one source-scanning case outright. Its one mixed
  case (`SCHEMA_VERSION`) was stripped to its surviving behavioural assertion and renamed.
  `readFileSync`, `codeOnly`, `HERE` and the `node:path`/`node:url` imports then had no
  remaining caller. They were removed too.

## Decisions Made
- Treated `anno-graphics.test.ts`'s "the module header states the sprite-bitmap-out-of-scope
  boundary and the byte-datatype choice" case as in-scope under D-01 even though the D-14
  scanner (symbol-anchored by construction) did not flag it: its entire subject is two
  `assert.match` calls against a raw `readFileSync` of the module's own source, which is exactly
  the cut_rule's IN SCOPE definition ("the route does not matter... it may reach [source text]
  through a raw readFileSync"). Removing it is also what makes `REAL_ANNO_GRAPHICS_PATH`
  removable, consistent with the plan's own module-scope-binding candidate list.
- Applied D-02's exemption to `anno-types.test.ts`'s `SCHEMA_VERSION` case. The
  `assert.equal(SCHEMA_VERSION, 5, ...)` call is real production behaviour: it reads the actual
  exported constant, not source text. It was kept byte-for-byte. The seven `assert.match` calls
  against the module's own raw doc-comment text were pure source-text assertions, and they were
  removed. The case was renamed per D-03's mandatory-rename rule, because the old name ("...and
  the constant's own doc comment records the reaffirm-refusal decision by table name and by
  date...") promised the now-stripped half too.

## Removed Cases (D-16, this plan's share)

### `src/mcp/vice/prg-image.test.ts` (2 removed, whole-case, D-01)
1. `"prg-image.ts imports exactly one module, node:zlib, and nothing from this repo"` -- entire
   subject was the module's own `codeOnly()`-stripped import-specifier list. It made no
   production call.
2. `"prg-image.ts performs no filesystem, subprocess or network I/O"` -- entire subject was a
   forbidden-pattern regex scan over the module's own `codeOnly()`-stripped source. It made no
   production call.

### `src/mcp/vice/anno-graphics.test.ts` (2 removed, whole-case, D-01)
1. `"a non-vacuous structural scan of anno-graphics.ts's own import list reaches none of the
   store, the join, the host-path modules or the emulator backend"` -- entire subject was a
   banned-substring scan over the module's own `codeOnly()`-stripped import list (D-14 scanner
   direct hit).
2. `"the module header states the sprite-bitmap-out-of-scope boundary and the byte-datatype
   choice"` -- entire subject was two `assert.match` calls against a raw, unstripped
   `readFileSync` of the module's own source (D-14 blind-spot: no doomed symbol in its chain,
   found by the mandated raw-`readFileSync` pass, not the scanner).

### `src/mcp/vice/anno-types.test.ts` (1 removed whole, 1 stripped-in-place-and-renamed)
1. `"anno-types.ts declares no module-level mutable binding, and its import specifier set is
   exactly the four it needs"` -- **removed whole (D-01).** Entire subject was two scans over
   the module's own `codeOnly()`-stripped source: a module-level-mutable-state scan and an
   import-specifier scan (D-14 scanner direct hit). No behavioural assertion survives.
2. `"SCHEMA_VERSION is 5, and the constant's own doc comment records the reaffirm-refusal
   decision by table name and by date -- the bump is a decision on the record, not a number that
   drifted"` -- **stripped in place, renamed (D-02/D-03).** Removed the seven `assert.match`
   calls against a raw `readFileSync` of the module's own doc comment. Kept
   `assert.equal(SCHEMA_VERSION, 5, ...)` byte-for-byte, since it is real production behaviour.
   Renamed to `"SCHEMA_VERSION is 5 -- a deliberate one-way bump that strands every version 4
   store, not a number that drifted"`, because the old name promised the now-stripped
   doc-comment half too.

## Deviations from Plan

None - plan executed exactly as written. The one judgment call beyond the plan's explicit line
numbers -- removing `anno-graphics.test.ts`'s "the module header states..." case via the
mandated blind-spot pass -- was itself instructed by the plan's own `scanner_protocol` section
("for every file, do three passes... grep the file for readFileSync of a sibling .ts or .mts")
and is recorded above as a key decision, not a deviation from the plan's process.

## Issues Encountered

None. The executor did not capture the BEFORE TAP set for `anno-types.test.ts` (Task 3) to a
separate file before editing began. Recovery: write the file's pre-edit committed content
(`git show HEAD:...` at the point Task 3 started) to the working path, capture the TAP set, then
restore the edited content from a local backup copy. No git commands touched the git index or
history during this recovery -- only filesystem copies. The recovered BEFORE set (23 cases)
matches CONTEXT.md's census exactly. This confirms the recovery lost nothing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The D-14 scanner at `/tmp/gsd-56-scope-scan/scope-scan.mjs` is proven and ready for reuse by
  Phase 56 plans 02 through 11 -- it is session-scratchpad-scoped and will need re-authoring (or
  copying, per D-14's own "never committed" rule) in a fresh executor context if the scratchpad
  does not persist across plan dispatches.
- Three of seventeen importing files are clear. Fourteen remain: `anno-overlap.test.ts`,
  `anno-join.test.ts`, `block-class.test.ts`, `capture-predicate.test.ts`,
  `evid-report-keys.test.ts`, `anno-derive.test.ts`, `anno-index.test.ts`, `vsf-slice.test.ts`,
  `stock-dispatch.test.ts`, `anno-seam.test.ts`, `anno-store.test.ts`,
  `anno-export-asm.test.ts`, `anno-coverage.test.ts`, plus `shipped-modules.ts` +
  `shipped-modules.test.ts` themselves (D-09, final wave only after all sixteen regular files
  lose their import).
- No blockers. The suite is green and typecheck is clean. The next plan can proceed
  independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/prg-image.test.ts`
- FOUND: `src/mcp/vice/anno-graphics.test.ts`
- FOUND: `src/mcp/vice/anno-types.test.ts`
- FOUND commit `5334e21c` (Task 1)
- FOUND commit `285155ad` (Task 2)
- FOUND commit `20cccbb5` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names, `grep -c 'from "./shipped-modules.ts"'` returns 0 for
  all three files, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3748` (baseline 3753 minus the 5 net cases this plan removed).
