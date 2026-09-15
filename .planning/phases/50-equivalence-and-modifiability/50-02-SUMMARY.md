---
phase: 50-equivalence-and-modifiability
plan: 02
subsystem: testing
tags: [hazard-subject, acme, fixtures, annostore, reassembly-gate, node-test]

# Dependency graph
requires:
  - phase: 50-equivalence-and-modifiability
    provides: "plan 50-01's compare-cross-binary.mjs -- the narrowed mask/allowlist instrument this plan's regressed twin is the red control for"
provides:
  - "hazard-subject-regressed.prg: a red control differing from the committed subject at exactly three single-bit offsets, each feeding a store to $D020, $D015 or $D018"
  - "hazard-subject-modified.prg and hazard-subject-modified.annostore.json: the modified subject (sprite construction removed, second SMC construction called). A later plan reassembles it through Phase 49's gate for ROADMAP criterion 4."
affects: [50-03, 50-04, 50-05, 50-06, 50-07]

# Actuals (#2632)
actuals:
  tokens: 23000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared !source-line substitution implementation (substituteSourceLines()) in make-hazard-subject-fixtures.mjs. Called by the mis-aligned twin, the regressed twin and the modified subject. Never copied a third or fourth time."
    - "SUBJECTS array parameterisation in make-hazard-subject-annostore.mjs. The decomposition logic (ranges, scopes, labels, decode sanity, partition check) runs once per subject. Every boundary is a symbol lookup. A subject's shifted addresses are picked up automatically, with zero hand-transcription."
    - "Buffer-then-write refusal discipline, extended across subjects. Every SUBJECTS entry is assembled and decomposed before any output file is written. A failure on one subject leaves no output written for either."

key-files:
  created:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch-regressed.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-regressed.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json
    - src/mcp/vice/hazard-subject-variants.test.ts
  modified:
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs
    - src/mcp/vice/hazard-subject-fixture.test.ts

key-decisions:
  - "The $D018 regression uses a named constant, align_regressed_char_select. It moves the character-select field by +1 block, not an ad-hoc XOR. This matches the plan's own instruction: derive the regression from the same labels the committed file uses. On this fixture's committed layout, the field's current value is align_char_base / 2048 = 2, an even number. Adding 1 flips only the field's own low bit, with no carry. The emitted byte differs by exactly one bit. This is fixture-specific. It was checked against the actual assembled symbol table, not assumed."
  - "hazard-subject-align-nosprite.a keeps align_sprite_base and its !fill 63 data. No code points the hardware at it anymore. The plan requires the sprite shape to stay present as data. Only the pointer, enable and position code is removed."
  - "The annostore generator's decomposition arrays (ranges, scopes, LABELS) are written once. They live inside a buildExportDocument() function. Plan 50-02's own acceptance criteria call this 'one shared decomposition'. This function is called once per SUBJECTS entry, never duplicated per subject. Its own test asserts this by grepping for exactly one `const ranges = [` and one `const scopes = [`."

requirements-completed: [EQUIV-03]

coverage:
  - id: D1
    description: "The regressed twin differs from the committed subject at exactly three byte offsets. Each offset is a single bit. Each is the immediate operand of a store to $D020, $D015 or $D018. This is resolved by decoding the image, not by a hardcoded address."
    requirement: EQUIV-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the regressed image differs from the committed subject at exactly three byte offsets, each a single-bit change"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the three regressed differences map one-to-one onto stores targeting $D020, $D015 and $D018, resolved by decoding the image"
        status: pass
    human_judgment: false
  - id: D2
    description: "The regressed twin comes from the existing generator family. It was never hand-committed. A second generator run leaves the fixture directory clean."
    requirement: EQUIV-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: REGENERATOR AGREEMENT (regressed twin) -- re-deriving the synthesized root reproduces the committed hazard-subject-regressed.prg byte-for-byte"
        status: pass
      - kind: other
        ref: "node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs run twice. git status --porcelain src/mcp/vice/fixtures/hazard-subject empty after each run."
        status: pass
    human_judgment: false
  - id: D3
    description: "The modified subject removes the sprite construction (anchor $088B). It calls the second self-modifying construction for the first time (anchor $0825). Both are cross-referenced to a named committed hazard-report finding. The byte difference stays confined to the alignment routine's own range."
    requirement: EQUIV-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#every differing byte offset lies inside the alignment routine's own range, both bounds resolved from real ACME symbols"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the modified image contains a jsr to hazard_smc2_entry, and the committed subject contains none"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the modified image contains no store to $D015, and the committed subject contains exactly one"
        status: pass
      - kind: other
        ref: "grep -c '088B\\|088b\\|0825' src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a -> 6 (>= 2 required)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A modified annotation-store export exists. It comes from real ACME symbol addresses through the existing generator, never hand-typed. It partitions the modified image completely. It carries the same scope count as the committed export. The committed original export stays byte-unchanged."
    requirement: EQUIV-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the modified export's ranges partition the modified image with no hole and no overlap"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hazard-subject-variants.test.ts#hazard subject variants: the modified export carries the same number of scopes as the committed export"
        status: pass
      - kind: other
        ref: "diff of hazard-subject.annostore.json before and after the generator's parameterisation. Result: IDENTICAL."
        status: pass
    human_judgment: false

