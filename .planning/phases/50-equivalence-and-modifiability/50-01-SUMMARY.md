---
phase: 50-equivalence-and-modifiability
plan: 01
subsystem: testing
tags: [ram-capture, cross-binary-comparison, volatile-mask, allowlist, vic-ii, chip-state, node-test]

# Dependency graph
requires: []
provides:
  - "compare-cross-binary.mjs: a cross-binary RAM/chip-state classifier with no drift bucket, a narrowed I/O mask, route awareness, an intentional-difference allowlist, and per-binary logical checkpoints"
  - "IMAGE_VOLATILE / IO_VOLATILE mask tables, committed before any rebuild is compared under them (ROADMAP criterion 1)"
affects: [50-02, 50-03, 50-04, 50-05, 50-06, 50-07]

# Actuals (#2632)
actuals:
  tokens: 10300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-module discipline. compare-cross-binary.mjs duplicates compare.mjs's three-bucket shape on purpose. It does not import compare.mjs, so a future edit to one module's rules cannot silently change the other's rules."
    - "Guarded CLI dispatch tail (process.argv[1] === fileURLToPath(import.meta.url)), matching dump-artifacts.mjs rather than compare.mjs's unguarded tail, so exported mask tables stay safely importable"
    - "This module folds VIC-II register mirroring via (addr & 0x3f) against a canonical $D000-$D03F block. A masked or unmasked register's status stays accurate at all sixteen mirrors across $D000-$D3FF."

key-files:
  created:
    - src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs
    - src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs
  modified:
    - src/skills/c64-ram-capture/SKILL.md

key-decisions:
  - "This module demotes byte-identity to a recorded extra: BYTE_IDENTICAL: yes/no. It is never the verdict. classify() always runs, even on byte-identical images. This follows the plan's assumption_delta_decision (Signal 2: promote)."
  - "The --state sidecar uses this module's own new schema: route, checkpoint_name, checkpoint_address, registers. It is not a literal reuse of dump-artifacts.mjs's chip-state.json output. No committed sidecar carries $Dxxx register values directly today. The plan's own text was ambiguous about which of dump-artifacts.mjs's keys sit at the top level versus nested under `derived`. The module's own header documents this new schema as a flagged design choice."
  - "This executor implemented the work as one coherent pass. It then split the work into three task-scoped commits: mask/classifier only, then allowlist/checkpoints, then byte-identity demotion plus SKILL.md. Each commit was tested independently, green, before its own commit. This split honors the per-task atomic-commit protocol instead of landing one combined diff."

requirements-completed: [EQUIV-01]

coverage:
  - id: D1
    description: "A one-bit difference at $D020, $D015 or $D018 fails the cross-binary comparison and exits 1, with the register named in the output"
    requirement: EQUIV-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs#cross: a one-bit $D020/$D015/$D018 chip-state difference fails (exit 1) and names the register"
        status: pass
    human_judgment: false
  - id: D2
    description: "A difference at $D012, $D019, or in $D400-$D7FF, passes as volatile and is excluded from the verdict"
    requirement: EQUIV-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs#cross: a $D012/$D019 chip-state difference passes as volatile (exit 0)"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs#mask: the VIC-II mirroring fold catches a masked register's regression at every mirror"
        status: pass
    human_judgment: false
  - id: D3
    description: "The module refuses by name an allowlist entry without a why, or one that overlaps a masked span. The allowlist's own red control (--no-allowlist) proves the allowlist does real work."
    requirement: EQUIV-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs -- three tests: whitespace-only-why refusal, mask-overlap refusal, and the --no-allowlist red control"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two captures on different capture routes, or declaring different logical checkpoints, are refused rather than compared"
    requirement: EQUIV-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs#cross: a mismatched route pair is refused / two captures declaring different logical checkpoints are refused"
        status: pass
    human_judgment: false
  - id: D5
    description: "The module prints byte-identity as a subordinate BYTE_IDENTICAL: line. It never substitutes for the VERDICT: line. A chip-state-only regression fails even when the two images are byte-identical."
    requirement: EQUIV-01
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs#cross: byte-identical images with identical sidecars produce VERDICT: PASS ... / byte-identical images whose sidecars differ at $D020 still FAIL"
        status: pass
    human_judgment: false
  - id: D6
    description: "SKILL.md documents the new module in its section text, module table, and troubleshooting table, scoping the pre-existing $D000-$DFFF troubleshooting row to compare.mjs specifically"
    requirement: EQUIV-01
    verification:
      - kind: other
        ref: "grep -c 'compare-cross-binary' src/skills/c64-ram-capture/SKILL.md (6, >= 3 required)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-09-15
