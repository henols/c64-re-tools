---
phase: 35-dxa-vendored-and-parsed
plan: 02
subsystem: infra
tags: [dxa, listing-parser, disassembler, tdd]

# Dependency graph
requires:
  - phase: 35-dxa-vendored-and-parsed
    provides: "plan 35-01's dxa-listing.ts (parseDumpListing()'s window contract) and dxa-run.ts, this plan's own read_first ground truth"
provides:
  - "dxa-listing.ts owning all FIVE measured `-a dump` line shapes, with the two blank-byte-column shapes (label-only, mid-instruction `= * + n`) provably contributing zero bytes"
  - "the project's own named refusal, carrying accounted total, expected image size, matched-line count and unclassified count -- never dxa's own process exit status"
  - "CRLF-invariant and line-order-invariant parsing"
  - "a sorted, per-source-line rendered range list (DumpRange[]) that never merges two different lines even when they touch or agree on class"
  - "the overlapping-decode disposition: two (or more) lines claiming the same address resolve to `unclassified` with a stated reason naming every claim, never a winner, including when the claims agree"
affects: [35-03-dxa-partition, 35-04-dxa-blocks, 35-05-phase-verification]

# Actuals (#2632)
actuals:
  tokens: 9575
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Claims-collect-then-resolve: every byte emission is recorded as a claim BEFORE any set is populated, so an address with >1 claim can be diverted to `unclassified` uniformly -- no code path exists where the SAME address could reach two different sets, which is what a naive per-line direct-add algorithm risks under overlap."
    - "Range rendering keyed on (class, originating-line-index): two ranges only coalesce when they share BOTH, so two different source lines never merge into one range even when their addresses touch and their class agrees -- provenance, not just address+class, decides adjacency."
    - "Source-level negative-space tests (grep-shaped assertions inside node:test) prove an absence -- no second regex, no exit-code reference, no tie-break signal in executable code (comments excluded) -- the same technique 35-01's build-gate suite already established for this codebase."

key-files:
  created:
    - src/mcp/vice/dxa-listing.test.ts
  modified:
    - src/mcp/vice/dxa-listing.ts

key-decisions:
  - "Exported a new `DumpRange` interface (and widened `UnclassifiedByte`'s sibling into the public surface), even though the plan's own 'Artifacts this phase produces' note says this plan adds no new exported symbol beyond `parseDumpListing`, `DumpListingMap`, `DumpLineShape` and `UnclassifiedByte`. The plan's own action text for both tasks requires 'a rendered range list' as a first-class returned field (`DumpListingMap.ranges: DumpRange[]`), and the acceptance criteria assert its shape and class values directly -- an unnamed inline object type would satisfy the same runtime behavior but not the code's own established convention (named, documented, exported interfaces for every structured field, matching `DumpLineShape` and `UnclassifiedByte`). Treated as a Rule 1 correction to the plan's own artifact enumeration, not a scope expansion: the feature was explicitly required, only its type's name was uncounted."
  - "codeBytes/dataBytes are raw EMISSION counts (incremented once per claim, before overlap resolution), matching 35-01's own doc comment on those fields ('may exceed code.size under an overlapping decode -- a raw count, not a distinct address count') rather than being redefined to track post-resolution distinct addresses. This makes plan 35-01's existing field documentation literally true for the first time, since 35-01 shipped no overlap path that could exercise it."
  - "The 'two same-class spans separated by one address' adjacency case (must_haves edge case 5) is necessarily constructed with a differently-classed filler byte at the gap address, not a genuinely uncovered address -- the window-coverage refusal predicate makes an uncovered address WITHIN a valid window structurally impossible to construct without a refusal firing (that impossibility IS the refusal doing its job). The test asserts the CODE-class-only range count stays at 2 (never merging across the gap) rather than asserting the total range-list length, since the filler necessarily adds its own entry."
  - "The sixth-shape refusal fixture is a SYNTHETIC dash-separated line ('0900-aa-bb'), not a real dxa output form -- per the plan's own scope boundary, the refusal provoked by a genuinely unknown listing form from an actual dxa run is plan 35-05's evidence to produce, and this plan's job is to prove the MECHANISM (an unmatched shape under-counts and throws), not to claim the real-world provocation."

requirements-completed: []  # DXA-02 is ALSO declared by plan 35-01 (already summarized) and plan 35-05 (not yet run) -- shared-ID gate confirms 0/1 ready via `requirements ready-ids`. It flips to Complete when 35-05 finishes.

