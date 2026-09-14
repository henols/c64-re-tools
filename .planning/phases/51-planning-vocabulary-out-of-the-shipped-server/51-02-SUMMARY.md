---
phase: 51-planning-vocabulary-out-of-the-shipped-server
plan: 02
subsystem: testing
tags: [planning-vocabulary, citation-resolution, requirements-traceability, evidence-document]

# Dependency graph
requires:
  - phase: none (wave 1, depends_on: [])
    provides: n/a
provides:
  - "CITATION-RESOLUTION.md -- the one evidence document every remaining Phase 51 sweep plan (51-03..51-17) reads to resolve a citation. No sweep plan needs to re-derive the lookup itself."
  - "VOCAB-01..06 -- six requirement ids with traceability rows in REQUIREMENTS.md. This plan mints this phase's own requirements."
affects: ["51-03", "51-04", "51-05", "51-06", "every later Phase 51 sweep plan reading CITATION-RESOLUTION.md's Section A originating-phase map"]

# Actuals (#2632)
actuals:
  tokens: 18436
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import the guard's own predicate. Never hand-roll it. Every figure in CITATION-RESOLUTION.md comes from a throwaway, uncommitted scratch script. That script imports scanForPlanningVocabulary()/shippedScanSurface() directly and drives them over the live tree. The document's own numbers can never drift from what the guard itself would report."
    - "Re-derive a prior document's own figures before trusting them. CONTEXT.md's dangling-citation count (33 tokens, ~135 occurrences) was measured again rather than carried forward. The re-measurement found CONTEXT.md wrong for its own two largest entries."

key-files:
  created:
    - .planning/phases/51-planning-vocabulary-out-of-the-shipped-server/evidence/CITATION-RESOLUTION.md
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Section C classifies 150 requirement-id-shaped tokens into two groups. 107 are genuinely global: each has a checkbox declaration or a traceability row in REQUIREMENTS.md or an archived milestone document. The other 43 share the id shape but are phase-scoped code-review finding ids instead (CR-NN/WR-NN/IN-NN, plus two singletons, DIRECT-06/AUDIT-01). These 43 need the same tier-3 git-blame walk as D-NN. A central lookup cannot resolve them."
  - "PD-03 is the one requirement-id-shaped token that resolves to nothing anywhere in .planning/, in any form. It moves out of the 'no genuine declaration' bucket and into Section E's dangling set. It is not left as an ordinary tier-3 CR/WR-style token."
  - "The entire re-derived dangling set (30 tokens, 76 occurrences) is one family. It is an '01.x' sub-phase-numbering scheme (01.1/01.2/01.3/01.6.1/01.6.2/01.6.2.1/01.6.3). Four quick-task ids belong to that same family. This repository's own git history never contains any of them. Every citing file traces to this repo's first substantive commit (2026-08-09). The four dangling quick-task ids carry dates that predate that commit. This corroborates, by independent measurement, the guard's own header claim. The initial commit absorbed source from another, donor GSD-managed project. That donor project had its own Phase 01 decomposition. It also had its own quick-task history. Neither ever belonged to this project."
  - "VOCAB-01..06 traceability rows are minted at status Pending. This follows the task's own literal instruction. Plan 51-01 already satisfied five of the six (VOCAB-01/02/03/05/06), but this plan does not pre-mark them Complete. Promotion is left to the standard requirements.mark-complete / ready-ids gate, run at the end of this plan's own execution. That gate correctly accounts for the shared-id rule against sibling plan 51-01's declaration."
  - "The plan's own literal verify command for Task 2 cannot pass as written. It requires `grep -ac 'VOCAB-' .planning/ROADMAP.md` to equal 0. ROADMAP.md's Phase 51 entry already names VOCAB-01..06 at roadmap-creation time, before this plan ever ran. No executor could satisfy this verify command without deleting the planner's own pre-existing roadmap prose. This plan verifies the verify command's actual intent directly instead, via an empty `git diff --stat` on both ROADMAP.md and STATE.md. See Deviations."

requirements-completed: [VOCAB-01, VOCAB-02, VOCAB-03, VOCAB-04, VOCAB-05, VOCAB-06]

