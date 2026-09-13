---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 05
subsystem: testing
tags: [acme, byte-diff, reassembly, gate, hazard-report, acknowledgement]

requires:
  - phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
    provides: "runReassemblyGate() and the seven-input GateInput/HazardAcknowledgementResult shapes (plan 02); hazardCoverageOutsideDiffScope()'s undecidedRegions handling (plan 03)"
provides:
  - "reassembly-gate-ack.ts: the three-part finding key, the exactly-one acknowledgement matcher, the HAZARD_DISPOSITION disposition rule, and deterministic acknowledgement-line rendering"
  - "The real producer for HazardAcknowledgementResult (declared as a stub by plan 02), so the gate's hazard input is now wired to a real disposition rather than a test literal"
  - "An exhaustive proof, over all 864 combinations of the seven gate inputs' declared tokens, that no non-clean HAZARD_DISPOSITION combination ever returns green"
affects: [reassembly-gate-run, reassembly-gate-seam-guard]

actuals:
  tokens: 11593
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A finding's identity for acknowledgement-matching is its (hazardClass, anchorAddress, mechanism) triple, joined with a separator drawn from a closed vocabulary rather than keyed on array position -- so the findings array's undocumented ordering cannot silently move an acknowledgement to a different finding"
    - "Zero-match and multi-match acknowledgements are tracked in separate result fields rather than folded into one failure count, so a reader can tell 'you acknowledged something that is no longer there' from 'you did not acknowledge this'"
    - "Every array a matcher returns is sorted by its own canonical key before being handed back, making the whole result independent of the caller's own array order -- proven directly by a shuffled-input case rather than merely asserted"
    - "An exhaustive cross-product test over a gate's own declared token domains (rather than a handful of hand-picked cases) is the only way to prove a negative property (\"no route to green\") structurally instead of by sampling"

key-files:
  created:
    - src/mcp/vice/reassembly-gate-ack.ts
    - src/mcp/vice/reassembly-gate-ack.test.ts
  modified: []

key-decisions:
  - "disposeHazardReport() returns HazardAcknowledgementResult (the type plan 49-02 already declared with no producer), rather than inventing a second result shape -- this plan is that producer, not a redesign."
  - "matchHazardAcknowledgements() takes the full HazardReport's findings and regions arrays (filtering to \"unclassified\" regions internally), mirroring hazardCoverageOutsideDiffScope()'s own established parameter shape from plan 49-03 rather than requiring a caller to pre-filter."
  - "The key separator (\"::\") is documented as safe because every part it joins is drawn from a closed vocabulary (HazardClass, a lowercase-hyphenated mechanism string, a decimal integer address) that never contains it -- not because escaping was added."
  - "The exhaustive enumeration test drives runReassemblyGate() directly over bare GateInput tokens rather than constructing MovementResult/HazardAcknowledgementResult producer objects, with a comment explaining why: none of GateInput's seven fields is anything other than a bare token by its own type declaration, so enumerating the token domains directly is already exhaustive over everything the gate function itself reads."
  - "Added a twelfth `gate hazard:` case (multi-match acknowledgement) beyond the eleven the plan's own <behavior> block enumerated, because the plan's <acceptance_criteria> separately requires zero-match and multi-match to be proven as distinct, never-merged fields -- the eleven behaviors alone did not exercise the multi-match side."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "hazardFindingKey() keys a finding by (hazardClass, anchorAddress, mechanism) together; two findings differing only in mechanism produce different keys"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: the finding key is built from the class, the anchor address and the mechanism, and two findings differing only in mechanism produce different keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "matchHazardAcknowledgements() refuses duplicate acknowledgement keys by name before matching, and reports zero-match and multi-match acknowledgements in separate fields, never merged"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: two acknowledgements carrying the same key are refused by name before matching runs"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: an acknowledgement whose key matches no finding disposes blocked and is reported as a zero-match, distinct from an unacknowledged finding"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: an acknowledgement matching more than one finding is reported as a multi-match, distinct from a zero-match, and every such finding is treated as unacknowledged"
        status: pass
    human_judgment: false
  - id: D3
    description: "disposeHazardReport() derives clean/acknowledged/blocked per the committed rule: clean only for an all-empty report; acknowledged only when every finding and every undecided region is matched exactly once with a non-empty reason; blocked otherwise, naming the first failure"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: a report with zero findings, zero undecided regions and no acknowledgements disposes clean"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: a report with zero findings and one undecided region does not dispose clean; with that region acknowledged it disposes acknowledged, and without disposes blocked"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: an acknowledgement carrying an empty or whitespace-only reason disposes blocked, and the reason names the offending key"
        status: pass
    human_judgment: false
  - id: D4
    description: "A real, non-clean hazard report over the committed hazard-subject fixture reaches at most the acknowledged gate verdict (rule R10) with a complete acknowledgement set, and blocked/red (rule R9) with one acknowledgement removed -- never green"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: the real report over the committed subject is genuinely non-clean, carrying at least one finding -- the precondition every case below rests on"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: a complete acknowledgement set over the real report yields the acknowledged disposition and an acknowledged gate verdict -- never green"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: removing one acknowledgement from the real report's complete set yields blocked and a red gate verdict under the blocked-hazard rule"
        status: pass
    human_judgment: false
  - id: D5
    description: "An exhaustive enumeration of all 864 combinations of the seven gate inputs' declared tokens proves no combination with a non-clean HAZARD_DISPOSITION ever returns green, while at least one combination does return green"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: the exhaustive enumeration of the seven gate inputs' declared token sets never returns green for a non-clean hazard disposition, and at least one combination does return green"
        status: pass
    human_judgment: false
  - id: D6
    description: "renderAcknowledgementLines() sorts matched pairs by the frozen HAZARD_CLASSES order, then anchor address, then mechanism; two calls over the same report produce identical text"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: the rendered acknowledgement lines are ordered by class, then anchor address, then mechanism, and two calls over the same report produce identical text"
        status: pass
      - kind: unit
        ref: "reassembly-gate-ack.test.ts#gate hazard: rendering the real report's acknowledgement lines twice produces deeply equal arrays, each line carrying a hex anchor address and a non-empty reason"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 05: The hazard acknowledgement matcher and the no-silent-green proof Summary

