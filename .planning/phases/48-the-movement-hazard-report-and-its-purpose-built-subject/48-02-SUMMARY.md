---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 02
subsystem: analysis
tags: [hazard-report, indexed-dispatch, vic-ii-alignment, acme, fixtures]

requires:
  - phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
    provides: "plan 48-01's hazard-subject.a root, its regenerator, and anno-hazard-report.ts's class-2 (self-modifying-code) detector this plan's own class-1 finding is proven against with the same scanner, never a second implementation"
provides:
  - a planted non-canonical stack-return dispatch (indexed through Y, both address-table entries written as an explicit label-1) that the project's own imported scanIndirectDispatch() proves as a stack-return finding
  - a second, genuinely-working dispatch mixing X and Y index registers that the same scanner correctly declines, landing only in its advisory splitTableCandidates bucket
  - a real VIC-II hardware alignment dependency -- a 64-byte-aligned sprite shape and a 2048-byte-aligned character set, with the sprite pointer and VIC memory-control register both derived from their labels -- plus a level table and a music table
  - a deliberately mis-aligned twin image, synthesized from a swapped-in alignment source and committed as an observable negative control that assembles cleanly and is proven byte-different
  - hazard-subject-fixture.test.ts, 23 tests asserting every planted construction at the byte level (source text, assembled symbol addresses, or the imported scanner's own result), never through a detector's rendered opinion
affects: [48-03, 48-04, 48-05, 48-06]

actuals:
  tokens: 12241
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A synthesized-root regenerator entry: the mis-aligned twin has no committed root .a file of its own -- its root is built in memory by swapping one !source line in the committed root, written to a throwaway temp file, assembled, and never leaves a stray file in the tracked fixture tree."
    - "Byte-level, never-detector-text assertions: every new fixture claim (alignment, register derivation, mixed-index decline) is checked against source text or a freshly assembled image's own ACME symbol list (--symbollist), with the one exception being the class-1 finding itself, which is checked against the imported scanIndirectDispatch()'s own result fields -- exactly as criterion 3 requires."
    - "Independent re-derivation over calling the regenerator: each REGENERATOR AGREEMENT test rebuilds its own ACME argv (and, for the mis-aligned twin, its own root-text substitution) rather than shelling out to make-hazard-subject-fixtures.mjs, so a bug in the regenerator's own recipe is not hidden by the test trusting it."

key-files:
  created:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-misaligned.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject-misaligned.prg
    - src/mcp/vice/hazard-subject-fixture.test.ts
  modified:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.a
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs

key-decisions:
  - "The class-1 pairing crosses a source-file boundary by putting the two split address tables (and the three target routines) in the NEW hazard-subject-dispatch.a file, while the code that consumes them (hazard_dispatch_entry, both loads through Y) lives in the already-existing root hazard-subject.a -- so the scanner's cross-file symbol resolution is genuinely exercised, not simulated."
  - "The declining control (mixed X/Y index registers) is a complete, self-contained construction inside hazard-subject-dispatch.a rather than also crossing a file boundary -- only the PROVEN site needed to prove the cross-file property; adding it to the control too would not have strengthened the non-vacuity bar the plan asks for."
  - "Class 3 was read per D-48-A's binding choice: VIC-II hardware alignment (sprite pointer / 64, character-set select bits / 2048), not the code/timing page-crossing reading RESEARCH.md named as the excluded alternative. The VIC bank is set explicitly through $dd00 rather than assumed, per the plan's own instruction."
  - "The mis-aligned twin's root is never committed as a fourth .a file. make-hazard-subject-fixtures.mjs synthesizes it by swapping the root's one !source \"hazard-subject-align.a\" line for the mis-aligned file's name, matching the plan's 'artifacts' list exactly (no fifth source file was declared) while still producing a real, independently assembled program rather than a patched image."
  - "The mis-aligned source's diff from the aligned source is verified structurally (a test strips comments/blank lines from both files and asserts the only difference is two `!byte 0` filler lines), rather than trusted from the file's own header prose -- the header documents the intent, the test proves it."

requirements-completed: []

coverage:
  - id: D1
    description: "A non-canonical stack-return (RTS-trick) dispatch -- indexed through Y on both loads, address-table entries written as an explicit label-1, split across a source-file boundary from its consuming code -- is proven by the project's own imported scanIndirectDispatch(), with every reconstructed target decoding as a legal instruction inside the image."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the imported scanner proves at least one stack-return dispatch finding on the committed image, with the scan's own truncation flag false"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: every target the stack-return finding reconstructs is a real instruction start inside the committed image"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: every entry in both split address tables is written as a label followed by an explicit -1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second, genuinely-working dispatch mixing X and Y index registers is a real, working construction the scanner's closed accepted-shape list correctly declines to promote -- it survives only in the advisory splitTableCandidates bucket, never in any proven collection."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the mixed-index-register declining control appears in no proven collection -- only as an unproven, unresolved candidate"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the dispatch routine's two paired loads walk the Y register, never X; the declining control walks X on one load and Y on the other"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real VIC-II hardware alignment dependency -- a 64-byte-aligned sprite shape and a 2048-byte-aligned character set, with the sprite pointer ($07f8) and VIC memory-control register ($d018) both derived from their labels rather than bare constants, and the VIC bank set explicitly through $dd00 -- plus a level table and a music table, giving the subject four real data ranges."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the sprite shape base address is a multiple of 64, and the character-set base address is a multiple of 2048 -- asserted against the assembled image"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the byte written to $07f8 equals the sprite base divided by 64"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: four distinct labelled data tables exist -- sprite shape, character set, level and music"
        status: pass
    human_judgment: false
  - id: D4
    description: "A deliberately mis-aligned twin image -- differing from the aligned build only in two one-byte filler insertions that push the sprite and character-set bases off their required boundaries -- assembles cleanly (exit zero), is proven byte-different from the aligned image, and both images are re-derived from their sources and byte-compared on every suite run."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: hazard-subject-misaligned.prg exists, is tracked, and differs from hazard-subject.prg"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: the mis-aligned image's sprite shape base is not a multiple of 64, and its character-set base is not a multiple of 2048"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: REGENERATOR AGREEMENT (mis-aligned twin) -- re-deriving the synthesized root reproduces the committed hazard-subject-misaligned.prg byte-for-byte"
        status: pass
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: REGENERATOR AGREEMENT -- re-assembling the root reproduces the committed hazard-subject.prg byte-for-byte"
        status: pass
    human_judgment: false
  - id: D5
    description: "No fixture source anywhere in this plan names the scanner it is planted against, and no fixture source carries any planning-vocabulary string (.planning/ path, /gsd- name, D-NN id, BUILD-NN id, or 'Phase N' citation)."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-fixture.test.ts#hazard subject: no fixture source in this tree names the scanner it is planted against"
        status: pass
      - kind: other
        ref: "grep -a -v -E '^\\s*;' src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch.a | grep -ac scanIndirectDispatch (count 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full test suite (npm run test:automated) shows exactly the same six pre-existing failing test names the measured baseline records, and no seventh; typecheck exits zero."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "npm run test:automated -- failing set {anno-import.test.ts:352, anno-register.test.ts:385, anno-register.test.ts:479, audit-integrity.test.ts:245, docs-deferred-ledger.test.ts:101, docs-deferred-ledger.test.ts:195}"
        status: pass
      - kind: integration
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 62min
completed: 2026-09-12
status: complete
---

# Phase 48 Plan 02: The Non-Canonical Dispatch, the Declining Control, and the VIC-II Alignment Twin Summary

**The purpose-built subject grows a Y-indexed stack-return dispatch the imported scanner proves and a mixed-register dispatch it correctly declines, plus a real VIC-II sprite/charset alignment dependency and a deliberately mis-aligned negative-control twin -- every planted construction asserted at the byte level, never through a detector's opinion.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-12T21:14:00Z
- **Completed:** 2026-09-12T22:16:00Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- `hazard-subject-dispatch.a`: a non-canonical stack-return (RTS-trick) dispatch indexed entirely through Y (never X, unlike every fixture the project's own test corpus already ships), whose two split address tables carry an explicit `label-1` on every entry and are declared in this new file while the consuming routine lives in the already-existing root -- a real cross-source-file pairing the imported `scanIndirectDispatch()` proves without modification
- A second, genuinely-working dispatch in the same file mixes X and Y index registers on its two loads; the scanner's closed accepted-shape list correctly declines it, and it survives only in the advisory `splitTableCandidates` bucket
- `hazard-subject-align.a`: a real VIC-II hardware alignment dependency -- a 64-byte-aligned sprite shape and a 2048-byte-aligned character set, with the sprite pointer (`$07f8`) and VIC memory-control register (`$d018`) both derived from their labels, the VIC bank set explicitly through `$dd00`, plus a level table and a music table rounding out the four data ranges criterion 1 requires
- `hazard-subject-align-misaligned.a` and the committed `hazard-subject-misaligned.prg`: a deliberately mis-aligned twin differing from the aligned source in exactly two one-byte filler insertions, assembling cleanly at exit zero and proven byte-different -- the observable negative control D-48-A calls for
- `hazard-subject-fixture.test.ts`: 23 tests (22 carrying the `hazard subject:` prefix) asserting every claim above at the byte level -- source text, a freshly assembled image's own ACME symbol list, or the imported scanner's own result fields -- and re-deriving both committed images from source on every run

## Task Commits

Each task was committed atomically:

1. **Task 1: Plant the non-canonical indexed jump table, and the shape the scanner must decline** - `2c4e8fbd` (feat)
2. **Task 2: Plant the VIC-II alignment dependency and the four data tables** - `9e6916cc` (feat)
3. **Task 3: Commit the deliberately mis-aligned twin as the class-3 observable control** - `b7f736ef` (feat)

## Files Created/Modified

- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch.a` - the planted stack-return dispatch and the mixed-register declining control
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align.a` - the VIC-II alignment dependency and the four data tables
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-misaligned.a` - the deliberately mis-aligned twin source
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject-misaligned.prg` - the committed, byte-different mis-aligned image
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` - root: gained the dispatch/align routines and two new `!source` lines
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` - regenerated aligned image
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` - grew a second, synthesized-root build entry
- `src/mcp/vice/hazard-subject-fixture.test.ts` - the fixture's own byte-level assertion file

## Decisions Made

- The class-1 pairing crosses a source-file boundary by design: the two address tables (and target routines) live in the new `hazard-subject-dispatch.a`, while the consuming routine lives in the already-existing root -- exercising the scanner's cross-file symbol resolution for real rather than by assumption.
- The declining control stays self-contained inside `hazard-subject-dispatch.a` -- only the proven site needed to cross a file boundary to prove that property.
- Class 3 follows D-48-A: VIC-II hardware alignment (sprite/charset scaling), explicitly not the code/timing page-crossing reading RESEARCH.md named as the excluded alternative.
- The mis-aligned twin has no committed fourth root `.a` file; its root is synthesized in memory by the regenerator (and independently, in the test) by swapping one `!source` line, matching the plan's declared artifact list exactly.
- The source-diff claim ("only two filler-byte insertions differ") is verified structurally by a test, not merely asserted in the header's own prose.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and `<verify>` commands for all three tasks passed as specified; no Rule 1-4 deviations were needed.

## Issues Encountered

- The full `npm run test:automated` run intermittently picked up a stray, gitignored `installer/skills/acme-build/zz-scratch-*/` directory left behind by an unrelated test's own race (a previously-documented, pre-existing flake in this suite, unrelated to any change in this plan). Removing the stray directory and re-running restored the exact six-name measured baseline every time; this was confirmed on repeated runs after each task and is not a regression introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The subject now carries three of the four planned hazard classes (class 2 self-modifying-code from plan 48-01, class 1 indexed-dispatch and class 3 VIC-II alignment from this plan), plus the four data tables and a real observable negative control for class 3.
- `hazard-subject-fixture.test.ts` is the fixture's own home for future assertions; a later plan extending the detector for class 1/class 3 can read this file's byte-level facts directly rather than re-deriving them.
- No blockers. Class 4 (cycle-exact raster code) and the detector work for classes 1/3 remain for later plans in this phase, per `48-01-SUMMARY.md`'s own readiness note.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-12*

## Self-Check: PASSED

- All 5 created files found on disk (`hazard-subject-dispatch.a`, `hazard-subject-align.a`, `hazard-subject-align-misaligned.a`, `hazard-subject-misaligned.prg`, `hazard-subject-fixture.test.ts`).
- All 3 task commits found in git log (`2c4e8fbd`, `9e6916cc`, `b7f736ef`).
- `npm run typecheck` exits 0.
- `npm run test:automated` shows exactly the same 6 pre-existing failing test names the plan's measured baseline records, and no others (confirmed on a clean re-run after clearing an unrelated, pre-existing scratch-directory race).
- `node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs` run twice leaves `git status --porcelain` free of any unstaged (` M`) modification -- both committed images are a pure function of their committed sources.
- `node --test hazard-subject-fixture.test.ts` reports 23/23 passing, 22 carrying the `hazard subject:` prefix.
- Full diff scan for planning vocabulary (`.planning/` paths, `/gsd-` names, `D-NN`/`DNN-X` decision ids, `BUILD-NN` ids, `Phase N`) across every fixture source file this plan added or modified returns zero hits outside the test file's own literal string-comparison targets (which check FOR the absence of these strings, not violations of it).
