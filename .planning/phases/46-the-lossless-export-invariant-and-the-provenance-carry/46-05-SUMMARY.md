---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 05
subsystem: annotation-export
tags: [acme, exclusion, byte-diff-verification, tdd]

# Dependency graph
requires:
  - phase: 46
    provides: "plan 46-01's exportAsm() shape (the one store handle, the per-block emission loop, the marker-constant convention) and plan 46-03's addExcludedRange/listExcludedRanges/removeExcludedRange store verbs over anno_excluded_range"
provides:
  - "anno-export-asm.ts: EXCLUSION_MARKER_PREFIX, listExcludedRanges() joined into exportAsm()'s existing store handle, per-block exclusion-marker emission, ExportAsmResult.excludedRangeCount"
  - "anno-export-asm.test.ts: EXCLUSION Test 1-7 (the full-block-plus-marker behaviors), the readback parser proving criterion 2 against result.source alone, five exclusion empty:/ordering: edge tests, and an ACME round trip over an export carrying both exclusion and provenance markers"
affects: [46-06]

# Actuals (#2632)
actuals:
  tokens: 8036
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Exclusion annotation is a comment-only side channel, identical in shape to plan 46-01's provenance carry: the block-construction .map() and the byte-derivation of expectedBytes are untouched, and the only new conditionals are \"does this row overlap this block\" and \"how many rows overlapped\" -- neither reads a reason's or a verdict's contents."
    - "The overlap test between an exclusion row and a block is textually the SAME predicate provenanceForRange() and addExcludedRange() already use (row.start <= blockEndInclusive && row.endInclusive >= blockStart), so all three sites agree by construction rather than by three authors reaching the same answer independently."
    - "A count field's doc-comment states precisely what it counts and what it does not (records, not marker lines, not bytes) -- the WR-01 lesson this file already learned once about symbolCount, applied on arrival to excludedRangeCount rather than after a divergence is found."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "Task 1's own behavior tests (EXCLUSION Test 1-7) are committed under Task 2's commit, since Task 1's <files> declaration is anno-export-asm.ts only and Task 2's is anno-export-asm.test.ts -- the identical precedent 46-04's own SUMMARY already recorded for the same 'a task's own behavior tests live in a sibling task's file list' shape. Both tasks' acceptance criteria and the plan's own file-set split direct this structure; it is not a deviation from the plan."
  - "Exclusion markers are prepended to a block's content in the SAME place plan 46-01's provenance lines are (after the block's code/data emission, before emitBlock() brackets it), as a SEPARATE unshift() call rather than merged into one -- the two features are independent side channels and interleaving their prepend logic would couple two unrelated markers' ordering to each other for no benefit."
  - "Exclusion reason re-validation reuses the EXISTING assertExportableCommentText() -- never a second validator -- exactly as the ledger's own free-text evidence cell does, on the same re-check-not-re-define grounds assertDataTypeForExport()'s comment already states a few dozen lines above."

requirements-completed: [BUILD-05, BUILD-07]

