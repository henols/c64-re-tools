---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 06
subsystem: annotation-store
tags: [anno-bank, anno-join, bank-state, processor-port, planted-violation, observed-red, pitfall-23, auto-04, auto-05]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-02's path-dependent fixture (bank-path-dependent.a/.prg), the committed export-bank-path-dependent.txt capture, and parseConstWrites()/ConstWriteFact in anno-import.ts"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-01's BANK_CONDITIONAL_RANGES in memmap-lookup.ts and anno-join.ts's declined outcome/JoinCounts.declined field, landed unused for exactly this plan"
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-03's three-deep selectMemmapEntry() order and its entries-array parameter, which the candidate constraint narrows BEFORE calling"
provides:
  - "anno-bank.ts: decodeBankState() (D-37-21 bit arithmetic), isBankConditionalAddress(), resolveBankedRegion(), regionAdmitsEntry() (the region-to-map-entry consistency table over memmap.json's structured section field)"
  - "anno-join.ts's runMemmapJoin() gains an optional constWrites argument activating D-37-24's reaching-values computation and D-37-23's decline rule for addresses inside BANK_CONDITIONAL_RANGES -- a complete no-op when omitted, preserving every pre-37-06 call site's answer byte-for-byte"
  - "Two committed red transcripts discharging the phase's fifth and sixth (last) required observed-red controls: the bank-decode bypass and the forward-carried decline"
affects: ["37-08"]

# Actuals (#2632)
actuals:
  tokens: 18564
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A candidate constraint implemented as a PRE-FILTER of the entries array already passed into the existing selectMemmapEntry(), rather than a new parameter on that function -- keeps memmap-lookup.ts untouched while still narrowing the search space BEFORE the three-step order runs"
    - "An optional collection argument (constWrites) whose OMISSION (undefined), not its emptiness, is the activation switch for a whole new code path -- distinguishes 'this run carries no bank-state evidence at all' from 'this run has evidence but nothing reaches here', so every pre-existing caller's answer stays byte-identical"
    - "A region-to-map-entry consistency table keyed on the STRUCTURED section field for four regions, and a whole-word label match for the one region (RAM) with no dedicated section anywhere in the three bank-conditional ranges"

key-files:
  created:
    - src/mcp/vice/anno-bank.ts
    - src/mcp/vice/anno-bank.test.ts
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-path-dependent-decline-red.md
  modified:
    - src/mcp/vice/anno-join.ts
    - src/mcp/vice/anno-join.test.ts
    - src/mcp/vice/join-image-controls.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/package.json

key-decisions:
  - "The candidate constraint narrows the ENTRIES ARRAY passed into the existing, unmodified selectMemmapEntry(), rather than adding a new parameter to that function -- memmap-lookup.ts stays untouched, and the narrowing genuinely happens BEFORE the three-step selection order runs, satisfying D-37-22's 'before the address, not a post-filter' wording without a wrapper around selectMemmapEntry()'s own result."
  - "runMemmapJoin()'s new constWrites argument activates the whole bank-state machinery only when EXPLICITLY supplied (even []) -- undefined, every pre-37-06 call site, is a complete no-op. This is what makes 'the candidate-constraint argument must not change any unconstrained selection's answer' true by construction rather than by re-testing every existing case."
  - "The region-to-map-entry consistency table matches the STRUCTURED section field for io_area/character_rom/basic_rom/kernal_rom (e.g. section containing 'VIC'/'SID'/'CIA'/'Character ROM'/'BASIC ROM'/'KERNAL ROM'), and a whole-word RAM label match for the ram region specifically, because MEASURED this plan: no committed memmap.json section names RAM anywhere inside any of the three bank-conditional ranges -- only the map's own 'depends on the processor port' entries describe RAM as one of several possibilities, in their label text."
  - "The two flip tests' reachability edges are authored directly via putXref(), not derived from the real capture's own REFERENCES section -- plan 37-02's README already recorded that the .prg route's own internal-jsr defect means probe's real body never appears in that section at all. The edges instead mirror the SAME real, measured address trace that README's own table records, so the test still asserts against real data (the const-write facts) without pretending the buggy route proves reachability it cannot prove."
  - "The reaching-values computation's 'unknown' shape is kept in the type but never produced by current code -- MEASURED this plan: nothing in listXrefs()'s XrefRow data can currently signal a dropped or unresolved reference, so inventing a trigger for it would be fabricated nondeterminism, not a real limitation. Documented in anno-join.ts's own header rather than silently omitted from the type."

