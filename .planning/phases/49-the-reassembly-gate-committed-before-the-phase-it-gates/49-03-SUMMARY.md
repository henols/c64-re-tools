---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 03
subsystem: testing
tags: [acme, byte-diff, reassembly, gate, hazard-report, red-controls]

requires:
  - phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
    provides: "verifyAcmeAssemblesTree() and runReassemblyGate() over the seven frozen gate inputs (plan 02)"
provides:
  - "Three planted, honest-then-red controls observed going red: a wrong byte under an exit-zero assembler, a stale output-path artifact with byte-identical content, and a clean byte-diff over a scope that stopped covering a hazard-anchored range"
  - "A test-only outputDir seam on verifyAcmeAssemblesTree(), bounded by the same absentBeforeSpawn conjunct every other caller runs through"
  - "hazardCoverageOutsideDiffScope() reads a report's undecided regions and refuses a zero-length or inverted extent by name"
affects: [reassembly-gate-movement, reassembly-gate-ack, reassembly-gate-run, acme-seam]

actuals:
  tokens: 8900
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A test-only seam gains an optional field defaulting to the function's own prior behaviour (a fresh, self-removed directory), so every existing call site is byte-identical while a new caller can plant a control"
    - "A hazard construction's WRITER instruction is stored as byte-typed data (never code) so its own literal-target operand never becomes an in-tree reference the exporter would refuse without a label -- the self-modification is still detected because buildHazardReport() decodes raw bytes independently of how the store types them"
    - "The finding under test is placed at the highest-address range of a purpose-built subject, so removing that one range actually narrows the export's own [minBlockStart, maxBlockEnd) extent rather than leaving it unchanged (a gap in the middle is still spanned, not excluded)"

key-files:
  created: []
  modified:
    - src/mcp/vice/acme-verify.ts
    - src/mcp/vice/acme-verify.test.ts
    - src/mcp/vice/reassembly-gate.ts
    - src/mcp/vice/reassembly-gate.test.ts

key-decisions:
  - "The stale-artifact control's writer field for verifyAcmeAssemblesTree() is named outputDir (not e.g. plantedDir), documented with the same accuracy bound AcmeVerifyOptions.acmeBin already carries: nothing passed through it can reach the pass outcome unless the run itself created the output file, because absentBeforeSpawn runs against it unchanged."
  - "Both entry points' output file name is now the single exported constant VERIFY_OUTPUT_FILE_NAME (was a private 'export.bin' literal duplicated in both functions), so the stale-artifact test can plant a file at the exact path the check will test without hard-coding a literal a future rename could silently invalidate."
  - "The narrowed-scope subject's self-modification WRITER is typed 'byte' in the store, not 'code': anno-export-asm.ts's referencedAddress()/isInTree() rule treats any absolute- or zeropage-mode operand pointing at an address covered by another emitted range as an in-tree reference requiring a store label, and this subject is required to carry none. buildHazardReport() finds the self-modification regardless, since it decodes the raw bytes independently of the store's own typing."
  - "The modified target (the finding's anchor) is placed at the HIGHEST address of the subject's four ranges, not a middle one: removing a middle range leaves the export's overall [minBlockStart, maxBlockEnd) extent unchanged (the gap is still spanned and zero-filled), which would NOT narrow the scope the finding needs to fall outside of. Only removing an end range shrinks that span."
  - "hazardCoverageOutsideDiffScope() gained a third, OPTIONAL parameter (undecidedRegions, default []) and one new return field (undecided) rather than a second helper -- both changes are additive and every existing call site (including the boundary test from plan 49-02) is unaffected."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "The wrong-byte control (a corrupted expected byte fails the byte-diff while ACME itself exits 0) is reproduced for the tree entry point, paired with an honest control, and its failed verdict reads red through the gate's failed-rebuild rule (R6)"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-verify.test.ts#gate red: a corrupted byte in the tree entry point's expected bytes fails the byte-diff while ACME itself exits 0"
        status: pass
      - kind: unit
        ref: "acme-verify.test.ts#gate red: the gate reads that wrong-byte verdict as red under the failed-rebuild rule, not the catch-all and not the no-assembler rule"
        status: pass
    human_judgment: false
  - id: D2
    description: "A test-only outputDir seam makes the stale-artifact control plantable on the tree entry point; a previous run's byte-identical artifact is refused because the path was already present before the spawn, and its failed verdict reads red through R6"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "acme-verify.test.ts#gate red: a previous run's artifact sitting at the tree entry point's own output path is refused even though its bytes are byte-identical to the expected bytes"
        status: pass
      - kind: unit
        ref: "acme-verify.test.ts#gate red: the gate reads that refused-artifact verdict as red under the failed-rebuild rule"
        status: pass
    human_judgment: false
  - id: D3
    description: "A purpose-built subject's self-modification is anchored inside the full export's extent (complete coverage); removing its range still byte-diffs clean but the scope check reports incomplete, and the gate reads that as red under the diff-scope rule (R7) with a passing rebuild and a clean hazard disposition"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: a purpose-built subject carrying one detectable self-modification produces a hazard report with a finding inside the full export's extent, and the scope check reports complete coverage"
        status: pass
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding"
        status: pass
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "The diff-scope helper's boundary and degenerate behaviour is pinned: the extent's exclusive upper bound is outside, the lower bound is inside, zero findings with an undecided region is not covered-and-clean (the region is carried in the output), and a zero-length or inverted extent is refused by name"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: a finding whose anchor address equals the extent's exclusive upper bound is reported outside the scope"
        status: pass
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: a finding whose anchor address equals the extent's lower bound is reported inside the scope"
        status: pass
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: a report with zero findings but at least one undecided region is not reported as covered-and-clean; the undecided region is carried in the helper's output"
        status: pass
      - kind: unit
        ref: "reassembly-gate.test.ts#gate red: a zero-length extent is refused by name rather than reported as complete"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 03: The three planted controls Summary

