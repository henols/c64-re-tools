---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 03
subsystem: docs
tags: [documentation-drift, requirements, backlog, test-gate]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "D-03's .vsf-drop decision and the Phase 9 machine-type/export_lbl findings this plan corrects the wording of"
  - phase: 11-01/11-02
    provides: "WR-02/WR-04/WR-03/WR-05/WR-06/WR-07 fixes and the dynamic-import closure-walk fix this plan attributes when closing the two folded todos"
provides:
  - "A corrected .vsf pointer (D-34): no document points a future session at Phase 11 for .vsf; a real backlog item carries the three reasons and the reversal trigger"
  - "A verified, explicitly scoped --export_lbl compatibility claim in stock-symbols.ts (D-35)"
  - "R2000-13's wording naming the real enum install path, r2000_create_project_enum, instead of --dump-enum-files (D-22)"
  - "README's one-project limit narrowed to regenerator2000's --mcp-server HTTP route (D-15/D-19)"
  - "CLAUDE.md's rewriteArguments() line citations re-verified and pinned by docs-linerefs.test.ts"
  - "Both folded Phase 10 review todos closed with attribution to the plans that fixed each item"
affects: [phase-11-remaining-plans, phase-12-if-any, future-vsf-bootstrap-work]

# Tech tracking
tech-stack:
  added: []
  patterns: ["source-text-plus-line-number drift guard (docs-linerefs.test.ts), following hostpath-consumers.test.ts's structural-assertion-over-source-text precedent"]

key-files:
  created:
    - .planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md
    - .claude/mcp/vice/docs-linerefs.test.ts
  modified:
    - .planning/ROADMAP.md
    - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md
    - .claude/mcp/vice/stock-symbols.ts
    - .planning/REQUIREMENTS.md
    - README.md
    - CLAUDE.md
    - .planning/todos/completed/2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md
    - .planning/todos/completed/2026-08-20-r2000-review-residual-findings.md

key-decisions:
  - "D-34: .vsf is out of Phase 11; no R2000-* requirement covers it as a bootstrap input; filed as backlog with the three real reasons and the reversal trigger (a consumer with only .vsf captures)"
  - "D-35: stock-symbols.ts's --export_lbl compatibility note upgraded from unverified assumption to a verified claim, scoped to regenerator2000 0.9.20 and the probe-illegal.prg-derived fixture, not all inputs forever"
  - "D-22: R2000-13's wording corrected to name r2000_create_project_enum as the install path; --dump-enum-files reframed as a TOML-shape discovery tool, not an install path"
  - "D-15/D-19: README's one-project-per-namespace limit narrowed to regenerator2000's --mcp-server HTTP route -- this project's --mcp-server-stdio route binds no port, so the limit was sidestepped for this project, not fixed upstream"
  - "CLAUDE.md's rewriteArguments() citations re-measured by grep at execution time (2943/2878, 1422/1398) rather than trusted from the plan text, per the bullet's own re-verify instruction"
  - "docs-linerefs.test.ts kept out of package.json's files[] -- it verifies planning-facing documentation, not code shipped in the npm tarball"

patterns-established:
  - "Line-citation drift guards read the real cited file at test time and assert structural properties (function/call presence) at the cited line, rather than duplicating the number in the test"

requirements-completed: []  # R2000-13/R2000-14 touched (wording/evidence only) but NOT completed -- see Requirements Traceability Note; both are multi-plan requirements with other Phase 11 plans still pending

# Metrics
duration: 28min
completed: 2026-08-20
---

# Phase 11 Plan 03: Scope Corrections (D-34/D-35/D-22/D-15/D-19) and the CLAUDE.md Drift Guard Summary

**Corrected a dangling `.vsf` forward reference into a real backlog item, upgraded an unverified `--export_lbl` claim to a scoped-verified one, fixed `R2000-13`'s wrong install-path credit, narrowed README's one-project limit to the actual HTTP-only route, and pinned CLAUDE.md's `rewriteArguments()` line citations with a non-vacuous drift-guard test.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-20T20:29:30Z (per STATE.md `last_updated` at execution start)
- **Completed:** 2026-08-20T20:57:00Z
- **Tasks:** 3/3
- **Files modified:** 10 (2 created, 8 modified; 2 of the modified are todo-file moves)

