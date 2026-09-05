---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 08
subsystem: annotation-store
tags: [ghidra-pre-script, dxa-feedback, phantom-labels, graphics-derivation, auto-07, observed-red]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-07's anno-graphics.ts (deriveGraphicsRanges(), GraphicsRange/GraphicsMap/GraphicsConstWriteFact shaped to match dxa-blocks.ts's KnownDataRow with no translation layer)"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-06's bank-state resolution wired into runMemmapJoin() -- the constWrites-gated no-op contract this plan's own graphics write-back reuses"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-03's selection rules and provenance token in anno-join.ts, untouched by this plan"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-02's CONST_WRITES export section and parseConstWrites()/ConstWriteFact, whose watched-address set already covers $DD00/$D018/$D011"
provides:
  - "DataRangeSeed.java: a new Ghidra pre-script marking an inclusive range as undefined data before analysis, driven by the new dataRangesPath wire field"
  - "runMemmapJoin()'s graphics write-back: derives ranges from constWrites, writes the caller-selected map via the existing setDataType() call, surfaces contradicted-comment/split-table disclosures"
  - "A live-measured, committed proof that phantom function labels a graphics region mints when decoded as code are present before the feedback and absent after (fixtures/ghidra/charset-phantom-minted-labels.json)"
affects: []

# Actuals (#2632)
actuals:
  tokens: 27840
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second -preScript pair emitted unconditionally BEFORE the caller-supplied one, activated by a single new optional field, when a Ghidra pre-script must run before another pre-script's own analyzeAll() call -- argv order is the only synchronisation Ghidra's -preScript repetition offers"
    - "A graphics write-back gated on the SAME optional-argument presence check an earlier plan's bank-state block already established (constWrites !== undefined), so both features share one no-op contract rather than inventing a second"
    - "listRanges()'s RangeRow output is structurally identical to dxa-blocks.ts's KnownDataRow (start/endInclusive/dataType) -- rows reach the already-built emitters with a field-selecting map, never a second emitter or a translation layer"

key-files:
  created:
    - src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java
    - src/mcp/vice/fixtures/ghidra/charset-phantom.a
    - src/mcp/vice/fixtures/ghidra/charset-phantom.prg
    - src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-08-phantom-labels-before-after.md
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/resources/ghidra-project.mjs
    - src/mcp/vice/ghidra-run.ts
    - src/mcp/vice/anno-join.ts
    - src/mcp/vice/anno-join.test.ts
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/anno-bank.test.ts
    - src/mcp/vice/join-image-controls.test.ts
    - src/mcp/vice/fixtures/ghidra/README.md

