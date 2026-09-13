---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
plan: 07
subsystem: testing
tags: [acme, byte-diff, reassembly, gate, decision-rule, verdict, findings-document]

requires:
  - phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
    provides: "the frozen seven-input schema and twelve-rule decision table (49-01), the tree-aware byte-diff entry point and gate module (49-02), the three planted red controls (49-03), the movement transform and real relocated rebuild (49-04), the hazard acknowledgement matcher (49-05), and the ACME seam guard (49-06)"
provides:
  - "reassembly-gate-run.test.ts: the run harness producing the gate's four in-process inputs (TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, DIFF_SCOPE_COVERAGE x2) from real machinery"
  - "reassembly-gate-movement-subject.ts: the movement plan's subject, lifted into a shared, non-test module so the run harness reuses it rather than declaring a second one"
  - "The five measurement evidence files carrying the seven recorded gate inputs as bare column-0 outcome lines, each with its command, date and raw excerpt"
  - "docs/phase49-the-reassembly-gate-findings.md: the published, machine-readable verdict -- red under rule R7 -- with every input cited to its evidence line and the ordering property proved from git history"
affects: [50]

actuals:
  tokens: 19400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A shared movement/test subject lifted into a plain, non-test .ts module (never imported from a .test.ts sibling), so two test files reuse the identical fixture without re-running each other's registered tests as an import side effect"
    - "A measuring harness that asserts only domain membership on every printed token, never a particular value, with an explicit comment naming why -- so a later reader cannot quietly convert the instrument into a second, unfrozen decision rule"
    - "Per-evidence-file excerpting: each of the five evidence files quotes only the raw-output slice for the outcome line(s) SCHEMA.md assigns to it, never the whole multi-input run transcript, so no file 'declares' a line assigned to a sibling file"

key-files:
  created:
    - src/mcp/vice/reassembly-gate-run.test.ts
    - src/mcp/vice/reassembly-gate-movement-subject.ts
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-tree-rebuild.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-movement-rebuild.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-hazard-disposition.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-red-controls.md
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-guards.md
    - docs/phase49-the-reassembly-gate-findings.md
  modified:
    - src/mcp/vice/reassembly-gate-movement.test.ts

key-decisions:
  - "Extracted the movement plan's subject (document, image, delta, reference sites) out of reassembly-gate-movement.test.ts into a new shared, non-test module (reassembly-gate-movement-subject.ts), because importing a .test.ts file for its exports would also re-run every top-level test(...) call it registers as an import side effect -- the exact hazard acme-verify.ts's and acme-gate.ts's own headers already document for staying plain .ts modules."
  - "HAZARD_DISPOSITION is recorded as blocked, not acknowledged: the frozen acknowledgement array declared in the run harness names one entry per real finding (three), per the plan's own action text, and supplies no acknowledgement for the committed subject's one permanently-unclassified VIC-II region. The plan's own instruction is explicit that no entry is added to turn a blocked disposition into a passing one, so this is the honest, real measurement."
  - "DIFF_SCOPE_COVERAGE is printed and transcribed TWICE (once per rebuild run), per SCHEMA.md S2.4's own explicit two-declared-source-file design for this one input -- never collapsed to a single combined line, since doing so would leave one of the two declared occurrences ABSENT from its assigned file, which SCHEMA.md's own absence rule treats as never a pass."
  - "The verdict is red under rule R7 (DIFF_SCOPE_COVERAGE incomplete on the baseline occurrence), not R9 (HAZARD_DISPOSITION blocked) -- R7 precedes R9 in the committed first-match-wins order, and the walk table in the findings document shows R8/R9/R10/R11 were never reached."
  - "Recorded an ACCEPTED LIMIT in the two DIFF_SCOPE_COVERAGE-carrying evidence files (and a corresponding override in the findings document) rather than editing SCHEMA.md or DECISION-RULE.md: this plan's own Task 2 <verify> asserts a total of exactly seven bare outcome-line matches across the five evidence files, but SCHEMA.md's own dual-occurrence design for DIFF_SCOPE_COVERAGE makes the schema-correct total eight, measured directly. Both required occurrences were written in full; the verify command's literal '7' is the thing found not to match reality, and SCHEMA.md/DECISION-RULE.md are themselves unedited (confirmed by git diff --quiet)."

requirements-completed: [BUILD-06]

