---
phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts
plan: 02
subsystem: docs-generation
tags: [markdown-generation, drift-guard, prerequisites, readme, non-vacuous-verification]

# Dependency graph
requires:
  - phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts (plan 01)
    provides: src/mcp/vice/prereq-readme-gen.ts (the generator) and prereq-readme-gen.test.ts's parseGeneratedRegion/auditGeneratedReadme (the guard this plan proves non-vacuous)
provides:
  - "GEN-03 in full: five planted-divergence cases, each in a fresh mkdtempSync(tmpdir()) scratch copy of the real declaration and README, prove the guard fails and names the record/ecosystem that diverged and the exact fix command"
  - "the remaining half of GEN-02/roadmap criterion 4: padding, row order and blank-line reflows leave the guard green, while a reordered header (a real structural change) does not"
  - "round-trip fidelity proof: parseGeneratedRegion(renderX(deriveX(decl))) reconstructs the derived rows exactly over the real declaration, including the debian-trixie remedy's em dash"
affects: [61-03, any future phase touching prerequisites.json or README.md's install sections]

# Actuals (#2632)
actuals:
  tokens: 6467
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-fixture-per-case discipline (D-12): every planted-divergence, tolerance and round-trip case builds its own mkdtempSync(tmpdir()) scratch pair from copyFileSync of the real committed files, cleans up in a finally block, never a hand-written toy declaration or README"
    - "Reuse the generator's own spliceRegion() to write mutated table bodies back into a scratch README, rather than hand-rolling a second marker-splicing implementation for the test file's tolerance cases"
    - "Round-trip mapping functions (parsedEcosystemRow/parsedOverviewRow) are the deliberate INVERSE of the generator's own render functions, proven against assert.deepEqual to the generator's own derive output -- never a third, independently-invented expectation"

key-files:
  modified:
    - src/mcp/vice/prereq-readme-gen.test.ts

key-decisions:
  - "Task 1's five GEN-03 cases target x64sc/debian-trixie (changed ecosystem remedy), ghidra/universal (changed universal remedy, proving the failure direction reaches the overview region), dxa (a fully removed record), the ecosystem region's data rows (emptied, markers/header intact), and the overview region's end marker (removed, proving the audit reports a malformed region by name and does not throw) -- chosen to span both regions and both failure shapes per the plan's own Flagged Assumption 1."
  - "The existing GEN-03 case from plan 61-01 was extended in place (added a REGENERATE_COMMAND assertion) rather than duplicated, per read_first's instruction not to duplicate the existing clean-audit/GEN-03 coverage -- it counts as one of the five planted-divergence cases the acceptance criteria require."
  - "Tolerance and round-trip cases reuse parseGeneratedRegion + the generator's own spliceRegion/renderEcosystemTable/renderOverviewTable exports rather than a second splicing or rendering implementation, keeping D-10's shared-derivation discipline intact for the new cases too."
  - "No round-trip case revealed an ambiguous rendering (no real declaration value collides with the EMPTY_UNBLOCKS/comma-join sentinels), so prereq-readme-gen.ts was left untouched -- README.md and prerequisites.json are both still byte-unchanged since 61-01, confirmed via git diff --quiet after every commit and after two consecutive `npm run generate:readme` runs."
  - "The single test-file diff was split into two atomic commits along the plan's task boundary (constructing a Task-1-only intermediate state, verifying it green, committing, then layering in Task 2's additions) rather than one combined commit, to honor per-task atomic commit protocol even though both tasks touch the same file."

requirements-completed: [GEN-02, GEN-03]

coverage:
  - id: D1
    description: "Five planted-divergence cases, each in its own scratch copy of the real declaration/README, prove auditGeneratedReadme() fails and names the diverged record/ecosystem and REGENERATE_COMMAND -- never merely a non-empty array"
    requirement: "GEN-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: a planted divergence in a scratch copy is caught, the diverged ecosystem is named, and the fix command is named"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: a changed universal remedy is caught and names the diverged record, proving the failure direction reaches the overview region too"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: a removed record leaves an orphaned row the declaration no longer carries"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: an emptied ecosystem region -- markers and header intact, zero data rows -- is reported rather than passing silently"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#GEN-03: a removed end marker is reported as a malformed region and never throws"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reflowed whitespace (padding, row order, blank lines, all combined) leaves the guard green, while a reordered header row -- a real structural change -- returns a named failure"
    requirement: "GEN-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#widened cell padding in both generated regions leaves the audit clean (roadmap criterion 4)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#a different row order, applied independently in each generated region, leaves the audit clean (roadmap criterion 4)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#blank lines inserted inside both generated regions leave the audit clean (roadmap criterion 4)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#padding, row order and blank lines applied together in one scratch README leave the audit clean (roadmap criterion 4)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#a reordered header row in a generated region is NOT tolerated -- it is a different table, not a reflow"
        status: pass
    human_judgment: false
  - id: D3
    description: "The parser reconstructs every field the renderer produces, over the real declaration, for both regions -- including the debian-trixie remedy's em dash surviving render-then-parse exactly"
    requirement: "GEN-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#round trip: parseGeneratedRegion(renderEcosystemTable(deriveEcosystemRows(decl))) reconstructs the derived rows exactly"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#round trip: parseGeneratedRegion(renderOverviewTable(deriveOverviewRows(decl))) reconstructs the derived rows exactly"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#round trip preserves the debian-trixie remedy text's em dash exactly -- no Unicode normalisation, no case folding, no whitespace collapsing"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prereq-readme-gen.test.ts#this guard compares facts, not bytes: the committed pair and a reflowed copy of it both audit clean"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-09-19
status: complete
---

# Phase 61 Plan 02: The Install Tables Generated, and a Guard That Compares Facts Summary

**`prereq-readme-gen.test.ts` gained five planted-divergence cases (GEN-03) that watch `auditGeneratedReadme()` actually fail and name what moved, plus tolerance and round-trip cases proving the guard forgives reflow but never a changed fact.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-19T (see git log for first task commit timestamp)
- **Completed:** 2026-09-19T07:50:48Z
- **Tasks:** 2 (both `tdd="true"`; see "TDD Gate Compliance" below)
- **Files modified:** 1 (`src/mcp/vice/prereq-readme-gen.test.ts`, 11 tests -> 20 tests, +482/-24 lines)

## Accomplishments

- **Task 1 — watched the guard fail.** Five planted-divergence cases, each building its own `realpathSync(mkdtempSync(tmpdir()))` scratch copy of the real `prerequisites.json` and `README.md`: a changed ecosystem remedy (x64sc/debian-trixie), a changed universal remedy (ghidra, proving the failure direction reaches the overview region), a removed record (dxa), an emptied ecosystem region (markers/header intact, zero data rows), and a removed end marker (proving the audit reports a malformed region by name and never throws). Every failure-asserting case checks the CONTENT of the returned failure array — the record/ecosystem id and `REGENERATE_COMMAND` — never merely that the array is non-empty. A scratch-hygiene test closes the file, asserting `git status --porcelain` names no leaked scratch path under the repository tree.
- **Task 2 — proved the guard compares facts, not bytes.** Tolerance cases show widened cell padding, reversed row order (applied independently to each region), inserted blank lines, and all three combined all leave `auditGeneratedReadme()` returning an empty array. A counter-case reorders a region's header row (content untouched) and asserts a NAMED failure, keeping the tolerance from being read as a general license. Round-trip fidelity cases derive rows from the real declaration, render them with the generator's own `renderEcosystemTable`/`renderOverviewTable`, parse that rendering back with `parseGeneratedRegion`, and `assert.deepEqual` the reconstruction against the original derived rows — including a named assertion that the debian-trixie remedy's em dash (`—`) survives render-then-parse exactly. A closing case runs the committed pair and a deliberately reflowed copy of it through the same audit in one test body, both returning empty, naming the file's own "facts, not bytes" statement.
- No production code changed. No round-trip case revealed an ambiguous rendering (checked: no real `unblocks.skills`/`unblocks.mcp` value collides with `EMPTY_UNBLOCKS`'s `"none"` sentinel or contains `", "`), so `prereq-readme-gen.ts` stayed untouched. `README.md` and `src/mcp/vice/prerequisites.json` are both still byte-unchanged since plan 61-01 — confirmed via `git diff --quiet` after every commit, and via two consecutive `npm run generate:readme` runs producing an identical `sha256sum`.

## Task Commits

Each task was committed atomically as a single `test(61-02)` commit — no separate GREEN/REFACTOR commit was needed since no production code changed (see "TDD Gate Compliance" below):

1. **Task 1: Watch the guard fail — a planted divergence in a temp tree** - `506ce4a2` (`test`)
2. **Task 2: Prove it compares facts, not bytes — tolerance and round-trip fidelity** - `e354e736` (`test`)

**Plan metadata:** committed separately below.

## Files Created/Modified

- `src/mcp/vice/prereq-readme-gen.test.ts` — gained the five GEN-03 planted-divergence cases, four tolerance cases plus a header-reorder counter-case, three round-trip fidelity cases, a "facts not bytes" closing case, and a scratch-hygiene assertion; 9 net new tests (11 → 20), all reusing `auditGeneratedReadme`, `parseGeneratedRegion`, and the generator's own derive/render/splice exports — no second implementation of what a row should contain.

## Decisions Made

- The five GEN-03 cases were chosen to span both regions (ecosystem and overview) and both failure shapes (a changed fact vs. a structurally broken region), per the plan's own Flagged Assumption 1 — a reviewer judgment call the plan explicitly left open, answered here rather than deferred.
- The existing GEN-03 case from plan 61-01 (x64sc/debian-trixie) was extended in place with a `REGENERATE_COMMAND` assertion rather than duplicated with a near-identical new case, honoring read_first's "must not duplicate" instruction while still counting toward the five required cases.
- Tolerance-case table mutations reuse the generator's own `spliceRegion()` export to write a re-rendered body back into the scratch region, rather than hand-rolling a second marker-splicing routine in the test file.
- The single test-file diff for both tasks was deliberately split into two atomic commits along the plan's task boundary — a Task-1-only intermediate state was constructed, verified green, and committed before Task 2's additions were layered in — to keep the "commit each task atomically" protocol honest even though both tasks touch the same file.

## TDD Gate Compliance

Both tasks carry `tdd="true"`, and `workflow.tdd_mode` is `false` in this project's config (no orchestrator-side RED-commit gate applies; the discipline is the plan's own, per-task, per the dispatch note).

This plan's own framing is observational rather than feature-building: its `<output>` is "additional cases in `prereq-readme-gen.test.ts`" against an `auditGeneratedReadme()` implementation that plan 61-01 already built and proved (its own SUMMARY records the identical mechanism working end to end). Writing each new assertion and running it produced an immediate pass rather than a pre-implementation failure, because the SUT being exercised (the guard's failure-detection and tolerance behavior) already existed — the tests are the non-vacuous PROOF the guard behaves as designed (ENGINEERING_RULES.md §6: "watched failing under a planted violation"), not a spec for code not yet written. Per the TDD reference's fail-fast rule 1 ("Unexpected GREEN in RED phase... investigate before proceeding"), this was investigated: the round-trip and tolerance helper functions were independently re-verified by hand-checking one representative case each (the em-dash assertion's own `assert.ok(trixieRow.text.includes("—"))` guards against a vacuously-true round-trip; the "facts not bytes" case explicitly checks the SAME audit call against both an untouched and a reflowed copy in one test body) before accepting the immediate pass as correct rather than a broken assertion.