key-decisions:
  - "dataRangesPath carries NO second script-name field -- DataRangeSeed.java's own filename is a fixed constant (ghidra-project.mts's DATA_RANGE_SEED_SCRIPT_NAME), resolved by Ghidra against the SAME -scriptPath directory every caller already supplies, mirroring how GHIDRA_STOCK_6502_LANGUAGE_FILES names a fixed set rather than accepting one on the wire. This keeps dataRangesPath the ONE new field this plan adds, per D-37-33."
  - "DataRangeSeed.java's own -preScript pair is ALWAYS emitted first in argv, before any caller-supplied preScript -- VERIFIED live: analyzeHeadless runs -preScript entries strictly in argv order, and VolatileCarve.java's own run() calls analyzeAll() itself at the end of its own execution, so the data ranges must already be marked before that call or code discovery would already have run over them."
  - "The phantom-label proof is flat-64K-route only. anno-graphics.ts's derived range is computed from register VALUES (a hardware-address-space fact); the .prg route's own two-byte BinaryLoader shift (documented since plan 37-02) misaligns that range against where the fixture's charset bytes actually land on THAT route. The .prg route's own CONST_WRITES/derivation half is exercised in a separate gated case; the phantom-label count is not asserted there."
  - "The fixture's charset bytes are a chain of 4-byte jsr/rts blocks, each jsr targeting the block immediately following it, reached via ONE real jsr from the fixture's own entry point -- standing in for whatever caused a real analyser to look inside a graphics region in the first place. MEASURED live: this mints 512 phantom function labels (FUN_1000 through FUN_17fc) before the feedback, and exactly 0 after DataRangeSeed.java marks the range as data."
  - "An exact-last-byte-boundary chain variant (a special final jsr targeting the range's own last address directly) was tried live and produced an unexpected decompiler artifact (the far jsr's own call target was misreported by Ghidra's decompiler in a way this session did not fully diagnose) -- reverted to the simpler, verified chain. The exact-first/exact-last-byte backstop truth is instead discharged structurally (a hermetic unit test asserting the membership predicate over the real derived range's own boundaries), consistent with this must_have's own 'verification: backstop' marking."
  - "The graphics write-back's own disclosure fields (graphicsContradictedComments/graphicsReinterpretedSplitTables) are always present on JoinCounts, mirroring SetDataTypeResult's own 'always present, often empty' convention -- and the full disclosure arrays ride alongside on a separate graphics record, so neither the counts nor the raw disclosures are dropped."
  - "graphicsMapIndex is a new optional argument to runMemmapJoin(), defaulting to 0, refusing (AnnoJoinError) rather than clamping when out of range -- writing more than one of deriveGraphicsRanges()'s several maps would write mutually-contradicting ranges into the same store by construction (D-37-27)."

requirements-completed: [AUTO-07]

coverage:
  - id: D1
    description: "A new Ghidra pre-script (DataRangeSeed.java) marks an inclusive range as undefined data before analysis, driven by a new optional dataRangesPath wire field threaded through both host-bound modules and their committed build artifacts, and through the container-side run module -- a request omitting it resolves exactly as before this plan"
    requirement: AUTO-07
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_ARG_KEYS/HOST_TOOL_PATH_ARG_KEYS: ghidra.analyze and ghidra.installExtension's own allowlist arrays contain exactly their documented members"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS: every declared path key refuses an escaping value and an absolute value (non-vacuity)"
        status: pass
      - kind: integration
        ref: "ghidra-live.test.ts#ghidra-live AUTO-07 (after): the SAME fixture, with dataRangesPath applied, mints ZERO function labels inside the SAME derived character-set range"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real, live run over a graphics-bearing fixture proves the labels a graphics region mints when decoded as code are present before the feedback and absent after, on the flat-64K route, with the derived range computed from the run's own real CONST_WRITES facts rather than hard-coded"
    requirement: AUTO-07
    verification:
      - kind: e2e
        ref: "ghidra-live.test.ts#ghidra-live AUTO-07 (before): a real run over charset-phantom.prg with NO graphics feedback mints a non-empty set of function labels inside the derived character-set range"
        status: pass
      - kind: e2e
        ref: "ghidra-live.test.ts#ghidra-live AUTO-07 (after): the SAME fixture, with dataRangesPath applied, mints ZERO function labels inside the SAME derived character-set range"
        status: pass
      - kind: e2e
        ref: "ghidra-live.test.ts#ghidra-live AUTO-07 (prg route, CONST_WRITES only): the fixture's own register writes resolve on the .prg route too"
        status: pass
    human_judgment: false
  - id: D3
    description: "The requirement is gated in the automated suite the CI actually runs, not only the manual-only live file -- four automated cases assert over Task 2's committed captured artifacts that the before-set is non-empty, the after-set is empty, first/last-byte boundary membership is correct, and case-sensitive label-name comparison holds"
    requirement: AUTO-07
    verification:
      - kind: unit
        ref: "anno-join.test.ts#AUTO-07 hermetic gate: the committed before-set is non-empty"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#AUTO-07 hermetic gate: the committed after-set is empty"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#AUTO-07 hermetic gate: a label at the exact first address and one at the exact last address of the derived range are both classified inside it"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#AUTO-07 hermetic gate: two label names differing only by case are counted as two distinct labels"
        status: pass
    human_judgment: false
  - id: D4
    description: "Derived graphics ranges reach the disassembler through the already-built emitters (dxa-blocks.ts), with no second emitter written: zero rows omit the file, touching ranges stay two lines, overlaps are refused, a one-byte range is one line, two runs are byte-identical and ascending; the join's own range write-back writes each range via the existing setDataType() call and surfaces its contradicted-comment/split-table disclosures rather than dropping them"
    requirement: AUTO-07
    verification:
      - kind: unit
        ref: "anno-join.test.ts#runMemmapJoin (graphics write-back): writes each derived range as a typed range, and the store's range listing returns them after a close and a reopen"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#runMemmapJoin (graphics write-back): the contradicted-comment and split-table disclosures the range write reported are surfaced in the join's own return, neither dropped"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#the graphics write-back's own listRanges() rows reach emitDataBlocks() unchanged in shape: three ranges, ascending by start, byte-identical across two runs"
        status: pass
      - kind: unit
        ref: "anno-join.test.ts#two overlapping derived-shaped ranges are refused by the existing emitter rather than silently unioned"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 08: The dxa and Ghidra feedback, and the phantom labels present before and absent after Summary