requirements-completed: [AUTO-04, AUTO-05]

coverage:
  - id: D1
    description: "Bank state is resolved BEFORE the address: decodeBankState()'s bit arithmetic, resolveBankedRegion()'s per-range lookup, and the region-to-map-entry candidate constraint (regionAdmitsEntry()) narrow selectMemmapEntry()'s own entries array before the three-step selection order ever runs"
    requirement: "AUTO-04"
    verification:
      - kind: unit
        ref: "anno-bank.test.ts#decodeBankState(0x37)/0x34/0x33 report the I/O area/RAM/Character ROM at the I/O range respectively, plus the bits-above-2-ignored case"
        status: pass
      - kind: unit
        ref: "anno-bank.test.ts#resolveBankedRegion() for an address outside all three bank-conditional ranges reports not_applicable, not RAM"
        status: pass
      - kind: integration
        ref: "anno-bank.test.ts#driven from the committed captured export: the shared subroutine's border-colour-register write resolves under the all-RAM value ($34) to a comment whose label is NOT the border colour label"
        status: pass
      - kind: integration
        ref: "anno-bank.test.ts#driven from the same capture: the shared subroutine's sprite-0-X-register read resolves under the character-ROM value ($33) to a comment whose label is NOT the sprite-0-X label"
        status: pass
    human_judgment: false
  - id: D2
    description: "A program point the program does not determine (empty reaching-values set, or several values decoding to different regions) DECLINES with a reason naming the absence or both disagreeing values, never defaulting to the power-on value or carrying one value forward; several values decoding to the SAME region still annotate"
    requirement: "AUTO-05"
    verification:
      - kind: unit
        ref: "anno-bank.test.ts#a program point reached by no recovered value declines with a reason naming the absence; it never defaults to the power-on value"
        status: pass
      - kind: unit
        ref: "anno-bank.test.ts#a program point reached by two values decoding to different regions for its range declines with a reason naming both values and the address"
        status: pass
      - kind: unit
        ref: "anno-bank.test.ts#a program point reached by two values decoding to the SAME region for its range annotates, and the decision records that the values differed but the region did not"
        status: pass
      - kind: unit
        ref: "anno-bank.test.ts#a decline and a no-map-entry skip are different outcomes with different reasons"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two of the phase's six required observed-red controls, discharged: bypassing the processor-port decode stops the real $34/$33 flip and mislabels $D020 as the border colour; replacing the decline with a forward-carried value annotates the real disagreeing-values address the committed code correctly declines"
    requirement: "AUTO-04"
    verification:
      - kind: unit
        ref: 'anno-bank.test.ts#"PLANTED VIOLATION: bypassing decodeBankState() makes the $34/$33 flip stop changing the annotation, and the border-colour write is now labelled the border colour"'
        status: pass
      - kind: unit
        ref: 'anno-bank.test.ts#"PLANTED VIOLATION: replacing the decline branch with a forward-carried value produces an annotation where the committed code correctly stays silent"'
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 06: The Processor-Port Decode, Region Resolution, and Decline Summary

