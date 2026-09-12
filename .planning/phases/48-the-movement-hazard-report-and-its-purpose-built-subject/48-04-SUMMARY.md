---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 04
subsystem: analysis
tags: [hazard-report, cycle-exact-raster, self-modifying-code, annostore-export, acme, fixtures]

requires:
  - phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
    provides: "plan 48-01's report shell and class-2 detector, plan 48-02's dispatch/alignment fixture parts, plan 48-03's class-1/3/4 detectors and completed HAZARD_LIMITS -- this plan plants the class-4 construction those detectors are proven against and produces the committed store export the multi-file reassembly plan reads"
provides:
  - the timer-stabilised (non-canonical) class-4 raster construction, presenting only the timer-reload signal and neither the raster-register-access nor the timing-sled signal, with the choice recorded honestly in its own header
  - a second, deliberately undetected self-modification (an indirect-indexed store through a runtime-computed, biased zero-page pointer), proven missed from both sides -- no class-2 finding at its target, the report's own limits naming the miss, and no two hazard classes sharing a mechanism id
  - hazard-subject.annostore.json, the committed store export describing the whole subject -- full byte coverage, four external_file data tables, five scopes with no boundary-crossing range, every in-image reference resolved to a symbol, and the two touching dispatch tables preserved as two adjacent ranges
  - scope support added to anno-store-export.ts's generic JSON export/import format (additive, schema-version-unchanged), closing a gap that format had no route for at all
affects: [48-05, 48-06]

actuals:
  tokens: 16900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A shared IRQ handler distinguishes its two entry sources (a VIC-II raster interrupt and a CIA1 timer interrupt) via a one-byte zero-page phase flag, since both route through the same $0314/$0315 RAM vector -- never two separate handlers."
    - "A self-modification's runtime-computed pointer is built from a compile-time-computed BIASED offset (target address minus a fixed constant, reconstructed via 16-bit addition at runtime) rather than any direct label reference, so the real target byte never appears as a literal operand anywhere in the image -- the offset technique itself, not merely the indirect-indexed addressing mode, is what keeps the address out of the instruction stream."
    - "Store decomposition folds an ACME alignment directive's filler padding into whichever construct's own range precedes the boundary (the setup routine's trailing padding, the character set's trailing padding) rather than carving out anonymous filler ranges -- both readings are honest, and this keeps every declared boundary a plain symbol-to-symbol span."
    - "A fixture-test's own literal-target scan is scoped to the store's own CODE-typed ranges before trusting a decoded 'instruction' as evidence of a real reference -- decode() has no notion of code vs. data and happily produces plausible branch/absolute targets over raw bytes in a data table."

key-files:
  created:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-raster.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs
  modified:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-misaligned.prg
    - src/mcp/vice/hazard-subject-fixture.test.ts
    - src/mcp/vice/anno-store-export.ts
    - src/mcp/vice/anno-decomp-closure.test.ts
    - src/mcp/vice/fixtures/dxa/basic-stub.annostore.json
    - src/mcp/vice/fixtures/dxa/fixture.annostore.json
    - src/mcp/vice/fixtures/dxa/tracer.annostore.json
    - src/mcp/vice/fixtures/export-asm/smc.annostore.json
    - src/mcp/vice/fixtures/ghidra/bank.annostore.json
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json
    - src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json
    - src/mcp/vice/fixtures/petcat/computed-sys.annostore.json
    - src/mcp/vice/fixtures/petcat/not-basic.annostore.json