**A new Ghidra pre-script (`DataRangeSeed.java`) and its `dataRangesPath` wire field mark derived graphics ranges as data before analysis runs; `runMemmapJoin()` writes those same ranges back into the store through the existing `setDataType()` call and feeds them to the disassembler through the already-built emitters; and a real, live run over a new synthetic fixture measures 512 phantom function labels minted inside the derived character-set range before the feedback, and exactly 0 after.**

## Performance

- **Duration:** ~48 min
- **Started:** ~2026-09-05T08:39:42Z (estimated, immediately after 37-07's closing commit)
- **Completed:** 2026-09-05T09:27:31Z
- **Tasks:** 3
- **Files modified:** 17 (5 created, 12 modified)

## Accomplishments

- `DataRangeSeed.java` -- a new Ghidra pre-script mirroring `VolatileCarve.java`'s own plumbing shape (a file of facts read once, acted on per entry, one diagnostic line per outcome, a summary count) with the OPPOSITE semantics: it clears whatever is currently defined across an inclusive range and redefines the whole range as undefined data, one byte at a time, so code discovery never treats those bytes as instructions. Malformed lines and inverted ranges are refused by name with a diagnostic, never skipped silently, and the run continues over the remaining lines.
- `dataRangesPath` -- the ONE new wire field this plan adds to `ghidra.analyze`, threaded through `host-tool.mts`'s argument-key/path-argument-key allowlists, its `GhidraAnalyzeArgs`/`ResolvedGhidraAnalyzePaths` interfaces, its narrowing arm and its `buildHostToolArgv()` branch; through `ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()` (a fixed script name, `DATA_RANGE_SEED_SCRIPT_NAME`, emitted as an UNCONDITIONAL first `-preScript` pair whenever the field is present -- before any caller-supplied `preScript`, since `VolatileCarve.java`'s own `analyzeAll()` call must never run before the data ranges are marked); and through `ghidra-run.ts`'s container-side wire args. A request omitting it resolves exactly as before this plan.
- `charset-phantom.a`/`.prg` -- a new fixture writing a complete, real `$DD00=$3f`/`$D018=$04`/`$D011=$1b` combination (bank base `$0000`, character-set range `$1000`-`$17ff`) whose derived range is filled with 511 four-byte `jsr`/`rts` blocks, each targeting the block immediately following it, reached by one real `jsr` from the fixture's own entry point.
- **Measured live against real Ghidra 12.1.3**, flat-64K route: WITHOUT `dataRangesPath`, `## DECOMPILED_TEXT` carries 513 functions, 512 of them inside the derived character-set range (`FUN_1000` through `FUN_17fc`) -- none of them matching the ROADMAP's cited example names (`zpp_02`/`zpa_06`/`f_1B1A`), which are Ghidra's own genuine `FUN_<addr>` default naming convention, not a fabricated match; WITH `dataRangesPath` (a one-line range file naming the same derived range), exactly 1 function survives -- the fixture's own real entry point. Both label sets are committed as measured output in `fixtures/ghidra/charset-phantom-minted-labels.json` and the full transcript is in `evidence/37-08-phantom-labels-before-after.md`.
- `runMemmapJoin()` gains a graphics write-back step (gated on the SAME `constWrites !== undefined` condition the bank-state block already uses): `deriveGraphicsRanges()` over the recovered register facts selects one map (`graphicsMapIndex`, default 0, out-of-range refuses by name), and each of its ranges is written via the EXISTING `setDataType()` call -- no second emitter. The contradicted-comment and split-table disclosures a range write can report are surfaced on the returned record and its counts (`graphicsContradictedComments`/`graphicsReinterpretedSplitTables`), never dropped.
- The disassembler feedback reuses `dxa-blocks.ts`'s already-built `emitDataBlocks()`/`emitLabels()` unchanged: `listRanges()`'s own `RangeRow` output is structurally identical to `KnownDataRow` (`start`/`endInclusive`/`dataType`), so rows reach the emitters with a field-selecting map, never a translation layer or a second writer -- proven hermetically for zero rows (no file written), touching ranges (two lines, never merged), overlap (refused), a one-byte range (one line, equal addresses), and determinism (two runs byte-identical, ascending by start).
- Four automated hermetic cases in `anno-join.test.ts` assert over Task 2's committed captured artifacts (never a live Ghidra installation): the before-set is non-empty, the after-set is empty, first/last-byte boundary membership classifies correctly, and two label names differing only by case count as two distinct labels -- so the requirement has a gate in the suite `npm run test:automated` actually runs, not only in the manual-only live file.