coverage:
  - id: D1
    description: "The parser accounts for exactly the five measured -a dump line shapes (tab instruction, tab .byt, space .word, label-only, mid-instruction '= * + n'), the last two correctly contributing zero bytes, and refuses by name -- never via dxa's own exit status -- on an unseen sixth shape, an empty listing, or a degenerate imageSize."
    requirement: "DXA-02"
    verification:
      - kind: unit
        ref: "dxa-listing.test.ts (17 task-1 cases: 5 shapes, 2 preambles, sixth-shape refusal, empty/degenerate imageSize, CRLF invariance, reverse-order invariance, adjacency x2, Phase 23 279-byte fixture, no-exit-code source check)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An overlapping decode (two lines claiming the same address, agreeing or disagreeing on class) yields unclassified with a stated reason naming both claims, never a winner; distinct coverage (code+data+unclassified) is what the refusal predicate compares, so a fully-covered overlapping listing does not spuriously refuse; the unclassified class renders in the sorted range list as its own class."
    requirement: "DXA-02"
    verification:
      - kind: unit
        ref: "dxa-listing.test.ts (9 task-2 cases: disagreeing overlap, reason contents, agreeing overlap, full-coverage no-throw, short-coverage throw with unclassified count, range rendering, a jsr-into-mid-instruction-target case built from two real -a dump shaped lines, no-tie-break source check, unclassified-reaches-return-and-renderer source check)"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-04
status: complete
---

# Phase 35 Plan 2: dxa Listing Parser Hardening Summary