## Accomplishments

- D-34: all three sites naming Phase 11 as `.vsf`'s home (`ROADMAP.md`'s standing constraint, Phase 10 criterion 3's parenthetical, the `R2000-08` cut-table row, and `10-CONTEXT.md`'s Deferred Ideas entry) now point at a real backlog item instead of a dangling forward reference.
- D-35: `stock-symbols.ts`'s header no longer says "STATED ASSUMPTION, NOT A VERIFIED FACT" — it states the measured fact (`al C:0810 .init_screen` matches `VICE_LABEL_LINE_RE` exactly) scoped to regenerator2000 0.9.20 and the probe fixture, with the skip-unrecognised-lines behaviour retained and its reason restated for a verified-but-scoped format.
- D-22: `R2000-13` no longer credits `--dump-enum-files` as an install path; it names `r2000_create_project_enum` and explains what `--dump-enum-files` actually does (writes the three built-in enums and exits).
- D-15/D-19: README's one-project-per-namespace limit is now explicitly scoped to regenerator2000's `--mcp-server` HTTP route, with this project's `--mcp-server-stdio` route stated as binding no port.
- CLAUDE.md's `rewriteArguments()` citations re-verified against the live source (`vice-proxy.ts:2943`/`:2878`, `:1422`/`:1398`, both drifted from the previously cited `2889`/`1368`) and pinned by a new test, `docs-linerefs.test.ts`, proven non-vacuous by a planted violation.
- Both folded Phase 10 review todos closed under `.planning/todos/completed/` with resolution sections naming the plan(s) that fixed each item.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-34 — remove the `.vsf` dangling forward reference at all three sites and file it as backlog** - `4c5ffef` (docs)
2. **Task 2: D-35, D-22 and the D-15 narrowing — three prose claims made true** - `31bcec4` (docs)
3. **Task 3: CLAUDE.md's drifted line citations, a drift guard for them, and the two folded todos closed** - `268c11e` (docs)

_No plan-metadata commit yet — this SUMMARY.md and STATE.md/ROADMAP.md updates are committed separately per this plan's `worktree: false` protocol._

## Files Created/Modified

- `.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md` - New backlog item: `.vsf` as a regenerator2000 bootstrap input, with the three real reasons and the reversal trigger
- `.planning/ROADMAP.md` - Three `.vsf` sites corrected (standing constraint line ~187, Phase 10 criterion 3 parenthetical, `R2000-08` cut-table row)
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md` - Deferred Ideas `.vsf` entry appended with D-34's resolution and the new todo path
- `.claude/mcp/vice/stock-symbols.ts` - Header's `--export_lbl` note upgraded from unverified assumption to scoped-verified claim
- `.planning/REQUIREMENTS.md` - `R2000-13`'s wording corrected to name `r2000_create_project_enum`; `--dump-enum-files` reframed correctly
- `README.md` - One-project-limit paragraph narrowed to the `--mcp-server` HTTP route, `--mcp-server-stdio` stated as binding no port
- `CLAUDE.md` - `rewriteArguments()` bullet's line citations corrected (`:2943`/`:2878`, `:1422`/`:1398`) plus a new clause on the `r2000_*` family's by-construction exemption
- `.claude/mcp/vice/docs-linerefs.test.ts` - New drift guard: extracts `vice-proxy.ts:<N>` citations from CLAUDE.md's `rewriteArguments()` bullet and asserts each cited line matches its claim; includes a non-vacuity assertion and a planted-violation regression test
- `.planning/todos/completed/2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md` - Moved from `pending/`, resolution section added naming `11-02`
- `.planning/todos/completed/2026-08-20-r2000-review-residual-findings.md` - Moved from `pending/`, resolution section added naming `11-01`/`11-02` per finding

## Decisions Made

- Kept the ROADMAP.md `.vsf`-preference constraint as an emulator-output rule and explicitly stated it does not extend to regenerator2000's input set, rather than deleting or hedging it — the constraint is still true for anything actually leaving the emulator.
- Worded CLAUDE.md's new `r2000_*`/`buildViceTool()` clause as an architectural fact established by planning for plan `11-05` (confirmed present in `11-CONTEXT.md`, `11-PATTERNS.md`, `11-RESEARCH.md`, and `11-05-PLAN.md`), even though the actual `r2000_*` MCP tool registration does not exist in `vice-proxy.ts` yet as of this plan — the family is currently reached only via the `vice-mcp r2000 <verb>` CLI subcommand at `vice-proxy.ts:217-218`, which also never touches `forwardToVice()`.
- Named the new backlog todo `2026-08-20-vsf-as-a-bootstrap-input.md` (matching the plan's specified filename) rather than deriving a new slug.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their `<action>` text; no auto-fixes, no architectural questions, no checkpoints hit.

## Issues Encountered

One planned self-correction during Task 1: the acceptance criterion `grep -rn "vsf" .planning/ROADMAP.md | grep -c "Phase 11"` returns 0` initially failed after the first edit, because the corrected wording used the literal phrase "Phase 11 confirmed this (D-34)" on a `.vsf`-mentioning line — a legitimate reference to this phase, but one that mechanically tripped the "no `.vsf` line names Phase 11" gate. Reworded to "confirmed by D-34" (same meaning, no literal "Phase 11" token) and re-verified the grep returns 0.