## Task Commits

Each task was committed atomically:

1. **Task 1: The data-range pre-script, its wire field, and the graphics-bearing fixture** - `b432d522` (feat)
2. **Task 2: Capture the minted-label set before the feedback, from a real run** - `21a75b4f` (test)
3. **Task 3: Apply the feedback to both consumers, and show the label set empty after** - `0ba84cbb` (feat)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-08):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java` - the new mark-as-data pre-script
- `src/mcp/vice/fixtures/ghidra/charset-phantom.a`/`.prg` - the graphics-bearing before/after fixture
- `src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json` - the committed measured before/after label sets, the real CONST_WRITES facts, and the derived range
- `src/mcp/vice/fixtures/ghidra/README.md` - provenance for the new fixture, its address trace on both routes, and why the `.prg` route is unusable for the phantom-label proof specifically
- `src/mcp/vice/host-tool.mts`/`resources/host-tool.mjs` - `dataRangesPath`'s allowlists, interfaces, narrowing arm, resolution and argv-building
- `src/mcp/vice/ghidra-project.mts`/`resources/ghidra-project.mjs` - `DATA_RANGE_SEED_SCRIPT_NAME`, the argv-key set, and the always-first `-preScript` emission
- `src/mcp/vice/ghidra-run.ts` - `dataRangesPath` threaded through the container-side wire args
- `src/mcp/vice/anno-join.ts` - the graphics write-back (`GraphicsWriteBack`, `graphicsMapIndex`, the new `JoinCounts` fields)
- `src/mcp/vice/anno-join.test.ts` - the write-back's own hermetic cases, the disassembler-feedback shape cases, and the four automated hermetic gate cases
- `src/mcp/vice/ghidra-live.test.ts` - the live before/after/prg-route gated cases
- `src/mcp/vice/host-tool.test.ts` - two pinned allowlist censuses updated for the new field
- `src/mcp/vice/anno-bank.test.ts`, `src/mcp/vice/join-image-controls.test.ts` - scratch-tree module shims updated for `anno-join.ts`'s new fourth sibling import
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-08-phantom-labels-before-after.md` - the full before/after transcript