status: complete
---

# Phase 50 Plan 01: Cross-Binary Comparison Instrument Summary

**`compare-cross-binary.mjs`: a sibling of `compare.mjs` with no drift tolerance. It has a narrowed `$Dxxx` mask with mirrored-register folding, an intentional-difference allowlist with its own red control, and per-binary logical checkpoints. Committed before any rebuild exists to compare under it.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-15 (approximate — exact start not captured at session open)
- **Completed:** 2026-09-15T13:20:05Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Built `IMAGE_VOLATILE`/`IO_VOLATILE` mask tables. They narrow `compare.mjs`'s blanket `$D000-$DFFF` exclusion to only the registers and ranges that genuinely cannot be stable, each with a one-line hardware reason. `$D015`, `$D018` and `$D020` stay deliberately visible to the verdict.
- Removed the one-bit "drift" tolerance entirely for cross-binary comparisons. Every non-volatile, non-allowlisted difference now fails, regardless of bit count. This closes the exact hole (`lda #$02` -> `lda #$03`) this plan's objective names.
- Added route awareness (snapshot vs memory-read). The module refuses a comparison across incompatible capture routes instead of silently comparing the wrong thing.
- Added an intentional-difference allowlist. The module checks it on load: it refuses a missing `why`, a `start` above `endInclusive`, or any overlap with a masked span. The allowlist carries its own red control (`--no-allowlist`), so its contribution is measurable, not assumed.
- Added per-binary logical checkpoints (`checkpoint_name`/`checkpoint_address` in the state sidecar). The module refuses a comparison whose two captures name different checkpoints.
- Demoted byte-identity to a recorded `BYTE_IDENTICAL:` extra. The classifier always runs in full, even on byte-identical images, so a chip-state-only regression (e.g. a differing `$D020`) is still caught.
- Updated `src/skills/c64-ram-capture/SKILL.md` with a new "Compare two different binaries" section, a module-table row, and troubleshooting rows. Those rows scope the pre-existing `$D000-$DFFF` claim to `compare.mjs` specifically.

## Task Commits

Each task was committed atomically:

1. **Task 1: The narrowed I/O mask and the cross-binary classifier** - `254de34d` (feat)
2. **Task 2: The intentional-difference allowlist and the per-binary logical checkpoint** - `268e755b` (feat)
3. **Task 3: Demote byte-identity in the module's own output, and fix the shipped skill text** - `95a53730` (feat)

_Note: this executor wrote the work as one coherent pass. It then deliberately re-split the work into three task-scoped diffs. Each diff was tested green, independently, before its own commit. This honors the per-task atomic-commit protocol._

## Files Created/Modified
- `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` - the cross-binary classifier: mask tables, allowlist, per-binary checkpoints, CLI dispatch (`cross` verb)
- `src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` - 23 tests covering every `<behavior>` bullet across all three tasks
- `src/skills/c64-ram-capture/SKILL.md` - new section, module-table row, and four troubleshooting rows