# Metrics
duration: ~40min
completed: 2026-09-15
status: complete
---

# Phase 50 Plan 02: Regressed and Modified Hazard-Subject Variants Summary

**Two new subject variants, built from the committed hazard subject. A three-single-bit-regression red control at $D020/$D015/$D018. A modified subject that removes the sprite construction and switches on the second self-modifying construction. Both anchored to named Phase 49 findings. Both produced by amended, still-deterministic generators.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-15 (approximate -- exact start not captured at session open)
- **Completed:** 2026-09-15T13:46:03Z
- **Tasks:** 3
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments
- Built `hazard-subject-dispatch-regressed.a` and `hazard-subject-align-regressed.a`. These plant three deliberate single-bit regressions. `dispatch_target_1`'s `$D020` immediate is `$03` where the committed subject has `$02`. The `$D015` sprite-enable immediate is `%00000000` where the committed subject has `%00000001`. A new `align_regressed_char_select` constant moves the `$D018` character-select field by one 2048-byte block. On this fixture's own assembled layout, that move is a single bit. Committed `hazard-subject-regressed.prg`. It is byte-identical in length to the original.
- Extracted `substituteSourceLines()` in `make-hazard-subject-fixtures.mjs`. This is the one `!source`-line substitution implementation. It is now shared by the mis-aligned twin, the regressed twin and the modified subject. It was previously duplicated once. It would have been duplicated a third and fourth time without this extraction.
- Built `hazard-subject-align-nosprite.a`. It removes the sprite pointer, enable and position code from `hazard_align_entry`. It keeps the sprite shape as data. This removal is cross-referenced to the committed finding at anchor `$088B` (`page-alignment`, `sprite-pointer-names-aligned-base`). It also adds `jsr hazard_smc2_entry` before the routine's `rts`. This addition is cross-referenced to the finding at anchor `$0825` (`self-modifying-code`, `store-target-in-instruction-opcode-byte`). Committed `hazard-subject-modified.prg`, the same byte length as the original. The `!align $7ff, 0` directive absorbs the code shrinkage.
- Parameterised `make-hazard-subject-annostore.mjs` over a `SUBJECTS` array of two entries. Both entries share one decomposition implementation: `ranges`, `scopes`, `LABELS`, a `decode()` sanity pass, and a partition check. The committed subject and the modified subject both run through it. The generator buffers both export documents before writing either. A failure on one subject leaves neither output written. Regenerated and committed `hazard-subject-modified.annostore.json`. It has 16 ranges, 22 labels and 5 scopes, the same counts as the committed original. Checked the committed `hazard-subject.annostore.json` stays byte-unchanged by the parameterisation.
- Wrote `src/mcp/vice/hazard-subject-variants.test.ts`. This new file has 23 tests. It asserts the byte-level shape of both variants. It asserts exact diff counts and bit counts for the regressed twin. It asserts store targets resolved through `decode()`. It asserts alignment-routine-range confinement for the modified subject. It asserts `jsr` and `sta $d015` presence and absence. It asserts the annostore partition, scope count and label address. It also adds one regenerator-agreement test per variant.

## Task Commits

Each task was committed atomically:

1. **Task 1: The regressed twin -- three single-bit regressions at the three named registers** - `0d7579fd` (feat)
2. **Task 2: The modified subject -- one behaviour removed, one added, each anchored to a named finding** - `db2a242d` (feat)
3. **Task 3: The modified annotation-store export, from real symbol addresses** - `be52ca18` (feat)

## Files Created/Modified
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch-regressed.a` - dispatch sibling with one planted $D020 regression
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-regressed.a` - align sibling with two planted regressions ($D015, $D018)
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a` - align sibling: sprite construction removed, second SMC construction called
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg` - generated red-control image
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg` - generated modified-subject image
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json` - generated modified-subject store export
- `src/mcp/vice/hazard-subject-variants.test.ts` - new test file, 23 tests over both variants
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` - extracted substituteSourceLines(), added the third and fourth FIXTURES entries
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs` - parameterised over a SUBJECTS array, buffer-then-write across subjects
- `src/mcp/vice/hazard-subject-fixture.test.ts` - updated one now-stale assertion (FIXTURES table build count) after this plan's own generator amendment