key-decisions:
  - "The timer-stabilised raster routine touches $D012 exactly once in the whole file (the initial arming, outside the interrupt handler) and never re-arms it -- the raster-compare register keeps naming the same line every frame with no code re-writing it, which is what keeps the raster-register-access signal out of the routine the interrupt vector names and makes the construction genuinely non-canonical rather than a relabelled textbook stabiliser."
  - "No no-operation sled was added anywhere in the raster routine, even though that would have made a second detector signal fire -- the plan explicitly forbids padding a fixture to satisfy a detector, and the routine's header records the absence as a deliberate, verified fact rather than an oversight."
  - "The second self-modification's zero-page pointer is built via a biased compile-time offset (target minus a constant, added back at runtime) rather than a direct label reference, so literally no instruction in the assembled image carries the real target as an operand -- a stronger, independently-testable property than merely using an addressing mode the detector happens to skip."
  - "anno-store-export.ts's generic JSON document format had no field for scopes at all -- `exportAsmTree()` reads scopes straight off an open store handle, never through this export/import path. Rather than working around it in the fixture generator, the format was extended: an optional, additive `scopes` array, STORE_EXPORT_SCHEMA_VERSION unchanged, all nine pre-existing committed fixtures backfilled with an explicit `\"scopes\": []` so a re-export stays deep-equal to what is committed."
  - "The store decomposition types dispatch_hi/dispatch_lo/decline_hi/decline_lo as plain `byte` ranges, not any split-table dataType -- they are parallel arrays (all high bytes, then all low bytes), not interleaved pairs, and the schema's `lo_hi_address`/`hi_lo_address` types describe interleaved pairs only."
  - "Two ACME alignment-directive filler gaps (before the character set, and between the character set and the sprite shape) are folded into the range immediately preceding each gap rather than carved into anonymous filler ranges -- simpler, still honest, and keeps every declared boundary a plain symbol-to-symbol span the generator can validate against a real instruction start."

requirements-completed: [BUILD-04]

coverage:
  - id: D1
    description: "The timer-stabilised (non-canonical) class-4 raster construction is planted: a shared IRQ handler installed through $0314/$0315, a raster-compare register armed exactly once outside the handler, and a one-shot CIA1 Timer A reload written inside the handler at a fixed cycle offset. It presents the timer-reload signal and deliberately neither the raster-register-access signal nor the timing-sled signal, with the choice recorded honestly in the source header; no NOP sled was added to force an extra signal."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the image contains a store pair writing an in-image address into the interrupt vector"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the routine the interrupt vector names contains a write to the first CIA's timer reload registers"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the routine the interrupt vector names contains no run of three or more consecutive no-operation instructions"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the raster fixture's own header names which of the detector's three class-4 signals it presents and which it does not"
        status: pass
      - kind: other
        ref: "grep -a -v -E '^\\s*;' hazard-subject-raster.a | grep -acE '\\$d012' (count 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second self-modification is planted in hazard-subject-smc.a: a zero-page pointer built entirely at runtime from a biased, compile-time-computed offset, then an indirect-indexed store through that pointer landing on another instruction's own operand byte. The class-2 detector misses it by construction (indirect-indexed addressing has no literal target), proven from both sides: no finding at the indirect store's target, the report's own emitted limits naming the miss by name, and no two hazard classes sharing a mechanism id over the whole subject."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the second self-modification's indirect-indexed store lands inside another decoded instruction's byte range, and no instruction in the image carries that target address as a literal operand"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the report over the subject image finds the first self-modification, records the second as a limit, never as a finding, and every hazard class uses a distinct mechanism id"
        status: pass
    human_judgment: false
  - id: D3
    description: "hazard-subject.annostore.json, the committed store export produced through a new generator (make-hazard-subject-annostore.mjs) that assembles the subject, reads real ACME symbol addresses, decomposes the image into a fresh store, and exports it through the existing exportStoreDocument() entry point. Every byte of the image is covered by exactly one range; exactly four ranges (sprite shape, character set, level table, music table) are typed external_file; five scopes (one per hazard-bearing routine) each contain at least one range with none crossing a scope boundary; every in-image branch/call/jump/data-reference target resolves to a declared symbol; the two touching dispatch tables survive as two adjacent, un-coalesced ranges; and the two self-modified bytes carry declining comments rather than a misleading symbol."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the committed store export imports cleanly into a fresh store"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: every address in the committed image is covered by exactly one range in the committed store export"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: exactly four ranges in the committed store export are typed as external files"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: every scope in the committed store export contains at least one range, and no range crosses a scope boundary"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: every in-image branch, call, jump and data-reference target has a declared symbol in the committed store export"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the two touching dispatch ranges are two ranges with adjacent inclusive bounds in the committed store export"
        status: pass
      - kind: other
        ref: "node -e 'external_file ranges===4' over hazard-subject.annostore.json"
        status: pass
      - kind: other
        ref: "grep for planning-vocabulary patterns over hazard-subject.annostore.json (count 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scope support added to anno-store-export.ts's generic JSON export/import document format -- an additive, backward-compatible `scopes` field (STORE_EXPORT_SCHEMA_VERSION unchanged), with all nine pre-existing committed .annostore.json fixtures backfilled so a fresh re-export stays deep-equal to what is committed."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-store-export.test.ts (9/9 passing unchanged)"
        status: pass
      - kind: integration
        ref: "anno-decomp-closure.test.ts (24/24 passing -- Test 1 re-export deep-equal against all nine committed fixtures)"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts (206/206 passing unchanged)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full automated suite (npm run test:automated) shows exactly the same six pre-existing failing test names the measured baseline records, and no seventh; typecheck exits zero."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "npm run test:automated -- failing set {anno-import.test.ts:352, anno-register.test.ts:385, anno-register.test.ts:479, audit-integrity.test.ts:245, docs-deferred-ledger.test.ts:101, docs-deferred-ledger.test.ts:195}"
        status: pass
      - kind: integration
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 04: The Fourth Hazard Class, the Deliberately Undetected Self-Modification, and the Committed Store Export Summary