coverage:
  - id: D1
    description: "A recorded exclusion emits its containing block in FULL (real origin, real bytes for the whole span, both bracket assertions) with a single-spelling `; EXCLUDED BY USER REQUEST:` marker naming the exclusion's own extent and the user's reason -- never as a threshold, never as a skip."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 1: a recorded exclusion over the middle range's full extent emits exactly one marker naming its extent and reason verbatim"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 5: an exclusion covering only PART of a store range still emits that range's full block, with the marker naming the exclusion's own narrower extent"
        status: pass
    human_judgment: false
  - id: D2
    description: "result.expectedBytes and result.blocks (start/endExclusive) are IDENTICAL between an export with a recorded exclusion and the same store exported with none -- asserted against the byte arrays and the block list directly, never the source text."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 2 (LOAD-BEARING): result.expectedBytes is byte-identical between an export with a recorded exclusion and the same store exported with none"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 3: result.blocks.length and every block's start/endExclusive are identical between an export with a recorded exclusion and one with none"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 4: the excluded block's emitted content lines are the same as the no-exclusion export's for that block, modulo the marker line"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reading the export back recovers what was excluded and why: a parser anchored on the imported EXCLUSION_MARKER_PREFIX extracts every excluded extent and reason from result.source alone, with no access to the store, and is provably pinned to the real constant rather than a loose match."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION READBACK: parsing result.source alone recovers every excluded extent and its reason (criterion 2)"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION READBACK: a one-character mutation of the marker spelling yields zero recoveries"
        status: pass
    human_judgment: false
  - id: D4
    description: "The empty case (zero exclusion records) emits nothing and changes nothing; a one-byte exclusion is emitted correctly; the pre-existing zero-ranges refusal is unmoved by the exclusion machinery; excludedRangeCount counts records overlapping an emitted block, not every record in the store."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion empty: a store with no exclusion records emits no exclusion marker"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion empty: a one-byte exclusion is recorded and emitted"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion empty: a store with zero ranges still raises the pre-existing no-ranges refusal"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 6: result.excludedRangeCount counts only exclusion records overlapping an emitted block, not every record in the store"
        status: pass
    human_judgment: false
  - id: D5
    description: "Marker order within one block is stable across two identical exports; ascending-by-start is recorded as a chosen (backstop) convention rather than presented as a derived contract."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion ordering: two disjoint exclusions inside one block emit markers in ascending start order"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion ordering: two consecutive identical exports produce byte-identical source"
        status: pass
    human_judgment: false
  - id: D6
    description: "A store whose exclusion reason was edited on disk to contain a line break is refused BY NAME at the export boundary, with the reason's own text withheld from the message (CR-03)."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION Test 7: a store whose exclusion reason was edited on disk to contain a line break is refused BY NAME at the export boundary"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real ACME 0.97 assembles an export carrying BOTH exclusion markers and ledger provenance lines and reproduces expectedBytes octet for octet."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#EXCLUSION + LEDGER: real ACME reassembles an export carrying both exclusion markers and ledger provenance lines byte-identically"
        status: pass
    human_judgment: false
  - id: D8
    description: "The exclusion-ordering stability assertion (ascending-by-start within one block) is a backstop, not a derived contract -- no SPEC states a required order for this case."
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#exclusion ordering: two disjoint exclusions inside one block emit markers in ascending start order"
        status: pass
    human_judgment: true
    rationale: "This must_have is explicitly marked verification: backstop in the plan itself -- the test proves the CHOSEN behavior is stable, but a human reviewer is the one who confirms no future SPEC contradicts the choice recorded here."

duration: 16 min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 05: The Exclusion Marker in `exportAsm()` Summary