## Planted-Violation Transcript (Task 3 non-vacuity check)

Before landing the final CLAUDE.md wording, the `:2943` citation was temporarily replaced with the non-numeric phrase "somewhere inside forwardToVice()" and `docs-linerefs.test.ts` was re-run:

```
# Subtest: every vice-proxy.ts:<N> citation in CLAUDE.md's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function
not ok 2 - every vice-proxy.ts:<N> citation ...
  error: 'no citations extracted -- see the non-vacuity test above'
# tests 3
# pass 1
# fail 2
```

The test correctly failed (2/3 tests fail) when a citation was removed. The wording was then restored to the correct `:2943`/`:2878` numbers and the suite re-ran green (3/3).

## User Setup Required

None - no external service configuration required.

## Requirements Traceability Note

This plan's frontmatter lists `requirements: [R2000-13, R2000-14]`, but both are
multi-plan requirements also claimed by other Phase 11 plans not yet executed
(`R2000-13`: 11-01 already done, plus 11-06/11-12 pending; `R2000-14`: 11-04/11-08/11-11
pending). This plan only corrected `R2000-13`'s wording (D-22) and extended the
verified evidence `R2000-14` depends on (D-35's `--export_lbl` claim) — it did not
implement enum generation or the symbol round trip. **`requirements.mark-complete`
was deliberately NOT run for either ID**: both checkboxes remain `[ ]` in
`REQUIREMENTS.md`, correctly reflecting that the features they describe are not yet
built. They should be marked complete only once the plan(s) that actually deliver
the enum-generation and symbol-round-trip behavior land.

## Next Phase Readiness

- Plans 11-04 through 11-12 (the annotation store, enum generation, and symbol round trip proper) are unblocked by this plan and can proceed independently — this plan touched only documentation/requirements/CLAUDE.md/a symbol-store header comment and a new test file, none of which any later Phase 11 plan's `<files>` list claims.
- The `r2000_*`/`buildViceTool()` clause added to CLAUDE.md anticipates plan `11-05`'s actual registration work; when `11-05` lands, its own verification should confirm the clause remains accurate (it already plans to, per its own `T-11-PATH-XLATE` threat-register entry).
- No blockers or concerns carried forward from this plan.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md`
- FOUND: `.claude/mcp/vice/docs-linerefs.test.ts`
- FOUND: `.planning/todos/completed/2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md`
- FOUND: `.planning/todos/completed/2026-08-20-r2000-review-residual-findings.md`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-03-SUMMARY.md`
- FOUND commit: `4c5ffef` (Task 1)
- FOUND commit: `31bcec4` (Task 2)
- FOUND commit: `268c11e` (Task 3)

No missing items.
