---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 11
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning, phase-close]

# Dependency graph
requires:
  - phase: 56-01
    provides: "prg-image.test.ts, anno-graphics.test.ts, anno-types.test.ts cleared of their
      import, plus the D-14 scratch scanner every later plan in this phase reused."
  - phase: 56-02
    provides: "anno-seam.test.ts reduced from 23 cases to its two designed survivors, kept as a
      file (not removed, not renamed)."
  - phase: 56-03
    provides: "block-class.test.ts, anno-join.test.ts, anno-overlap.test.ts cleared."
  - phase: 56-04
    provides: "capture-predicate.test.ts, evid-report-keys.test.ts cleared."
  - phase: 56-05
    provides: "anno-index.test.ts, vsf-slice.test.ts cleared."
  - phase: 56-06
    provides: "stock-dispatch.test.ts cleared -- the phase's largest single population of
      raw-source-scanning cases."
  - phase: 56-07
    provides: "anno-store.test.ts cleared -- the phase's largest single file at 5,595 lines."
  - phase: 56-08
    provides: "anno-export-asm.test.ts cleared, including one case found only by a mandated
      blind-spot pass."
  - phase: 56-09
    provides: "anno-coverage.test.ts cleared, including an eleven-case cluster invisible to both
      the D-14 scanner and the plan's own candidate list."
  - phase: 56-10
    provides: "anno-derive.test.ts cleared -- the sixteenth and last regular importing file --
      plus D-11's five named production modules repaired of their now-false enforcement credits."
provides:
  - "shipped-modules.ts and shipped-modules.test.ts no longer exist in the repository. Every
    regular test file lost its import across plans 56-01 through 56-10 before this plan removed
    the module itself, so the removal owed no other file an edit."
  - "The phase-level reconciliation this SUMMARY carries: 100 embedded cases removed across
    sixteen surviving files (56-01 through 56-10), reported separately from the 16 cases removed
    with the module's own test file (this plan), for a total suite drop of 116 (3753 to 3637),
    reconciled case by case against a verbatim name list."
affects: []

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 13300
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A repository-wide preflight grep as the sole precondition check before a `git rm` that
      would otherwise break typecheck for every remaining importer -- run once, immediately
      before the removal, rather than trusted from any prior plan's own report."
    - "git diff against a single pre-phase baseline commit (188ca931, the commit immediately
      before 56-01's first test commit), filtered to lines matching `^[-+]\\s*test\\(`, as the
      authoritative cross-check for a ten-plan prose reconciliation -- catches a rename (a
      REMOVED line paired with a GAINED line for the same case) that a purely prose-based tally
      would double-count as a whole removal."

key-files:
  created: []
  modified:
    - src/mcp/vice/shipped-modules.ts
    - src/mcp/vice/shipped-modules.test.ts

key-decisions:
  - "Reconciled the whole phase's test-count drop against a git-diff-derived ground truth (every
    `test(` line removed or gained between the pre-phase baseline commit and this plan's own HEAD,
    per file) rather than trusting the sum of ten plans' own prose counts. The two methods agree
    exactly: 104 removed-name lines minus 4 renames (a removed line paired with a gained line for
    the same case) equals 100 net whole-case removals, matching the orchestrator-measured
    3753-to-3653 drop across plans 56-01 through 56-10 exactly."
  - "Reported the embedded-case count (100) and the removed test file's own case count (16) as two
    separate numbers throughout this SUMMARY, per success criterion 2's own wording, rather than a
    single combined total of 116 anywhere a reader could mistake for one measurement."

requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5]