**The gate is watched turning red on all three named failure shapes -- a wrong byte under an exit-zero ACME, a byte-identical stale artifact, and a clean byte-diff over a scope that stopped covering a hazard-anchored range -- each paired with an honest control, before any green result from it is trusted.**

## Performance

- **Duration:** ~50 min
- **Started:** ~2026-09-13T09:00:00Z
- **Completed:** 2026-09-13T09:32:19Z
- **Tasks:** 3
- **Files modified:** 4 (acme-verify.ts, acme-verify.test.ts, reassembly-gate.ts, reassembly-gate.test.ts)

## Accomplishments

- Task 1 reproduces the wrong-byte control for `verifyAcmeAssemblesTree()`: an honest control against the committed hazard-subject tree passes and parses at least one real per-segment result line, then flipping one byte of the SAME tree's expected bytes fails with a disagreeing byte-diff, the corrupted offset named, and exit status 0 -- proving an exit-zero assembler cannot hide a wrong byte. A companion case feeds that verdict into `runReassemblyGate()` and confirms rule R6 (never the catch-all, never the no-assembler rule).
- Task 2 adds `AcmeVerifyTreeOptions.outputDir`, a test-only, bounded seam letting a caller supply the assembled-output directory. The absentBeforeSpawn conjunct runs against it unchanged, proven both ways: an empty planted directory still verifies clean, and a directory already holding a byte-identical copy of the expected bytes is refused -- with the failure reason naming the path as already present before the spawn, never a byte disagreement -- even when the assembler binary is a harmless stand-in (`/bin/true`) that never really runs. Both entry points' output file name is now the single exported `VERIFY_OUTPUT_FILE_NAME` constant rather than a private literal duplicated in each.
- Task 3 (TDD) builds a small purpose-built subject whose self-modification writer is stored as `byte`-typed data (never `code`), so its own literal-target operand never becomes an in-tree reference requiring a label -- `buildHazardReport()` still finds the self-modification because it decodes raw bytes independently of the store's typing. The modified target sits at the highest address of the subject's four ranges, so removing its range actually narrows the export's own extent. RED first: two of the seven new cases failed against the unmodified `hazardCoverageOutsideDiffScope()` (undecided regions, zero-length extent). GREEN: the helper gained an optional third parameter for a report's region dispositions and a zero-length/inverted-extent refusal, both additive and backward compatible.
- All three red controls are paired with an honest control in the same suite, and the narrowed-scope red is attributable to the scope input alone (passing rebuild, clean hazard disposition) -- exactly what `must_haves.key_links` describes.

## Task Commits

Each task was committed atomically:

1. **Task 1: The wrong-byte control** - `4943a3ce` (test)
2. **Task 2: The stale-artifact control** - `fcb3d8ff` (feat)
3. **Task 3: The narrowed-scope control** - `8b4a3b1b` (test, RED) then `d3dbe18f` (feat, GREEN)

**Plan metadata:** _(this commit)_ `docs(49-03): complete the three-red-controls plan`

_Task 3 (`tdd="true"`) produced two commits, RED then GREEN; no REFACTOR commit was needed._

## Files Created/Modified

