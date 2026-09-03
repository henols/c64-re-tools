---
phase: 34-the-host-tool-execution-seam
plan: 06
subsystem: infra
tags: [testing, non-vacuity-floor, ghidra, jvm, decision-record]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host-tool.mts/host-tool-client.ts and plan 34-03's ghidra-project.mts -- the three real family members this plan's floor and positive control observe on disk"
provides:
  - "A second, independently pinned non-vacuity floor (HOST_TOOL_FAMILY_FLOOR = 2 + 1) over the host-tool/ghidra/dxa module family, inside the closed-consumer discipline without widening the five-member EXPECTED_IMPORTERS set"
  - "docs/phase34-host-tool-seam-decisions.md: SEAM-07's recorded JVM lifetime binding (per-invocation) with its measurement and a concrete, checkable reversal condition, plus all fourteen planner assumptions (A-01..A-14) this phase made in the absence of a discuss-phase"
affects: [34-05-PLAN]

actuals:
  tokens: 8340
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A second family gets a second, independently hand-pinned floor rather than a shared parameterised mechanism -- hostpath-consumers.test.ts's own header forbids deriving a floor from disk, so a generalized helper whose threshold came from anywhere but a hand-written literal per call would convert two proven guards into unfailable ones"
    - "topLevelProductionModules()'s dir parameter is injectable (default HERE) so the emptiness/ordering/disjointness edge cases drive the SAME production code path against synthetic mkdtempSync directories, mirroring module-classification.test.ts's inEnumerationOnDisk(dir) convention"
    - "A consolidated planner-decisions document (docs/phaseNN-*-decisions.md) is the recorded home for assumptions made when no /gsd-discuss-phase ran, following docs/phase33-reproducible-run-gate-findings.md's house shape: machine-greppable verdict lines beside measured inputs and a stated reversal condition"

key-files:
  created:
    - docs/phase34-host-tool-seam-decisions.md
  modified:
    - src/mcp/vice/hostpath-consumers.test.ts

key-decisions:
  - "HOST_TOOL_FAMILY_RE is a union of three anchored prefixes (host-tool|ghidra|dxa), one floor rather than three separate ones -- a floor per prefix would pin two of them at zero today, which is a floor that cannot fail (A-13)."
  - "HOST_TOOL_FAMILY_FLOOR = 2 + 1 is expressed as a relation (34-01's two modules plus 34-03's one), verified against disk at this commit, never derived from disk (A-14)."
  - "JVM_BINDING: per-invocation, matching what plans 34-01/34-03 actually built -- a fresh analyzeHeadless process per host_tool request -- rather than an unbuilt resident-socket design; the reversal condition is keyed on a corpus pass's measured JVM-startup share of wall-clock time (N=20 binaries, P=30 percent), both chosen and stated as mechanically checkable."
  - "topLevelProductionModules() gained an injectable dir parameter (default HERE) rather than adding a second readdirSync-based helper, keeping exactly one directory walk in the file."

requirements-completed: [SEAM-06, SEAM-07]

coverage:
  - id: D1
    description: "A second non-vacuity floor is pinned over the host-tool/ghidra/dxa family's own prefix, hand-written, observed naming three real on-disk modules, proven capable of failing (empty case), proven order-independent (ordering case), and proven disjoint from the anno- family (adjacency case) (SEAM-06)"
    requirement: "SEAM-06"
    verification:
      - kind: unit
        ref: "hostpath-consumers.test.ts (22/22 pass, including the 9 new SEAM-06 cases: floor, pinned-equals-measured, positive control, derived-absence, named-absence, planted violation, empty, ordering, adjacency)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The new family is inside the closed-consumer discipline: every derived and future family member is asserted absent from hostpathImporters(), and the five-member EXPECTED_IMPORTERS set (and its length===5 assertion) is byte-identical to before this plan (SEAM-06)"
    requirement: "SEAM-06"
    verification:
      - kind: unit
        ref: "hostpath-consumers.test.ts#every DERIVED host-tool-family module is absent..., #future host-tool-family members are absent..."
        status: pass
      - kind: other
        ref: "git diff -- src/mcp/vice/hostpath-consumers.test.ts shows EXPECTED_IMPORTERS declaration and its length assertion as unmodified context lines"
        status: pass
    human_judgment: false
  - id: D3
    description: "The JVM lifetime binding is a recorded decision (docs/phase34-host-tool-seam-decisions.md) carrying its measurement (12407ms, 11160ms, the cited 12.6-17.4s range) and a concrete checkable reversal condition with numbers in it, plus all fourteen planner assumptions consolidated (SEAM-07)"
    requirement: "SEAM-07"
    verification:
      - kind: other
        ref: "plan's own verify block: JVM_DECISION_RECORDED, JVM_MEASUREMENTS_PRESENT, ASSUMPTIONS_CONSOLIDATED all echoed"
        status: pass
      - kind: integration
        ref: "node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts docs-linerefs.test.ts (37/37 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No guard this plan touched moved as a side effect: npm run typecheck clean, node scripts/check-npm-packages.mjs OK, and npm run test:automated's failing count stays at the documented baseline of 2 (both pre-existing, in anno-register.test.ts)"
    verification:
      - kind: other
        ref: "npm run test:automated: 3204 tests, 3196 pass, 2 fail (unchanged from the baseline recorded in evidence/34-guard-dispositions.md), broker stopped throughout"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 06: The Second Prefix Floor and the JVM Lifetime Decision Record Summary