**A recorded exclusion now emits as a full, byte-complete block carrying a single-spelling `; EXCLUDED BY USER REQUEST:` marker naming its own extent and reason, with `expectedBytes` and the block list proven byte-identical to the same store exported with no exclusion, and the marker readable back out of `result.source` alone with no access to the store.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-11T16:43:00Z (approximate -- `date -u` was not captured as the literal first bash call this session; the earliest recorded artifact is the baseline test-suite run at 16:45:21Z, so the true start was a few minutes earlier during the required-reading pass)
- **Completed:** 2026-09-11T16:58:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `EXCLUSION_MARKER_PREFIX` (`"  ; EXCLUDED BY USER REQUEST: "`) declared beside `anno-export-asm.ts`'s other marker constants, exported for test reach, with a doc-comment naming `BUILD-07` and the skip-the-block failure mode it exists to prevent.
- `listExcludedRanges()` joined into `exportAsm()`'s single existing store handle as a sixth read (beside `listRanges`/`listLabels`/`listComments`/`listProjectEnums`/`listEnumUsage`), never a second `openStore()`.
- Every block overlapping a recorded exclusion is still emitted in FULL -- real origin, real bytes for the whole span, both `!if * != ...` bracket assertions -- with a marker line prepended naming the exclusion's OWN extent (never the block's) and its checked reason, in ascending-start order when more than one exclusion overlaps one block. The overlap test is textually the same predicate `provenanceForRange()`/`addExcludedRange()` already use.
- `ExportAsmResult.excludedRangeCount` added: counts exclusion RECORDS with at least one emitted marker, doc-commented to state precisely that it counts neither marker lines nor bytes.
- 30 new tests in `anno-export-asm.test.ts` (120 total in the file, 0 fail, 0 skipped -- ACME present): the seven full-block-plus-marker behaviors, the load-bearing `expectedBytes`/`blocks` byte-identity proof against a no-exclusion export of the same store, a readback parser recovering every excluded extent and reason from `result.source` alone (criterion 2, with a non-vacuity precondition and a marker-spelling-mutation negative control), five `exclusion empty:`/`exclusion ordering:` edge tests, and a real-ACME round trip over an export carrying both exclusion markers and ledger provenance lines.
- `buildStore()`/`buildStoreOverImage()` gained an optional `exclusions` field, recorded through `addExcludedRange()` -- the store's own public write verb, never raw SQL for a fixture's happy-path rows (the one corrupted-reason test goes around the write verb deliberately, via `update anno_excluded_range set reason = ?`, to reproduce a state the write verb can no longer create -- mirroring the file's own pre-existing comment-corruption test).

## Task Commits

Each task was committed atomically:

1. **Task 1: Exclusion-aware block emission -- the full bytes, plus a marker naming the request** - `4a8cc336` (feat, `anno-export-asm.ts` only, per the plan's own `<files>` declaration for this task)
2. **Task 2: Reading the export back -- recovering what was excluded and why, plus the empty and ordering edges** - `4f4fdc76` (test, `anno-export-asm.test.ts` only -- carries BOTH Task 1's own behavior tests (EXCLUSION Test 1-7) and Task 2's own readback/empty/ordering/ACME tests, since Task 2's `<files>` is exactly this file; see Decisions Made below)

**Plan metadata:** committed as part of this same close-out step.

## Files Created/Modified
- `src/mcp/vice/anno-export-asm.ts` - `EXCLUSION_MARKER_PREFIX`, a sixth `listExcludedRanges()` read inside the existing store handle's `try` block, per-block exclusion-marker emission (ascending by start, re-checked reason via `assertExportableCommentText()`), `ExportAsmResult.excludedRangeCount`
- `src/mcp/vice/anno-export-asm.test.ts` - `addExcludedRange` import, `StoreSpec.exclusions` optional field wired into `buildStore()`/`buildStoreOverImage()`, `exclusionStore()` fixture, 30 new tests (7 full-block-plus-marker behaviors, 2 readback, 3 `exclusion empty:`, 2 `exclusion ordering:`, 1 ACME round trip carrying both exclusion and ledger markers -- plus supporting non-vacuity/mutation assertions inside those groups)

## Decisions Made
See `key-decisions` in the frontmatter above. The most consequential one: Task 1's own seven behavior tests are committed under Task 2's `anno-export-asm.test.ts` commit rather than Task 1's, because Task 1's `<files>` declaration is implementation-only. This is not a deviation -- 46-04's own SUMMARY already recorded the identical structure for the same reason ("Both tasks' acceptance criteria and the plan's own file-set split direct this structure; it is not a deviation from the plan"), and both files were written, verified together, and passing (120/120) before either commit was made.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1-3 auto-fixes were needed. The implementation and tests matched the plan's `<action>`/`<behavior>` text directly.

### Disclosed, Not Fixed (out of scope / plan-authored inconsistency)

**1. [Disclosure] Task 1's acceptance criterion `grep -ac 'openStore(' src/mcp/vice/anno-export-asm.ts` returning 1 was already false before this plan started**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** The criterion states "there is still exactly one store open in the module" and expects the literal grep count to be 1. Measured on the pre-plan tree (`git show HEAD:src/mcp/vice/anno-export-asm.ts | grep -n 'openStore('`), the count was already 3: two pre-existing doc-comment mentions (`ExportAsmOptions.storePath`'s own doc-comment, lines 157 and 171) plus the one real call site. This predates this plan entirely.
- **Action taken:** This plan's own new comment beside the sixth `list*` call was deliberately phrased to avoid the literal substring `openStore(` (using "There is no second store opened for this" instead of "Never a second `openStore()`."), so the count is unchanged by this plan's work: still 3, not 1, but not made worse. No pre-existing documentation was altered or deleted to force the literal grep to pass, since doing so would mean editing prose this plan does not own for the sole purpose of satisfying a stale acceptance-criterion command.
- **Verification:** `grep -ac 'openStore(' src/mcp/vice/anno-export-asm.ts` → 3, both before and after this plan's diff (confirmed via `git show HEAD~2:...` vs the working tree, where `HEAD~2` is the commit immediately preceding this plan's first commit).
- **Files modified:** none (disclosure only)
- **Impact:** The SPIRIT of the criterion — "still exactly one store OPEN (one `openStore()` CALL) in the module" — is true and independently verified by reading the diff: `exportAsm()` still opens exactly one handle. The literal grep command in the plan text cannot pass on this file regardless of this plan's changes, because of pre-existing prose unrelated to store-opening.

## Issues Encountered

**Unrelated concurrent activity in the shared main working tree (not caused by this plan, not fixed, out of scope):** partway through this plan's execution, `git log` showed a new commit (`714c0391 docs: repeal the convention that writes planning vocabulary into product files`) had landed on `main` that this plan did not create, and the working tree accumulated uncommitted modifications to roughly twenty `src/skills/**` files plus a new untracked test file (`src/mcp/vice/skills-planning-vocabulary.test.ts`) -- none of which this plan touched, staged, or committed. The phase-level `npm run test:automated` baseline check accordingly showed a FIFTH failing test beyond the four documented in this phase's baseline: `no shipped skill file contains GSD planning vocabulary (ENGINEERING_RULES § 21.1)`. This failure's own assertion text and file (`skills-planning-vocabulary.test.ts:220`) name nothing this plan created or modified (`anno-export-asm.ts`/`anno-export-asm.test.ts` are not skill files and carry no GSD planning vocabulary). Per the scope boundary ("Only auto-fix issues DIRECTLY caused by the current task's changes"), this was left untouched and undisclosed to `deferred-items.md` was not needed since it is not this plan's own out-of-scope discovery -- it is pre-existing, in-flight work by a concurrent, unidentified process in the same shared tree. Every `git add`/`git commit` this plan performed named `src/mcp/vice/anno-export-asm.ts` or `src/mcp/vice/anno-export-asm.test.ts` explicitly (never `git add -A`/`.`), confirmed via `git status --short` immediately before each commit, so none of that concurrent activity's files were accidentally staged or committed by this plan.

## User Setup Required

None - no external service configuration required. No `user_setup` block in the plan's frontmatter.

## Next Phase Readiness
- `BUILD-05` is now fully declared complete (`requirements.mark-complete` confirmed it READY and marked it, since 46-01/46-02/46-04 and this plan are its only declarers and all four are done). `BUILD-07` stays "Pending" as expected -- plan 46-06 also declares it and has not yet run (its own planted-control test is the remaining half of BUILD-07's proof).
- `EXCLUSION_MARKER_PREFIX` and `ExportAsmResult.excludedRangeCount` are the shipped surface plan 46-06 can build its planted-control fixture against: a synthetic entry where a heuristic *would* want to drop a range, proving the range survives.
- `anno-register.ts`'s `anno_exclude_range` register entry still cites `anno-tools.ts:anno_exclude_range` as its consumer rather than the now-real `anno-export-asm.ts:listExcludedRanges` call site this plan added. Per the wave-context note accompanying this plan, updating that citation is OPTIONAL and NOT one of this plan's `must_haves` -- it was deliberately NOT done here, so it is explicitly recorded as a choice rather than an oversight. `node --test anno-register.test.ts` was re-run after this plan's changes and DIRECTION 5's basis-integrity problem list is unchanged (still the pre-existing baseline entries only, no new line for either exclusion verb), confirming this plan's changes did not silently invalidate the existing citation either way.
- The full `npm run test:automated` suite's failing-name set is the phase's documented four-name baseline PLUS the one unrelated, pre-existing-and-in-flight `skills-planning-vocabulary` failure described above under Issues Encountered -- not a regression introduced by this plan, and disclosed rather than fixed per the scope boundary. No failure names `anno-export-asm.ts`, `EXCLUSION`, or `exclusion`.
- No blockers for 46-06.

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-export-asm.ts ]` - FOUND (modified)
- `[ -f src/mcp/vice/anno-export-asm.test.ts ]` - FOUND (modified)
- `git log --oneline --all --grep="46-05"` — no commits use that literal trailer (this plan's commit messages follow the `{type}(46-05): ...` convention in the SUBJECT line, confirmed present): `git log --oneline | grep -E '\(46-05\)'` returns `4f4fdc76 test(46-05): ...` and `4a8cc336 feat(46-05): ...` - FOUND, 2 commits
- Re-ran every task's `<verify>` and the plan-level `<verification>` commands against the final tree:
  - `npm run typecheck` — exit 0, clean
  - `node --test anno-export-asm.test.ts` — `ℹ tests 120`, `ℹ pass 120`, `ℹ fail 0`, `ℹ skipped 0`
  - `grep -a -v -E '^\s*(//|\*|/\*)' src/mcp/vice/anno-export-asm.ts | grep -ac 'EXCLUDED BY USER REQUEST'` → 1
  - `grep -ac 'listExcludedRanges' src/mcp/vice/anno-export-asm.ts` → 2 (the import and the one call site — the plan's own `<fails_when>` only requires nonzero)
  - `grep -ac 'function assert.*CommentText' src/mcp/vice/anno-export-asm.ts` → 1 (unchanged)
  - `node --test anno-export-asm.test.ts 2>&1 | grep -ac 'exclusion empty:\|exclusion ordering:'` → 5
  - `grep -ac 'insert into anno_excluded_range' src/mcp/vice/anno-export-asm.test.ts` → 0
  - `node scripts/check-npm-packages.mjs; echo exit=$?` → `exit=0`
  - `npm run test:automated` → failing-name set is the documented 4-name baseline plus the one unrelated concurrent-activity failure described above; no failure related to this plan's files
- Every task's `<acceptance_criteria>` re-checked against the final tree, including the one disclosed exception (`openStore(` grep count) documented above under Deviations.

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