coverage:
  - id: D1
    description: "CITATION-RESOLUTION.md exists with five sections (A-E). Section A has at least 90 per-file rows. Both Plan 41-05 and plan 40-03 are recorded as RESOLVING, with their real plan/summary documents named."
    requirement: "VOCAB-04"
    verification:
      - kind: unit
        ref: "51-02-PLAN.md's <verify> block, all 5 automated assertions, re-run live: file exists, 5 sections, >=90 rows, both tokens present, both target docs exist"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six requirement ids (VOCAB-01..06) exist in REQUIREMENTS.md with six traceability rows mapping them to Phase 51. The Coverage block's total and mapped counts both move from 32 to 38 together."
    verification:
      - kind: unit
        ref: "51-02-PLAN.md's <verify> block, Task 2's 4 automated assertions, re-run live. V1/V2 pass. V3 is a pre-existing-content false-negative, documented in Deviations. V4 -- the actual intent, an empty diff on STATE.md/ROADMAP.md -- passes"
        status: pass
    human_judgment: false
  - id: D3
    description: "The recovery ladder's tier 2/tier 3 correction (D-NN moves from tier 2 to tier 3) is published visibly. It is backed by a fresh count: 37 distinct D-NN tokens, 1167 occurrences. It is not merely restated from RESEARCH.md."
    verification:
      - kind: other
        ref: "CITATION-RESOLUTION.md Section B, cross-verified against the live scan's own decisionSummary tally"
        status: pass
    human_judgment: true
    rationale: "Whether the tier correction reads clearly to a future sweep-plan executor (the document's actual audience) is a judgment call about prose clarity. No command asserts pass/fail on that."

duration: 24min
completed: 2026-09-14
status: complete
---

# Phase 51 Plan 02: Citation-resolution index and VOCAB-01..06 minting Summary

**One evidence document, built entirely from the guard's own live-tree scan and never a hand-rolled grep, resolves 102 dirty files' worth of citations. Fourteen sweep plans consume it. Plus six newly-minted Phase 51 requirement ids with traceability.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-09-14T13:05:00Z (approx.)
- **Completed:** 2026-09-14T13:29:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Built `CITATION-RESOLUTION.md` by importing `scanForPlanningVocabulary()` and `shippedScanSurface()` directly from the guard. Drove them over the live tree from an uncommitted scratch script. Never a hand-rolled grep. The result matches the guard's own frozen count exactly: 102 dirty files, 3876 hits.
- **Section A**: one row per dirty file (102 rows). Each row names its top originating commit scopes (from `git log --follow --format=%s`) and the resolved `.planning/phases/` or `.planning/quick/` directory to read first.
- **Section B**: the corrected five-tier recovery ladder. The D-07 premise correction is stated visibly: `D-NN` decision ids move from tier 2 to tier 3. Measured reason: `D-13` alone is independently defined in 188 files, across six unrelated phase and quick-task contexts. This is backed by a fresh count of 37 distinct `D-NN` tokens (1167 occurrences) in the current shipped surface.
- **Section C**: of 150 requirement-id-shaped tokens, 107 (626 occurrences) resolve to a genuine, single declaration. The other 43 (652 occurrences) share the shape but are phase-scoped review-finding ids instead (`CR-NN`/`WR-NN`/`IN-NN`, plus `DIRECT-06`/`AUDIT-01`). These 43 need the tier-3 walk. `PD-03` is the one exception: it is genuinely dangling. The one gap id (`G-40-1`) and both `UTF-16` technical-token-collision sites are recorded too.
- **Section D**: every distinct `Plan NN-MM`/`Phase NN` token is resolved. This required correcting for zero-padding on single-digit phase numbers -- `Phase 2` resolves to `02-stock-backend-connection`, not a literal `2-*` match. `Plan 41-05` (66 occurrences) and `plan 40-03` (20 occurrences) were CONTEXT.md's two largest claimed-dangling entries. Both RESOLVE cleanly to real plan and summary documents.
- **Section E**: the dangling set, re-derived from scratch. The measured result is 30 distinct tokens, 76 occurrences -- not CONTEXT.md's inherited 33 tokens and ~135 occurrences. All 30 trace to one root cause: every dangling token belongs to a pre-existing "`01.x`" sub-phase-numbering scheme. This repository's own git history never contains that scheme. Every citing file traces to the repo's first substantive commit (2026-08-09). The dangling `quick-` tokens carry dates that predate that commit. This independently corroborates the guard's own header claim about donor-project source.
- Minted `VOCAB-01` through `VOCAB-06` in `.planning/REQUIREMENTS.md`. Each is a self-contained sentence, in the existing section's own style. Six Pending traceability rows were added. The coverage block moved from 32/32 to 38/38. The pre-existing "Phase 51's declaration is deferred" parenthetical is rewritten, not deleted, to record that this same edit discharged the deferral.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the citation-resolution index the sweep plans consume** - `74c43351` (feat)
2. **Task 2: Mint VOCAB-01..06 with traceability** - `f7e6555c` (feat)

_No plan-metadata commit yet. This SUMMARY, STATE.md, and ROADMAP.md are committed together right after this file is written (sequential/non-worktree mode)._

## Files Created/Modified

- `.planning/phases/51-planning-vocabulary-out-of-the-shipped-server/evidence/CITATION-RESOLUTION.md` - the five-section citation-resolution index (750 lines)
- `.planning/REQUIREMENTS.md` - new Phase 51 requirements section (VOCAB-01..06), six traceability rows, coverage block 32→38, deferral-note rewrite, footer note appended