**The subject now carries all four planted hazard classes -- a timer-stabilised (non-canonical) raster routine and an indirect-indexed self-modification the detector proves missed -- and a committed `.annostore.json` decomposition describes every byte of it, closing a scope-export gap in `anno-store-export.ts` along the way.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-12T21:47:00Z
- **Completed:** 2026-09-12T22:37:18Z
- **Tasks:** 3
- **Files modified:** 19 (3 created, 16 modified)

## Accomplishments

- `hazard-subject-raster.a`: the timer-stabilised (non-canonical) class-4 construction -- a shared IRQ handler through $0314/$0315, one raster-compare arming outside the handler, and a one-shot CIA1 Timer A reload inside it; presents only the timer-reload signal, records honestly which of the other two signals it deliberately lacks, and adds no NOP sled to manufacture a second one
- `hazard-subject-smc.a` gains a second self-modification: a zero-page pointer built at runtime from a biased, compile-time-computed offset, then an indirect-indexed store landing on another instruction's operand byte -- the class-2 detector misses it by construction, and the miss is proven from both sides plus a whole-subject check that no two hazard classes share a mechanism id
- `hazard-subject.annostore.json` (via the new `make-hazard-subject-annostore.mjs` generator): a committed store export covering every byte of the image, typing the four data tables `external_file`, declaring five scopes with no boundary-crossing range, resolving every in-image reference to a symbol, and preserving the two touching dispatch tables as two adjacent ranges
- `anno-store-export.ts` gains scope round-tripping (additive `scopes` field, schema version unchanged) -- a gap discovered mid-task rather than worked around, with all nine pre-existing committed fixtures backfilled to keep their own re-export tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Plant the timer-stabilised raster routine -- the fourth class, in its non-canonical form** - `35ba1036` (feat)
2. **Task 2: Plant the self-modification the detector is designed to MISS, and record the miss** - `cb7686ed` (feat)
3. **Task 3: Commit the annotation-store export that describes the subject** - `2925a61c` (feat)

## Files Created/Modified

- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-raster.a` - the planted timer-stabilised raster construction
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json` - the committed store export
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs` - the export's regenerator
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` - root: gained a fourth `!source` line and the raster entry call
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a` - gained the second self-modification
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` / `hazard-subject-misaligned.prg` - regenerated images
- `src/mcp/vice/hazard-subject-fixture.test.ts` - 12 new `hazard subject:` tests across all three tasks
- `src/mcp/vice/anno-store-export.ts` - `StoreExportScopeRow`, the `scopes` field, export/import handling
- `src/mcp/vice/anno-decomp-closure.test.ts` - one literal `StoreExportDocument` fixture updated with `scopes: []`
- nine pre-existing `*.annostore.json` fixtures - backfilled with `"scopes": []`

## Decisions Made

