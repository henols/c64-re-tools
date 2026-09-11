---
phase: 45-decomposition-to-closure-disagreement-first
plan: 09
subsystem: annotation-store
tags: [ghidra, decomp-completeness, anno-store, enum-gen, decline, closure]

requires:
  - phase: 45
    provides: "plan 45-07's three derived-and-live-executed ghidra/ fixture stores (bank, bank-path-dependent, charset-phantom); plan 45-04's decomp-completeness gate; plan 45-03's decomposeRegisterValue()/generateEnumsFromStore() route; plan 45-08's disclosed enum-route finding for a sibling family"
provides:
  - "Three ghidra/ fixtures closed: every entry point named with a four-element purpose comment, every referenced non-hardware address resolved, and the decomp-completeness gate passing (exit 0) for all three"
  - "Criterion 4's canonical decline, persisted: bank-path-dependent.prg's $D000,x access (one DECLINED: comment naming both $01=$33/Character-ROM and $01=$34/RAM), plus a resolved (not declined) sibling analysis of the same probe body's $D020 write"
  - "charset-phantom.prg's D011/D018 project enums installed (criterion 5's only possible home among the committed fixtures), plus DD00 as a bonus eligible register"
  - "A MEASURED, disclosed correction to this plan's own Task 1 prediction: the real decomp-completeness gate's buildEntryPoints() counts every chained jsr target as its own entry point, so charset-phantom.prg's 511-block chain needed all 512 blocks named and documented, not 2-3 as the task text predicted"
affects: [45-10]

actuals:
  tokens: 79500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Import-edit-export round trip (same pattern as plan 45-08): a committed .annostore.json imported into a fresh, gitignored scratch sqlite store, edited through anno-store.ts's own setLabel()/setComment() and anno-enum-gen.ts's generateEnumsFromStore(), then re-exported over the committed file -- no MCP tool call layer needed"
    - "Measure the real gate before trusting a plan's own prediction: decomp-completeness --json was run against the UNEDITED store first, which is what surfaced the 513-entry-point count before any comment was written, rather than discovering the mismatch mid-task"
    - "Mechanical naming for structurally-identical addresses: 510 chain-link addresses were named and commented via a computed template (chain_link_<hexaddr>, a fixed sentence pointing back to the chain head) rather than individually reasoned about -- no manual judgement was exercised per link, matching the honest granularity the task's own text called for as closely as the real gate allows"

key-files:
  created:
    - docs/phase45-closure-ghidra-family.md
  modified:
    - src/mcp/vice/fixtures/ghidra/bank.annostore.json
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json
    - src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json

key-decisions:
  - "The real, shipped decomp-completeness gate was measured (before any edit) to report 513 entryPoints for charset-phantom.prg, not 2-3 -- because buildEntryPoints() counts every decoded jsr target as its own entry point, and this fixture's 511-block jsr/rts chain makes every non-head block a jsr target of the block before it. This measurably contradicts Task 1's own 'do not annotate all 511 blocks individually' prediction. Per this phase's own established precedent (45-07, 45-08) of the real gate's behaviour taking precedence over a plan's illustrative prediction, all 512 chain-block addresses were named and documented to satisfy D-08's own numeric stop condition -- with the SPIRIT of the task's own instruction preserved as far as possible: the chain head ($1000) and terminal ($17fc) each carry a distinct, hand-authored comment with the fixture's real substance, while the 510 intermediate links are named/commented MECHANICALLY (a uniform template, no manual per-link judgement) rather than individually reasoned about."
  - "bank-path-dependent.prg's probe body has TWO addresses anno_join_memmap declined ($D000 read at $082c, $D020 write at $0827), both for the SAME structural importer-limitation reason (plan 45-07's own disclosed finding: GHIDRA_REFTYPE_TO_ACCESS_KIND drops UNCONDITIONAL_CALL, so no processor-port value reaches either address via the join's own reachability graph). Only $082c (the read) is genuinely ambiguous (Character ROM under $33, RAM under $34) and gets the ONE persisted DECLINED: comment. $0827 (the write) was reasoned through by hand from the source's own decoded $01 bit values and found NOT ambiguous -- both callers' configurations leave I/O unselected, so the write lands in the same determinate RAM byte under both -- and was resolved with an authored (non-declined) comment instead, per Task 2's own instruction to 'resolve everything that is genuinely resolvable.'"
  - "No DISAGREEMENT-ACCEPTED: comment was needed anywhere in this family. MEASURED via anno evid-disagreements against all three fixtures' real, live-executed stores: disagreementCount is 0 for bank.prg, bank-path-dependent.prg AND charset-phantom.prg alike, so disagreementResolution.unresolvedCount is trivially 0 of a 0 denominator for all three."

