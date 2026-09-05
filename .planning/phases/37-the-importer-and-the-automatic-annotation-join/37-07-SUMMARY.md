---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 07
subsystem: annotation-store
tags: [anno-graphics, vic-ii, graphics-derivation, auto-06, register-arithmetic]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-02's CONST_WRITE_WATCHED_ADDRESSES/ConstWriteFact shape in anno-import.ts, which already includes the three VIC registers this derivation needs, and its committed captured export (measured this plan to carry no writes to any of the three)"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-06's anno-bank.ts sibling shape (a pure, store-independent register-decode module) this plan follows without duplicating its processor-port decode"
provides:
  - "anno-graphics.ts: deriveGraphicsRanges() -- screen matrix, character-set-or-bitmap and sprite-pointer ranges derived from recovered $DD00/$D018/$D011 VALUES alone, never from cross-references"
  - "GraphicsRange/GraphicsMap/GraphicsConstWriteFact types, shaped to match dxa-blocks.ts's KnownDataRow so plan 37-08 can hand rows to the existing emitters without a translation layer"
affects: ["37-08"]

# Actuals (#2632)
actuals:
  tokens: 8235
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure arithmetic module over an ARRAY OF RECOVERED VALUES with no store/graph dependency at all -- deriveGraphicsRanges() takes plain facts and returns plain ranges, matching anno-bank.ts's own store-independence for decodeBankState() but going one step further: this module never receives even the store handle anno-bank.ts's own resolveBankedRegion()/regionAdmitsEntry() take"
    - "Distinct-value cross product for 'several valid maps, never one merged map' (D-37-27): each of the three watched registers' own DISTINCT recovered values forms an axis (a register with zero facts contributes a single missing slot, never an axis), and the cross product -- not a reaching-value graph walk -- produces one map per combination, in ascending tuple order"

key-files:
  created:
    - src/mcp/vice/anno-graphics.ts
    - src/mcp/vice/anno-graphics.test.ts
  modified:
    - src/mcp/vice/package.json
    - src/mcp/vice/hostpath-consumers.test.ts

key-decisions:
  - "The fixture question was checked, not assumed: fixtures/ghidra/export-bank-path-dependent.txt (plan 37-02's committed capture) was grepped for $D011/$D018/$DD00 and carries ZERO writes to any of the three -- only three writes to the processor port ($0001: $34/$33/$37). Every graphics-register case in anno-graphics.test.ts is therefore a hand-built fact list, stated plainly in the test file's own header rather than left implicit; plan 37-08's own graphics-bearing fixture is the future real-capture case."
  - "'Distinct combination' is the cross product of each register's own distinct-value set, not a reaching-value graph walk. Since D-37-26 forbids this module from reading the cross-reference graph (unlike anno-bank.ts's AUTO-04 resolution, which DOES walk the graph via anno-join.ts), there is no mechanism available here to correlate WHICH d018 value co-occurred with WHICH dd00 value at a given program point. The cross product is the simplest, fully-deterministic answer available without that mechanism, and is exact for the stated common case (one axis varies per raster split, others held constant) at the cost of a theoretical over-generation risk if two axes vary independently and unrelatedly -- a risk this module cannot resolve without becoming the graph-reading module D-37-26 forbids it from being. Recorded here rather than left implicit."
  - "GraphicsConstWriteFact is declared LOCALLY (not imported from anno-import.ts) even though its shape is identical to ConstWriteFact. Importing anno-import.ts would add a dependency this module's own import-list scan (Task 2) does not need to tolerate, and plain structural typing means a caller can pass a real ConstWriteFact[] with zero translation regardless of which name the type carries."
  - "Sprite pointer range is produced whenever bank-select AND memory-control are both present, REGARDLESS of whether control-register-1 (the mode bit) is present -- the sprite pointer table's location depends only on the screen-matrix base, not on the mode bit. Missing control-register-1 removes only the character-set-or-bitmap range, never the screen matrix or sprite pointers."

requirements-completed: [AUTO-06]