## Decisions Made

- **`dataRangesPath` carries no second script-name field.** `DataRangeSeed.java`'s own filename is a fixed constant, resolved by Ghidra against the same `-scriptPath` directory every caller already supplies -- mirroring how `GHIDRA_STOCK_6502_LANGUAGE_FILES` names a fixed set rather than accepting one on the wire. This keeps `dataRangesPath` the ONE new field this plan adds.
- **`DataRangeSeed.java`'s own `-preScript` pair is always emitted first in argv.** VERIFIED live: `analyzeHeadless` runs `-preScript` entries strictly in argv order, and `VolatileCarve.java`'s own `run()` calls `analyzeAll()` itself at the end of its own execution -- the data ranges must already be marked before that call, or code discovery would already have run over them.
- **The phantom-label proof is flat-64K-route only.** `anno-graphics.ts`'s derived range is a hardware-address-space fact; the `.prg` route's own two-byte `BinaryLoader` shift (documented since plan 37-02) misaligns that range against where the fixture's charset bytes actually land on that route. The `.prg` route's own CONST_WRITES/derivation half is exercised separately; the phantom-label count is not asserted there.
- **The fixture's byte pattern is a real-jsr-triggered chain, not an artificially-seeded entry point.** The fixture's own real code does exactly one `jsr` into the derived range, standing in for whatever caused a real analyser to look there -- ordinary call-reference-driven code discovery does the rest, chaining through 511 further blocks.
- **An exact-last-byte chain variant was tried live and reverted.** A special final `jsr` targeting the range's own last address directly produced an unexpected decompiler artifact (Ghidra's own decompiler reported a different call target than the raw bytes encode, for a reason this session did not fully diagnose) -- reverted to the simpler, already-verified uniform chain. The exact-first/exact-last-byte backstop truth is discharged structurally instead (a hermetic membership-predicate test over the real derived range's own boundaries), consistent with this must_have's own `verification: backstop` marking.
- **`graphicsMapIndex` defaults to 0 and refuses (never clamps) when out of range.** Writing more than one of `deriveGraphicsRanges()`'s several maps would write mutually-contradicting ranges into the same store by construction (D-37-27).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two pinned allowlist censuses in `host-tool.test.ts` needed updating for the new field**
- **Found during:** Task 1's verify run (`node --test host-tool.test.ts`)
- **Issue:** `HOST_TOOL_PATH_ARG_KEYS`'s own hand-pinned total (16) and `ghidra.analyze`'s own hand-pinned member list both moved when `dataRangesPath` was added.
- **Fix:** Raised the pinned total from 16 to 17 (two assertion sites) and added `dataRangesPath` to the documented member list, each with a dated comment naming this plan.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** `node --test host-tool.test.ts` -- 156/156 pass
- **Committed in:** `b432d522` (Task 1 commit)

**2. [Rule 2 - Missing Critical] `anno-join.test.ts`'s structural no-agent/no-queue/no-skill scan did not cover the new `anno-graphics.ts` sibling**
- **Found during:** Task 3, reviewing `AUTO-01`'s own structural proof after adding the new import
- **Issue:** `anno-graphics.ts` is now genuinely part of the join's own module graph (imported by `anno-join.ts`); leaving it out of `SCANNED_MODULES` would silently narrow `AUTO-01`'s own already-established invariant.
- **Fix:** Added `"anno-graphics.ts"` to `SCANNED_MODULES`.
- **Files modified:** `src/mcp/vice/anno-join.test.ts`
- **Verification:** `node --test anno-join.test.ts` -- 26/26 pass, including the structural proof
- **Committed in:** `0ba84cbb` (Task 3 commit)

**3. [Rule 1 - Bug introduced by this plan's own change] Two scratch-tree module builders (`anno-bank.test.ts`, `join-image-controls.test.ts`) could no longer resolve `anno-join.ts`'s new fourth sibling import**
- **Found during:** `npm run test:automated`'s Task 3 verify run
- **Issue:** `anno-join.ts` now imports a FOURTH sibling (`./anno-graphics.ts`), but two pre-existing scratch-tree builders (built before this plan landed) only shimmed the first three (`anno-store.ts`, `memmap-lookup.ts`, `anno-bank.ts`) -- their dynamically-imported scratch copies of `anno-join.ts` failed to resolve with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Added a fourth re-export shim (`anno-graphics.ts`, forwarding by absolute path to the real, unmutated file) to both builders, mirroring the existing `anno-bank.ts` shim precedent each already carried.
- **Files modified:** `src/mcp/vice/anno-bank.test.ts`, `src/mcp/vice/join-image-controls.test.ts`
- **Verification:** `node --test anno-bank.test.ts join-image-controls.test.ts` -- 20/20 pass; `npm run test:automated` (broker confirmed absent) shows no failure in either file
- **Committed in:** `0ba84cbb` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking/completeness census corrections, 1 missing-critical completeness fix, 1 bug this plan's own new import introduced). **Impact:** all four are guard/completeness corrections required to keep this plan's own new field and new module consistent with pre-existing structural gates and sibling plans' own scratch-tree controls; none changed this plan's own scope or the shape of any exported function.

## Issues Encountered

None beyond the deviations above. `ps -eo pid,cmd | grep -i "vice-broker\|x64sc"` confirmed no live broker before every `npm run test:automated` run this session.

## User Setup Required

None - no external service configuration required. (A real Ghidra 12.1.3 installation with the vendored `6502:LE:16:nmos` language extension already installed was required for and used during this plan's own live verification, per the phase's standing precedent -- no new setup step for a future session.)

## Next Phase Readiness

- `AUTO-07` is complete: derived graphics ranges reach the disassembler through the already-built mechanism and the analyser through a new one, and the labels a graphics region mints when decoded as code are measured present before the feedback and absent after, with a gate in the automated suite in addition to the live manual-only file.
- This is the LAST plan in Phase 37 -- all of `AUTO-01`..`AUTO-08` are now complete, closing the phase's requirement set.
- No blockers. `npm run test:automated` (broker confirmed absent via `ps -eo pid,cmd`) measured at 3512 tests / 3499 pass / 2 fail, both pre-existing in `anno-register.test.ts` -- the same documented pair every prior phase-37 plan has recorded, unchanged by this plan.

## Self-Check: PASSED

- `src/mcp/vice/vendor/ghidra-scripts/DataRangeSeed.java` — FOUND
- `src/mcp/vice/fixtures/ghidra/charset-phantom.a` — FOUND
- `src/mcp/vice/fixtures/ghidra/charset-phantom.prg` — FOUND
- `src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-08-phantom-labels-before-after.md` — FOUND
- Commit `b432d522` — FOUND in `git log --oneline --all`
- Commit `21a75b4f` — FOUND in `git log --oneline --all`
- Commit `0ba84cbb` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node build.ts && node --test resources-sync.test.ts` 2/2 pass, no drift; `node --test host-tool.test.ts ghidra-project.test.ts hostpath-consumers.test.ts` 156/156 pass; `node --test anno-join.test.ts dxa-blocks.test.ts dxa-seam.test.ts anno-store.test.ts` all pass; `node --test ghidra-live.test.ts` with the opt-in unset exits 0, 21/21 skipped with named reasons; with `GHIDRA_HOME`/`VICE_LIVE_GHIDRA=1` set, exits 0, 19 pass / 0 fail / 2 pre-existing corpus-skips; `acme -f cbm` reassembles `charset-phantom.a` byte-for-byte; the evidence file carries both `before` and `after` and `12.1.3` and `roadmap`/`ROADMAP` and `dataRangesPath`; `git status --porcelain` over the modified source files -- 0 lines; `npm run test:automated` (broker confirmed absent) 3512 tests / 3499 pass / 2 fail, both pre-existing in `anno-register.test.ts`.

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
