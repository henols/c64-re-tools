---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 04
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
    capture-predicate.test.ts, evid-report-keys.test.ts."
  - "The verbatim four-case removed-case-name list for this plan's share of D-16's SUMMARY
    deliverable."
affects: [56-05, 56-06, 56-07, 56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 1996
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used twice in this plan,
      each landing exactly on the named set with zero unexpected loss or gain."
    - "evid-report-keys.test.ts was PATTERNS.md's worked example of Edit Kind 4 (a module-scope
      helper whose every caller is being removed). All three helpers (evidenceFamilyModules,
      assertRuntimeUnionHasExactlyTwoMembers, assertNoRuntimeLiteralOutsideUnion) were
      grep-confirmed to have no caller outside the two removed direction-4 cases before removal."

key-files:
  created: []
  modified:
    - src/mcp/vice/capture-predicate.test.ts
    - src/mcp/vice/evid-report-keys.test.ts

key-decisions:
  - "capture-predicate.test.ts's second candidate case ('no exported function in either module
    takes a filesystem path...') is reached by a LOCAL const signaturesOf defined inside the
    test body, not through the module-scope moduleSpecifiers helper the plan's action text names
    as the route for both hits. The scanner itself reported both as scanner hits (one
    helper-indirected via moduleSpecifiers, one direct), and hand-reading both case bodies
    confirmed both are source-TEXT assertions under the cut_rule's IN SCOPE test regardless of
    which route reaches codeOnly. Both were removed whole under D-01 exactly as the plan
    specified by verbatim name. The helper-attribution detail did not change the cut decision."
  - "evid-report-keys.test.ts's directions 1-3 (scope completeness over ANNO_TOOL_DEFINITIONS,
    banned-key walk over ANSWERS JSON, denominator adjacency over ANSWERS JSON) were confirmed
    NOT IN SCOPE: their subject is a runtime JS value (a tool-definitions array or a JSON answer
    object returned by runAnnoTool), never a module's source text. Only direction 4 reads source
    text via readFileSync + codeOnly. Left untouched."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "capture-predicate.test.ts loses its two whole source-scanning cases (module
      import-specifier scan, exported-function-signature scan). The argvDigest
      order-sensitivity case and every other behavioural case survive untouched. No
      shipped-modules import remains, and the now-orphaned moduleSpecifiers helper is gone."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "capture-predicate.test.ts (TAP name-set diff, /tmp/56-04-t1-lost.txt / -gained.txt)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "evid-report-keys.test.ts loses its two whole direction-4 source-scanning cases
      (RuntimeExecClass cardinality scan over anno-types.ts/evid-*.ts, and its synthetic-source
      planted control), plus all three module-scope helpers PATTERNS.md's Edit Kind 4 names
      (evidenceFamilyModules, assertRuntimeUnionHasExactlyTwoMembers,
      assertNoRuntimeLiteralOutsideUnion) once grep-confirmed their only callers were the two
      removed cases. Directions 1-3 and the package.json files[]-exclusion case survive
      untouched -- none of them read module source text."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "evid-report-keys.test.ts (TAP name-set diff, /tmp/56-04-t2-lost.txt / -gained.txt)"
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
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3719, pass 3710, fail 0,
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

# Phase 56 Plan 04: Cut capture-predicate.test.ts and evid-report-keys.test.ts Summary

**Removed four whole source-scanning cases across two files: two in capture-predicate.test.ts, two direction-4 cases in evid-report-keys.test.ts. Also removed evid-report-keys.test.ts's three now-orphaned module-scope helpers, PATTERNS.md's worked Edit Kind 4 example. The whole suite stays green.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-15T05:44:21Z
- **Completed:** 2026-09-15T05:51:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits) before
  trusting it against either real file, per the plan's `scanner_protocol`.
- Cut `capture-predicate.test.ts`'s two whole source-scanning cases (module import-specifier
  scan reached via the `moduleSpecifiers` helper, exported-function-signature scan reached via a
  local `signaturesOf` const), both scanner hits over `capture-predicate.ts`/`stop-oracle.ts`'s
  own source. Removed the now-orphaned `moduleSpecifiers` helper and the doomed `codeOnly`
  import once grep-confirmed no other caller existed. Kept `"argvDigest is order-sensitive and
  refuses an empty array by name"` byte-identical (RESEARCH Q3: wholly behavioural).
- Cut `evid-report-keys.test.ts`'s two whole direction-4 source-scanning cases (the
  `RuntimeExecClass` cardinality scan over the evidence family's own modules, and its synthetic
  three-member-union planted control), both scanner hits. Removed the three module-scope helpers
  PATTERNS.md names as this file's Edit Kind 4 example (`evidenceFamilyModules`,
  `assertRuntimeUnionHasExactlyTwoMembers`, `assertNoRuntimeLiteralOutsideUnion`) once
  grep-confirmed their only callers were the two removed cases, and the doomed
  `codeOnly`/`shippedTsModules` import. Kept `OWN_FILENAME`, still named by the surviving
  package.json files[]-exclusion case. Directions 1-3 (scope completeness, banned keys,
  denominator adjacency) all read runtime JS values, not source text, and survive untouched.
- Ran the two mandated blind-spot passes (raw `readFileSync` of a sibling `.ts`/`.mts`,
  `*_SOURCE` module-scope constants, suspicious case-name skim) over both files. Found no case
  the scanner missed in either file. Every other `readFileSync` call in both files reads
  `package.json` as JSON, explicitly NOT IN SCOPE.