**A finding's acknowledgement is keyed to its class, anchor address and mechanism together (never a wildcard, a count or an array index), zero-match and multi-match acknowledgements are reported as distinct facts rather than merged, and an exhaustive 864-combination enumeration of the gate's own seven inputs proves no non-clean hazard disposition can ever reach green.**

## Performance

- **Duration:** ~45 min
- **Started:** ~2026-09-13T09:40:00Z
- **Completed:** 2026-09-13T10:24:19Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `reassembly-gate-ack.ts` implements `hazardFindingKey()` (the three-part identity), `matchHazardAcknowledgements()` (duplicate-key refusal, exactly-one matching with zero-match/multi-match tracked separately, and full order-independence via canonical-key sorting on every output array), `disposeHazardReport()` (the clean/acknowledged/blocked disposition rule, returning the `HazardAcknowledgementResult` shape plan 49-02 declared with no producer), and `renderAcknowledgementLines()` (deterministic, class-then-address-then-mechanism ordering for the verdict artifact).
- A real hazard report built over the committed hazard-subject fixture (its committed `.prg` supplies the bytes, its committed store export supplies the ranges) is confirmed non-clean (three real findings: an indexed-dispatch stack-return, a self-modifying-code opcode-byte hit, and a cycle-exact-raster timer-reload signature, plus one `unclassified` region from an incomplete VIC-II register recovery). A complete acknowledgement set disposes it `acknowledged` and the gate returns the `acknowledged` outcome under rule `R10` -- never green. Removing one acknowledgement disposes `blocked` and the gate returns `red` under rule `R9`.
- An exhaustive test enumerates the full cross product of all seven gate inputs' declared token domains (3 × 4 × 3 × 2 × 3 × 2 × 2 = 864 combinations) directly against `runReassemblyGate()`, asserting no combination with a non-clean `HAZARD_DISPOSITION` ever returns green, while also asserting at least one combination does return green -- so the check cannot pass by the gate rejecting everything.
- 17 `gate hazard:` cases total (12 pure-rule cases needing no assembler or store, plus 5 cases against the real fixture and the exhaustive token space); typecheck clean; `reassembly-gate-ack.ts` contains no store open, file write or child-process spawn (mechanically asserted); it is absent from `package.json`'s published `files[]` array.

## Task Commits

Each task was committed atomically:

1. **Task 1: The three-part key, the exactly-one matching, and the disposition rule** (`tdd="true"`) - `3bfe9fe3` (test, RED) then `ace9c758` (feat, GREEN)
2. **Task 2: The real report, the exhaustive no-silent-green check, and the gate wiring** - `8aaacdf6` (test)

A follow-on deviation fix (multi-match acceptance criterion, found via the mandatory acceptance-criteria gate) - `36c20809` (test)

**Plan metadata:** _(this commit)_ `docs(49-05): complete the hazard acknowledgement matcher plan`

## Files Created/Modified

