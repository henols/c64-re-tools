---
phase: 47-multi-file-rebuildable-source
plan: 06
subsystem: reverse-engineering-toolchain
tags: [acme, export-asm, annotation-store, symbol-resolution, split-address-tables, multi-file-source]

requires:
  - phase: 47-multi-file-rebuildable-source
    provides: "47-04's referencedAddress()/isInTree()/labelIndex in-tree symbol rule and its collect-then-refuse-once unresolvedReferences machinery -- reused verbatim by this plan's data-path branch, never re-derived; 47-01's exportAsmTree() tree writer and one-row-one-block partition; 47-02's multi-scope boundary-crossing refusal"
provides:
  - "isSplitAddressDataType() -- the membership test for the two split ADDRESS layouts (lo_hi_address/hi_lo_address), derived from isSplitDataType() plus the store's own address/word suffix, never a fourth hand-written layout list"
  - "emitSplitAddressLines()/tokenDataLines() -- the paired low-byte/high-byte emission branch: one symbol per entry, both halves derived from it, feeding the SAME unresolvedReferences/inTreeReferenceCount collection the instruction path's in-tree symbol rule already owns"
  - "a proof, against real ACME 0.97, that both split ADDRESS layouts (low-first and high-first byte order) reassemble byte-identically through paired symbol references"
  - "a proof that a split range is one ExportBlock and lands in one emitted file, and that relocating the target routine moves both halves of an affected entry together -- never one alone -- with a preceding non-vacuity check"
affects: []

actuals:
  tokens: 9177
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One membership test, never a fourth hand-written type-name list: isSplitAddressDataType() = isSplitDataType() AND the store's own '_address' suffix, mirroring WORD_PAIR_DATA_TYPES's own stated discipline against re-deriving the vocabulary."
    - "Reuse the shared refusal, don't rebuild it: emitSplitAddressLines() returns its own inTreeReferenceCount/unresolvedReferences and the caller folds them into exportAsm()'s existing totals, so a table entry and a jsr are refused (or not) by exactly one end-of-export throw."
    - "Two physical runs, not interleaved pairs: a split range's slice is cut at the midpoint into a first run and a second run: which one is 'low' and which is 'high' is decided once, by the dataType's own prefix, and both the byte-order orientation and the emission order follow from physical position -- never a second re-derivation."
    - "Relocation proved with two independently-built images (never a single store mutated in place), so the demonstration is that the SAME emitted symbol text resolves correctly against wherever the routine now sits, rather than a diff of one file's history."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "The two split WORD layouts (lo_hi_word/hi_lo_word) are deliberately excluded from the new branch by construction (isSplitAddressDataType()'s own '_address' suffix check) -- they keep going through emitDataLines()'s existing raw-!byte fallback, unchanged, per the store's own address/word distinction (address forms produce cross-references, word forms do not)."
  - "The referring address recorded for an unresolved split-address entry is its own first-run byte address (blockStart + i) -- an address a human reading the generated source can look at, on the same terms instr.address already is for the instruction path -- rather than a synthetic or omitted value."
  - "The relocation demonstration (Task 2) builds two SEPARATE images/stores (a 'before' and an 'after', each with the routine placed at its own origin) rather than mutating one store's label address in place, because a real relocation moves the routine's own code bytes, not just a store-side pointer -- the two independent exports prove the SAME emitted symbol text resolves correctly at each address."

requirements-completed: [BUILD-03]