coverage:
  - id: D1
    description: "The run harness produces the gate's four in-process inputs (TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, and both DIFF_SCOPE_COVERAGE occurrences) from real machinery -- a real ACME, the committed purpose-built subject, a real relocation of the shared movement subject, the real hazard report, and a real disposal against a frozen per-finding acknowledgement array -- asserting only domain membership on every printed token"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-run.test.ts#gate run: the four in-process gate inputs, measured for real against the committed subject and a real assembler"
        status: pass
    human_judgment: false
  - id: D2
    description: "The movement plan's subject is reused by the run harness via a new shared, non-test module rather than a second declaration, and the refactor of reassembly-gate-movement.test.ts to import it is behavior-preserving"
    requirement: "BUILD-06"
    verification:
      - kind: unit
        ref: "reassembly-gate-movement.test.ts (21/21 pass, unchanged assertions, after the subject-construction extraction)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seven gate inputs are recorded as sourced, dated, command-cited outcome lines across the five declared evidence files, with the ordering property proved from real git history rather than from any document's own claim"
    requirement: "BUILD-06"
    verification:
      - kind: other
        ref: "grep -acE column-0 outcome-line check across evidence/49-*.md (task 2 <verify>); git log --diff-filter=A / git show file-list checks for DECISION-RULE.md's and SCHEMA.md's own add-commits"
        status: pass
    human_judgment: false
  - id: D4
    description: "The verdict document evaluates the frozen rule table in order against the recorded inputs, publishes red under R7 with every input cited to its evidence line, and leaves SCHEMA.md/DECISION-RULE.md unedited"
    requirement: "BUILD-06"
    verification:
      - kind: other
        ref: "task 3 <verify>: frontmatter verdict/verdict_rule_applied counts, >=7 evidence citations, git diff --quiet on SCHEMA.md/DECISION-RULE.md"
        status: pass
      - kind: manual_procedural
        ref: "task 3 <human-check>: confirm R7 is genuinely the first matching rule in the committed table and the body does not argue with it"
        status: unknown
    human_judgment: true
    rationale: "Task 3 carries a <human-check> verifying the rule-table walk is read correctly and the body's tone does not argue with the fired rule -- this plan's own text requires that confirmation from a human reader, not an automated assertion."

duration: 55min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 07: The Real Run and the Published Verdict Summary

**Ran the reassembly gate for real against the committed hazard subject and a real ACME, recorded all seven inputs across five evidence files, and published a `red` verdict under rule `R7` -- the baseline rebuild's own diff-scope coverage is incomplete because the subject carries one permanently-unclassified VIC-II region, unrelated to any byte-level defect.**

## Performance

- **Duration:** ~55 min
- **Started:** ~2026-09-13T10:30:00Z
- **Completed:** 2026-09-13T11:20:00Z
- **Tasks:** 3
- **Files modified:** 9 (7 created, 1 test file refactored to remove a duplicated subject declaration, 1 findings document created)

## Accomplishments

- `reassembly-gate-run.test.ts` runs the gate's four in-process inputs end to end against real machinery: a real ACME (release 0.97 "Zem") reassembles the committed purpose-built subject's tree (`TREE_REBUILD: ok`), the real hazard report over that same subject drives the diff-scope check against the export's own half-open extent (`DIFF_SCOPE_COVERAGE: incomplete`, baseline), a real relocation of the shared movement subject's `routine_a` (delta 261 bytes, `$080B` -> `$0910`) re-exports and reassembles clean at the new layout (`MOVEMENT_REBUILD: ok`, its own `DIFF_SCOPE_COVERAGE: complete`), and a real disposal of the real hazard report against a frozen, three-entry, per-finding acknowledgement array reports `HAZARD_DISPOSITION: blocked` (the subject's one permanently-unclassified region is left unacknowledged, per the plan's own instruction never to add an entry to force a pass).
- `reassembly-gate-movement-subject.ts` lifts the movement plan's subject (document, image, delta, declared reference sites) out of `reassembly-gate-movement.test.ts` into a shared, non-test module, so the run harness reuses the identical subject rather than inventing a second one -- verified behavior-preserving by re-running `reassembly-gate-movement.test.ts` after the extraction (21/21 pass, unchanged).
- Five evidence files transcribe the run: `49-tree-rebuild.md` and `49-movement-rebuild.md` each carry their own excerpt of the run harness's output plus their own `DIFF_SCOPE_COVERAGE` occurrence; `49-hazard-disposition.md` carries the full finding table, the undecided region, and the rendered acknowledgement lines; `49-red-controls.md` names all three planted controls from plan 49-03 individually and confirms all were observed passing in one `node --test acme-verify.test.ts reassembly-gate.test.ts` run (67/67 pass); `49-guards.md` records the ACME seam guard's own accepted limit about its two pre-existing comparison-site members verbatim, and the ordering proof derived from `git log --diff-filter=A` and `git show --name-only` against `SCHEMA.md`'s and `DECISION-RULE.md`'s own add-commits (`b6953618`, `4df0f567` -- both single-file commits, both the first two commits of the whole phase).
- `docs/phase49-the-reassembly-gate-findings.md` evaluates the frozen twelve-rule table in order against the seven recorded inputs and publishes `verdict: red`, `verdict_rule_applied: R7` -- the first matching rule, reached before `HAZARD_DISPOSITION: blocked` would have fired `R9` two rules later. Every input carries an inline citation to its evidence file and line (7 citations). `SCHEMA.md` and `DECISION-RULE.md` are confirmed unedited (`git diff --quiet`).
- The full `test:automated` suite was re-run after this plan's changes: 4392 tests, 4377 pass, 6 fail -- the same four pre-existing failing files as the documented baseline (`anno-import.test.ts`, `anno-register.test.ts`, `audit-integrity.test.ts`, `docs-deferred-ledger.test.ts`), no new failures introduced.