- `src/mcp/vice/reassembly-gate-ack.ts` - the acknowledgement matcher, disposition rule and deterministic renderer: `HazardAcknowledgement`, `UndecidedRegionAcknowledgement`, `AcknowledgementMatch`, `AcknowledgementMatchResult`, `hazardFindingKey()`, `matchHazardAcknowledgements()`, `disposeHazardReport()`, `renderAcknowledgementLines()`
- `src/mcp/vice/reassembly-gate-ack.test.ts` - 17 `gate hazard:` cases: the key, clean/blocked over an empty report, an undecided region alone, a fully acknowledged report, an unacknowledged finding, a zero-match acknowledgement, a multi-match acknowledgement, duplicate-key refusal, an empty reason, order-independence under shuffling, deterministic rendering, the real report's non-clean precondition, the real report's acknowledged/blocked dispositions and gate verdicts, the exhaustive 864-combination enumeration, and the real report's rendered lines

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the multi-match acknowledgement case the plan's own acceptance criteria required but its eleven behaviors did not enumerate**
- **Found during:** the mandatory acceptance-criteria verification gate, after Task 1's GREEN commit
- **Issue:** Task 1's `<acceptance_criteria>` states "Zero-match and multi-match acknowledgements are reported in separate fields of the match result, never merged into one count" -- but the eleven `<behavior>` bullets the RED commit was written against only describe the zero-match side (an acknowledgement matching zero findings). Without a dedicated case, `multiMatchAcknowledgements` was implemented but never exercised.
- **Fix:** Added a twelfth `gate hazard:` case constructing two findings sharing an identical (class, anchor, mechanism) triple (possible only in a hand-assembled array, since a real `buildHazardReport()` output de-duplicates on that exact triple) matched by one acknowledgement, asserting the acknowledgement is reported as a multi-match (never also as a zero-match), both findings are treated as unacknowledged, and `disposeHazardReport()` surfaces them via `ambiguousAcknowledgements`.
- **Files modified:** `src/mcp/vice/reassembly-gate-ack.test.ts`
- **Verification:** `node --test reassembly-gate-ack.test.ts` -- 17/17 pass; `npm run typecheck` clean
- **Committed in:** `36c20809`

---

**Total deviations:** 1 auto-fixed (Rule 2 -- a missing-critical test case the plan's own acceptance criteria required). **Impact:** necessary for the plan's own stated acceptance gate to actually hold; no scope creep beyond what Task 1 already specified.

## Known Stubs

None introduced by this plan. `MovementResult` (from plan 49-02, wired to a real producer by plan 49-04) is unaffected by this plan; `HazardAcknowledgementResult` (also declared by plan 49-02 with no producer) now has its real producer here (`disposeHazardReport()`).

## Issues Encountered

None beyond the one auto-fixed deviation above.

**Pre-existing test-suite flakes observed, not caused by this plan.** A full `npm run test:automated` run showed 8 failing tests across 6 files: the 4 documented-baseline files (`anno-import.test.ts`, `anno-register.test.ts`, `audit-integrity.test.ts`, `docs-deferred-ledger.test.ts`) plus two additional files (`anno-tools.test.ts`, `anno-verb-coverage.test.ts`) whose failing tests both pass cleanly when that single file is run in isolation (`node --test anno-tools.test.ts` and `node --test anno-verb-coverage.test.ts` are each 100%/106 and 10/10 green). Neither file is touched by this plan, and `anno-verb-coverage.test.ts` is a previously-known cross-test race (it leaks a gitignored scratch directory when run inside the full suite). This plan's own files (`reassembly-gate-ack.ts`, `reassembly-gate-ack.test.ts`, `reassembly-gate.ts`, `reassembly-gate.test.ts`, `anno-hazard-report.test.ts`) all pass cleanly, standalone and together, both before and after this plan's changes -- no new failing file was introduced by this plan.

## User Setup Required

None - no external service configuration required. No new external tool is introduced; this module reads a hazard report and an acknowledgement set with no store, file or process interaction.

## Next Phase Readiness

- The gate's `HAZARD_DISPOSITION` input now has a real producer (`disposeHazardReport()`), matching plan 49-04's movement producer (`reassembly-gate-movement.ts`) on the same terms plan 49-02 anticipated. Plan 49-06 (the seam guard) and plan 49-07 (the real end-to-end run) can now import `matchHazardAcknowledgements`, `disposeHazardReport` and `renderAcknowledgementLines` as fixed contracts.
- `BUILD-06` is shared across all seven plans in this phase (01-07) and is not yet marked complete in `REQUIREMENTS.md` -- the shared-ID gate correctly withholds it until every plan declaring it has its own SUMMARY.md.
- No blockers. This plan's own files and every file it reads (`anno-hazard-report.ts`, `reassembly-gate.ts`, `anno-store-export.ts`) pass unchanged.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED

Both key files (`reassembly-gate-ack.ts`, `reassembly-gate-ack.test.ts`) confirmed present on disk. All four commit hashes (`3bfe9fe3`, `ace9c758`, `8aaacdf6`, `36c20809`) confirmed present in `git log`. Every task's `<acceptance_criteria>` re-verified passing (including the multi-match case added as a deviation fix); the plan-level `<verification>` items re-run: every refusal (duplicate key, zero-match, multi-match, empty reason, unacknowledged finding, unacknowledged undecided region) is observed by a dedicated case; the real non-clean report reaches the acknowledged verdict and no further; the whole seven-input token space is enumerated with no non-clean combination returning green and at least one combination proving green reachable; `anno-hazard-report.ts` is untouched and its 64 tests pass unchanged.