## Decisions Made

See `key-decisions` in the frontmatter above for the full list. The most consequential one: Section C splits 150 requirement-id-shaped tokens into 107 genuinely-global tokens and 43 phase-scoped-but-same-shape tokens. `PD-03` is singled out as neither: it is genuinely dangling. This distinction keeps Section E precise. It lists 30 tokens, not 43 plus 30.

## Deviations from Plan

### Auto-fixed Issues

None. No bug, no missing-critical-functionality, and no blocking issue was found in the existing codebase during this plan. Both auto-fix rule categories (1-3) were unused.

### Disclosed, Not Auto-fixed: Task 2's ROADMAP.md verify command is unsatisfiable as written

**Found during:** Task 2, running the task's own `<verify>` block.

**Issue:** The task's third automated verify command is `test "$(grep -ac 'VOCAB-' .planning/ROADMAP.md)" = "0"`. Its `<fails_when>` clause names the failure condition: a nonzero printed count means this plan edited the roadmap, which a worktree executor must not do. The raw count is **7**, both before and after this plan's own edits. This was verified by running the grep before touching any file. `.planning/ROADMAP.md`'s Phase 51 entry already names `VOCAB-01` through `VOCAB-06`. It does so in its own **Requirements** line, and in its surrounding prose about the `VOCAB-06`/`DOCS-04` overlap. The phase's own planner wrote that content at roadmap-creation time, before Plan 51-02 ever executed. No executor could satisfy this literal verify command without deleting the planner's own pre-existing roadmap prose. Task 2's own action text separately and explicitly forbids exactly that: "Do not touch `.planning/ROADMAP.md` or `.planning/STATE.md` from this plan."

**Resolution:** `.planning/ROADMAP.md` and `.planning/STATE.md` were left completely untouched. This was verified directly: `git diff --stat -- .planning/STATE.md .planning/ROADMAP.md` is empty, both before and after this plan's two commits. This satisfies the verify command's actual intent -- this plan must not edit either file. The verify command's literal grep-count form still cannot pass on this project's ROADMAP.md content. This is documented rather than silently worked around. It was not "fixed" by editing the roadmap, since that would have violated the plan's own explicit constraint.

**Files modified:** none (this is a disclosure, not a fix).

**Verification:** `git diff --stat -- .planning/STATE.md .planning/ROADMAP.md` prints nothing after both commits.

---

**Total deviations:** 0 auto-fixed. 1 disclosed (a plan-verify-command limitation, not a defect in this plan's own work). **Impact:** None on the plan's actual deliverables. The real constraint -- leave ROADMAP.md/STATE.md untouched -- is independently verified satisfied.

## Issues Encountered

None beyond the disclosed verify-command limitation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CITATION-RESOLUTION.md` is ready for Plan 51-03 onward. Each sweep plan opens it, finds its assigned file(s) in Section A, and classifies each citation site by Section B's tier. It then resolves the site via Section C (global ids) or Section D (plan/phase citations). If the token appears in Section E's table instead, it treats the site as tier 4.
- `VOCAB-01..06` exist with traceability rows at Pending. The standard `requirements.mark-complete`/`ready-ids` gate runs at the end of this plan's own execution, per the shared-id rule against sibling plan `51-01`. That gate determines which ids become Complete now that both declaring plans have summaries.
- No blockers for Plan 51-03 (host tools: `host-tool.mts` to zero).

## Self-Check: PASSED

Both key files exist on disk:
- `FOUND: .planning/phases/51-planning-vocabulary-out-of-the-shipped-server/evidence/CITATION-RESOLUTION.md`
- `FOUND: .planning/REQUIREMENTS.md`

Both task commit hashes resolve in `git log --oneline --all`:
- `FOUND: 74c43351`
- `FOUND: f7e6555c`

Every plan-level `<verification>` item was re-run live:
- The evidence document exists with all five sections (`## Section A` through `## Section E`) and 102 per-file rows in Section A (90 or more required).
- `Plan 41-05` (66 occurrences) and `plan 40-03` (20 occurrences) are both recorded as RESOLVING. Their target plan/summary documents (`41-05-PLAN.md`/`41-05-SUMMARY.md`, `40-03-PLAN.md`/`40-03-SUMMARY.md`) exist on disk.
- Six requirement ids (`VOCAB-01`..`VOCAB-06`) exist with six traceability rows. The coverage block moved 32/32 to 38/38 together.
- `.planning/ROADMAP.md` and `.planning/STATE.md` are untouched by this plan. Both show an empty `git diff --stat`, verified above and in Deviations.

---
*Phase: 51-planning-vocabulary-out-of-the-shipped-server*
*Completed: 2026-09-14*
