---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 04
subsystem: testing
tags: [acme, byte-diff, reassembly, gate, movement, relocation, tdd]

requires:
  - phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
    provides: "verifyAcmeAssemblesTree() and runReassemblyGate() over the seven frozen gate inputs, plus MovementResult's declared shape (plan 49-02)"
provides:
  - "reassembly-gate-movement.ts: relocateSubject() (store-document + image layer relocation with five named refusals and a range-collision check), buildMovementResult() and refusedMovement() wired to the gate's own MovementResult contract"
  - "A real relocated tree, exported and reassembled by a real ACME at the new layout, diffing clean through the moved symbol"
  - "The half-moved split-address-table control, in both directions, at the exact byte"
affects: [reassembly-gate-run]

actuals:
  tokens: 12492
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Relocation as a pure transform over a StoreExportDocument and a plain Uint8Array image -- no live store handle, no child process, no file I/O -- so the transform's own properties are provable without an assembler"
    - "Rebuild the image from scratch into a fresh buffer sized from the TRANSFORMED document's own extent, copying each range from its ORIGINAL address to its NEW one, rather than patching in place -- the vacated address is left as zeroes by construction, never by a separate zero-fill step"
    - "Reference sites are DECLARED input data (fixture-supplied), validated against the image's CURRENT bytes before any row shifts, and refused by name on drift -- never derived from the exporter's own symbolisation"
    - "A relocation gate's ground truth for a byte-diff is the FULLY, correctly relocated image's own expectedBytes, not the suspect input's self-derived account of itself -- required because the exporter's address-reference symbol substitution is, by design, tautologically self-consistent with whatever image produced it"

key-files:
  created:
    - src/mcp/vice/reassembly-gate-movement.ts
    - src/mcp/vice/reassembly-gate-movement.test.ts
  modified: []

key-decisions:
  - "RelocatedSubject carries symbolName (not declared in the plan's own field list for that type) because buildMovementResult() needs it to populate MovementResult.symbolName without a second lookup back into the transformed document -- an additive, non-conflicting design choice."
  - "The collision check uses half-open extents (endExclusive = endInclusive + 1) so two ranges that merely abut (one's exclusive end equals the other's start) are allowed, and two that share even one address are refused -- the same boundary convention this codebase's isInTree()/hazardCoverageOutsideDiffScope() already use."
  - "The movement subject built for tasks 2 and 3 is a small, purpose-built program (an absolute-indexed entry load reading a lo_hi_address split table by symbol name, plus two one-byte routines) -- never the committed hazard-subject fixture, which deliberately carries constructions whose whole point is that they cannot move."
  - "The half-move reds (task 3) verify the half-patched tree's real assembled output against the HONEST relocation's own expectedBytes, not the half-patched export's self-derived expectedBytes -- see Deviations for the measured reason this was necessary."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "relocateSubject() shifts a symbol's label, owning range and containing scope by one delta, rebuilds the image at the transformed document's new extent, and patches every declared reference site -- refusing five named dishonest inputs and any range collision before touching a row"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: a valid request returns a document whose named label, whose owning range and whose containing scope have all moved by exactly the delta, and whose every other row is byte-for-byte unchanged"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: the returned image carries the moved range's bytes at the new address and zeroes at the address the range vacated"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: a relocation whose new range ends exactly one byte below another range's start succeeds / ...starts exactly at another range's start is refused"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every dishonest relocation request is refused by name: a zero delta, an empty site list, an unknown symbol, a site naming a different symbol, and a site whose current bytes do not already hold the symbol's original address"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: a request with a delta of zero is refused by name... / an empty reference-site list... / a request naming a symbol the document has no label for... / a declared site naming a different symbol... / a declared site whose current bytes do not hold the symbol's original address..."
        status: pass
    human_judgment: false
  - id: D3
    description: "A real relocation (routine_a, both octets of its address changed) is exported at the new layout and reassembled by a real ACME, diffing clean through the same symbol name the unrelocated tree used"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: the unrelocated movement subject's tree verifies to the pass outcome... before any relocation is attempted"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: relocating routine_a and re-exporting at the new layout verifies to the pass outcome with an equal byte-diff, through the same symbol"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: the gate returns green for a passing movement result and red under the movement rule for a refused one"
        status: pass
    human_judgment: false
  - id: D4
    description: "Moving one half of a split lo_hi_address table without the other is caught in both directions (low-only, high-only declared), at the exact byte, each preceded by a passing both-halves control, and without disturbing the exporter's own split-table emission tests"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: the honest direction, with both of routine_a's table sites declared, verifies to the pass outcome with an equal byte-diff before either red is attempted"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: relocating routine_a with only its LOW-octet table site declared fails the byte-diff at the table's high-octet entry for the moved routine"
        status: pass
      - kind: unit
        ref: "reassembly-gate-movement.test.ts#gate movement: relocating routine_a with only its HIGH-octet table site declared fails the byte-diff at the table's low-octet entry for the moved routine"
        status: pass
      - kind: test
        ref: "anno-export-asm.test.ts (206/206, unchanged)"
        status: pass
    human_judgment: false