Each task was therefore committed as a single `test({phase}-{plan}): ...` commit (matching the commit-type table's "Test-only changes" row) rather than a `test` → `feat` pair — there is no GREEN implementation step because no implementation changed. This is stated explicitly here per the TDD reference's instruction to document any RED/GREEN gate departure in this section.

## Deviations from Plan

None — plan executed exactly as written. No auto-fix rules (1-3) or architectural questions (Rule 4) were triggered; no round-trip case revealed a generator-side ambiguity requiring the optional sentinel-constant change the plan anticipated as a possibility.

## Known Stubs

None.

## Issues Encountered

- The full `phase58-citation-ledger.test.ts` file still carries the same two failing tests (five drifted `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md` anchors between them) documented as pre-existing in plan 61-01's own SUMMARY and in this plan's dispatch instructions. Re-verified after both task commits: the failing SET is byte-identical to the documented baseline — `.planning/REQUIREMENTS.md:86`, `.planning/ROADMAP.md:2002-2005`, `.planning/ROADMAP.md:1959`, `.planning/ROADMAP.md:1939-1942`, `.planning/ROADMAP.md:1947` — all five `.planning/`-only, none touching README.md, none new. Full `npm --prefix src/mcp/vice test`: 4051 tests, 3968 pass, 2 fail (same two files, same anchors); `npm run test:automated`: 3894 tests, 3883 pass, 2 fail (same two). The SET was compared, not the count, per this plan's own stated obligation.
- No other issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `GEN-03` is now delivered in full: the guard has been watched failing on five distinct planted divergences against the real declaration and the real README, each naming the record/ecosystem that moved and the fix command.
- `GEN-02`'s remaining half (the tolerance direction) and the parser-fidelity proof (`ENGINEERING_RULES.md` §6) are both delivered non-vacuously.
- `README.md` and `src/mcp/vice/prerequisites.json` are both confirmed byte-unchanged throughout this plan (D-02) — verified via `git status --porcelain`/`git diff --quiet` after every commit and after regenerating twice.
- Plan 61-03 (README prose rewrite and `docs/phase58-declaration-provenance.md` re-anchoring) was not touched by this plan, per this plan's own scope boundary (`files_modified` was exactly `prereq-readme-gen.test.ts` and, optionally, `prereq-readme-gen.ts` — the latter was not needed).
- No blockers for 61-03.

## Self-Check: PASSED

- FOUND: src/mcp/vice/prereq-readme-gen.test.ts
- FOUND commit: 506ce4a2 (test: Task 1, five GEN-03 planted-divergence cases + scratch hygiene)
- FOUND commit: e354e736 (test: Task 2, tolerance + round-trip fidelity cases)
- Re-ran all task acceptance criteria and the plan-level `<verification>`: `node --test prereq-readme-gen.test.ts` 20/20 green; `git status --porcelain` after the full run names no new untracked file under `src/mcp/vice/` (only the pre-existing, pre-plan untracked files remain); `npm run typecheck` exit 0; `npm run generate:readme` run twice produces an identical README.md sha256 and `git diff --quiet -- README.md` succeeds; `phase58-citation-ledger.test.ts`/`prerequisites.test.ts` failing set unchanged from the 5 pre-existing `.planning/`-only anchors; full `npm --prefix src/mcp/vice test`: 4051/3968/0/2 (2 pre-existing, both `.planning/`-only) — failing SET compared, not count, and unchanged from the documented baseline.