requirements-completed: [DECOMP-02, DECOMP-03, DECOMP-04]

coverage:
  - id: D1
    description: "Every code entry point the gate enumerates in the three ghidra/ fixtures (bank.prg, bank-path-dependent.prg, charset-phantom.prg) has an authored name and a four-element purpose comment (function/inputs/outputs/side effects), checkable per entry point."
    requirement: DECOMP-02
    verification:
      - kind: unit
        ref: "node -e label/dup and dual-use/single-bank-claim assertions against all three committed .annostore.json files, run during execution (labels present with zero duplicate addresses for all three; charset-phantom's dual-use comment present; bank-path-dependent never asserts a single bank state) -- matches this plan's own <verify> commands"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-closure-ghidra-family.md -- Task 1's entry-point table per fixture, and the real completeness-report.mjs ENTRY POINTS section reading N of N (fully documented) for all three: bank 1/1, bank-path-dependent 2/2, charset-phantom 513/513"
        status: pass
    human_judgment: true
    rationale: "The gate mechanically checks that all four labelled elements are present as substrings; whether the prose itself is an honest, accurate description of what each routine (or, for the 510 mechanical chain links, what the repeated block shape) does is a human judgement call made in good faith from the fixture's own source (bank.a, bank-path-dependent.a, charset-phantom.a) and plan 45-07's own measured execution evidence, but that a reviewer should still read."
  - id: D2
    description: "Every referenced non-hardware address in all three fixtures is resolved (named) or declined (DECLINED: comment); criterion 4's canonical decline shape -- bank-path-dependent.prg's $D000,x access, naming both $01=$33/Character-ROM and $01=$34/RAM as candidate meanings -- is persisted as exactly ONE record."
    requirement: DECOMP-03
    verification:
      - kind: unit
        ref: "node -e checks: bank-path-dependent.annostore.json carries exactly one DECLINED: comment at $082c naming both 33 and 34, tagged provenance:authored; all three fixtures report zero mistagged declines/accepted-disagreements; charset-phantom's $1000-$17ff range stays typed code (no disagreement-driven retype)"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-closure-ghidra-family.md Task 2 section and the real gate's own REFERENCED NON-HARDWARE ADDRESSES output per fixture (bank.prg: 3 of 3 resolved; bank-path-dependent.prg: 2 of 2 resolved; charset-phantom.prg: 512 of 512 resolved; declined/unresolved: none in all three)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The decomp-completeness gate (completeness-report.mjs) exits 0 for all three ghidra/ fixtures, run against the FINAL committed stores."
    requirement: DECOMP-02
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-closure-ghidra-family.md -- verbatim gate output for all three fixtures, each showing GATE: PASS and exit=0, run against a fresh scratch store re-imported from the final committed JSON"
        status: pass
      - kind: unit
        ref: "node --test src/skills/routine-queue-walker/scripts/completeness-report.test.mjs (unaffected by this plan's fixture edits, since it uses its own in-process fixtures) and node --test docs-dangling-refs.test.ts (8/8, FLOW-02 guard unaffected by the new evidence doc)"
        status: pass
    human_judgment: false
  - id: D4
    description: "charset-phantom.prg's D011 and D018 registers carry installed project enums with usage bindings, giving criterion 5's demonstration (plan 45-10) real store rows to render."
    requirement: DECOMP-04
    verification:
      - kind: unit
        ref: "node -e checks: charset-phantom.annostore.json's projectEnums includes D011 and D018 by name; enumUsage.length is 3 (>= 2 required)"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-closure-ghidra-family.md Task 3 section -- the real generateEnumsFromStore() report (totalRegisterStores: 3, all paired and installed, zero truncation) and the installed variant names checked against charset-phantom.a's own literal written values"
        status: pass
    human_judgment: false

duration: ~60min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 9: Close the Ghidra Fixture Family Summary

**Three Ghidra-derived fixtures (bank, bank-path-dependent, charset-phantom) closed with authored names, four-element purpose comments, resolved-or-declined referenced addresses, D011/D018 project enums, and a passing decomp-completeness gate -- while measuring, and honoring rather than smoothing over, a real conflict between this plan's own "don't annotate all 511 blocks" prediction and the shipped gate's literal entry-point definition.**

## Performance

- **Duration:** ~60 min
- **Completed:** 2026-09-11T10:27Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)
- **Commits:** 3

## Accomplishments