**`anno-bank.ts` decodes the `$01` processor port into per-range banked regions and resolves them into `selectMemmapEntry()`'s own candidate set BEFORE selection runs; `anno-join.ts` declines with a named reason wherever the reaching processor-port values disagree or are absent, driven from plan 37-02's real captured export so the same `$D020` write is proven to annotate differently under two different recovered `$01` values -- completing the phase's sixth and final required observed-red control.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-05T09:46:00+02:00 (estimated, immediately after 37-05's closing commit)
- **Completed:** 2026-09-05T10:15:22+02:00
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `anno-bank.ts` -- new module: `decodeBankState()` (D-37-21's bit arithmetic over `$01` bits #2-#0, masking above bit 2 first), `isBankConditionalAddress()`, `resolveBankedRegion()` (never defaults to RAM outside the three bank-conditional ranges -- returns an explicit `not_applicable` member instead), and `regionAdmitsEntry()` (the region-to-map-entry consistency table: `memmap.json`'s structured `section` field for I/O area/Character ROM/BASIC ROM/KERNAL ROM, a whole-word `RAM` label match for the RAM region specifically, since no committed section names RAM anywhere inside any of the three ranges)
- `anno-join.ts`'s `runMemmapJoin()` gains an optional `constWrites` argument (D-37-24): when supplied, a per-address reaching-values computation walks the stored xref graph forward from each recovered const-write's own address, and an address inside `BANK_CONDITIONAL_RANGES` now resolves through the region-constrained candidate set, annotates when exactly one value reaches it or several agree on the same region, and DECLINES -- never guesses -- when none reach it or they disagree (D-37-23). `undefined` (every pre-37-06 call site) is a complete no-op, so the candidate-constraint argument never changes any unconstrained selection's answer
- Driven from plan 37-02's real, committed `export-bank-path-dependent.txt` capture: the shared subroutine's border-colour-register write at `$D020` resolves under the all-RAM value (`$34`, from `$0815`) to a comment whose label is emphatically NOT the border colour, and the same address resolves under the Character-ROM value (`$33`, from `$081c`) to a DIFFERENT, also-not-border-colour label -- the requirement's own two named consequences, both asserted by name
- Annotated bank-conditional addresses now carry an axis-qualified `[processor-port:$xx]` marker in their comment text, positioned before the `[memmap-sha256:...]` digest token, which stays last
- The store's reserved `bank` column stays `null` on every row this plan writes (D-37-25), confirmed by a dedicated test and by `anno-store.test.ts`'s own 98/98 green run
- Two committed red transcripts discharge the phase's fifth and sixth (LAST) required observed-red controls: bypassing `decodeBankState()` in a scratch copy stops the real `$34`/`$33` flip and mislabels `$D020` as the border colour regardless of the recovered value; replacing `anno-join.ts`'s decline branch with a forward-carried value, also in a scratch copy, produces a confident annotation at the same real disagreeing-values address the committed code correctly declines. **All six of the phase's required observed-red controls are now discharged**: three from plan 37-04, one from plan 37-05, two from this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: The processor-port decode, the region resolution, and the decline** - `c985e8bd` (feat)
2. **Task 2: Control -- bypassing the processor-port decode reddens the two-value flip** - `e5c5bf40` (test)
3. **Task 3: Control -- replacing the decline with a forward-carried value reddens the path-dependent case** - `d48e8509` (test)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-06):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/anno-bank.ts` - `decodeBankState()`, `isBankConditionalAddress()`, `resolveBankedRegion()`, `regionAdmitsEntry()`
- `src/mcp/vice/anno-bank.test.ts` - 18 cases: the decode/resolve behavior bullets, the six program-point decision scenarios, the two real-capture flip cases, the axis-qualified provenance format, the null-bank-column check, `regionAdmitsEntry()`'s own unit cases, and the two planted-violation controls
- `src/mcp/vice/anno-join.ts` - `runMemmapJoin()`'s `constWrites` argument, the reaching-values computation (`computeReachingValues`/`buildAdjacency`/`canReach`), the bank-conditional decision block (decline/annotate-under-region), and the `BANK_PROVENANCE_PREFIX` marker
- `src/mcp/vice/anno-join.test.ts` - `SCANNED_MODULES` (the AUTO-01 structural no-agent/no-queue/no-skill scan) extended to include the new `anno-bank.ts` sibling
- `src/mcp/vice/join-image-controls.test.ts` - a third re-export shim (`anno-bank.ts`) added to plan 37-05's own scratch-tree helper, so its existing control keeps resolving now that `anno-join.ts` imports a third sibling
- `src/mcp/vice/hostpath-consumers.test.ts` - `ANNO_MODULE_FLOOR` raised from 19 to 20, with a dated comment naming this plan and the one module added
- `src/mcp/vice/package.json` - `files[]` gained `anno-bank.ts`
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md` - Task 2's transcript
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-path-dependent-decline-red.md` - Task 3's transcript, carrying the AUTO-05 prior-art survey and the conservatism limit

## Decisions Made

- **The candidate constraint narrows the entries ARRAY passed into the existing `selectMemmapEntry()`, never a new parameter on that function.** `memmap-lookup.ts` stays completely untouched by this plan; `anno-join.ts` filters its own `entries` via `regionAdmitsEntry()` before calling `selectEntry(address, constrained)`, which is genuinely "before the address, not a post-filter" since the excluded entries never enter the three-step order at all.
- **`constWrites`'s OMISSION, not its emptiness, is the activation switch.** Passing `undefined` (every pre-37-06 call site, including every existing `anno-join.test.ts` case) skips the whole bank-state block; passing `[]` activates it and immediately declines every bank-conditional address (a genuinely different, deliberate answer: "we know there is no bank-state evidence at all" is not the same claim as "we never asked").
- **The region-to-map-entry table uses the structured `section` field, never `desc`** (37-RESEARCH.md Pitfall 2), except for the one region (RAM) that has no dedicated section anywhere in the three ranges -- matched instead against a whole-word `RAM` token in the entry's own label, which is exactly how the map's own "depends on the processor port" entries describe the RAM alternative.
- **The two flip tests wire reachability directly via `putXref()`, not from the real capture's own `REFERENCES` section.** Plan 37-02's own README already measured that the `.prg` route's internal-`jsr` defect means `probe`'s real body never appears there at all -- the edges instead mirror the SAME real, measured address trace that README's table records, so the test still asserts against the real committed capture's const-write facts without pretending the buggy route proves a reachability fact it cannot prove.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `package.json`'s `files[]` and `hostpath-consumers.test.ts`'s `ANNO_MODULE_FLOOR` needed the new module**
- **Found during:** Task 1's verify run (`anno-seam.test.ts`, `hostpath-consumers.test.ts`)
- **Issue:** `anno-seam.test.ts`'s shipped-module census compares `package.json`'s `anno-*` entries against the `anno-*.ts` files actually on disk; `hostpath-consumers.test.ts`'s `ANNO_MODULE_FLOOR` hand-pins the measured count of `anno-*.ts` production modules. Adding `anno-bank.ts` moved the on-disk count to 20 without moving either guard, mirroring plan 37-01's own identical deviation.
- **Fix:** Added `"anno-bank.ts"` to `package.json`'s `files[]`; raised `ANNO_MODULE_FLOOR` from `17 + 2` to `17 + 2 + 1`, with a new dated comment naming this plan and the module added, following the file's own "re-derive deliberately, never nudge to fit" discipline.
- **Files modified:** `src/mcp/vice/package.json`, `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test anno-seam.test.ts hostpath-consumers.test.ts anno-cli-path-consumers.test.ts` -- 57/57 pass
- **Committed in:** `c985e8bd` (Task 1 commit)

**2. [Rule 1 - Bug I introduced] `join-image-controls.test.ts`'s (plan 37-05) scratch-copy shim set was missing the new `anno-bank.ts` sibling**
- **Found during:** `npm run test:automated`'s Task 3 verify run
- **Issue:** `anno-join.ts` now imports a THIRD sibling (`./anno-bank.ts`), but plan 37-05's own scratch-tree builder (built before this plan landed) only shimmed the original two (`anno-store.ts`, `memmap-lookup.ts`) -- its dynamically-imported scratch copy of `anno-join.ts` failed to resolve with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Added a third re-export shim (`anno-bank.ts`, forwarding by absolute path to the real, unmutated file) to that file's `buildScratchAnnoJoinModule()` helper, mirroring the existing two.
- **Files modified:** `src/mcp/vice/join-image-controls.test.ts`
- **Verification:** `node --test join-image-controls.test.ts` -- 2/2 pass; `npm run test:automated` (broker confirmed absent) shows no failure in this file
- **Committed in:** `d48e8509` (Task 3 commit)

**3. [Rule 2 - Missing Critical] `anno-join.test.ts`'s structural no-agent/no-queue/no-skill scan did not cover the new `anno-bank.ts` sibling**
- **Found during:** Task 1, reviewing `AUTO-01`'s own structural proof after adding the new import
- **Issue:** `anno-join.test.ts`'s `SCANNED_MODULES` list names the exact set of files the `AUTO-01` structural proof scans for skills-tree imports, child-process spawns and queue references. `anno-bank.ts` is now genuinely part of the join's own module graph (imported by `anno-join.ts`), so leaving it out of the scan would silently narrow `AUTO-01`'s own already-established invariant.
- **Fix:** Added `"anno-bank.ts"` to `SCANNED_MODULES`.
- **Files modified:** `src/mcp/vice/anno-join.test.ts`
- **Verification:** `node --test anno-join.test.ts` -- 14/14 pass, including the structural proof and its own non-vacuity control
- **Committed in:** `c985e8bd` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug introduced by this plan's own change, 1 missing-critical completeness fix). **Impact:** all three are guard/completeness corrections required to keep this plan's own new module consistent with pre-existing structural gates and a sibling plan's own control; none changed this plan's own scope or the shape of any exported function.

## Issues Encountered

None beyond the deviations above. `ps -eo pid,cmd | grep -i "vice-broker\|x64sc"` confirmed no live broker before every `npm run test:automated` run this session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AUTO-04` and `AUTO-05` are complete: bank state resolves before the address via a candidate constraint on `selectMemmapEntry()`'s own entries array, and a program point the program does not determine declines with a named reason rather than guessing
- All six of the phase's required observed-red controls (`37-VALIDATION.md`'s own table) are now discharged: three from plan 37-04 (`AUTO-02`'s narrowest-range-wins/tie-break), one from plan 37-05 (`AUTO-03`'s in-image skip), two from this plan (`AUTO-04`'s bank decode, `AUTO-05`'s path-dependent decline)
- Plans 37-07 (`AUTO-06`, graphics-range derivation from VIC register writes) and 37-08 (`AUTO-07`, graphics-range feedback to dxa and Ghidra, depending on both 37-06 and 37-07) remain -- 37-08's own `files_modified` already names `anno-join.ts` again, so a future plan touching this plan's own bank-state block should read it in full first
- No blockers. `npm run test:automated` (broker confirmed absent via `ps -eo pid,cmd`) measured at 3488 tests / 3475 pass / 2 fail, both pre-existing in `anno-register.test.ts` -- the same documented pair every prior phase-37 plan has recorded, unchanged by this plan

## Self-Check: PASSED

- `src/mcp/vice/anno-bank.ts` — FOUND
- `src/mcp/vice/anno-bank.test.ts` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-path-dependent-decline-red.md` — FOUND
- Commit `c985e8bd` — FOUND in `git log --oneline --all`
- Commit `e5c5bf40` — FOUND in `git log --oneline --all`
- Commit `d48e8509` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test anno-bank.test.ts anno-join.test.ts memmap-lookup.test.ts anno-import.test.ts` 72/72 pass; `node --test anno-store.test.ts` 98/98 pass (reserved `bank` column still null); `git status --porcelain` over `anno-bank.ts`/`anno-join.ts` -- 0 lines; `ls evidence/*-red.md` -- 7 files (>= 6 required); `npm run test:automated` (broker confirmed absent) -- 3488 tests / 3475 pass / 2 fail, both pre-existing in `anno-register.test.ts`

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