coverage:
  - id: D1
    description: "A split hi/lo ADDRESS table's entries are emitted through paired low-byte/high-byte symbol references over ONE symbol per entry -- never per-half symbolisation -- for both lo_hi_address (low halves first) and hi_lo_address (high halves first), and the emission is byte-identical to the raw octets it replaces, proven by a real ACME round trip for both layouts."
    requirement: "BUILD-03"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: a `lo_hi_address` range emits paired low-byte/high-byte symbol references, low halves first, then high halves, with no raw hex byte among the resolved entries"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#split table: a `lo_hi_address` range assembles through runHostTool() at exitStatus 0 with bytes deepEqual expectedBytes -- the operators are byte-identical to the octets they replaced"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#split table: a `hi_lo_address` range emits the HIGH halves first, matching the store's own documented byte order, and also reassembles byte-identically"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: exactly one symbol is consulted per entry -- the low half and the high half of one entry always name the SAME symbol"
        status: pass
    human_judgment: false
  - id: D2
    description: "An entry whose composed target lies inside an emitted block with no symbol refuses by name through the SAME end-of-export refusal the instruction path already raises -- one run reports both kinds of unresolved reference together -- while an out-of-tree target keeps its raw byte and is never refused."
    requirement: "BUILD-03"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: an entry whose composed target lies OUTSIDE every emitted block keeps its raw byte value in both halves and is not a refusal"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: an entry whose composed target lies INSIDE an emitted block with no label there refuses by name, through the same end-of-export refusal the instruction path uses"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: an unresolved split-address entry and an unresolved instruction reference are BOTH reported by the SAME refusal in one run"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two split WORD layouts stay unsymbolised, in both directions, and dataByteCount is unchanged by the symbolisation."
    requirement: "BUILD-03"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: a `lo_hi_word` range still emits raw bytes and is never symbolised, and neither is `hi_lo_word` -- the address/word boundary asserted in both directions"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: `result.dataByteCount` is unchanged by the symbolisation -- the same total the raw emission produced for the same extent"
        status: pass
    human_judgment: false
  - id: D4
    description: "A split range is one ExportBlock and lands in exactly one emitted file (both half line groups together), and relocating the target routine changes both halves of the affected entry together, never one alone, with a preceding non-vacuity check that the two exports' table bytes genuinely differ; a split range straddling a scope boundary gets the ordinary boundary-crossing refusal with no exemption."
    requirement: "BUILD-03"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: a `lo_hi_address` range yields exactly ONE ExportBlock, and both its half line groups land in the SAME emitted file"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: non-vacuity for the relocation demonstration -- the two exports' table bytes really do differ"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: relocation -- moving the target routine changes BOTH halves of the affected entry together, never one alone"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#split table: relocation -- the moved tree reassembles at exitStatus 0 with bytes deepEqual its own new expectedBytes"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#split table: a split range crossing a scope boundary gets the ORDINARY boundary-crossing refusal, with no special case for the table"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 6: Paired-Symbol Emission for Split hi/lo Address Tables Summary