- `src/mcp/vice/acme-verify.ts` - `VERIFY_OUTPUT_FILE_NAME` exported constant; `AcmeVerifyTreeOptions.outputDir` test-only seam; `verifyAcmeAssemblesTree()` uses a caller-supplied directory when given one and never removes it
- `src/mcp/vice/acme-verify.test.ts` - four `gate red:` cases (wrong-byte pair, stale-artifact pair) plus a shared `passingGateInputExceptRebuild()` helper
- `src/mcp/vice/reassembly-gate.ts` - `hazardCoverageOutsideDiffScope()` gains an optional `undecidedRegions` parameter, a zero-length/inverted-extent refusal, and an `undecided` field on its return value
- `src/mcp/vice/reassembly-gate.test.ts` - seven `gate red:` cases: the purpose-built narrowed-scope subject (honest, narrowed-equal-byte-diff, gate-red), the two boundary directions, the undecided-region case, and the zero-length-extent refusal

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `reassembly-gate.ts` needed a small implementation change the plan's own `files_modified` list did not declare**
- **Found during:** Task 3
- **Issue:** The plan's frontmatter `files_modified` names only `src/mcp/vice/acme-verify.ts`, `src/mcp/vice/acme-verify.test.ts` and `src/mcp/vice/reassembly-gate.test.ts` for this plan -- but two of Task 3's own required behaviors ("a report with zero findings but at least one undecided region is not reported as covered-and-clean; the undecided region is carried in the helper's output" and "a zero-length extent is refused by name rather than reported as complete") describe a property of `hazardCoverageOutsideDiffScope()` itself, not of its test. The task's own action text explicitly authorizes exactly this for the zero-length case ("add the refusal to the helper if plan 49-02 did not already place it there"), and the undecided-region behavior names the SAME function's own return value ("the undecided region is carried in the helper's output"), which is only satisfiable by extending that function.
- **Fix:** Added an optional third parameter (`undecidedRegions`, default `[]`) and a zero-length/inverted-extent throw to `hazardCoverageOutsideDiffScope()` in `reassembly-gate.ts`. Both changes are additive: every existing call site (this file's own boundary test from plan 49-02) is unaffected, since the new parameter defaults to empty and the return value only gains a field.
- **Files modified:** `src/mcp/vice/reassembly-gate.ts`
- **Verification:** `npm run typecheck` clean; `node --test reassembly-gate.test.ts` 20/20 pass; the pre-existing "gate tree: the diff-scope helper treats the extent's lower bound as inside..." test (calling the 2-argument form) is unchanged and still passes.
- **Committed in:** `d3dbe18f` (Task 3 GREEN commit)

**2. [Rule 1 - Bug] The `expectedSegments` used for a `/bin/true`-backed stale-artifact call had to be empty, not the real tree's segment count**
- **Found during:** Task 2 (first test run)
- **Issue:** `/bin/true` prints no stdout at all, so ACME's own per-segment result lines never exist for it. `assembleAndDiff()`'s unanimity rule (rule 5) is unconditional and runs BEFORE the absentBeforeSpawn check (rule 7) this control exists to observe -- passing the real 16-block `expectedSegments` produced a count-disagreement failure reason ("16 block(s) expected, 0 ... parsed") instead of the "ALREADY PRESENT before the spawn" reason the test asserted.
- **Fix:** Changed `expectedSegments` to `[]` for every `/bin/true`-backed call in the stale-artifact tests, matching `/bin/true`'s own zero parsed lines and letting the run reach rule 7. The honest-direction call (real ACME, real per-segment output) keeps the real `blocksInTreeSourceOrder(result)` segments.
- **Files modified:** `src/mcp/vice/acme-verify.test.ts`
- **Verification:** all four Task 2 `gate red:` cases pass; the assertion on "ALREADY PRESENT before the spawn" now matches the actual reason.
- **Committed in:** `fcb3d8ff` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical addition to a file outside the plan's declared list, 1 bug found and fixed before it could ship). **Impact:** both were necessary for this plan's own task text and acceptance criteria to hold; neither is scope creep beyond what Task 2 and Task 3 already specified.

## Known Stubs

None introduced by this plan. `MovementResult` and `HazardAcknowledgementResult` remain stubs of the producers (not the architecture), unchanged from plan 49-02 and still tracked there.

## Issues Encountered

None beyond the two auto-fixed deviations above, both resolved within this plan's own scope.

## User Setup Required

None - no external service configuration required. ACME was already detected on `PATH` (`/home/henrik/.local/bin/acme`, release 0.97 "Zem") and no new external tool is introduced.

## Next Phase Readiness

- All three planted controls named in the phase's own success criterion 3 are now observed red in this suite, each preceded by an honest control against the same subject or tree. `evidence/49-red-controls.md` can now record `RED_CONTROLS: all-observed` citing these test names.
- `verifyAcmeAssemblesTree()`'s new `outputDir` seam and `hazardCoverageOutsideDiffScope()`'s new `undecidedRegions` parameter are both additive and backward compatible -- later plans (movement relocation, hazard acknowledgement, the real end-to-end run) can adopt them without renegotiating the existing contract.
- `BUILD-06` is shared across all seven plans in this phase (01-07) and is not yet marked complete in `REQUIREMENTS.md` -- the shared-ID gate correctly withholds it until every plan declaring it has its own SUMMARY.md.
- The full `test:automated` suite was re-run after this plan's changes: the same 4 pre-existing failing files (`anno-import.test.ts`, `anno-register.test.ts`, `audit-integrity.test.ts`, `docs-deferred-ledger.test.ts`) as the documented baseline, and no new failures introduced. `anno-hazard-report.test.ts` and `anno-export-asm.test.ts` (this plan's own read-only dependencies) both pass unchanged (270/270).
- No blockers.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED

All four modified files (`acme-verify.ts`, `acme-verify.test.ts`, `reassembly-gate.ts`, `reassembly-gate.test.ts`) confirmed present on disk with the expected changes. All four task commit hashes (`4943a3ce`, `fcb3d8ff`, `8b4a3b1b`, `d3dbe18f`) confirmed present in `git log`. Every task's `<acceptance_criteria>` re-verified passing; the plan-level `<verification>` items re-run (see Deviations and Next Phase Readiness above for the full command output).