## Task Commits

Each task was committed atomically:

1. **Task 1: The run harness** - `0ba1872e` (feat)
2. **Task 2: The five evidence files** - `ab07ee47` (docs)
3. **Task 3: The verdict document** - `e11b0da4` (docs)

**Plan metadata:** _(this commit)_ `docs(49-07): complete the real-run-and-verdict plan`

## Files Created/Modified

- `src/mcp/vice/reassembly-gate-run.test.ts` - the run harness: builds and prints the four in-process gate inputs from real machinery, asserting only domain membership
- `src/mcp/vice/reassembly-gate-movement-subject.ts` - the movement plan's subject (document, image, delta, declared reference sites), lifted into a shared, non-test module
- `src/mcp/vice/reassembly-gate-movement.test.ts` - imports the shared subject module instead of declaring it locally; no assertion changed
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-tree-rebuild.md` - `TREE_REBUILD` and `DIFF_SCOPE_COVERAGE` (baseline occurrence)
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-movement-rebuild.md` - `MOVEMENT_REBUILD` and `DIFF_SCOPE_COVERAGE` (movement occurrence)
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-hazard-disposition.md` - `HAZARD_DISPOSITION`, the full finding/region table, and the rendered acknowledgement lines
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-red-controls.md` - `RED_CONTROLS`, naming all three planted-control cases individually
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-guards.md` - `SECOND_PATH_GUARD` and `ORDERING_PROOF`, with the guard's own accepted limit quoted and the ordering proof derived from git history
- `docs/phase49-the-reassembly-gate-findings.md` - the published verdict: `red` under `R7`, every input cited, the ordering proof summarized, and an override recorded for the one place this plan's own verify command disagrees with `SCHEMA.md`

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's own acceptance criterion ("reuse the movement subject... rather than declaring a second one") could not be satisfied by importing the movement plan's own `.test.ts` file**
- **Found during:** Task 1, while resolving how to reuse plan 49-04's movement subject
- **Issue:** `reassembly-gate-movement.test.ts` declares the movement subject (document, image, delta, sites) as local, unexported constants. Importing that file directly for those values would also re-run every top-level `node:test` `test(...)` call it registers, as an import side effect -- silently duplicating that file's own test execution inside the run harness, exactly the hazard `acme-verify.ts`'s and `acme-gate.ts`'s own headers document as the reason those two modules stay plain `.ts` files rather than `.test.ts` ones.
- **Fix:** Extracted the subject's construction into a new shared, non-test module, `reassembly-gate-movement-subject.ts` (no `test(...)` registration of any kind), and changed `reassembly-gate-movement.test.ts` to import from it instead of declaring the subject locally. The plan's own action text explicitly authorized exactly this ("if reuse needs it, lift its construction into a small exported helper rather than copying the bytes").
- **Files modified:** `src/mcp/vice/reassembly-gate-movement-subject.ts` (new), `src/mcp/vice/reassembly-gate-movement.test.ts` (import swap only)
- **Verification:** `npm run typecheck` clean; `node --test reassembly-gate-movement.test.ts` 21/21 pass, unchanged from before the extraction.
- **Committed in:** `0ba1872e` (Task 1 commit)

**2. [Rule 1 - Bug] This plan's own Task 2 `<verify>` line-count assertion (exactly seven bare outcome-line matches across the five evidence files) contradicts `SCHEMA.md`'s own frozen, dual-occurrence design for `DIFF_SCOPE_COVERAGE`**
- **Found during:** Task 2, while writing the two `DIFF_SCOPE_COVERAGE`-carrying evidence files
- **Issue:** `SCHEMA.md` S2.4 and S3 require `DIFF_SCOPE_COVERAGE` to appear as its own bare line in TWO separate declared files (`evidence/49-tree-rebuild.md`'s baseline occurrence and `evidence/49-movement-rebuild.md`'s movement occurrence) -- "Both occurrences are read" is explicit. This plan's own Task 2 `<verify>` command instead asserts the total count of the seven declared line NAMES across all five evidence files equals exactly `7`, which is only satisfiable if `DIFF_SCOPE_COVERAGE` appears ONCE, not twice. Measured directly: writing both required occurrences (as `SCHEMA.md` mandates) makes the true total `8`.
- **Fix:** Wrote both `DIFF_SCOPE_COVERAGE` occurrences in full, per `SCHEMA.md`'s own requirement (omitting either would make that occurrence ABSENT from its declared source file, which `SCHEMA.md` S1/S4 states is never a pass). Recorded an `## ACCEPTED LIMIT` in both affected evidence files and a corresponding `## Override` section in the findings document, naming the plan's own verify command as the thing found not to match reality -- `SCHEMA.md` and `DECISION-RULE.md` themselves are unedited (confirmed: `git diff --quiet HEAD -- DECISION-RULE.md SCHEMA.md` in the evidence directory passes clean). Also recorded in the cross-phase defect register (`gsd-tools windows append --kind deviation`, entry id 63).
- **Files modified:** `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/49-tree-rebuild.md`, `.../49-movement-rebuild.md`, `docs/phase49-the-reassembly-gate-findings.md`
- **Verification:** All other Task 2 and Task 3 `<verify>` commands pass; the one line-count assertion (`test "$TOTAL" = "7"`) fails with the measured, schema-correct `TOTAL=8`, exactly as this deviation states.
- **Committed in:** `ab07ee47` (Task 2 commit), `e11b0da4` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking -- a test-duplication hazard the plan's own text anticipated and authorized a fix for; 1 bug -- a miscount in this plan's own verify command, found not to match its own frozen dependency, `SCHEMA.md`). **Impact:** Both were necessary for this plan's own stated constraints (D49-E, D49-F, and `SCHEMA.md`'s own frozen absence rule) to hold; neither is scope creep, and neither touched `SCHEMA.md` or `DECISION-RULE.md`.