## Decisions Made
- **Byte-identity demotion (assumption_delta_decision Signal 2, "promote"):** `compare-cross-binary.mjs` never short-circuits on equal image digests, unlike `compare.mjs`'s `cmdCompare()`. Full classification always runs. The module prints `BYTE_IDENTICAL:` as a subordinate header line, with an explicit note that `VERDICT:` is the only line to gate on.
- **Chip-state sidecar schema (flagged, not silently assumed):** the plan's task text describes the `--state` sidecar as carrying `dump-artifacts.mjs chip-state`'s `registers`/`sprites`/`cpu`/`port01_raw`/`dd00_raw`/`d018_raw`/`sprite_pointers` keys. The actual committed `buildChipState()` output nests `dd00_raw`/`d018_raw`/`sprite_pointers` under a `derived` object instead. No committed chip-state sidecar carries `$Dxxx` register values directly at all — checked: `find . -iname "*.state.json"` found no committed example. No acceptance criterion pins an exact key layout, and every state-comparison test in this plan builds its own fixture in-memory. `compare-cross-binary.mjs` therefore defines its own explicit sidecar schema: `route`/`checkpoint_name`/`checkpoint_address`/`registers`. `registers` is a flat address-to-byte map, with keys parseable as `$Dxxx`, `0xNNNN`, or bare decimal. The module's own header documents this schema as distinct from, but inspired by, `dump-artifacts.mjs`'s shape. This decision is recorded here for a reason. A later plan wiring a real capture into this module should adapt the sidecar shape. It should not assume literal compatibility.
- **VIC-II mirroring implemented via canonical-address folding**, not sixteen duplicated mask-table entries. `ioMaskEntryFor()` computes `0xD000 + (addr & 0x3f)` for any address in `$D000-$D3FF`, then checks that canonical address against a single small table. `$D020`'s regression is provably caught at all fifteen mirrors — asserted directly in a dedicated unit test — without the mask table itself growing sixteen-fold.
- **Guarded CLI dispatch tail**, departing from `compare.mjs`'s literal unguarded `process.exit()` tail. This module exports `IMAGE_VOLATILE`/`IO_VOLATILE`/`classify`/`isImageVolatile`/`isIoVolatile` for reuse by its own test file and by later Phase 50 plans. An unguarded tail would call `process.exit()` the instant anything imported it. `dump-artifacts.mjs`, the newer sibling script in the same directory, already carries the identical guard for the identical reason. This plan follows that established, safer precedent, not `compare.mjs`'s older, untested-until-now shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Guarded the CLI dispatch tail instead of copying compare.mjs's unguarded one verbatim**
- **Found during:** Task 1 (writing the module's CLI dispatch)
- **Issue:** The plan's "New exported names" artifact list requires `IMAGE_VOLATILE`/`IO_VOLATILE` to be importable. The plan's action text also says to reuse `compare.mjs`'s dispatch shape "verbatim." `compare.mjs`'s actual tail is unguarded: `const [cmd, ...rest] = process.argv.slice(2); ... process.exit(...)` runs unconditionally at module load. This would call `process.exit()` the instant any test or sibling module imported this file to reach the exported tables. That includes this plan's own test file's direct unit tests against `isImageVolatile`/`isIoVolatile`/`classify`.
- **Fix:** Wrapped the dispatch tail in `if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { main(); }`, matching the guard `dump-artifacts.mjs` (the newer sibling script in the same directory) already uses for the identical reason. The flat `commands` object, `process.argv.slice(2)` parsing, usage-on-no-verb, and try/catch-with-exit-code shape are otherwise reused exactly as `compare.mjs` does.
- **Files modified:** `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs`
- **Verification:** The test file imports `IMAGE_VOLATILE`, `IO_VOLATILE`, `isImageVolatile`, `isIoVolatile`, and `classify` directly. It runs assertions against them without spawning a subprocess and without triggering an early exit. All 23 tests pass.
- **Committed in:** `254de34d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical-functionality fix, Rule 2)
**Impact on plan:** The fix is necessary for the plan's own "New exported names" requirement to work at all. It follows an established, safer precedent already present in the same directory. No scope creep occurred. The CLI's user-facing behavior — flags, output format, exit codes — is unchanged from what the plan specifies.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The cross-binary instrument — mask tables, allowlist, checkpoints, byte-identity demotion — is committed and fully unit-tested. It is ready ahead of any rebuild that exists to compare under it. This satisfies this plan's own pre-commitment ordering requirement (ROADMAP criterion 1). It also satisfies the phase's placement of this plan ahead of the tracer slice (plan 50-04).
- No blockers for plan 50-02 onward. Plans that need to produce a real chip-state sidecar for `--state` should follow the schema documented in `compare-cross-binary.mjs`'s own header comment: `route`/`checkpoint_name`/`checkpoint_address`/`registers`. They should not assume literal compatibility with `dump-artifacts.mjs`'s `buildChipState()` output shape. See "Decisions Made" above.
- `docs/phase50-*` remains absent. This plan's own pre-commitment step requires that. The first phase50 transcript is downstream work for a later plan.

## Self-Check: PASSED

- `[ -f src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs ]` → FOUND
- `[ -f src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs ]` → FOUND
- `git log --oneline --all --grep="50-01"` → 3 commits found (`254de34d`, `268e755b`, `95a53730`)
- `node --test src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs` → 23/23 pass
- `node --test 'src/skills/*/scripts/*.test.mjs'` → 213/213 pass, 6 skipped (matches the pre-existing skip floor, no new skips introduced)
- `ls docs/phase50-* 2>/dev/null | wc -l` → 0

---
*Phase: 50-equivalence-and-modifiability*
*Completed: 2026-09-15*