**A `lo_hi_address`/`hi_lo_address` table's entries now emit through ACME's low-byte/high-byte operators over one symbol per entry -- never per-half symbolisation -- through the same in-tree symbol rule and end-of-export refusal plan 47-04 built for the instruction path, with the move-together property (one row, one block, one file) asserted directly against real ACME 0.97.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `isSplitAddressDataType()` derives the two ADDRESS split layouts' membership from `isSplitDataType()` plus the store's own address/word suffix -- never a fourth hand-written layout-name list, exactly the drift `WORD_PAIR_DATA_TYPES`'s own comment warns against.
- `emitSplitAddressLines()` splits a block's slice into its two physical runs and, for each entry, composes the 16-bit target from the layout's own documented byte order (low-first for `lo_hi_address`, high-first for `hi_lo_address`), then renders BOTH halves through `<symbol`/`>symbol` when the target is in-tree and named, keeps the raw byte in both halves when it is out-of-tree (D47-F's boundary, applied to a second kind of reference), and collects it for the shared end-of-export refusal when it is in-tree and unnamed.
- The collection is the SAME `unresolvedReferences`/`inTreeReferenceCount` the instruction path's in-tree symbol rule already owns -- one export run can report an unresolved `jsr` and an unresolved split-address entry together, as `N of M`, through one throw.
- The two split WORD layouts (`lo_hi_word`/`hi_lo_word`) never reach the new branch at all (`isSplitAddressDataType()`'s own suffix check) and stay on `emitDataLines()`'s raw-`!byte` fallback, unchanged in both directions.
- Fourteen `split table:`-prefixed tests cover the shape (low-first/high-first byte order), the byte-identical ACME round trip for both layouts, the out-of-tree non-refusal, the in-tree unresolved refusal (alone and combined with an instruction-path unresolved reference in one run), the word-layout negative control, the one-symbol-per-entry invariant, `dataByteCount` invariance, the one-block/one-file structural link, the relocation demonstration (with its own non-vacuity check), and the ordinary boundary-crossing refusal with no table-specific exemption.
- Measured against real ACME 0.97 "Zem": `routine_a rts` / `routine_b rts` at $0801/$0802 with `tbl_lo !byte <routine_a, <routine_b` / `tbl_hi !byte >routine_a, >routine_b` assembles at exit 0 to `60 60 01 02 08 08` -- byte-identical to the raw octets, exactly the plan's own measured fixture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Paired-symbol emission for the two split ADDRESS layouts** - `e2fff30f` (feat)
2. **Task 2: The table moves as one unit -- asserted, not assumed** - `1b6d1774` (test)

_Note: both tasks carried `tdd="true"`; per this project's established phase-47 convention (see 47-01/47-02/47-03/47-04/47-05 history), implementation and its own direct test coverage landed together for Task 1, since `MVP_MODE=false`/`TDD_MODE=false` for this run and the plan's own `type: execute` frontmatter does not invoke the plan-level RED/GREEN/REFACTOR gate. Task 2 is pure test-only additions (no production code changed), landing as its own `test` commit._

## Files Created/Modified

- `src/mcp/vice/anno-export-asm.ts` - `isSplitAddressDataType()`, `emitSplitAddressLines()`, `tokenDataLines()`, and the block loop's new `else if` branch hooking the split-address emission into the SAME `unresolvedReferences`/`inTreeReferenceCount` totals the instruction path already maintains
- `src/mcp/vice/anno-export-asm.test.ts` - fourteen `split table:` tests plus `splitAddressFixture()`, `splitAddressOutOfTreeFixture()`, `splitAddressUnresolvedFixture()` (Task 1); `relocationFixture()`, `runRelocationDemo()`, `splitAddressBoundaryCrossingFixture()` (Task 2)

## Decisions Made

- The two split WORD layouts are deliberately excluded from the new branch by construction (`isSplitAddressDataType()`'s own `_address` suffix check) -- they keep going through `emitDataLines()`'s existing raw-`!byte` fallback, unchanged, per the store's own address/word distinction (address forms produce cross-references, word forms do not).
- The referring address recorded for an unresolved split-address entry is its own first-run byte address (`blockStart + i`) -- an address a human reading the generated source can look at, on the same terms `instr.address` already is for the instruction path.
- The relocation demonstration (Task 2) builds two SEPARATE images/stores (a "before" and an "after", each with the routine placed at its own origin) rather than mutating one store's label address in place, because a real relocation moves the routine's own code bytes, not just a store-side pointer -- the two independent exports prove the SAME emitted symbol text resolves correctly at each address, chosen so BOTH the low byte ($01 -> $42) and the high byte ($08 -> $09) genuinely change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run test:automated`'s failing-name set after both commits matches the documented 6-member baseline exactly (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`); tests 4191 / pass 4176 / fail 6 / skipped 9 (up from the 4177/4162/6/9 baseline entering this plan, by exactly the 14 new tests this plan added).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUILD-03 is now `Complete` in `REQUIREMENTS.md` -- this was the last of its three declaring plans (47-02, 47-04, 47-06) to land a SUMMARY, so the shared-ID gate is satisfied (`requirements.ready-ids` confirmed 1/1 ready before marking).
- The split hi/lo address table gap the ROADMAP's own Notes called out for this phase is closed: paired names, move-together, and the same refusal rule the instruction path already had.
- The adversarial control that deliberately moves one half and proves a gate catches it is explicitly Phase 49's, by the ROADMAP note's own words -- recorded in-line in the test file so its absence reads as a boundary rather than a gap.
- No blockers.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-export-asm.ts`
- FOUND: `src/mcp/vice/anno-export-asm.test.ts`
- FOUND commit `e2fff30f` (Task 1)
- FOUND commit `1b6d1774` (Task 2)
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test anno-export-asm.test.ts` 206/206 pass, 0 fail, 0 skipped; `grep -ac 'split table:'` over that output is 14 (>= 11 required); `node scripts/check-npm-packages.mjs` exit 0; `npm run test:automated` failing-name set is exactly the 6 documented baseline names (tests 4191, pass 4176, fail 6, skipped 9).
- `requirements.ready-ids` confirmed 1/1 ready before `requirements.mark-complete BUILD-03`; BUILD-03 now reads Complete in both the checkbox and traceability surfaces of `REQUIREMENTS.md`.