duration: ~20min (commit span; research/context-loading time preceding the first commit not included)
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 04: The movement transform, a real relocated rebuild, and the half-moved split-table control Summary

**A symbol relocates at the store-document-and-image layer with five named refusals and a range-collision check, a real relocation exports and reassembles clean at its new layout through a real ACME, and moving one half of a split address table without the other is caught in both directions at the exact byte.**

## Performance

- **Duration:** ~20 min (commit span)
- **Task count:** 3
- **Files created:** 2 (`reassembly-gate-movement.ts`, `reassembly-gate-movement.test.ts`)
- **Files modified:** 0

## Accomplishments

- `reassembly-gate-movement.ts` implements `relocateSubject()`: shifts a chosen symbol's label row, its owning range and its containing scope (when one exists) all by the same signed delta, rebuilds the program image into a fresh zero-filled buffer spanning the transformed document's own new extent (copying each range from its original address to its new one, never patching in place), and patches every declared reference site under its own encoding (`twoByteLittleEndian`, `lowByte`, `highByte`).
- Five refusals run before any row is shifted or byte copied, each naming the function and the offending input: a zero delta, an empty site list, an unknown symbol, a site naming a different symbol than the one being moved, and a site whose current bytes do not already hold the symbol's original address. A sixth refusal (range collision) runs after the shift is computed but before it is applied, over half-open extents so two ranges that merely abut are allowed and two that share even one address are refused.
- `buildMovementResult()` carries a real assembler verdict into the gate's `MovementResult` shape, forcing the `"refused"` outcome whenever the original and relocated addresses are equal regardless of what the verdict said (defence in depth beside `relocateSubject()`'s own upstream zero-delta refusal). `refusedMovement()` builds a refused result from a reason string alone.
- A small, purpose-built movement subject (never the committed hazard-subject, which deliberately cannot move) is exported unrelocated, verified clean; then `routine_a` is relocated by a delta that changes both address octets, re-exported at the new layout into a fresh tree, and verified clean through a real ACME -- the relocated address differs from the original, and the relocated tree's emitted text still names the routine by its original symbol.
- The half-moved split-table control relocates the same routine with only one of its two declared table sites (low-octet, then high-octet, in both directions), each preceded by a passing both-halves honest control, and each red's first differing byte offset is computed from the subject's own declared table layout rather than written as a bare number.

## Task Commits

Each task was committed atomically (Task 1 is `tdd="true"` and produced two commits, RED then GREEN; no REFACTOR commit was needed):

1. **Task 1: The relocation transform** - `62e856e7` (test, RED) then `6cde14a5` (feat, GREEN)
2. **Task 2: The real relocated rebuild** - `8f92f842` (test)
3. **Task 3: The half-moved split table** - `d6c5eea0` (test)

**Plan metadata:** _(this commit)_ `docs(49-04): complete the movement plan`

## Files Created/Modified

- `src/mcp/vice/reassembly-gate-movement.ts` - the movement module: `RELOCATION_SITE_ENCODINGS`/`RelocationSiteEncoding`, `RelocationSite`, `RelocationRequest`, `RelocatedSubject`, `relocateSubject()`, `buildMovementResult()`, `refusedMovement()`
- `src/mcp/vice/reassembly-gate-movement.test.ts` - twenty `gate movement:` cases: ten unit cases on the pure transform (task 1), three real-rebuild cases (task 2), and seven half-move/honest-control cases (task 3), plus the file's own `ACME availability gate` case

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `RelocatedSubject` needed a `symbolName` field the plan's own type sketch did not list**
- **Found during:** Task 1
- **Issue:** The plan's action text lists `RelocatedSubject`'s fields as "the transformed document, the rebuilt image, its origin, the original and relocated addresses, the delta, and the sites that were patched" -- no `symbolName`. But `buildMovementResult()`'s own required behaviour ("a movement result built from a passing assembler verdict carries... the symbol name...") has no other source for that field without re-deriving it from a reverse label lookup on every call.
- **Fix:** Added `symbolName: string` to `RelocatedSubject`, populated directly from the request. Additive; does not conflict with anything the plan declares.
- **Files modified:** `src/mcp/vice/reassembly-gate-movement.ts`
- **Verification:** `npm run typecheck` clean; all `gate movement:` cases pass.
- **Committed in:** `6cde14a5`