coverage:
  - id: D1
    description: "shipped-modules.ts and shipped-modules.test.ts no longer exist. A
      repository-wide preflight grep confirmed zero remaining importers before removal. The
      same grep after removal confirmed zero mentions of the import specifier anywhere under
      src/mcp/vice."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "test -e src/mcp/vice/shipped-modules.ts (false), test -e
          src/mcp/vice/shipped-modules.test.ts (false)"
        status: pass
      - kind: unit
        ref: "grep -rac 'from \"./shipped-modules.ts\"' src/mcp/vice -- returns 0 matches"
        status: pass
      - kind: unit
        ref: "git show --name-status HEAD -- status D for both paths"
        status: pass
    human_judgment: false
  - id: D2
    description: "No real coverage was removed as collateral. The embedded-case count (100, across
      sixteen files, plans 56-01 through 56-10) and the whole-file test-removal count (16, this
      plan) are reported separately below, each backed by a per-file TAP name-set diff or a
      git-diff-derived verbatim name list."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "git diff 188ca931 HEAD -- <each of 16 files> | grep -cE '^[-+]\\s*test\\(' (this
          plan's reconciliation pass, see 'The reconciliation' below)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run test:automated is green (EXIT=0, fail 0, skipped 9, tests 3637) and npm
      run typecheck exits 0. The test-count drop (3753 to 3637, net 116) is stated and reconciled
      case by case against the verbatim name list below: 100 embedded removals + 16 whole-file-test
      removals = 116."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3637, pass 3628, fail 0,
          skipped 9"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck -- EXIT=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "No touched test file is left empty or setup-only. Every one of the sixteen
      surviving files reports at least one assert. call after the whole phase's cuts."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -ac 'assert\\.' across all 16 surviving files -- every count is non-zero
          (32 to 694 per file)"
        status: pass
    human_judgment: false
  - id: D5
    description: "anno-seam.test.ts's WR-25 behavioural case survives in the final TAP set,
      alongside the package.json files[] completeness case -- exactly the two D-07 survivor
      names, nothing else."
    requirement: SC-5
    verification:
      - kind: unit
        ref: "node --test --test-reporter=tap anno-seam.test.ts -- EXIT=0, two ok lines: the
          files[] case and 'WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY
          when neither a workspaceRoot nor the escape is supplied'"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 11: Remove shipped-modules.ts, run the phase gate, and reconcile the whole phase's test-count drop Summary

**Removed `shipped-modules.ts` and its 16-case test file with `git rm`, after confirming zero remaining importers. Reconciled all ten prior plans' embedded-case removals (100, verbatim, case by case) plus this plan's own whole-file removal (16) against the suite's measured 3753-to-3637 drop.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-15T11:20:00Z
- **Completed:** 2026-09-15T12:00:00Z
- **Tasks:** 3
- **Files modified:** 2 removed, 1 created (this SUMMARY)

## Accomplishments

- Ran a repository-wide preflight grep for the import specifier `from "./shipped-modules.ts"`
  across `src/mcp/vice`. Exactly one file still carried it -- `shipped-modules.test.ts`, the
  module's own test -- confirming every one of the sixteen regular test files had already lost
  its import across plans 56-01 through 56-10, per D-09's ordering constraint.
- Confirmed no `MANUAL_ONLY_TESTS` entry (`vice-broker-launch.test.ts`, `vice-proxy.test.ts`,
  `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`,
  `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`,
  `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`,
  `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`) imports the module -- these are
  excluded from `test:automated` and a broken import there would not otherwise have surfaced.
  `vice-proxy.test.ts` carries one comment-only mention (line 3488), the same D-13 stale mention
  the phase already accepted.
- Removed `src/mcp/vice/shipped-modules.ts` and `src/mcp/vice/shipped-modules.test.ts` with
  `git rm`, in one commit naming both paths explicitly. Neither file was truncated or emptied.
  `git show --name-status HEAD` shows status `D` for both.
- `npm run typecheck` exits 0 with the module gone.
- Ran the full automated suite once: `EXIT=0`, `tests 3637`, `pass 3628`, `fail 0`, `skipped 9`.
- Ran `node --test --test-reporter=tap anno-seam.test.ts`: exactly the two D-07 survivor names,
  one of which is the WR-25 behavioural refusal (success criterion 5).
- Confirmed every one of the sixteen surviving files reports at least one `assert.` call (32 to
  694 per file) -- none is empty or setup-only (success criterion 4).
- Confirmed the only remaining textual mentions of `shipped-modules` anywhere under
  `src/mcp/vice` are the two comment-only ones D-13 names: `vice-proxy.test.ts` (line 3488) and
  `hostpath-consumers.test.ts` (line 624, inside a doc comment referencing
  `withSyntheticPackage()`'s shape).
- Cross-checked all ten prior plans' prose-reported removal counts against a git-diff-derived
  ground truth (see "The reconciliation" below). The two methods agree exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm zero remaining importers, then git rm both files** - `c179b272` (test)
2. **Task 2: Run the phase gate and check all five success criteria** - no commit (pure
   verification and evidence-gathering. No file was changed)
3. **Task 3: Write the D-16 phase SUMMARY with every removed name verbatim** - this commit

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/mcp/vice/shipped-modules.ts` - removed with `git rm` (679 lines).
- `src/mcp/vice/shipped-modules.test.ts` - removed with `git rm` (449 lines, 16 cases, all of
  them testing the removed module).

## Decisions Made

See key-decisions in frontmatter: the git-diff-derived reconciliation method, and reporting the
two counts (embedded, whole-file) separately throughout.

## Deviations from Plan

None - plan executed exactly as written. The preflight grep found exactly the expected single
importer (the module's own test), confirming plans 56-01 through 56-10 all landed correctly.

---

## The two numbers this phase asked for (SC-2), reported separately

**Number one -- embedded cases removed across the sixteen surviving files (plans 56-01 through
56-10): 100.**

**Number two -- cases removed with the module's own test file (this plan): 16.**

These are never added together into one figure anywhere a reader could mistake for a single
measurement. Where a combined total is useful for the reconciliation below, it is always shown
as `100 + 16 = 116`, never as a bare `116`.

## One. Every removed case name, verbatim, grouped by file

Every name below is copied verbatim from the git history of the commit that removed it (cross-
checked against each plan's own SUMMARY). Each carries a one-line reason it qualified: its entire
subject was a scan of a module's own source text (via `codeOnly()`, a raw `readFileSync`, or an
equivalent helper), with no call to a real production function anywhere in the case body.

### `src/mcp/vice/prg-image.test.ts` (2, plan 56-01)
1. "prg-image.ts imports exactly one module, node:zlib, and nothing from this repo" -- import-
   specifier scan over the module's own stripped source.
2. "prg-image.ts performs no filesystem, subprocess or network I/O" -- forbidden-pattern regex
   scan over the module's own stripped source.

### `src/mcp/vice/anno-graphics.test.ts` (2, plan 56-01)
1. "a non-vacuous structural scan of anno-graphics.ts's own import list reaches none of the
   store, the join, the host-path modules or the emulator backend" -- banned-substring scan over
   the module's own stripped import list.
2. "the module header states the sprite-bitmap-out-of-scope boundary and the byte-datatype
   choice" -- two `assert.match` calls against a raw, unstripped `readFileSync` of the module's
   own source (found by the mandated blind-spot pass, not the scanner -- no doomed symbol in its
   chain).

### `src/mcp/vice/anno-types.test.ts` (1 removed whole, 1 stripped-and-renamed, plan 56-01)
1. "anno-types.ts declares no module-level mutable binding, and its import specifier set is
   exactly the four it needs" -- **removed whole.** Two scans over the module's own stripped
   source (mutable-state scan, import-specifier scan).
2. "SCHEMA_VERSION is 5, and the constant's own doc comment records the reaffirm-refusal decision
   by table name and by date -- the bump is a decision on the record, not a number that drifted"
   -- **stripped and renamed (D-02/D-03).** Removed seven `assert.match` calls against a raw
   `readFileSync` of the module's own doc comment. Kept `assert.equal(SCHEMA_VERSION, 5, ...)`
   byte-for-byte -- real production behaviour. Renamed to "SCHEMA_VERSION is 5 -- a deliberate
   one-way bump that strands every version 4 store, not a number that drifted" because the old
   name promised the now-stripped doc-comment half too.

### `src/mcp/vice/anno-seam.test.ts` (21, plan 56-02)
1. "node:sqlite is named by exactly one module of the shipped module set (STORE-07)" -- scan of
   every shipped module's source text for the specifier.
2. "planted violation, route (a): a single-line static import is reported by the same predicate
   the real scan uses" -- plants and scans a synthetic source string.
3. "planted violation, route (b): a multi-line static import whose keyword, binding and specifier
   land on different lines is reported" -- plants and scans a synthetic source string.
4. "planted violation, route (c): a dynamic import() is reported" -- plants and scans a synthetic
   source string.
5. "planted violation, route (d): process.getBuiltinModule -- the route a two-regex import
   detector cannot see -- is reported" -- plants and scans a synthetic source string.
6. "negative control: a source whose ONLY mention of the specifier is inside a // comment is NOT
   reported" -- plants and scans a synthetic source string.
7. "non-vacuity: the scanned shipped module set is non-empty and contains all three new modules"
   -- asserts over the doomed module's `shippedTsModules()` scan result.
8. "the seam never touches SQLite's extension-loading surface" -- scans the seam's own stripped
   source for forbidden identifiers.
9. "the seam declares no module-level mutable binding, including a const bound to a mutable
   container" -- scans the seam's own stripped source line-by-line.
10. "no shipped module other than the seam names ANY of the declared seam-private exports" --
    scans every other shipped module's source for leaked export names.
11. "the seam-private export scan is NON-VACUOUS over the code this area added: all three staging
    transitions are present in the seam's own stripped source" -- scans the seam's own stripped
    source.
12. "idempotency: re-running the scan over an unchanged tree yields the identical one-element
    importer list" -- re-invokes the doomed-module-backed scan three times.
13. "the revision compare-and-swap is structurally intact: begin immediate, an UPDATE guarded on
    the current revision, and a changes count that must equal 1" -- scans the seam's own stripped
    source for SQL literal fragments.
14. "the seam contains exactly one commit statement, so the single planted-violation site is
    unique" -- scans the seam's own stripped source via the doomed-module-backed commit matcher.
15. "the commit-statement matcher counts all six of SQLite's spellings, so neither a synonym nor a
    trailing semicolon can hide a second commit site" -- asserts over local fixture source-text
    strings.
16. "the commit-statement matcher counts a commit sharing an exec() with a preceding statement,
    which the whole-literal matcher counted as zero" -- asserts over a fixture source-text string.
17. "the commit-statement matcher counts neither commit-ish identifiers, nor an exec() taking a
    bare identifier, nor user-facing prose about a commit (28-18 P1)" -- asserts over a fixture
    source-text string.
18. "node:sqlite is bounded in the TEST tree too: the set of test files naming it is a DECLARED
    list" -- scans every test file's source text for the specifier.
19. "non-vacuity of the test-tree scan: a planted test file naming the specifier IS reported by
    the same predicate" -- plants and scans synthetic source strings.
20. "WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at
    its enumerated module-derived opens" -- scans the seam's own stripped source (call-site
    count) and every other shipped module's source (leak scan).
21. "WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped
    source still contains openStore" -- scans the seam's own stripped source for a symbol.

**Kept (2, byte-identical, D-07, success criterion 5):** "package.json files[] ships every
anno-* production module on disk and no anno-prefixed test file or test-only helper" (reads
`package.json` as JSON and a directory listing, never scans source text) and "WR-25: the guard
itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is
supplied" (the file's only behavioural case, asserted through `openStore`'s real entry point).

### `src/mcp/vice/block-class.test.ts` (2, plan 56-03)
1. "block-class.ts imports nothing census-side, disassembler-side, transport-side or
   path-translation-side" -- import-specifier scan plus a dynamic-import regex scan over the
   module's own source.
2. "block-class.ts declares no module-level mutable binding, including a const mutable
   container" -- line-by-line scan of the module's own stripped source.

### `src/mcp/vice/anno-join.test.ts` (1, plan 56-03)
1. "the join's module graph (anno-join.ts, memmap-lookup.ts, anno-import.ts) imports nothing
   under the skills tree, spawns no child process, and references no queue module" -- scan of
   five modules' own stripped source, reached through the `importSpecifiers()` helper.

### `src/mcp/vice/anno-overlap.test.ts` (1, plan 56-03)
1. "adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the
   store's code" -- stripped scan of `anno-store.ts`'s own source for three forbidden
   substrings.

### `src/mcp/vice/capture-predicate.test.ts` (2, plan 56-04)
1. "neither module imports anything but node builtins -- no path-translation seam, and not each
   other" -- import-specifier scan of both modules' own source, reached through the
   `moduleSpecifiers()` helper.
2. "no exported function in either module takes a filesystem path -- every one takes bytes,
   scalars or a parsed value" -- exported-function-signature scan of the same two modules' own
   source.

### `src/mcp/vice/evid-report-keys.test.ts` (2, plan 56-04)
1. "direction 4 (no runtime data branch), clean control: RuntimeExecClass has exactly two
   members, and no scanned evidence-family module assigns a runtime literal outside it" -- scan
   of `anno-types.ts` and every `evid-*.ts` module's own source for a union declaration and any
   literal outside it.
2. "direction 4 (no runtime data branch), planted control: a synthetic source string declaring a
   three-member runtime union fails the cardinality check by name" -- fed a SYNTHETIC source
   string through the same cardinality-check helper as its sibling.

### `src/mcp/vice/anno-index.test.ts` (3, plan 56-05)
1. "the linear-scan oracle shares no code path with the production paint index" -- stripped scan
   of `anno-index.test.ts`'s OWN source (not a production module) for four forbidden production
   identifiers.
2. "anno-index.ts declares no module-level mutable binding, including a const bound to a mutable
   container" -- stripped scan of `anno-index.ts`'s own source via the `indexSource()` helper.
3. "anno-index.ts imports from exactly one module, anno-types.ts, and uses no dynamic import" --
   import-specifier scan plus a dynamic-import shape scan, both via `indexSource()`.

### `src/mcp/vice/vsf-slice.test.ts` (4, plan 56-05)
1. "vsf-slice.ts imports nothing from this repo -- only node: builtins, and only in the CLI
   region" -- import-specifier scan of the whole file and the library region, via
   `libraryRegion()`.
2. "vsf-slice.ts's LIBRARY region performs no filesystem, subprocess or network I/O" -- stripped
   scan of the library region for five forbidden-call-shape regexes.
3. "the CLI entry point is guarded: main() is only reachable behind the entry-point check" --
   scan of the whole file's source for `process.exit(` call-site count and two structural regex
   matches.
4. "no exported function takes a filesystem path -- both take a byte array" -- scan of the whole
   file's source for `export function` signatures against a pinned two-entry array.

### `src/mcp/vice/stock-dispatch.test.ts` (15 removed whole, 2 stripped-and-renamed, plan 56-06)
1. "structure/proxy: vice-proxy.ts has exactly one dispatchStock CALL SITE" -- text scan of
   `vice-proxy.ts`'s own stripped source via `VICE_PROXY_SOURCE`.
2. "structure/proxy: vice-proxy.ts's dispatchStock call site passes ensureBrokerLease as its
   LeaseProvider" -- same source-constant scan.
3. "structure/proxy: vice-proxy.ts references manifestPathForBackend exactly once" -- same
   source-constant scan.
4. "structure/proxy: vice-proxy.ts's ensureBrokerLease has at least two lease-bearing success
   returns" -- same source-constant scan.
5. "structure/proxy: no code line in vice-proxy.ts pairs \"stock\" with \"forwardToVice\"" -- same
   source-constant scan.
6. "structure/proxy (CR-07): every registered tool whose runner can touch a transport reaches
   dispatchStock, directly or via handleRecycle()/handleDiagnose()" -- scan via
   `proxyToolRegistrations()`.
7. "structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations
   bypassing dispatchStock entirely are vice_result_continue and the anno_* family" -- scan via
   `proxyToolRegistrations()`.
8. "structure/proxy (CR-07): vice_result_continue's runner is handleResultContinue, whose body
   touches no transport at all" -- scan via `reachesDispatchStock()`.
9. "structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose
   body touches no VICE transport at all" -- scan via `reachesDispatchStock()`.
10. "structure/proxy (CR-07): handleRecycle() and handleDiagnose() each delegate to
    dispatchStockFor(), with no per-backend branch left to route around" -- text scan of
    `vice-proxy.ts`'s own source.
11. "structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one
    registration, via buildViceTool() directly" -- text scan of `vice-proxy.ts`'s own source.
12. "structure/proxy: vice-proxy.ts CALLS resolvedBackend() exactly once" -- text scan of
    `vice-proxy.ts`'s own source.
13. "structure/proxy (CR-06): buildHeldLease() threads epochFile and supervisorDir, from
    activeInstance() and brokerRootDir() respectively" -- text scan via `VICE_PROXY_SOURCE`.
14. "structure: stock-dispatch.ts contains zero CODE references to the fork-forwarding function's
    name, pairing the vice-proxy.ts structural assertion above with this module's own" -- a raw
    `readFileSync` of `stock-dispatch.ts`'s own source (found only by the mandated blind-spot
    pass -- no doomed symbol in its chain).
15. "invariant (WR-13): no shipped module hardcodes a fork-provides refusal claim" -- enumerates
    every shipped module via `shippedTsModules()` and reads each as text.
16. **Stripped and renamed (D-02/D-03).** "WR-06: vice-proxy.ts strips the WHATWG bracket form
    when deriving the dial host, so an IPv6 URL is usable by net.connect()" -- removed a trailing
    `buildHeldLease()` source-text slice. Kept three WHATWG URL parser assertions byte-for-byte.
    Renamed to "WR-06: the WHATWG URL parser keeps IPv6 brackets in .hostname, and the same strip
    expression removes them while leaving an IPv4 host unaffected".
17. **Renamed only, body untouched (D-03).** "structure/proxy (plan 29-01): every curated anno_*
    name is absent from tools-manifest.stock.json" -- reads a JSON manifest plus an imported
    production array (`CURATED_ANNO_TOOLS`), never source text. Kept byte-identical. Renamed to
    "anno_* curation (plan 29-01): every curated anno_* name is absent from
    tools-manifest.stock.json" only to drop the misleading "structure/proxy" prefix.

### `src/mcp/vice/anno-store.test.ts` (12 removed whole, 1 stripped-and-renamed, plan 56-07)
1. **Stripped and renamed (D-02/D-03).** "the reserved bank field is never INTERPRETED: every
   list function returns bank null, and no line of the seam's own code branches on or computes
   with a bank value" -- removed the structural half (a `codeOnly()` scan of the seam's own
   source). Kept four real list-function bank-null assertions byte-for-byte. Renamed to "the
   reserved bank field is never INTERPRETED: every list function returns bank null for every row
   it lists".
2. "WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its
   cleanups route through discardSnapshot rather than a bare rmSync" -- scan of `anno-store.ts`'s
   own stripped source.
3. "STORE-02 non-vacuity: the code this gap closure adds is inside the source the no-splitter
   structural scan reads" -- scan of `anno-store.ts`'s own stripped source.
4. "the prune's SOURCE ORDER is the guarantee: inside pruneSnapshots the pointer-row delete
   precedes the unlink, asserted over the module's own stripped source" -- scan of
   `anno-store.ts`'s own stripped source.
5. "the sweep's SOURCE ORDER is the guarantee too: inside reconcileSnapshotRing there is NO
   pointer-row delete at all, and the commit precedes the unlink" -- scan of `anno-store.ts`'s own
   stripped source.
6. "the publish path's SOURCE ORDER is the durability guarantee (WR-13): stageSnapshot fsyncs
   after its vacuum, and publishSnapshot fsyncs the ring directory after its rename" -- scan of
   `anno-store.ts`'s own stripped source.
7. "WR-11, STRUCTURAL: the CAS-failure refusal carries BOTH revisions, and reads the second one
   BEFORE the rollback" -- scan of `anno-store.ts`'s own stripped source.
8. "WR-02 and WR-04, STRUCTURAL: the two remaining unguarded calls are inside handlers" -- scan of
   `anno-store.ts`'s own stripped source.
9. "revertTo step 6, STRUCTURAL BACKSTOP: the sweep call sits inside a handler, so a future edit
   that reintroduces a throw cannot cost the caller a handle" -- scan of `anno-store.ts`'s own
   stripped source.
10. "WR-17, STRUCTURAL: every openStore AFTER the rename in revertTo is inside a handler, and the
    reopen failure reports a revert that LANDED ON DISK" -- scan of `anno-store.ts`'s own stripped
    source.
11. "WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call
    site rather than discarded" -- scan of `anno-store.ts`'s own stripped source.
12. "WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a
    reported rollback failure is not handed back as a clean handle" -- scan of `anno-store.ts`'s
    own stripped source.
13. "D-15: the schema_version refusal is a SINGLE WITNESS -- exactly one comparison site, inside
    openStore, with no second write of anno_meta.schema_version and no migration entry point
    anywhere in the module" -- scan of `anno-store.ts`'s own stripped source.

**D-02 exemption, no rename needed (56-07):** "CR-08: a retained snapshot TRUNCATED to zero
bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still
answers, and a later openStore succeeds" -- removed its trailing source-order slice (three
string-landmark orderings inside `revertTo`'s stripped body). Kept its behavioural half (a real
store at revision 3, a truncated snapshot, a by-name refusal, an intact live store, a successful
fresh open) byte-for-byte through the closing brace. The surviving name already described only
the kept half, so no rename was needed.

### `src/mcp/vice/anno-export-asm.test.ts` (11, plan 56-08)
1. "the fixture generator's ACME probe ladder matches the gate's (30-REVIEW IN-04)" -- found only
   by the mandated blind-spot pass (zero doomed-symbol reference). Reads `acme-gate.ts` AND
   `make-export-asm-fixtures.mjs` as text.
2. "the exporter hands decode() the INCLUSIVE bound (30-REVIEW WR-07)" -- a single
   `readFileSync` + `assert.match` against the exporter's own source.
3. "STRUCTURAL SCAN, all three directions: the exporter imports the prefix regex, a planted
   five-prefix copy is reported, and a comment-only mention is NOT" -- reads
   `anno-export-asm.ts` via `readFileSync`/`stripComments` and scans for a restated prefix regex.
4. "the filtering variant's identifier never reaches anno-export-asm.ts's own shipped source" --
   scan via `blockConstructionSlice`.
5. "guard non-vacuity: codeOnly()'s own extraction of anno-export-asm.ts is non-empty and
   strictly shorter than the raw source" -- scan via `blockConstructionSlice`.
6. "STRUCTURAL GUARD (BUILD-07): the block array is built 1:1 from the sorted range list, with no
   filter and no provenance-field conditional" -- scan via `blockConstructionSlice`.
7. "guard non-vacuity: pinsUnconditionalBlockMap fires when the block shape drifts from the
   pinned form" -- scan via `blockConstructionSlice`.
8. "guard non-vacuity: hasRangeListFilter fires when a .filter() is inserted before the block
   .map()" -- scan via `blockConstructionSlice`.
9. "guard non-vacuity: hasBlockListFilter fires when a .filter() is chained after the block
   .map()" -- scan via `blockConstructionSlice`.
10. "guard non-vacuity: referencesProvenanceField fires when a provenance field name is inserted
    into the slice" -- scan via `blockConstructionSlice`.
11. "anno-export-asm.ts imports nothing from node:child_process -- the exporter provably runs no
    external program" -- `readFileSync` + `codeOnly` scan for an absence.

**Three confirmed false positives, left byte-identical (56-08):** "the auto-name prefix set is
parsed from AUTO_NAME_PREFIX_RE's own alternation" (inspects an imported RegExp's own `.source`
property -- a runtime value, not file text), "every one of the parsed prefixes round-trips as a
label name" (real `exportAsm()` + ACME round trip, zero file reads), "ROUND TRIP: the ALIASED
store still reassembles byte-identically" (real `exportAsm()` + `verifyExport()` round trip, zero
file reads).

### `src/mcp/vice/anno-coverage.test.ts` (16, plan 56-09)
1. "derived agreement: every member of the store's label-kind vocabulary appears as a literal in
   the census's source" -- a `reportFor`-driven loop whose selection target is itself derived
   from the same source-text partition the case's name promises to prove (production call is
   scaffolding for the text claim, not an independent proof -- D-02's own worked warning).
2. "SUPPLEMENT (not the proof): the census module's source carries no production block-type
   literal" -- pure source-text absence confirmation.
3. "SUPPLEMENT (WR-12): no shipped module passes CoverageOptions.blockClassifier" -- pure
   source-text absence confirmation.
4. "the declared shape count equals the number of true-returning sites in
   hasDispatchContext()'s own source" -- found only by the mandated blind-spot pass. Counts
   occurrences in `anno-coverage.ts`'s own stripped source.
5. "functionBodyFromSource() THROWS naming the signature when the function it is asked for does
   not exist" -- a self-test of the doomed local helper itself.
6. "EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely
   the window" -- counts/orders occurrences in the module's own stripped source.
7. "PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult
   the shared gate" -- counts occurrences in the module's own stripped source.
8. "PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the
   sites total the route count" -- counts occurrences in the module's own stripped source.
9. "PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes
   into one of them" -- counts occurrences in the module's own stripped source.
10. "PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call
    precedes it" -- orders occurrences in the module's own stripped source.
11. "PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three
    sites" -- counts occurrences in the module's own stripped source.
12. "PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate --
    and nothing else" -- counts occurrences in the module's own stripped source.
13. "PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the
    predicate" -- counts occurrences in the module's own stripped source.
14. "PIN 8: the descent consults the predicate BEFORE the loop that marks class zero" -- orders
    occurrences in the module's own stripped source.
15. "the coverage module contains no file-write call, no project-save call and no live-session
    import" -- pure source-text absence confirmation.
16. "CR-05 (F, one decode two callers): anno-cli.ts's cross-reference byte source delegates to
    this loader rather than re-parsing" -- reads a SIBLING module, `anno-cli.ts`, as text.

**One confirmed false positive, left byte-identical (56-09):** "the witness is PURE over its four
arguments: two calls on one payload return the same answer" -- pure idempotency confirmation
against a local test witness, zero source-text reference anywhere in its body.

### `src/mcp/vice/anno-derive.test.ts` (5, plan 56-10)
1. "STORE-06 never-cached control: the derivation modules' stripped source carries no SQL write
   verb" -- regex scan over the modules' own stripped source.
2. "STORE-06 never-cached control: the derivation modules name no filesystem write call and no
   SQLite binding" -- substring scan over the same stripped source.
3. "MCP-02: the derivation modules import none of the three host-path seam modules" -- substring
   scan over the same stripped source for three banned import specifiers.
4. "STORE-06 never-cached control: the tree's SQL write sites are exactly the named expected set"
   -- a directory-wide census of SQL-write-verb regex matches against a named expected set.
5. "STORE-06 never-cached control: the census can actually SEE a planted write site" -- a
   non-vacuity self-test of the census's own regex/helper pair against a hand-planted source
   string.

### `src/mcp/vice/shipped-modules.test.ts` (16, this plan -- whole-file removal, D-09)
Every one of this file's sixteen cases tested the removed module itself (`codeOnly`,
`shippedTsModules`, and their supporting helpers). With the module gone, the whole file went with
it under D-09. These sixteen are the "whole-file test" number reported separately from the 100
embedded removals above -- they are not double-counted into that figure anywhere in this
SUMMARY.

## Two. Every D-03 rename, old name and new name, one line on what the case now proves

1. **anno-types.test.ts (56-01).** Old: "SCHEMA_VERSION is 5, and the constant's own doc comment
   records the reaffirm-refusal decision by table name and by date -- the bump is a decision on
   the record, not a number that drifted." New: "SCHEMA_VERSION is 5 -- a deliberate one-way bump
   that strands every version 4 store, not a number that drifted." Now proves only that the real
   exported constant equals 5. The doc-comment text claim is gone.
2. **anno-store.test.ts (56-07).** Old: "the reserved bank field is never INTERPRETED: every list
   function returns bank null, and no line of the seam's own code branches on or computes with a
   bank value." New: "the reserved bank field is never INTERPRETED: every list function returns
   bank null for every row it lists." Now proves only the four real list-function assertions. The
   structural source-scan half is gone.
3. **stock-dispatch.test.ts (56-06).** Old: "WR-06: vice-proxy.ts strips the WHATWG bracket form
   when deriving the dial host, so an IPv6 URL is usable by net.connect()." New: "WR-06: the
   WHATWG URL parser keeps IPv6 brackets in .hostname, and the same strip expression removes them
   while leaving an IPv4 host unaffected." Now proves only the three real WHATWG URL parser
   assertions. The `buildHeldLease()` source-text slice is gone.
4. **stock-dispatch.test.ts (56-06).** Old: "structure/proxy (plan 29-01): every curated anno_*
   name is absent from tools-manifest.stock.json." New: "anno_* curation (plan 29-01): every
   curated anno_* name is absent from tools-manifest.stock.json." Body untouched -- this rename
   drops only the misleading "structure/proxy" prefix from a case that was never a source-text
   scan (it reads a JSON manifest plus an imported production array).

## Three. Every D-02 exemption, the case and the assertions that survived

1. **anno-types.test.ts's SCHEMA_VERSION case (56-01).** Survived:
   `assert.equal(SCHEMA_VERSION, 5, ...)` against the real exported constant.
2. **anno-store.test.ts's "reserved bank field" case (56-07).** Survived: four assertions that
   every list function's returned rows carry `bank: null`, proven by writing rows across all four
   bank-carrying tables through a real store and reading them back.
3. **anno-store.test.ts's CR-08 "truncated to zero bytes" case (56-07, no rename needed).**
   Survived: a real store at revision 3, a truncated snapshot, a by-name refusal
   (`assertRefusedRevertLeftEverythingIntact`) naming both paths, the live store byte-identical
   afterward, and a successful fresh `openStore`.
4. **stock-dispatch.test.ts's WR-06 case (56-06).** Survived: three WHATWG URL parser assertions
   -- that `.hostname` keeps IPv6 brackets, that the dial-host strip expression removes them, and
   that an IPv4 host is unaffected by the same expression.

## Four. Every candidate a hand-read CLEARED, and why the attribution was a false positive

These are as load-bearing as the removals above -- they are the record that the cut was not
over-broad. Each was suspected (by the D-14 scanner's line-proximity attribution, or by a plan's
own named-candidate list) and hand-read at its own paren-matched boundary before being left
completely untouched.

1. **stock-dispatch.test.ts, "dispatch: no handler in the table ever throws -- dispatchStock
   always resolves to a well-formed {content,isError} result" (56-06).** The plan described it
   as reading a source constant while also calling `dispatchStock` for real. Hand-read: the
   entire body loops three literal tool names through a real `dispatchStock()` call with zero
   source-text assertion anywhere. Not a source-scanning case at all.
2. **stock-dispatch.test.ts, "WR-06: a non-connect handshake failure keeps the plain wording"
   (56-06).** The D-14 scanner reported a "direct" hit at this case's own boundary. Hand-read: no
   doomed-symbol text anywhere inside that boundary -- an upstream paren-matching artifact (this
   file's regex-dense assertions corrupted the scanner's own depth-counting) attributed a
   distant real hit to the wrong call.
3. **anno-join.test.ts, "the structural proof's non-vacuity assertion is itself non-vacuous..."
   (56-03).** Sits immediately after a removed case and its own prose references that case's
   `SCANNED_MODULES` constant by name. Hand-read: its entire body operates on a hardcoded empty
   array literal to hand-confirm a property of the removed case's own guard logic -- never reads
   any module's source text.
4. **anno-export-asm.test.ts, "the auto-name prefix set is parsed from AUTO_NAME_PREFIX_RE's own
   alternation" (56-08).** The plan flagged it as parsing "a regex out of the exporter's source
   text." Hand-read: its only source is `AUTO_NAME_PREFIX_RE.source` -- the imported REGEX
   OBJECT'S OWN pattern property, a runtime value, never a file read via `readFileSync`.
5. **anno-export-asm.test.ts, "every one of the parsed prefixes round-trips as a label name"
   (56-08).** The plan flagged it as "genuinely mixed." Hand-read: builds a real store, calls
   `exportAsm()`, and round-trips the result through real ACME -- zero file reads anywhere in its
   body.
6. **anno-export-asm.test.ts, "ROUND TRIP: the ALIASED store still reassembles byte-identically"
   (56-08).** The plan's own contingency text anticipated this might resolve either way.
   Hand-read: a genuine `exportAsm()` + `verifyExport()` round trip with zero file reads.
7. **anno-coverage.test.ts, "the witness is PURE over its four arguments: two calls on one
   payload return the same answer" (56-09).** The plan named it as needing a D-02 hand judgement.
   Hand-read: calls `reachesGateInterior` (a local test witness using the real `decode()`
   function) twice on identical inputs and asserts the results are equal -- pure idempotency,
   zero source-text reference anywhere.

**Also confirmed out of scope by the cut_rule's own JSON-data-file exclusion** (read
`package.json` via `readFileSync`, but parsed as JSON, never scanned as source text -- not
counted above since none was ever a scanner or line-proximity candidate): the files[]-inclusion
case in `block-class.test.ts` (56-03), the files[]-completeness case surviving in
`anno-seam.test.ts` (56-02, listed in section One's "Kept" note), the files[]-absence case in
`anno-export-asm.test.ts` (56-08), and the files[]-exclusion case surviving in
`evid-report-keys.test.ts` and `capture-predicate.test.ts` (56-04).

## Five. The two numbers, once more, for a reader who skips straight to this section

- **Embedded cases removed across the sixteen surviving files (56-01 through 56-10): 100.**
- **Cases removed with the module's own test file, `shipped-modules.test.ts` (this plan): 16.**
- These are two separate measurements. Their sum, `116`, appears only inside the reconciliation
  in section Six, never as a number presented on its own.

## Six. The reconciliation

The suite's measured test-count drop across the whole phase is **3753 to 3637, a net decrease of
116.**

That is reconciled against the verbatim name list above as follows:

| Stage | Tests | Net drop | Source |
|---|---|---|---|
| Pre-phase baseline | 3753 | -- | orchestrator-measured, before any Phase 56 edit |
| After 56-01 | 3748 | -5 | 2 (prg-image) + 2 (anno-graphics) + 1 (anno-types whole) = 5 |
| After 56-02 | 3727 | -21 | anno-seam.test.ts, all 21 |
| After 56-03 | 3723 | -4 | 2 (block-class) + 1 (anno-join) + 1 (anno-overlap) |
| After 56-04 | 3719 | -4 | 2 (capture-predicate) + 2 (evid-report-keys) |
| After 56-05 | 3712 | -7 | 3 (anno-index) + 4 (vsf-slice) |
| After 56-06 | 3697 | -15 | stock-dispatch.test.ts, 15 whole (2 more renamed, net-neutral on count) |
| After 56-07 | 3685 | -12 | anno-store.test.ts, 12 whole (1 more renamed, net-neutral on count) |
| After 56-08 | 3674 | -11 | anno-export-asm.test.ts, all 11 |
| After 56-09 | 3658 | -16 | anno-coverage.test.ts, all 16 |
| After 56-10 | 3653 | -5 | anno-derive.test.ts, all 5 |
| **After this plan (56-11)** | **3637** | **-16** | **shipped-modules.test.ts, all 16, whole-file** |

Column sum of the per-plan drops: 5+21+4+4+7+15+12+11+16+5 = **100** (embedded, plans 56-01
through 56-10), plus **16** (this plan's whole-file removal) = **116**, matching the measured
3753-to-3637 drop exactly.

**Independent cross-check.** This plan additionally re-derived the removal list directly from
git history rather than trusting the sum of ten plans' own prose: `git diff 188ca931 HEAD --
<file>` (188ca931 is the commit immediately before 56-01's first test commit) filtered to lines
matching `^[-+]\s*test\(`, for each of the sixteen surviving files. That comparison found 104
removed-name lines and 4 gained-name lines. The 4 gained lines pair exactly with 4 of the 104
removed lines as renames (the two `anno-types.test.ts`/`anno-store.test.ts` D-02/D-03 renames and
the two `stock-dispatch.test.ts` renames listed in section Two) -- so net whole-case removals are
`104 - 4 = 100`, agreeing with the per-plan sum exactly. No discrepancy was found. Both methods
agree, and the total reconciles against the measured suite drop.

## Seven. The five repaired production modules from plan 56-10

Plan 56-10 repaired thirteen now-false "asserted by `anno-seam.test.ts`" / "asserted by
`capture-predicate.test.ts`" enforcement credits across five named production modules -- the
credited test cases had already been removed by earlier plans in this phase, leaving each
constraint sentence true but its citation false. Every constraint itself was kept. Only the
now-false credit clause was dropped.

- **`src/mcp/vice/anno-store.ts` (8 clauses):** the header "WHY THIS FILE EXISTS" paragraph, the
  SQLite-extension trap, the module-derived-path confinement note, the `SNAPSHOT_FILE_PATTERN`
  docstring, the single-commit-site comment, `applyWriteWithoutCommit`'s doc comment (both
  mentions), and a historical note's test-file citation (trimmed, not removed as a constraint --
  the note already stated its old control was superseded).
- **`src/mcp/vice/dxa-blocks.ts` (1 clause):** reworded to state the same constraint without
  naming the removed test file.
- **`src/mcp/vice/evid-ingest.ts` (1 clause):** dropped the credit. Kept the constraint.
- **`src/mcp/vice/memmap-lookup.ts` (1 clause):** same rewording as `dxa-blocks.ts`.
- **`src/mcp/vice/capture-predicate.ts` (2 clauses):** the NO-filesystem/NO-network claim's
  credit, and the filesystem-PATH-parameter trap's credit.

## Eight. What is left stale on purpose, and the accepted gap

- **D-13 (stale on purpose).** Two files still name the removed module in a comment with no
  import: `vice-proxy.test.ts` line 3488 ("the npm-published shipped-module subset
  shipped-modules.ts derives from") and `hostpath-consumers.test.ts` line 624 (a doc comment
  referencing `shipped-modules.test.ts`'s own `withSyntheticPackage()` shape). Neither is an
  import. Both stay stale on purpose. The six `.planning/codebase/*.md` maps that cite the
  removed scanners also stay stale -- they are regenerated by the codebase-mapping command, not
  by this phase.
- **D-12 (accepted gap).** A stale enforcement claim outside D-11's five named modules may
  survive. Plan 56-10's own extra finds (the eight-vs-four and two-vs-one occurrence counts) were
  all INSIDE the five named modules, so D-12 was never invoked by this phase -- it remains an
  accepted, bounded possibility rather than a confirmed instance.

## Nine. What is now deliberately untested as a side effect

Following the precedent of the two rounds that preceded this phase (quick tasks
`260914-poo`/`260914-uhm`, which deleted 43 non-qualifying tests, `module-classification.ts`,
`capture-seam.test.ts` and `textmon-seam.test.ts`), the modules those rounds already left
untested keep that status unchanged by this phase. `shipped-modules.ts` itself joins that list by
being removed: its behavior (comment/string-masking source scanning, `shippedTsModules()`
enumeration) is no longer exercised by any test anywhere in the repository, because the module
that behavior belonged to no longer exists. This is the expected, designed outcome of this
phase's whole net effect being deletion -- not a coverage regression to repair.

## Issues Encountered

None. The preflight grep, both removals, the full gate, and the anno-seam.test.ts TAP check all
matched the plan's own stated expectations exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 56 is complete. All five success criteria (SC-1 through SC-5) have a recorded verdict
backed by a measured artifact in this SUMMARY. `npm run test:automated` is green (`fail 0`,
`skipped 9`, `tests 3637`) and `npm run typecheck` exits 0. `requirements.ready-ids` should now
report SC-1 through SC-5 as ready to mark complete -- this is the last plan of the phase, so no
sibling plan is still declaring any of them.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Plan: 11*
*Completed: 2026-09-15*

## Self-Check: PASSED

- CONFIRMED: `src/mcp/vice/shipped-modules.ts` does not exist on disk.
- CONFIRMED: `src/mcp/vice/shipped-modules.test.ts` does not exist on disk.
- FOUND commit `c179b272` (Task 1) -- `git log --oneline --all | grep c179b272` returns it, and
  `git show --name-status c179b272` shows status `D` for both removed paths.
- Every task's `<acceptance_criteria>` re-verified against the current tree: `module_exists=no`,
  `test_exists=no`, `importers=0`, `untouchable_staged=0`, `npm run typecheck` EXIT=0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`,
  `tests 3637`. `node --test --test-reporter=tap anno-seam.test.ts` reports exactly the two D-07
  survivor names. `grep -rl 'shipped-modules' src/mcp/vice --include='*.ts' --include='*.mts'
  --include='*.mjs'` names only `vice-proxy.test.ts` and `hostpath-consumers.test.ts`.
- `git status --porcelain` confirms the eight pre-existing unrelated paths (`.claude/settings.json`,
  `src/mcp/vice/anno-bank.ts`, `src/mcp/vice/anno-coverage.ts`, `src/mcp/vice/anno-enum-gen.ts`,
  `src/mcp/vice/anno-tools.ts`, `docs/dissambler-workflow.md`, `docs/vice-mcp-ideas.md`,
  `setup-claude-ste100.sh`) remain untouched and unstaged throughout this plan.