coverage:
  - id: D1
    description: "deriveGraphicsRanges() derives screen-matrix, character-set-or-bitmap and sprite-pointer ranges from recovered $DD00/$D018/$D011 values alone: the bank-select inversion (both-low-bits-set -> base zero, both-clear -> highest base), the $D018 high-nibble screen offset and low-nibble upper-three-bits character/bitmap offset, and the $D011 bit-5 mode bit deciding character-set vs bitmap kind/size"
    requirement: AUTO-06
    verification:
      - kind: unit
        ref: "anno-graphics.test.ts#a bank-select value with both low bits set yields bank base zero; one with both low bits clear yields the highest bank base"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#the screen-matrix range is exactly 1024 bytes, starting at the bank base plus the high nibble times the matrix granularity"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#with the mode bit clear the second range is a character set of the character-set size; with it set it is a bitmap of the bitmap size"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#the sprite-pointer range is exactly eight inclusive bytes, starting at the screen-matrix base plus the fixed sprite-pointer offset"
        status: pass
    human_judgment: false
  - id: D2
    description: "Several distinct recovered register-value combinations produce several maps (never one merged map), in a stated deterministic ascending-tuple order; a missing register produces a map naming the absence and omitting only the ranges that depended on it, never a power-on default"
    requirement: AUTO-06
    verification:
      - kind: unit
        ref: "anno-graphics.test.ts#two distinct recovered combinations produce two maps in ascending tuple order, each carrying its own register values, and two runs over the same facts are deeply equal"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#a fact list missing the bank-select register produces a map naming that register in missingRegisters, with every range that depended on it omitted -- never a power-on default"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#every returned range has endInclusive >= start, and every dataType is a member of the frozen DATA_TYPES vocabulary"
        status: pass
    human_judgment: false
  - id: D3
    description: "A range is derived for an address the stored cross-reference graph does not contain at all and the reference-driven join does not reach; the derivation's output is unchanged by the graph's contents; a non-vacuous structural scan proves the module's import list cannot reach the store, the join, the host-path modules or the emulator backend"
    requirement: AUTO-06
    verification:
      - kind: unit
        ref: "anno-graphics.test.ts#a derived character-set range covers an address no stored cross-reference row targets, against the SAME store"
        status: pass
      - kind: integration
        ref: "anno-graphics.test.ts#the real join over the same store produces no decision covering the derived character-set address"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#derived ranges are unchanged whether the store carries cross-reference rows or none at all"
        status: pass
      - kind: unit
        ref: "anno-graphics.test.ts#a non-vacuous structural scan of anno-graphics.ts's own import list reaches none of the store, the join, the host-path modules or the emulator backend"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 07: The VIC-Register Graphics Derivation Summary

**`anno-graphics.ts`'s `deriveGraphicsRanges()` turns recovered `$DD00`/`$D018`/`$D011` register VALUES into screen-matrix, character-set-or-bitmap and sprite-pointer ranges through pure arithmetic with zero store or cross-reference-graph access, proven by a hermetic test suite that derives a character-set range covering an address no stored cross-reference row targets and the real join does not reach.**

## Performance

