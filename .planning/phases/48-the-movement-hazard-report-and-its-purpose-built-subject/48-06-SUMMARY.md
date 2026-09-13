---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 06
subsystem: analysis
tags: [hazard-report, fixture-design, multi-file-export, acme, reassembly, vic-ii-raster]

requires:
  - phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
    provides: "plan 48-02's dispatch/alignment fixture parts, plan 48-04's raster/second-self-modification parts and the committed store export, plan 48-05's cross-check record -- this plan documents all four planted variants together and proves the committed store export survives the full multi-file rebuild path"
provides:
  - "FIXTURE-DESIGN.md: the committed design document stating, per hazard class, which variant the subject carries, why it is not the textbook idiom, and what the textbook version alone would have proved -- plus a structural-difference section, a two-entry deliberate-exclusions section, and an on-screen observations section recording a genuine, disclosed disagreement between prediction and captured behaviour for the raster construction"
  - "hazard-subject-reassembly.test.ts: the subject's committed store export runs through the real multi-file tree export and reassembles under real ACME to an image octet-identical to the committed subject image, with the negative working-directory control, cross-file symbol resolution, and export determinism all proven on this program specifically"
  - "a real defect in the committed store export, found and fixed: a declining comment recorded at a mid-instruction address with no store label there, which no generic export can attach a comment to -- re-anchored to the host instruction's own start address"
affects: []

actuals:
  tokens: 10500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A store and its exported tree must share one workspace root: exportAsmTree() opens its own store handle by path and confines it against the SAME root the tree is written under -- a store file created in a sibling temp directory fails to open, even though both directories exist and are readable."
    - "A comment can only attach to an instruction's own start address, or to an address a store label already names -- never to an arbitrary mid-instruction byte a label was deliberately withheld from. A declining comment naming a byte with 'no single correct symbol' still needs an anchor the exporter can place a line at; the host instruction's own start address is that anchor without contradicting the no-symbol intent."
    - "Live emulator observation is prepared, not assumed: a screenshot's absence of a predicted effect is investigated by isolating constructions (running each planted hazard alone, then in combination) before it is written up as a disagreement, so the recorded finding names exactly how far it reaches rather than a single failed capture."

key-files:
  created:
    - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md
    - src/mcp/vice/hazard-subject-reassembly.test.ts
  modified:
    - src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json
    - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs

key-decisions:
  - "The 'split hi/lo address tables emit paired names from one symbol per entry' property is asserted as 'the dispatch and decline tables keep four distinct, table-specific symbol names, resolved across a file boundary, rather than losing their pairing to raw hex' -- the committed store types these tables as plain byte ranges (a prior plan's own decision, since they are parallel arrays, not interleaved pairs), so the literal 'one symbol per interleaved entry' reading does not apply to this specific store; the test asserts the honest, applicable version of the same property instead of asserting something the store's own layout cannot support."
  - "A real defect in the committed store export was found and fixed in this plan, not deferred: the second self-modification's declining comment was recorded at the operand byte's own address, which has no store label and is not an instruction start, so no generic export can place a line there. Re-anchored to the host instruction's own start address (hazard_smc2_write) with the same wording, since it still names the operand byte correctly (one past the opcode)."
  - "The on-screen observation for the raster construction is recorded as a genuine, disclosed disagreement between the stated prediction and what a live stock emulator actually showed, rather than reconciled or silently dropped. Extensive isolated testing (the self-modifying and alignment constructions captured alone, both via a real emulator, with the effects persisting and visible) narrows the finding to the timer-stabilised raster construction's own interaction with the running environment, without asserting a root cause beyond what was directly observed -- including a live test using an emulator ONLY entry point that never returns to BASIC at all, which still reproduced the same reversion and rules out 'returning to BASIC undoes the vector' as the explanation."
  - "The reassembly test never widens the export module or the host-tool seam -- both are exercised unmodified, exactly as the plan requires, and both of their existing test files (anno-export-asm.test.ts, host-tool.test.ts) plus resources-sync.test.ts pass unchanged (316/316)."

requirements-completed: []