**`dxa-listing.ts` now owns all five measured `-a dump` line shapes with a named, project-owned refusal (never dxa's exit status), and disposes any overlapping decode as `unclassified` with a stated reason rather than awarding it to a winner — never resolving even when the two claims agree.**

## Performance

- **Duration:** 40 min (this session; a prior attempt on this same plan was killed by an orchestrator-side monitoring error ~12 minutes in, before writing or committing anything — this session started clean from `e733c38`)
- **Started:** 2026-09-04T12:08:39+02:00 (base commit `e733c38`)
- **Completed:** 2026-09-04T12:46:48+02:00
- **Tasks:** 2 (both completed)
- **Files modified:** 2 (`dxa-listing.ts` modified, `dxa-listing.test.ts` created)

## Accomplishments

- `dxa-listing.ts` classifies all five measured `-a dump` line shapes correctly: the tab-separated instruction and `.byt` lines and the space-separated `.word` line all emit bytes; the label-only line and the mid-instruction `= * + n` continuation line correctly emit zero bytes because the ONE ported regular expression never matches them (their non-matching IS the mechanism, not an omission).
- The refusal is this project's own, by name: it throws, and its message carries the accounted total, the declared image size, the matched-line count, and now the unclassified count — never dxa's own process exit status, independently measured (35-01) to exit 0 on inconsistent input.
- CRLF and LF listings now parse to byte-identical structures (a trailing carriage return is stripped once per line, before matching), and classification is fully independent of line order.
- A new sorted, ascending rendered range list (`DumpListingMap.ranges: DumpRange[]`) never merges two different source lines into one entry, even when their spans touch exactly or agree on class — provenance (which line produced a byte), not just class and address, decides adjacency.
- The overlapping-decode disposition: two (or more) lines claiming the same address — whether they agree or disagree on class — resolve to `unclassified` with a stated reason naming every claiming line verbatim and every claimed class. There is no tie-break, no first-wins, no last-wins, no longest-span-wins and no code-beats-data rule anywhere in the module, verified by both behavioral tests (an agreeing-overlap case that still produces `unclassified`) and a source-level grep-shaped test over executable code (comments excluded).
- Distinct coverage — the quantity the one refusal predicate compares against `imageSize` — is now the union of `code`, `data` and `unclassified` addresses, so a fully-covered overlapping listing does not spuriously refuse; a short overlapping listing still refuses, now naming the unclassified count alongside the accounted total so the two causes (a genuinely short listing vs. an ambiguous one) are distinguishable.
- A `jsr`-landing-one-byte-into-a-three-byte-instruction case is built from two REAL `-a dump`-shaped lines (not an abstract pair of address ranges), proving the overlap bytes become `unclassified` while each line's own non-overlapping byte keeps its own classification — a disposition that swallowed the whole line would fail this test.
- 26 new tests in `dxa-listing.test.ts`, all fixture bytes for the real Phase 23 279-byte listing extracted verbatim via a shell script reading the committed transcript (never retyped), reproducing that phase's own `PARSE_ACCOUNTED_BYTES: 279`, `PARSE_MATCHED_LINES: 125`, `PARSE_CODE_BYTES: 179`, `PARSE_DATA_BYTES: 100` exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: The five shapes, the named refusal, and the CRLF/ordering/adjacency contracts** — `4e929ba` (test)
2. **Task 2: The overlapping decode — `unclassified` with a stated reason, never a winner** — `8d05ecf` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/dxa-listing.ts` — hardened: five-shape coverage (already true from 35-01's port, now proven), CRLF stripping, per-source-line-owner range rendering, claims-collect-then-resolve overlap handling producing `unclassified`.
- `src/mcp/vice/dxa-listing.test.ts` — 26 new tests: 17 task-1 cases (shapes, preambles, refusal, degenerate inputs, CRLF, ordering, adjacency, the Phase 23 fixture, a no-exit-code source check) + 9 task-2 cases (overlap agreement/disagreement, coverage, rendering, the jsr case, a no-tie-break source check, an unclassified-reaches-the-return-and-renderer source check).

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exported a new `DumpRange` type the plan's own artifact enumeration did not count**
- **Found during:** Task 1, while implementing "return the map as address sets plus a rendered range list" (the plan's own action text)
- **Issue:** The plan's "Artifacts this phase produces" note states this plan adds no new exported symbol beyond `parseDumpListing`, `DumpListingMap`, `DumpLineShape` and `UnclassifiedByte`. But both tasks' action text and acceptance criteria explicitly require a rendered range list with typed entries (`class`/`start`/`end`), tested directly by name (`ranges[0].class === "code"`, etc.) — an unnamed inline object type would work at runtime but breaks the module's own established convention of a named, documented, exported interface per structured field (mirroring `DumpLineShape` and `UnclassifiedByte`, both already exported for exactly this reason).
- **Fix:** Added `export interface DumpRange { class: "code" | "data" | "unclassified"; start: number; end: number }`, exported alongside the others, with the same doc-comment density as its siblings.
- **Files modified:** `src/mcp/vice/dxa-listing.ts`
- **Verification:** `npm run typecheck` clean; every range-shaped assertion in `dxa-listing.test.ts` passes against the named type.
- **Committed in:** `4e929ba` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug: an undercounted artifact enumeration in the plan's own text, corrected to match what the plan's own action text and acceptance criteria actually require).
**Impact on plan:** Necessary for the plan's own acceptance criteria (which assert range-list shape and class values by name) to be satisfiable at all under the codebase's established typing convention. No scope creep — the range-list FEATURE was explicitly required by both tasks; only its type's name was uncounted in the plan's own summary line.

## Issues Encountered

None. The prior attempt on this plan was terminated by an orchestrator-side monitoring error before writing or committing any code (confirmed clean HEAD at `e733c38` and no `dxa-listing.test.ts` on disk at session start) — not a plan defect, and this session proceeded from a clean base with no rescue or reconciliation needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `DXA-02` is declared by THREE plans in this phase (`35-01`, `35-02`, `35-05`). Per the shared-ID gate, it is not marked `Complete` in `REQUIREMENTS.md` yet — `gsd-tools requirements ready-ids` confirms `0/1 ready` at this plan's completion (only `35-05`, the last declaring plan, has not yet finished). It will flip to `Complete` when `35-05`'s own SUMMARY lands.
- `dxa-listing.ts`'s public surface (`parseDumpListing`, `DumpListingMap`, `DumpLineShape`, `UnclassifiedByte`, `DumpRange`) is now stable for plan `35-03` (partitioning) and `35-04` (data blocks/labels) to build on directly — both were already named as consumers of the `unclassified` disposition in this plan's own `key_links`.
- The one claim this plan explicitly does NOT make — a refusal provoked by a genuinely unknown listing form from an actual dxa run, as opposed to this plan's synthetic sixth-shape stand-in — remains plan `35-05`'s own evidence to produce.
- No blockers.

## Self-Check: PASSED

Both claimed files confirmed present on disk (`src/mcp/vice/dxa-listing.ts`, 308 lines;
`src/mcp/vice/dxa-listing.test.ts`, 372 lines). Both claimed commit hashes (`4e929ba`,
`8d05ecf`) confirmed in `git log`. All task-level `<acceptance_criteria>` and the plan-level
`<verification>` block re-ran green immediately before this SUMMARY was written:
`node --test dxa-listing.test.ts` — 26/26 pass; the regex-count check
(`grep -av '^\s*[/*]' dxa-listing.ts | grep -ac '= /'`) — exactly 1; `npm run typecheck` —
clean; `node --test dxa-seam.test.ts hostpath-consumers.test.ts` — 31/31 pass;
`grep -a -c 'exitStatus\|exitCode' dxa-listing.ts` — 0. Full `npm run test:automated` —
3323 tests, 3315 pass, 2 fail (both `anno-register.test.ts`, the documented pre-existing
STORE-01/STORE-04/STORE-06/MCP-04 requirements-bookkeeping drift, unrelated to this plan and
present before this session started) — no regression against the phase's recorded floor.

---
*Phase: 35-dxa-vendored-and-parsed*
*Completed: 2026-09-04*