## Known Stubs

None introduced by this plan.

## Issues Encountered

The one Task 2 `<verify>` line-count mismatch above is the only issue encountered; it is fully documented as Deviation 2 rather than silently worked around, and the plan's own `<verify>` command was run and its actual failure recorded rather than assumed.

## User Setup Required

None - no external service configuration required. ACME was already detected on `PATH` (`/home/henrik/.local/bin/acme`, release 0.97 "Zem") and no new external tool is introduced.

## Next Phase Readiness

- `BUILD-06` is now marked complete in `REQUIREMENTS.md` -- this is the seventh and final plan declaring it, and the shared-ID gate confirmed all six sibling plans already carry their own SUMMARY.md before this one ran.
- Phase 50 depends on this gate having run for real and being green or explicitly acknowledged (per `ROADMAP.md`'s own dependency line for Phase 50). **This gate returned `red`, not `green` or `acknowledged`** -- `docs/phase49-the-reassembly-gate-findings.md` states this plainly in its own `## Verdict` section, and Phase 50's own planning must read that document's frontmatter (`verdict: red`, `verdict_rule_applied: R7`) as its precondition before proceeding, per this plan's own "next phase may rely on" instruction.
- The verdict's own root cause (an incomplete VIC-II register recovery leaving one region of the committed subject permanently `"unclassified"`) is a property of the fixture and the current recovery, not of anything this plan's own movement or acknowledgement machinery got wrong -- both the movement rebuild and the byte-diffs themselves are clean.
- No blockers to phase completion from this plan's own perspective; the `red` verdict is itself the recorded finding this phase exists to produce, per its own explicit prohibition against re-measuring to obtain a better one.

---
*Phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates*
*Completed: 2026-09-13*

## Self-Check: PASSED