**2. [Rule 1 - Bug] The plan's own self-diff framing for the half-move reds does not produce a byte-diff failure, measured directly against this subject**
- **Found during:** Task 3
- **Issue:** The plan's action text describes verifying a half-patched relocated tree against ITS OWN (self-derived) `expectedBytes`, expecting `outcome: "failed"` with a disagreeing byte-diff. Measured directly: this always returns `"ok"`. The reason is structural, not a fixture mistake -- `emitSplitAddressLines()` (`anno-export-asm.ts`) reconstructs a table entry's target address FROM THE SAME IMAGE BYTES it is about to render, then either substitutes a symbol whose real address IS that reconstructed target by definition, or falls back to the identical raw bytes. Either way the emitted source and the image it was derived from are tautologically self-consistent; self-diffing a half-patched export can never disagree with itself, symbol-substituted or not.
- **Fix:** Both half-move reds verify the half-patched tree's real assembled output against the bytes the FULL, correctly-relocated subject (both sites declared) produces, rather than against the half-patched export's own `expectedBytes`. This is not a weakening of the control -- it is the correct ground truth for a relocation gate in general: "expected bytes" for a relocation is properly the fully-relocated image, never the suspect input's own account of itself. Both reds still compute their first-differing-offset assertion from the subject's own declared block layout, never a bare number, exactly as the plan requires.
- **Files modified:** `src/mcp/vice/reassembly-gate-movement.test.ts`
- **Verification:** Both reds fail with the expected outcome, byte-diff and offset; the honest (both-sites) control and `anno-export-asm.test.ts` (206/206) are unaffected.
- **Committed in:** `d6c5eea0`

---

**Total deviations:** 2 auto-fixed (1 additive type-field addition needed for the plan's own required behaviour to be satisfiable, 1 measured correction to the verification framing after the plan's literal approach was shown not to produce the required outcome against a real ACME). **Impact:** both were necessary for this plan's own acceptance criteria to hold against reality; neither weakens what the control actually proves -- the half-move is still caught, in both directions, at the exact byte, through a real assembler.

## Known Stubs

None introduced by this plan.

## Issues Encountered

None beyond the two auto-fixed deviations above, both resolved within this plan's own scope and documented for the findings document this phase will produce (plan 49-07).

## User Setup Required

None - no external service configuration required. ACME was already detected on `PATH` (`/home/henrik/.local/bin/acme`, release 0.97 "Zem") and no new external tool is introduced.

## Next Phase Readiness

- `relocateSubject()`, `buildMovementResult()` and `refusedMovement()` are wired end to end against a real relocation, a real ACME, and the gate's own rule table (`R5` for refused, `R6` for failed). `evidence/49-movement-rebuild.md` (plan 49-07) can cite this file's real-path cases directly.
- The half-move control is observed catching both directions at the exact byte, contributing to the `RED_CONTROLS` input's eventual `all-observed` value (plan 49-07), alongside the two controls plan 49-03 already proved.
- `BUILD-06` is shared across all seven plans in this phase (01-07) and is not yet marked complete in `REQUIREMENTS.md` -- the shared-ID gate correctly withholds it until every plan declaring it has its own SUMMARY.md.
- The full `test:automated` suite was re-run after this plan's changes: 4359 tests, 4344 pass, 6 fail -- the same four pre-existing failing files as the documented baseline (`anno-import.test.ts`, `anno-register.test.ts`, `audit-integrity.test.ts`, `docs-deferred-ledger.test.ts`), no new failures introduced.
- No blockers.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED

Both created files (`reassembly-gate-movement.ts`, `reassembly-gate-movement.test.ts`) confirmed present on disk. All four task commit hashes (`62e856e7`, `6cde14a5`, `8f92f842`, `d6c5eea0`) confirmed present in `git log`. Every task's `<acceptance_criteria>` re-verified passing; the plan-level `<verification>` items re-run: all dishonest relocations refused by name with the collision boundary pinned in both directions; a real relocation exports/reassembles/diffs clean through the symbol; both half-move directions caught at the exact byte, each preceded by a passing both-halves control; `anno-export-asm.test.ts` (206/206) unaffected.