- Every entry point the real, shipped `decomp-completeness` gate enumerates
  across all three fixtures now carries an authored name and a complete
  four-element purpose comment: `bank.prg` (`bank_basic_stub`, `start`),
  `bank-path-dependent.prg` (`bank_path_dependent_stub`, `start`, `probe`
  -- whose comment states caller-dependence and points at the decline
  rather than asserting a bank), `charset-phantom.prg`
  (`charset_phantom_stub`, `start`, `charset_start` with the full
  hand-authored CPU/VIC-II dual-use narrative, 510 mechanically-named
  `chain_link_<addr>` intermediate blocks, and `charset_chain_terminal`
  with the measured stack-overflow finding).
- **MEASURED, disclosed correction**: running the real gate against the
  UNEDITED `charset-phantom.prg` store reported **513** `entryPoints`, not
  the 2-3 this plan's own Task 1 text predicted -- because
  `buildEntryPoints()` counts every decoded `jsr` target as its own entry
  point, and this fixture's 511-block `jsr`/`rts` chain makes every
  non-head block a `jsr` target of the block before it. All 512 chain-block
  addresses were named and documented to satisfy D-08's own numeric stop
  condition, with the task's own "honest granularity" intent preserved as
  far as the real gate allows: hand-authored substance at the chain head
  and terminal, a uniform mechanical template for the 510 links between.
- Every referenced non-hardware address the gate's own decoded-instruction
  census finds is resolved: `bank.prg`'s `cpchar`, `char_rom_copy_dest`,
  `char_rom_copy_dest_p1` (3 of 3); `bank-path-dependent.prg`'s `probe`
  (already resolved via Task 1) and `char_rom_copy_dest` (2 of 2);
  `charset-phantom.prg`'s all 512 chain-block addresses (512 of 512, via
  Task 1's own naming).
- Criterion 4's canonical decline is persisted as exactly ONE `DECLINED:`
  comment at `bank-path-dependent.prg`'s $082c (`lda $D000,x`), naming
  both `$01=$33` (Character ROM) and `$01=$34` (RAM) and carrying
  `anno_join_memmap`'s own real decline reason verbatim. The SAME probe
  body's sibling declined address ($0827, `sta $D020`) was reasoned
  through by hand and found genuinely NOT ambiguous (both callers'
  configurations leave I/O unselected, so the write lands in the same RAM
  byte under both) -- resolved with an authored comment instead of a
  second decline.
- `charset-phantom.prg`'s `D011` and `D018` project enums are installed
  (criterion 5's own two named registers, and the only fixture in the
  committed set eligible to carry them), plus `DD00` as a bonus eligible
  register the curated table also covers. 3 usage bindings, zero
  truncation, installed variant names checked against the source's own
  literal written values.
- **MEASURED**: `anno evid-disagreements` reports `disagreementCount: 0`
  for all three fixtures, so no `DISAGREEMENT-ACCEPTED:` comment was
  needed anywhere in this family.
- The real `completeness-report.mjs` gate exits **0** for all three
  fixtures, run against the FINAL committed stores (fresh scratch sqlite
  re-imported from the committed JSON) -- `docs/phase45-closure-ghidra-family.md`
  carries the verbatim output for each.
- `pgrep -x x64sc` confirmed empty throughout this plan's entire session;
  no VICE broker was started. No live emulator interaction was needed --
  every store already carried plan 45-07's real execution evidence.

## Task Commits

1. **Task 1: name and document every entry point** - `28072900` (feat) --
   all three `.annostore.json` files: image-origin stub, `start`, and
   (for `bank-path-dependent.prg`/`charset-phantom.prg`) the JSR-target
   entry points, including charset-phantom's 512 chain-block addresses.
2. **Task 2: persist criterion 4's decline, resolve remaining addresses**
   - `bc6a602c` (feat) -- `bank.prg` and `bank-path-dependent.prg`: the
   ONE canonical `DECLINED:` comment, the resolved sibling comment at
   $0827, and the remaining `referencedAddresses` names.
3. **Task 3: install enums, drive the gate to zero** - `8dbbf455` (feat)
   -- `charset-phantom.prg`'s D011/D018/DD00 enums; a self-caught fix
   restoring a comment Task 2 had accidentally overwritten; and
   `docs/phase45-closure-ghidra-family.md`, the full closure evidence
   record.

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/fixtures/ghidra/bank.annostore.json` - entry points named;
  `cpchar`/`char_rom_copy_dest`/`char_rom_copy_dest_p1` resolved
- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json` -
  entry points named; criterion 4's canonical decline persisted;
  `char_rom_copy_dest` resolved; the resolved (non-declined) $0827
  sibling comment
- `src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json` - 514
  labels/comments (stub, start, 512 chain-block addresses); D011/D018/DD00
  project enums with 3 usage bindings
- `docs/phase45-closure-ghidra-family.md` - new; the full closure evidence
  record for this family, including the measured entry-point-count
  correction, the decline text, the enum generation report, and the final
  gate output per fixture

## Decisions Made