- `npm run test:automated`: `EXIT=0`, `tests 3719`, `pass 3710`, `fail 0`, `skipped 9` -- matching
  the 56-03 baseline (`tests 3723`) minus exactly the 4 cases this plan removed. `npm run
  typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cut capture-predicate.test.ts** - `123fd2e0` (test)
2. **Task 2: Cut evid-report-keys.test.ts with its three scanning helpers, then run the gate** - `5dec8c16` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/capture-predicate.test.ts` - lost its two source-scanning cases, the
  `moduleSpecifiers` helper and the doomed `codeOnly` import. `readFileSync`, `dirname`,
  `fileURLToPath`, `join` and `HERE` all stay -- the surviving package.json files[] case still
  uses them.
- `src/mcp/vice/evid-report-keys.test.ts` - lost its two direction-4 source-scanning cases and
  the three module-scope helpers that only they used (`evidenceFamilyModules`,
  `assertRuntimeUnionHasExactlyTwoMembers`, `assertNoRuntimeLiteralOutsideUnion`, the doomed
  `codeOnly`/`shippedTsModules` import). `readFileSync`, `OWN_FILENAME` stay -- used by the
  surviving package.json files[]-exclusion case. Directions 1-3 stay fully untouched.

## Decisions Made
- Treated `capture-predicate.test.ts`'s second candidate case (reached via a local
  `signaturesOf` const rather than the module-scope `moduleSpecifiers` helper the plan's action
  text names) as in scope exactly as the plan specified -- see Decisions Made in frontmatter.
  The routing detail (local const vs module-scope helper) does not change the cut_rule's IN
  SCOPE test, which is about the case's SUBJECT (source text), not its call route.
- Confirmed `evid-report-keys.test.ts`'s directions 1-3 as NOT IN SCOPE: their subject is a
  runtime JS value (`ANNO_TOOL_DEFINITIONS`, or `ANSWERS` JSON returned by `runAnnoTool`), never
  a module's source text. See Decisions Made in frontmatter.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' scanner runs, blind-spot passes and helper
grep-confirmations matched the plan's action text exactly: two hits per file, three helpers in
evid-report-keys.test.ts with no surviving caller.

## Removed Cases (D-16, this plan's share)

### `src/mcp/vice/capture-predicate.test.ts` (2 removed, whole-case, D-01)
1. `"neither module imports anything but node builtins -- no path-translation seam, and not each
   other"` -- entire subject was a `codeOnly()`-stripped import-specifier scan of
   `capture-predicate.ts` and `stop-oracle.ts`'s own source, reached through the module-scope
   `moduleSpecifiers()` helper. Made no production call. Scanner hit via helper indirection.
2. `"no exported function in either module takes a filesystem path -- every one takes bytes,
   scalars or a parsed value"` -- entire subject was a `codeOnly()`-stripped export-function
   signature scan of the same two modules' own source, reached through a local `signaturesOf`
   const. Made no production call. Scanner direct hit.

### `src/mcp/vice/evid-report-keys.test.ts` (2 removed, whole-case, D-01)
1. `"direction 4 (no runtime data branch), clean control: RuntimeExecClass has exactly two
   members, and no scanned evidence-family module assigns a runtime literal outside it"` --
   entire subject was a `codeOnly()`-stripped scan of `anno-types.ts` and every `evid-*.ts`
   module's own source for the `RuntimeExecClass` union declaration and any `runtime: "..."`
   literal outside it, reached through three module-scope helpers. Made no production call.
   Scanner hit via helper indirection.
2. `"direction 4 (no runtime data branch), planted control: a synthetic source string declaring
   a three-member runtime union fails the cardinality check by name"` -- entire subject was a
   SYNTHETIC source string (`'export type RuntimeExecClass = "code" | "unobserved" | "data";'`)
   fed through the same `codeOnly()`-based cardinality-check helper as its sibling. An assertion
   on planted text is still an assertion on text under the cut_rule, so it goes whole with its
   sibling. Scanner hit via helper indirection.

---

**Total deviations:** 0
**Impact on plan:** None -- plan executed exactly as written.

## Issues Encountered

None. The BEFORE TAP name set was captured before editing began for both files, per prior wave
context's Item 4.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Eight of seventeen importing files are now clear (three from 56-01, three from 56-03, two from
  this plan). Nine remain, minus `anno-seam.test.ts` which 56-02 already reduced without removing
  the file or its import status separately tracked: `anno-derive.test.ts`, `anno-index.test.ts`,
  `vsf-slice.test.ts`, `stock-dispatch.test.ts`, `anno-store.test.ts`, `anno-export-asm.test.ts`,
  `anno-coverage.test.ts`, plus `shipped-modules.ts` + `shipped-modules.test.ts` themselves
  (D-09, final wave only after every regular file loses its import).
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline) and typecheck is
  clean. The next plan in this phase's wave sequence can proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/capture-predicate.test.ts`
- FOUND: `src/mcp/vice/evid-report-keys.test.ts`
- FOUND commit `123fd2e0` (Task 1)
- FOUND commit `5dec8c16` (Task 2)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (2/0, 2/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0 for both files, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3719` (baseline 3723 minus the 4 cases this plan removed).
  `git log --name-only` for this plan's two task commits names only the one file each commit
  staged.