coverage:
  - id: D1
    description: "FIXTURE-DESIGN.md states, per hazard class, which variant the subject carries, what the textbook idiom is, and why the planted variant is not it; shows the four classes are structurally different by naming their distinct mechanisms; records the page-crossing timing reading of alignment and the undetected indirect-indexed self-modification as two deliberately excluded, considered hazards; and states the raster class's structural-signature-only limit in the same sentence as its capability."
    requirement: BUILD-04
    verification:
      - kind: other
        ref: "grep -acE 'textbook|canonical' FIXTURE-DESIGN.md -- count 19 (>= 4 required)"
        status: pass
      - kind: other
        ref: "grep -ac '^## ' FIXTURE-DESIGN.md -- count 10 (>= 8 required)"
        status: pass
      - kind: other
        ref: "grep -acE '\\.planning/|/gsd-|\\bD-[0-9]|\\bBUILD-[0-9]|Phase [0-9]' FIXTURE-DESIGN.md -- count 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The subject's committed store export runs through the real multi-file tree export and a real ACME reassembles it to an image octet-identical to the committed subject image, proving the whole rebuild path -- proven unmodified on the export module and the host-tool seam."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "hazard-subject-reassembly.test.ts (11/11 passing, 10 with the 'hazard reassembly:' prefix, VICE_REQUIRE_ACME=1, no skips)"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts, resources-sync.test.ts, host-tool.test.ts (316/316 passing unchanged, VICE_REQUIRE_ACME=1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The four external-file data tables are extracted into their own binary files referenced by bare filename; every reference to the dispatch and decline tables resolves through a symbol across the file boundary between the consuming code and the tables; two exports from the unchanged store produce byte-identical trees; and the negative working-directory control fails with the assembler's own captured refusal text."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "hazard-subject-reassembly.test.ts#hazard reassembly: every external-file range produces its own binary file referenced by exactly one bare-filename !binary line, with no !byte line for it"
        status: pass
      - kind: unit
        ref: "hazard-subject-reassembly.test.ts#hazard reassembly: every reference to the dispatch and decline tables resolves through their own symbol name, across the file boundary between the consuming code and the tables it reads, and a hardware register write still renders as a literal address"
        status: pass
      - kind: unit
        ref: "hazard-subject-reassembly.test.ts#hazard reassembly: two exports from the unchanged store produce byte-identical file sets / file contents"
        status: pass
      - kind: unit
        ref: "hazard-subject-reassembly.test.ts#hazard reassembly: assembling the same root file with a directory that is not the tree as the working directory fails, and the assembler's own refusal text is captured"
        status: pass
    human_judgment: false
  - id: D4
    description: "The on-screen behaviour of both the aligned and the mis-aligned images is recorded against a stated prediction, prepared entirely by the executor with no manual step required from a human. The recorded observation for the raster-bearing constructions is a genuine, disclosed disagreement with the prediction rather than a forced match, with the disagreement narrowed by isolated testing rather than left as a single unexplained capture."
    requirement: BUILD-04
    rationale: "Whether a real stock emulator's rendered screen shows a recognisable sprite, a recognisable custom glyph, and a colour split is a judgment about pixels this repository's automated suite cannot render or inspect -- the design document's own text states this plainly, and this deliverable is exactly the one a human reviewer evaluates against the prepared, captured evidence."
    verification: []
    human_judgment: true
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

duration: 62min
completed: 2026-09-13
status: complete
---

# Phase 48 Plan 06: The Fixture Design Document, and the Subject Through the Multi-File Export and a Real-Assembler Reassembly Summary

**A committed design document names each planted variant against its textbook idiom and the four classes' distinct mechanisms, the subject's committed store export reassembles octet-identical under real ACME through the full multi-file rebuild path, and one genuine defect the reassembly path surfaced (an unplaceable declining comment) is found and fixed -- while the on-screen observation for the raster construction is recorded as an honest, disclosed disagreement between prediction and captured behaviour rather than smoothed over.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-12T23:14:00Z
- **Completed:** 2026-09-13T00:15:57Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `FIXTURE-DESIGN.md`: the fixture design document criterion 1 requires -- per-class sections stating the textbook idiom, what this subject carries instead, and what the textbook idiom alone would have proved; a structural-difference section naming the four distinct mechanisms (a stack-assembled return address, a write landing inside another instruction's own bytes, a scaled hardware index, and a timing window between two interrupts) and pointing at the test asserting no mechanism id is shared across two classes; a two-entry deliberate-exclusions section (the page-crossing timing reading of alignment, and the undetected indirect-indexed self-modification); and the raster class's structural-signature-only limit stated in the same sentence as its capability.
- `hazard-subject-reassembly.test.ts`: the subject's committed store export, imported into a fresh store, exported through the real multi-file tree writer, and reassembled by real ACME through the host-tool seam to an image octet-identical to the committed subject image -- 11 tests (10 carrying the `hazard reassembly:` prefix), covering the tree's file set and bare-filename source/binary references, cross-file symbol resolution between the consuming dispatch code and the tables it reads, export determinism across two runs, the negative working-directory control, and the full octet-identity round trip.
- A real defect the reassembly path surfaced on first contact: the second self-modification's declining comment was recorded at a mid-instruction address with no store label, which no generic export can attach a line to. Re-anchored to the host instruction's own start address in `make-hazard-subject-annostore.mjs`, regenerating `hazard-subject.annostore.json` with a one-line, minimal diff.
- The on-screen observations section: both committed images were loaded into a real stock emulator and captured with no manual step required. The aligned build's predicted sprite, custom glyph, colour split and border change are recorded against what was actually observed -- none of the four persist to a settled screen once the raster construction runs alongside the rest, even with an entry point that never returns to BASIC. Isolated testing of the self-modifying and alignment constructions alone shows their effects DO take hold and stay visible on a real screen, narrowing the disagreement specifically to the raster construction's own interaction with the running environment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the fixture design document -- per class, which variant and why it is not the textbook one** - `4f7a64db` (feat)
2. **Task 2: Run the subject through the multi-file export and reassemble it with a real assembler** - `b5db0c2e` (feat)
3. **Task 3: Record the on-screen observations for both images** - `b9145801` (docs)

## Files Created/Modified

- `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` - the committed fixture design document, including the on-screen observations section
- `src/mcp/vice/hazard-subject-reassembly.test.ts` - the reassembly test running the real multi-file export and rebuild path against this subject
- `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json` - one comment's address re-anchored (2100 -> 2099, decimal) so it attaches to a real instruction start
- `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs` - the generator's own comment call re-anchored to match, with the reasoning recorded in a new comment above it

## Decisions Made

See `key-decisions` in this file's frontmatter for the full list. The two load-bearing ones: the committed store's dispatch/decline tables are typed as plain `byte` ranges (a prior plan's decision, since they are parallel arrays, not interleaved pairs), so this plan's reassembly test asserts the honest, applicable form of the "paired symbol names" property -- that the four table names stay distinct and resolve by name across a file boundary -- rather than asserting an interleaved-pair property this store's own layout does not carry; and the on-screen observation for the raster construction is recorded as a genuine, disclosed disagreement, narrowed by isolated testing rather than forced to match the prediction or silently dropped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The committed store export carried a comment at an unplaceable address**
- **Found during:** Task 2, first run of the reassembly test against the real store export
- **Issue:** `hazard-subject.annostore.json`'s second declining comment was recorded at `smc2_operand_addr` (the second self-modification's own operand byte, one past its host instruction's opcode) -- a mid-instruction address the store deliberately gives no label, by design (a label there would be exactly the "misleading symbol" the construction avoids on purpose). `anno-export-asm.ts`'s generic export can only attach a comment to an instruction's own start address or to an address a store label already names; a comment at neither makes the export refuse by name (`exportAsm: the line comment at $0834 has no emitted line to attach to`), which is exactly the refusal this plan's own action text says must not be worked around by relaxing the test.
- **Fix:** Re-anchored the comment to `hazard_smc2_write`'s own start address (the host instruction), keeping the same wording (it still correctly names the operand byte as "one past its opcode"). Fixed in `make-hazard-subject-annostore.mjs` (the regenerator) and regenerated `hazard-subject.annostore.json` (a one-line diff: address `2100` -> `2099`, decimal).
- **Files modified:** `src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs`, `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json`
- **Verification:** `hazard-subject-reassembly.test.ts` (11/11), `hazard-subject-fixture.test.ts` and `anno-hazard-report.test.ts` re-run clean after the change (100/100 combined, no regression from the re-anchor), `npm run typecheck` exits 0.
- **Committed in:** `b5db0c2e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, found by exercising the reassembly path against a store no prior plan had run through it)
**Impact on plan:** Necessary for the plan's own criterion 4 (a real assembler reassembles the subject's committed store export) to hold at all -- the fix is minimal (one comment's anchor address), touches no byte of the assembled image, and does not change what the comment documents. No scope creep.

## Issues Encountered

- Investigating the raster construction's on-screen behaviour required extensive live testing (loading the committed images into a real stock emulator through multiple methods -- VICE's own autostart, and a direct monitor-driven load-and-jump after confirming a full KERNAL boot -- including a nested, fully isolated X server to rule out any interference from the host desktop). The reversion of the raster construction's installed interrupt vector and VIC-II/CIA1 state was reproduced consistently across every method, including with an entry point that never returns to BASIC at all (ruling out "returning to BASIC undoes the vector" as the explanation). The precise trigger was not identified further within this plan's scope; it is recorded in `FIXTURE-DESIGN.md`'s observations section as a genuine, disclosed finding rather than resolved or hidden. This is the one property recorded under `human_judgment: true` in this summary's coverage block -- a human reviewing the prepared, captured evidence is the correct next step, not an executor asserting a root cause it could not confirm.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six plans of Phase 48 are now complete. The purpose-built subject carries all four planted hazard classes, the pure read-only report module detects three of them (with the fourth's structural-signature-only limit stated plainly) and declines the deliberately undetected self-modification by name, the cross-check against four independently-sourced fixtures is committed, and the subject now reassembles through the real multi-file export path with a real assembler.
- **Not fully closed:** the raster construction's on-screen persistence, recorded honestly as a disclosed disagreement in `FIXTURE-DESIGN.md` rather than resolved. A future pass revisiting the timer-stabilised raster construction's interaction with a running KERNAL/BASIC environment -- or accepting the isolated-construction evidence as sufficient -- is the natural next step; this is not a blocker recorded elsewhere, since the report's own class-4 detector never claims to verify cycle-exactness or on-screen persistence in the first place.
- No blockers to phase completion. This was the last plan in the phase.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-13*

## Self-Check: PASSED

- Both created files found on disk (`FIXTURE-DESIGN.md`, `hazard-subject-reassembly.test.ts`).
- All 3 task commits found in git log (`4f7a64db`, `b5db0c2e`, `b9145801`).
- `npm run typecheck` exits 0.
- `VICE_REQUIRE_ACME=1 node --test hazard-subject-reassembly.test.ts` reports 11/11 passing, no skips, 10 tests carrying the `hazard reassembly:` prefix.
- `node --test anno-export-asm.test.ts resources-sync.test.ts host-tool.test.ts` (VICE_REQUIRE_ACME=1): 316/316 passing, confirming the export module and host-tool seam are exercised unmodified.
- `npm run test:automated` shows exactly the same six pre-existing failing test names the plan's measured baseline records, and no seventh (re-confirmed on a clean re-run after removing a leaked `zz-scratch-*` directory, a previously-documented pre-existing flake unrelated to this plan).
- `FIXTURE-DESIGN.md`: 10 `## ` section headings (>= 8 required), 19 occurrences of "textbook"/"canonical" (>= 4 required), 4 occurrences of "Prediction"/"Observation" (>= 4 required), 0 planning-vocabulary hits.
- No leaked `zz-scratch-*` directory or stray emulator/X-server process remains at completion (`ps aux` checked clean for `x64sc`/`Xephyr` after the live-testing session).