**A second, independently pinned floor (`HOST_TOOL_FAMILY_FLOOR = 2 + 1`) brings the host-tool/ghidra/dxa module family inside the closed-consumer discipline without widening the five-member `hostpath.ts` consumer set, and `docs/phase34-host-tool-seam-decisions.md` records SEAM-07's `per-invocation` JVM binding with its measurement and a checkable reversal condition, plus all fourteen planner assumptions this phase made.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-03T18:20:00+02:00 (approx.)
- **Completed:** 2026-09-03T18:55:00+02:00
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `hostpath-consumers.test.ts` gains `HOST_TOOL_FAMILY_RE` (a union of three anchored prefixes — `host-tool`, `ghidra`, `dxa` — one family, not three separate floors) and `hostToolFamilyProductionModules()`, reusing the same `topLevelProductionModules()` helper the five-member consumer scan and the `anno-` family both already use, now made `dir`-injectable (default `HERE`) so the new floor's emptiness, ordering and disjointness edge cases can drive the real production code path against synthetic `mkdtempSync` directories — exactly one `readdirSync(` call site survives on any code line.
- `HOST_TOOL_FAMILY_FLOOR = 2 + 1` is hand-pinned as a relation (the two modules plan 34-01 lands plus the one plan 34-03 lands), verified against disk (measured count: 3), never derived from disk, with a pinned-equals-measured companion test for diagnosis.
- Nine new test cases prove: the floor is non-vacuous and capable of failing (an empty synthetic directory reds the comparison), the positive control names the three real modules (`host-tool.mts`, `host-tool-client.ts`, `ghidra-project.mts`), four future family members (`ghidra-analyze.ts`, `ghidra-export.ts`, `dxa-listing.ts`, `dxa-run.ts`) are asserted absent from the consumer set before they exist, the family glob and the `anno-` glob are disjoint over a synthetic `anno-host-tool.ts`, the derivation is order-independent over a reversed synthetic listing, and a planted family-shaped violation is caught by the same `importsHostpath` predicate the real scan uses.
- `EXPECTED_IMPORTERS`'s five-member set and its `length === 5` assertion are byte-identical to their pre-plan value — confirmed via `git diff` showing both as unmodified context lines — with a new comment recording the mechanism by which the family stayed off the list (it reaches host-path logic through `containerpath.ts`, already declared, with every request-side path workspace-relative per plan 34-01's A-03).
- `docs/phase34-host-tool-seam-decisions.md` records `JVM_BINDING: per-invocation` (matching what plans 34-01/34-03 actually built — a fresh `analyzeHeadless` process per request, no resident JVM anywhere in this project's code), the measured `12.6-17.4s` range and this project's own `12407ms`/`11160ms` observations, `COMPARABLE_PROJECTS: 4` (MEDIUM confidence, survey-based), a concrete reversal condition keyed on a corpus pass's measured JVM-startup share of wall-clock time (`N=20` binaries, `P=30` percent), the two `34-RESEARCH.md` inputs left open (`-process` batch amortization, GitHub Actions install cost, with the `569,445,154`-byte archive size confirmed), why Ghidra departs from the seed's stateless-tool framing (persistent project directory, multi-minute runs, exports past the `64 KiB` control-channel cap), the parallelism guarantee under the chosen binding, and all fourteen planner assumptions `A-01` through `A-14` in one consolidated table with reasoning and a reversibility rating each.

## Task Commits

Each task was committed atomically:

1. **Task 1: The second prefix floor, its positive control, and its planted violation** - `b3d9d15` (test)
2. **Task 2: The JVM lifetime binding, recorded with its measurement and a checkable reversal condition** - `816ea0f` (docs)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/mcp/vice/hostpath-consumers.test.ts` - `HOST_TOOL_FAMILY_RE`, `hostToolFamilyProductionModules()`, `HOST_TOOL_FAMILY_FLOOR`, and nine new test cases (floor, pinned-equals-measured, positive control, derived-absence, named-absence, planted violation, empty, ordering, adjacency); `topLevelProductionModules()` gained an injectable `dir` parameter; a comment recording why the family stayed off `EXPECTED_IMPORTERS`
- `docs/phase34-host-tool-seam-decisions.md` - the recorded JVM lifetime binding (Part 1) and the consolidated `A-01`..`A-14` planner-decision table (Part 2)

## Decisions Made

See `key-decisions` in frontmatter: the union-of-three-prefixes floor shape (A-13), the floor's relation expression (A-14), the `per-invocation` JVM binding with its concrete reversal thresholds, and the `dir`-injectable `topLevelProductionModules()` refactor.

## Deviations from Plan

None — plan executed exactly as written. The measured on-disk family count (3) matched the pinned relation (`2 + 1`) exactly, so no re-derivation was needed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The new family is inside the closed-consumer discipline with a floor proven capable of failing, and `EXPECTED_IMPORTERS` is untouched — plan 34-05's whole-tree gate and closing sweep can run against a tree where SEAM-06's blind spot is closed.
- `docs/phase34-host-tool-seam-decisions.md` is the one consolidated, referenced home for every planner decision this phase made in the absence of a discuss-phase; a future phase revisiting the JVM binding reads its reversal condition directly rather than re-deriving one.
- `npm run test:automated`'s failing-test count (2, both pre-existing in `anno-register.test.ts`) is unchanged from the documented baseline — no new failure introduced.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/hostpath-consumers.test.ts
- FOUND: docs/phase34-host-tool-seam-decisions.md
- FOUND commit: b3d9d15
- FOUND commit: 816ea0f
- `node --test hostpath-consumers.test.ts`: 22/22 pass
- `node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts docs-linerefs.test.ts`: 37/37 pass
- `npm run typecheck`: clean
- `node scripts/check-npm-packages.mjs`: OK
- `npm run test:automated`: 3204 tests, 3196 pass, 2 fail (unchanged pre-existing baseline), broker stopped

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
