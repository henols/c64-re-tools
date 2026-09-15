---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 07
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over
      anno-store.test.ts)."
provides:
  - "One more of the seventeen files that imported shipped-modules.ts no longer does:
    anno-store.test.ts -- the largest single file in the phase (5,595 lines), and the one
    holding both of the phase's measured genuinely-mixed cases."
  - "The verbatim twelve-case removed-case-name list, plus one D-03 rename and one D-02
    strip-in-place with no rename, for this plan's share of D-16's SUMMARY deliverable."
affects: [56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 12975
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used three times in this
      plan (once per task): 6 lost / 1 gained, 4 lost / 0 gained, 3 lost / 0 gained -- every
      change matched the task's own recorded intent, zero unexpected loss or gain."
    - "D-02's exemption test applied to two genuinely mixed cases in the same file, with two
      different outcomes: the 'reserved bank field' case (Task 1) lost its behavioural half's
      NAME along with its structural half, so D-03 forced a rename. The CR-08 truncated-snapshot
      case (Task 2) did not need one. Its surviving name already described only the behavioural
      half PATTERNS.md had already measured -- no rename needed, confirmed by re-reading the
      surviving name after the strip."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "The 'reserved bank field is never INTERPRETED' case's original name promised two things --
    that every list function returns bank null, AND that no line of the seam's own code branches
    on or computes with a bank value. Removing the second (structural) half under D-02/D-03 left
    only the first provable, so the surviving name was rewritten to drop the second clause
    entirely rather than keep a promise the surviving assertions no longer support."
  - "CR-08's boundary matched PATTERNS.md's citation exactly: keep lines through the fresh-reopen
    block (a real store, a truncated snapshot, a by-name refusal naming both paths, an intact
    live store, and a successful fresh openStore), remove the tail beginning at the 'AND THE
    SOURCE ORDER, ASSERTED HERE RATHER THAN AS ITS OWN TEST' boundary comment, which slices
    revertTo's body out of stripped source and asserts three string-landmark orderings inside it."
  - "All twelve whole removals in this plan share one shape confirmed by hand-read before
    removal: each calls codeOnly(readFileSync(...)) against anno-store.ts's own source and
    asserts on the extracted text (a landmark's presence, its position relative to another
    landmark, or an absence), with no call to any real store function anywhere in the case body.
    None of the twelve needed the D-02 exemption test to reach a verdict -- each failed it
    trivially by having no production-behaviour assertion to retain."
  - "Both mandated whole-file blind-spot passes found nothing beyond the plan's own fourteen-hit
    scanner list. Pass one searched for a raw readFileSync of a sibling .ts or .mts outside the
    codeOnly wrapper, and for module-scope *_SOURCE constants. Pass two skimmed every case name
    for STRUCTURAL, SOURCE ORDER, non-vacuity, imports nothing, and declares no module-level. No
    helper function or module-scope constant was orphaned by this plan's removals -- the twelve
    removed cases called codeOnly() and readFileSync() directly, with no shared local helper
    between them."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "Region A (Task 1, lines 865-2640 pre-cut): five whole source-scanning cases
      (WR-24 STRUCTURAL, STORE-02 non-vacuity, and the prune/sweep/publish-path SOURCE ORDER
      cases) removed under D-01. The 'reserved bank field' mixed case is stripped of its
      structural half under D-02/D-03 -- keeping its four list-function bank-null assertions
      byte-for-byte -- and renamed to state only what it now proves."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "anno-store.test.ts (TAP name-set diff, /tmp/56-07-t1-lost.txt / -gained.txt --
          lost 6, gained 1, all recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Region B (Task 2, lines 3060-3980 pre-cut): four whole structural cases (WR-11,
      WR-02/WR-04, revertTo step 6 STRUCTURAL BACKSTOP, WR-17) removed under D-01. CR-08's
      trailing source-order slice is stripped under D-02/D-03. Its behavioural half (truncated
      snapshot refused by name, live store byte-identical, caller's handle still answers, a later
      openStore succeeds) survives byte-for-byte under its original name -- no rename needed."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "anno-store.test.ts (TAP name-set diff, /tmp/56-07-t2-lost.txt / -gained.txt --
          lost 4, gained 0, all recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "Region C (Task 3): the two WR-18 STRUCTURAL binding assertions and the D-15 'SINGLE
      WITNESS' case removed whole under D-01. The genuinely behavioural D-15 case (opens a real
      SCHEMA_VERSION 2 fixture through openStore(), asserts the refusal and the byte-identical
      file) survives untouched. Both mandated blind-spot passes found no further candidate. The
      now-unused `import { codeOnly } from \"./shipped-modules.ts\"` is removed -- the file's
      last reference to the doomed module."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "anno-store.test.ts (TAP name-set diff, /tmp/56-07-t3-lost.txt / -gained.txt --
          lost 3, gained 0, both recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3685, pass 3676, fail 0,
          skipped 9"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno-store.test.ts is neither empty nor setup-only after the cut: it lost
      exactly twelve case names net (121 before this plan, 109 after), carries no doomed import
      and no codeOnly() call anywhere, while every behavioural case -- including both mixed
      cases' surviving assertions, the genuine D-15 case, and everything not scanned above --
      remains."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -c 'from \"./shipped-modules.ts\"' returns 0, grep -c 'codeOnly(' returns 0,
          and the TAP set count moved from 121 to 109 (net -12)"
        status: pass
    human_judgment: false

# Metrics
duration: 42min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 07: Cut anno-store.test.ts's Source-Scanning Cases Summary

**Removed twelve whole source-scanning cases and stripped both of the phase's measured
genuinely-mixed cases (one renamed, one not) from anno-store.test.ts -- the phase's largest
single file at 5,595 lines. The whole suite stays green.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-15T09:40:00Z
- **Completed:** 2026-09-15T10:22:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits, zero false
  positives on comments/strings/regex-after-return) before trusting it, per `scanner_protocol`.
  Ran it over `anno-store.test.ts`: 14 direct hits, matching the plan's stated count exactly.
- **Task 1 (Region A):** hand-read the "reserved bank field is never INTERPRETED" mixed case.
  Its first half opens a real store, writes rows across all four bank-carrying tables, and
  asserts every listed row has `bank: null` -- genuine behavioural coverage, exempt under D-02.
  Its second half runs `codeOnly()` over `anno-store.ts` and asserts on the stripped text --
  removed. Renamed the surviving case from "...and no line of the seam's own code branches on or
  computes with a bank value" to "...for every row it lists", since the surviving assertions no
  longer prove the dropped clause. Then hand-read and removed whole under D-01: WR-24 STRUCTURAL,
  STORE-02 non-vacuity, and the prune/sweep/publish-path SOURCE ORDER cases -- each calls
  `codeOnly(readFileSync(...))` against `anno-store.ts`'s own source with no production call
  anywhere in the body.
- **Task 2 (Region B):** hand-read the CR-08 "truncated to zero bytes" mixed case against
  PATTERNS.md's cited boundary. Kept its behavioural half (a real store at revision 3, a
  truncated snapshot, a by-name refusal naming both paths, `assertRefusedRevertLeftEverythingIntact`,
  and a successful fresh `openStore`) byte-for-byte through the closing brace of its `reopened`
  block. Removed the tail beginning at the "AND THE SOURCE ORDER, ASSERTED HERE RATHER THAN AS
  ITS OWN TEST" boundary comment, which slices `revertTo`'s body out of stripped source and
  asserts three string-landmark orderings inside it. Confirmed the surviving name already
  described only the behavioural half -- no rename needed. Then hand-read and removed whole under
  D-01: WR-11 STRUCTURAL, WR-02 and WR-04 STRUCTURAL, revertTo step 6 STRUCTURAL BACKSTOP, and
  WR-17 STRUCTURAL.
- **Task 3 (Region C):** hand-read and removed whole under D-01: the two WR-18 STRUCTURAL
  binding-checks (`pruneSnapshots`' and `reconcileSnapshotRing`'s return values bound rather than
  discarded, both proven only by reading `anno-store.ts` as text) and the D-15 "SINGLE WITNESS"
  case (asserts exactly one `schema_version !== SCHEMA_VERSION` comparison site, one
  `anno_meta` write site, and no migration entry point -- all by reading the module's own
  stripped source, no `openStore` call anywhere in the body). Confirmed the earlier, genuinely
  behavioural D-15 case -- "a genuine SCHEMA_VERSION 2 store file is REFUSED" -- opens a real
  fixture through `writeSchemaVersion2Store` and `openStore`, with zero reference to any doomed
  symbol, and left it completely untouched. Ran both mandated whole-file blind-spot passes and
  found nothing beyond the plan's own fourteen-hit scanner list. Pass one searched for a raw
  `readFileSync` of a sibling `.ts`/`.mts` outside a `codeOnly()` wrapper, and for module-scope
  `*_SOURCE` constants. Pass two skimmed every case name for "STRUCTURAL", "SOURCE ORDER",
  "non-vacuity", "imports nothing", and "declares no module-level". Removed the now-orphaned
  `import { codeOnly } from "./shipped-modules.ts"`,
  the file's last reference to the doomed module. No helper function or `*_SOURCE` constant was
  orphaned by this plan -- every removed case called `codeOnly()` and `readFileSync()` directly.
- `npm run test:automated`: `EXIT=0`, `tests 3685`, `pass 3676`, `fail 0`, `skipped 9` --
  matching the 56-06 baseline (`tests 3697`) minus exactly this plan's twelve net removed case
  names (121 TAP names before this plan, 109 after: -5, -4, -3 across the three tasks). `npm run
  typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Region A, lines 865 to 2600, including the worked mixed case** - `acd96833` (test)
2. **Task 2: Region B, lines 3060 to 3980, including the CR-08 exempt case** - `2ae65227` (test)
3. **Task 3: Region C, the import, and the full automated gate** - `30b512a7` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/anno-store.test.ts` - lost twelve whole source-scanning cases net, stripped and
  renamed one mixed case (the "reserved bank field" case), stripped one mixed case with no
  rename (CR-08's truncated-snapshot case), and lost the `import { codeOnly } from
  "./shipped-modules.ts"`. Every other behavioural case -- including the genuine D-15 case, the
  four CR-08 sibling cases, and all writer/revert/prune/evidence coverage -- stays untouched.

## Decisions Made
See key-decisions in frontmatter: the bank-field case's mandatory rename, CR-08's no-rename
verdict against PATTERNS.md's cited boundary, the shared shape all twelve whole removals
measured to, and the two blind-spot passes finding nothing new.

## Deviations from Plan

None - plan executed exactly as written. All fourteen scanner hits and both mixed cases resolved
exactly as the plan's `action` text described. No candidate failed to match its description, and
neither blind-spot pass surfaced an unlisted case.

## Issues Encountered

None. The BEFORE TAP name set was captured before editing began for each of the three tasks, per
prior-wave context item 5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Twelve of seventeen importing files are now clear (three from 56-01, three from 56-03, two
  from 56-04, two from 56-05, one from 56-06, one -- `anno-store.test.ts`, the largest single
  file in the phase -- from this plan). Five remain: `anno-derive.test.ts`,
  `anno-export-asm.test.ts`, `anno-coverage.test.ts`, plus `shipped-modules.ts` +
  `shipped-modules.test.ts` themselves (D-09, final wave only after every regular file loses its
  import), minus `anno-seam.test.ts` which 56-02 already reduced without removing the file.
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline minus this plan's
  twelve net removed case names) and typecheck is clean. The next plan in this phase's wave
  sequence can proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-store.test.ts`
- FOUND commit `acd96833` (Task 1)
- FOUND commit `2ae65227` (Task 2)
- FOUND commit `30b512a7` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (6/1, 4/0, 3/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0, `grep -c 'codeOnly('` returns 0, the surviving D-15 behavioural case is present, and
  `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3685` (baseline 3697 minus the 12 net cases this plan removed).
  `git log --name-only` for this plan's three task commits names only
  `src/mcp/vice/anno-store.test.ts` in each -- never `src/mcp/vice/anno-store.ts`.