See `key-decisions` in this file's frontmatter for the full list. The two load-bearing ones: the raster routine touches `$D012` exactly once in the whole file (never re-arming it), which is what keeps it structurally non-canonical; and the second self-modification's pointer is built via a biased runtime computation so literally no instruction anywhere carries the real target address as an operand, a stronger property than merely picking an addressing mode the detector happens to skip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `anno-store-export.ts` had no route for scopes at all**
- **Found during:** Task 3, while producing the committed store export
- **Issue:** The plan's own acceptance criteria require verifying "every scope contains at least one range" and "no range crosses a scope boundary" against a freshly re-imported store built from the committed JSON export. `anno-store-export.ts`'s `StoreExportDocument`/`exportStoreDocument()`/`importStoreDocument()` had no field for scopes at all -- `exportAsmTree()` (the multi-file export path) reads scopes straight off an open store handle via `listScopes()`, never through this generic export/import path. A committed export produced without scope support would silently lose every scope the moment it was re-imported into a fresh store, exactly the case this plan's own acceptance criteria exercise.
- **Fix:** Added `StoreExportScopeRow`, an additive (optional, backward-compatible) `scopes` field on `StoreExportDocument`, and full export/import handling through the existing `addScope()`/`listScopes()` API. `STORE_EXPORT_SCHEMA_VERSION` is unchanged; `importStoreDocument()` treats an absent `scopes` array as empty. All nine pre-existing committed `.annostore.json` fixtures were backfilled with an explicit `"scopes": []` so their own re-export-deep-equal tests stayed green.
- **Files modified:** `src/mcp/vice/anno-store-export.ts`, `src/mcp/vice/anno-decomp-closure.test.ts`, and nine `*.annostore.json` fixtures.
- **Verification:** `anno-store-export.test.ts` (9/9), `anno-decomp-closure.test.ts` (24/24), `anno-export-asm.test.ts` (206/206) all pass; `npm run typecheck` exits 0.
- **Committed in:** `2925a61c` (Task 3 commit)

**2. [Rule 1 - Bug] A fixture test's own literal-operand scan produced false positives over data bytes**
- **Found during:** Task 2 and Task 3, first test runs
- **Issue:** `decode()` has no notion of code vs. data and happily decodes raw bytes in the BASIC loader stub and the music data table as plausible-looking instructions with their own resolved branch targets and immediate operands. Two new tests that scanned the WHOLE decoded image for "does any instruction carry this address as a literal operand" hit coincidental matches from these non-code regions, which are not real references at all.
- **Fix:** Narrowed the second-self-modification test to ABSOLUTE/ZEROPAGE-mode operands only (dropping the single-byte immediate check, which is inherently noisy). Narrowed the reference-resolution test to only consider instructions whose own address falls inside a CODE-typed range from the store's own decomposition, before trusting a decoded "instruction" as evidence of a real reference.
- **Files modified:** `src/mcp/vice/hazard-subject-fixture.test.ts`
- **Verification:** Both affected tests pass; the underlying claims (no instruction carries the second self-modification's target as an operand; every real reference resolves to a symbol) are unweakened -- only the false-positive source (data misdecoded as instructions) was excluded.
- **Committed in:** `cb7686ed` (Task 2), `2925a61c` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 missing-critical infrastructure gap, 1 bug in this plan's own new tests)
**Impact on plan:** Both were necessary for the plan's own acceptance criteria to hold against real, re-imported data rather than against a hand-authored assumption. No scope creep beyond what the three tasks already specified: the scope-support addition is exactly the capability the plan's own read_first pointed at, and the test narrowing only removes false positives, changing no asserted claim.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four hazard classes are now planted in the subject, each documented against the published idiom it deviates from, each proven present at the byte level by an independent fixture test (never a detector's own opinion).
- The committed `hazard-subject.annostore.json` is the input plan 48-06's reassembly criterion runs on; `anno-store-export.ts`'s new scope support means the multi-file export path (Phase 47) can now read real scopes from a re-imported subject store rather than finding none.
- No blockers. Plan 48-01's readiness note named plans 48-05 (the cross-check formalisation) and 48-06 (the multi-file reassembly) as the phase's remaining work; this plan's own scope (the fourth class, the deliberate miss, and the committed export) is complete.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-12*

## Self-Check: PASSED

- All three created files found on disk (`hazard-subject-raster.a`, `hazard-subject.annostore.json`, `make-hazard-subject-annostore.mjs`).
- All 3 task commits found in git log (`35ba1036`, `cb7686ed`, `2925a61c`).
- `npm run typecheck` exits 0.
- `node --test hazard-subject-fixture.test.ts` reports 36/36 passing.
- `npm run test:automated` shows exactly the same 6 pre-existing failing test names the plan's measured baseline records, and no others.
- `node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` and `make-hazard-subject-annostore.mjs` both re-run cleanly with identical output (sha256-verified for the store export; `git status --porcelain` empty for both committed images).
- `node --e 'external_file ranges===4'` over the committed store export passes; a full grep for planning-vocabulary patterns across it returns zero hits.
- `node --test anno-store-export.test.ts anno-decomp-closure.test.ts anno-export-asm.test.ts` all pass in full (9, 24, 206 respectively), confirming the `anno-store-export.ts` scope-support addition and the nine backfilled fixtures introduced no regression.