## Decisions Made
- **$D018 regression derivation, fixture-specific and checked, not assumed.** `align_regressed_char_select` moves the character-select field by `+1` block, not by an arbitrary bit flip. The plan requires the regression stay derived from the same labels the committed file derives from. This fixture's own assembled `align_char_base / 2048` field value is 2, an even number. `+1` produces no carry and flips exactly one bit. This was checked by assembling and diffing the actual image, not assumed from the formula alone.
- **Sprite shape kept as data in the modified subject.** `align_sprite_base` and its `!fill 63` bytes stay in `hazard-subject-align-nosprite.a`. No code points the VIC-II at them anymore. This matches the plan's explicit instruction. It keeps the removed-behaviour diff confined to code, not data.
- **Annostore decomposition written once, called per subject.** The function `buildExportDocument()` lives in `make-hazard-subject-annostore.mjs`. It is the one place `ranges`, `scopes` and `LABELS` are declared. `SUBJECTS` calls it once per entry, never duplicated per subject. This is what the plan's own acceptance criterion means by "one shared decomposition". A test asserts this directly, by grepping for exactly one `const ranges = [` and one `const scopes = [`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a pre-existing test assertion made stale by this plan's own generator amendment**
- **Found during:** Task 3 (running the plan's mandated automated test command `node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts`)
- **Issue:** `hazard-subject-fixture.test.ts` carried a test asserting the `FIXTURES` table declares exactly two build entries. Task 1 and Task 2 of this plan added a third and fourth entry, the regressed twin and the modified subject. This made the old assertion wrong, though not a bug in the new code. It is a now-false claim about the generator's own shape, in a sibling file this plan did not otherwise touch.
- **Fix:** Updated the test's name and assertions from "declares two builds" to "declares four builds". Updated the count assertion from 2 to 4. Added explicit assertions that the regressed and modified build output names are both declared.
- **Files modified:** `src/mcp/vice/hazard-subject-fixture.test.ts`
- **Verification:** `node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts` -- 56 of 56 pass.
- **Committed in:** `be52ca18` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** This deviation targets a test assertion this plan's own generator amendment made stale. No scope creep occurred. The updated test still asserts exactly the generator's own shape, using the count this plan's own tasks established.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both new subject variants are committed and fully unit-tested against real ACME assembly. `node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts hazard-subject-reassembly.test.ts` reports 67 of 67 pass. `npm run test:automated` reports 3648 pass, 0 fail, 9 skipped, matching the pre-existing skip floor.
- Both generators (`make-hazard-subject-fixtures.mjs`, `make-hazard-subject-annostore.mjs`) run clean twice in a row with no working-tree change. This was checked after every task commit.
- The regressed twin is ready for plan 50-01's `compare-cross-binary.mjs` to run against it, as the paired red control ROADMAP criterion 2 names. A green-only result is not proof on its own.
- The modified subject, its `.prg` and its `.annostore.json`, is ready to be reassembled through Phase 49's gate (`runReassemblyGate()`) for ROADMAP criterion 4. This plan built the material. Running the gate against it is downstream work for a later plan in this phase.
- `docs/phase50-*` remains absent. This matches this plan's own scope. Transcripts are later-plan work, per `50-RESEARCH.md`'s file layout.
- No blockers for plan 50-03 onward.

## Self-Check: PASSED

- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch-regressed.a ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-regressed.a ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg ]` -> FOUND
- `[ -f src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json ]` -> FOUND
- `[ -f src/mcp/vice/hazard-subject-variants.test.ts ]` -> FOUND
- `git log --oneline -3` -> `be52ca18`, `db2a242d`, `0d7579fd`, all present, checked by direct hash lookup
- `node --test hazard-subject-variants.test.ts hazard-subject-fixture.test.ts hazard-subject-reassembly.test.ts` -> 67 of 67 pass
- `npm run test:automated` -> 3648 pass, 0 fail, 9 skipped (pre-existing floor)
- `npm run typecheck` -> exit 0, no `error TS` lines
- Both generators re-run twice in a row. `git status --porcelain src/mcp/vice/fixtures/hazard-subject` shows only the already-staged or committed entries. No unstaged (` M`) lines appear after either run.

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15*