- **Duration:** ~18 min
- **Started:** ~2026-09-05T08:19:24Z (estimated, immediately after plan 37-06's closing commit)
- **Completed:** 2026-09-05T08:37:33Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `anno-graphics.ts` -- new module: `deriveGraphicsRanges()` derives the VIC bank base ($DD00 bits 0-1, inverted, ×16KB), the screen matrix (bank base + $D018 high nibble × 1024, fixed 1024-byte size), the character-or-bitmap range (bank base + $D018 low-nibble upper-three-bits × 2048, sized/kinded by $D011 bit 5), and the sprite-pointer range (screen-matrix base + fixed $3F8 offset, exactly 8 bytes) -- from recovered register VALUES alone, matching AUTO-06's own criterion that the chip's DMA fetches make a charset findable by no instruction anywhere in the program
- Bit arithmetic cross-checked by hand against `stock-vicii.ts`'s `memorySetup`/`control1` decode and `stock-sprites.ts`'s `vicBank()`/`vicBankBase()`/`screenBase()` -- **agrees exactly, no disagreements found** (both files decode the identical bit positions this module does; `stock-vicii.ts`'s own header explicitly defers bank-relative resolution to exactly the kind of arithmetic this module now performs statically)
- One `GraphicsMap` per distinct combination of the three registers' own recovered values (D-37-27, never a merged map), via a cross product of each register's own distinct-value set rather than a reaching-value graph walk -- because D-37-26 forbids this module from reading the cross-reference graph at all, unlike `anno-bank.ts`'s AUTO-04 resolution
- A missing register never defaults: `missingRegisters` names the absence and only the ranges that depended on it are omitted from that map's `ranges` array (the sprite pointer range still derives without the mode bit; nothing derives without bank-select or memory-control)
- Task 2 turns AUTO-06's distinguishing claim into three assertions against ONE scratch store: a derived character-set address exists, `listXrefs()` over that same store has no row targeting it, and the real `runMemmapJoin()` over that same store produces no decision covering it -- plus an independence check (rows present vs. absent produce identical derived ranges) and a non-vacuous structural scan of the module's own import list (hand-confirmed non-vacuous: the same scan against an empty source finds zero specifiers and would otherwise pass its banned-substring loop vacuously)
- **Measured, not assumed:** plan 37-02's committed capture (`fixtures/ghidra/export-bank-path-dependent.txt`) carries zero writes to any of the three watched VIC registers -- only three writes to the processor port. Every register-value test case here is a hand-built fact list; plan 37-08's own graphics-bearing fixture is the future real-capture case

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive screen, character-set-or-bitmap and sprite-pointer ranges from recovered register values** - `f1000cbd` (feat)
2. **Task 2: Prove the derivation finds what cross-references structurally cannot** - `997d762b` (test)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-07):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/anno-graphics.ts` - `deriveGraphicsRanges()`, `GraphicsRange`, `GraphicsMap`, `GraphicsConstWriteFact`, and the exported register-address/offset constants
- `src/mcp/vice/anno-graphics.test.ts` - 12 cases: the six arithmetic behaviour bullets, the missing-register and range/dataType invariants, the header-boundary-statement check, the two cross-reference-independence assertions (no-xref-row + no-join-decision), the store-with-vs-without-rows independence check, and the non-vacuous import-list structural scan
- `src/mcp/vice/package.json` - `files[]` gained `anno-graphics.ts`
- `src/mcp/vice/hostpath-consumers.test.ts` - `ANNO_MODULE_FLOOR` raised from 20 to 21, with a dated comment naming this plan and the one module added

## Decisions Made

- **The fixture question was checked, not assumed.** `fixtures/ghidra/export-bank-path-dependent.txt` was grepped directly for `$D011`/`$D018`/`$DD00` and carries zero writes to any of them -- plan 37-02's fixture is a banking fixture, not a graphics one, exactly as the plan's own `<read_first>` anticipated. Stated plainly in `anno-graphics.test.ts`'s own header rather than left implicit.
- **"Distinct combination" is a cross product of each register's own distinct-value set, not a reaching-value graph walk.** D-37-26 forbids this module from reading the cross-reference graph at all (unlike `anno-bank.ts`'s AUTO-04 resolution, which walks the graph via `anno-join.ts`'s `computeReachingValues()`), so there is no mechanism here to correlate which `$D018` value co-occurred with which `$DD00` value at a given program point. The cross product is the simplest fully-deterministic answer available without that mechanism, exact for the stated common case (one axis varies per raster split, others held constant), at the cost of a theoretical over-generation risk if two axes vary independently and unrelatedly -- a risk this module cannot resolve without becoming the graph-reading module D-37-26 forbids it from being.
- **`GraphicsConstWriteFact` is declared locally, not imported from `anno-import.ts`,** even though its shape is identical to `ConstWriteFact`. This keeps this module's own import-list scan free of any dependency on `anno-import.ts`; plain structural typing means a caller (plan 37-08) can still pass a real `ConstWriteFact[]` with zero translation.
- **The sprite-pointer range derives whenever bank-select and memory-control are both present, regardless of control-register-1.** The sprite pointer table's location depends only on the screen-matrix base, not on the mode bit -- a missing mode bit removes only the character-set-or-bitmap range.

## Deviations from Plan

None - plan executed exactly as written. The one thing flagged as a possible surprise in the plan's own `<read_first>` -- whether the committed capture carries any of the three watched registers -- was checked directly and confirmed to be the anticipated "no" case, not a deviation.

## Issues Encountered

None. `ps -eo pid,cmd | grep -i "vice-broker\|x64sc"` confirmed no live broker before every `npm run test:automated` run this session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `deriveGraphicsRanges()`, `GraphicsRange` and `GraphicsMap` are ready for plan 37-08 to feed into `dxa-blocks.ts`'s existing `emitDataBlocks()`/`emitLabels()` and into a Ghidra "mark as data" pre-script -- `GraphicsRange`'s `start`/`endInclusive`/`dataType` fields are shaped to match `dxa-blocks.ts`'s `KnownDataRow` directly, with no translation layer
- `AUTO-06` is complete: graphics areas derive from VIC register values alone, never from cross-references, proven by a case where the derived range and a real store/join both fail to see each other
- No blockers. `npm run test:automated` (broker confirmed absent via `ps -eo pid,cmd`) measured at 3500 tests / 3487 pass / 2 fail, both pre-existing in `anno-register.test.ts` -- the same documented pair every prior phase-37 plan has recorded, unchanged by this plan

## Self-Check: PASSED

- `src/mcp/vice/anno-graphics.ts` — FOUND
- `src/mcp/vice/anno-graphics.test.ts` — FOUND
- Commit `f1000cbd` — FOUND in `git log --oneline --all`
- Commit `997d762b` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test anno-graphics.test.ts` 12/12 pass; `node --test anno-join.test.ts anno-bank.test.ts memmap-lookup.test.ts anno-import.test.ts` 72/72 pass; `grep -av '^[[:space:]]*[/*]' anno-graphics.ts | grep -c 'node:sqlite\|openStore\|listXrefs\|anno-join\|hostpath\|stock-vicii'` outputs `0`; `git status --porcelain src/mcp/vice/` outputs 0 lines; `npm run test:automated` (broker confirmed absent) 3500 tests / 3487 pass / 2 fail, both pre-existing in `anno-register.test.ts`

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