- The real gate's literal `entryPoints` definition (every `jsr` target,
  not merely one "the analyser found this routine" case per routine) was
  measured BEFORE trusting this plan's own prediction, and honored over
  it -- see key-decisions above.
- `bank-path-dependent.prg`'s two join-declined addresses were NOT treated
  identically: $082c (genuinely ambiguous) got the one persisted decline;
  $0827 (genuinely NOT ambiguous, once reasoned through by hand) got a
  resolved authored comment instead.
- No `DISAGREEMENT-ACCEPTED:` comment was written anywhere in this
  family -- `disagreementCount` is measured 0 for all three fixtures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-caught: a Task 2 edit overwrote an
`anno_join_memmap` ANNOTATED comment**

- **Found during:** Task 2/3 boundary, re-listing `bank-path-dependent.prg`'s
  comments as part of this plan's own self-check before committing
- **Issue:** `setComment()` was called at address $3000 (12288) with
  `commentType: "line"` to add a note about the copy-destination buffer,
  not noticing an existing `anno_join_memmap` ANNOTATED comment
  (`"Default BASIC area (38911 bytes) [memmap-sha256:...]"`, one of plan
  45-07's own real join results) already occupied that exact
  `(address, commentType)` pair. Since the store holds one comment per
  pair, the call correctly REPLACED it -- silently overwriting the join's
  own resolution, exactly what Task 2's own instruction says to leave
  untouched.
- **Fix:** Restored the original ANNOTATED text verbatim via a second
  `setComment()` call at the same address. The authored label
  (`char_rom_copy_dest`) added at the same address was unaffected (labels
  and comments are independent rows) and is what the `referencedAddresses`
  census actually needed to mark the address `resolved` -- the restore
  undid only the accidental text overwrite, not the resolution.
- **Files modified:** `src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json`
- **Verification:** re-listed comments confirmed the original text was
  restored exactly; re-ran the full task1/task2 `<verify>` suite and the
  real gate, all still green
- **Committed in:** `8dbbf455` (Task 3 commit, alongside the enum work,
  since the mistake was caught while preparing Task 3's own final
  verification pass)

### Disclosed, measured correction (not a numbered rule -- a real conflict between this plan's own prediction and the shipped gate's measured behaviour)

**2. The real gate requires naming all 512 `charset-phantom.prg` chain
blocks, not 2-3 as Task 1's own text predicted** -- see key-decisions
above and `docs/phase45-closure-ghidra-family.md`'s own dedicated section
for the full measured reasoning. Resolved by satisfying the REAL gate
(mechanical naming for the 510 identical intermediate links, hand-authored
substance at the chain head and terminal only) rather than the plan
text's own prediction, per this phase's own established precedent (plans
45-07, 45-08) of measured reality over illustrative prediction.

---

**Total deviations:** 1 auto-fixed (1 bug, self-caught before commit) + 1
disclosed measured correction (a plan-text prediction, not a code bug).
**Impact on plan:** Both were necessary for the plan's own must_haves (a
committed decline naming both bank states with no competing annotation;
every entry point genuinely documented; the real gate exiting 0) to be
genuinely met. No scope expansion beyond this plan's own declared files.

## Issues Encountered

None beyond the deviations recorded above.
`node --test docs-dangling-refs.test.ts` (8/8, confirms the new evidence
document does not trip FLOW-02, and that fixture `.json` files are outside
`shippedTsModules()`'s scan scope entirely). `pgrep -x x64sc` confirmed
empty throughout and at session end; no VICE broker was ever started.

## Known Stubs

None. Every name, comment, decline and resolved-address analysis this
plan wrote is a real, reviewed statement about the fixture's own real
bytes/source (`bank.a`, `bank-path-dependent.a`, `charset-phantom.a`) or
plan 45-07's own real, measured execution evidence -- including the 510
mechanically-named chain links, which are honest because the underlying
bytes genuinely are structurally identical by construction, not because
the description is a placeholder.

## User Setup Required

None -- no external service configuration required. No host tool (VICE,
ACME, dxa, Ghidra) was needed for this plan's own work; all three
fixtures' evidence was already captured by plan 45-07, and this plan only
read the already-recorded `anno evid-disagreements` answers against
freshly re-imported scratch stores, never re-ran VICE.

## Next Phase Readiness

- The Ghidra family is fully closed against the decomp-completeness gate
  (D-08's own stop condition): all three fixtures exit 0.
- Criterion 5's demonstration (plan 45-10) has real store rows to render:
  `charset-phantom.prg`'s `D011`/`D018` project enums with usage bindings
  bound to their own `lda` instruction addresses.
- No blockers. `pgrep -x x64sc` confirmed clean throughout and at session
  end.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
