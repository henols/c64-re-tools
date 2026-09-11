---
phase: quick-260911-syq
plan: 01
subsystem: docs
tags: [research-question, fork-removal, roadmap, vice-mcp]

requires:
  - phase: none
    provides: n/a — standalone research answer, no code dependency
provides:
  - "The v1.0.0 rebuild half's need for stock's three hard losses (SID read-back, matrix
    keyboard, RESTORE/NMI) is answered No, re-derived against the tree, and marked Settled."
  - "Phase 52's `Depends on` line, which names this question by path, is discharged."
  - "A per-file worklist of 8 surviving `requires the fork` / `fork-only` routes in skill text
    for Phase 52 criterion 3 to rewrite."
affects: [52-remove-the-fork-backend]

actuals:
  tokens: 1799
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/research/questions.md

key-decisions:
  - "Corrected S-1: Phase 45's subject is the pre-existing committed fixtures (tracer.prg,
    bank.prg, smc.prg, bank-path-dependent.prg, charset-phantom), not Phase 48's new
    purpose-built synthetic subject — so the synthetic fixture is not \"the only subject\"."
  - "Corrected S-2: Phase 50 criterion 1 names the $D020/$D015/$D018 regression as the planted
    test case the narrowed volatile mask must catch, not a stated ceiling on what the mask
    narrows to."
  - "Corrected S-3: scanned the full Phase 45-51 range (not the narrower 47-50 range handed
    over) — verdict unchanged, still zero hits."
  - "Framing correction carried into the answer: the fork never worked, so removal does not
    lose a capability — it stops the documentation promising one."

requirements-completed: [QUICK-260911-syq]

coverage:
  - id: D1
    description: "Research question answered No with per-capability, re-derived evidence and
      three suspect claims corrected in writing"
    verification:
      - kind: other
        ref: "manual command re-derivation this session (awk/grep over ROADMAP.md,
          REQUIREMENTS.md, compare.mjs, PROJECT.md, src/skills/); see Task Commits below"
        status: pass
    human_judgment: false
  - id: D2
    description: "Question marked Settled with framing correction and Phase 52 hand-off
      worklist, scope guard held to questions.md only"
    verification:
      - kind: other
        ref: "git status --porcelain --untracked-files=no lists only questions.md"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-11
status: complete
---

# Quick Task 260911-syq: Answer the v1.0.0 Three-Hard-Losses Research Question Summary

**Re-derived and answered "No" — the v1.0.0 rebuild half needs none of stock's three hard
losses (SID read-back, matrix keyboard, RESTORE/NMI); question marked Settled and handed off
to Phase 52 with a corrected evidence base and an 8-route skill-text worklist.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-11
- **Completed:** 2026-09-11
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Verdict re-derived, not transcribed: a word-bounded scan of the whole v1.0.0 phase block
  (Phase 45 through Phase 51) for `keyboard|matrix|nmi|restore|joystick|sid` returns zero hits;
  the same scan over the 15 v1.0.0 requirement IDs (DECOMP-01..04, BUILD-01..07, EQUIV-01..04)
  also returns zero.
- All three SUSPECT claims (S-1, S-2, S-3) corrected in the answer text rather than copied from
  the orchestrator's handed-over evidence (see Correction Record below).
- Matrix keyboard, SID read-back and RESTORE/NMI each answered as their own paragraph, each
  citing the exact command run against the tree.
- The `FUT-05` caveat (applying the pipeline to `bruce_lee`) and the framing correction (the
  fork never worked, so nothing is actually lost) are both recorded, agreeing with
  `ROADMAP.md` Phase 50's own Notes and `.planning/notes/fork-removal-reversal-basis.md`.
- Question marked `**Settled:** 2026-09-11` beside its untouched `**Raised:**`/`**Blocks:**`
  lines, discharging Phase 52's stated dependency.
- Phase 52 hand-off worklist recorded: 8 surviving `requires the fork` / `fork-only` mentions
  across 7 skill files, for criterion 3 to rewrite rather than re-derive.

## Correction Record (the three SUSPECT claims)

| # | Handed-over claim | What it was corrected to |
|---|--------------------|---------------------------|
| S-1 | "the only subject in v1.0.0 is Phase 48's purpose-built SYNTHETIC fixture" | Phase 45's own Notes state its subject is "the existing committed fixtures" (`tracer.prg`, `bank.prg`, `smc.prg`, plus `bank-path-dependent.prg` and `charset-phantom` named in its criteria 4-5) — a pre-existing, non-synthetic set. Phase 48's fixture is the *new* one, not "the only" one; the answer now names both. |
| S-2 | "Phase 50 criterion 1 narrows that mask **only** to catch `$D020`/`$D015`/`$D018`" | Criterion 1's text names those three registers as the **planted regression the narrowed mask must be observed catching** — it is the proof case for the gate, not a stated ceiling on what the narrowing covers. "Only" was an over-read; the answer states this distinction explicitly. |
| S-3 | "RESTORE/NMI -- no mention in Phases 47-50" | The v1.0.0 rebuild half is Phases 45-51, not 47-50. Re-ran the scan over the correct, wider range; the verdict is unchanged (still zero hits), but the answer now states it was checked over the right range rather than a narrower one. |

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive the evidence base, hardest capability first, land the matrix-keyboard
   answer** - `702da54a` (docs) — corrected S-1, added the verdict line and the matrix-keyboard
   + `FUT-05` paragraphs.
2. **Task 2: Add the SID read-back and RESTORE/NMI answers and the requirements cross-check** -
   `6a21f3e5` (docs) — corrected S-2 and S-3, added the requirements cross-check paragraph.
3. **Task 3: Mark the question settled, record the framing correction and the Phase 52
   hand-off** - `3c21ce6b` (docs) — added the `**Settled:**` line, the framing correction, and
   the 8-route hand-off worklist.

No separate plan-metadata commit was made — per this quick task's constraints, SUMMARY.md and
STATE.md are committed by the orchestrator, not by this executor.

## Files Created/Modified
- `.planning/research/questions.md` - appended a dated `### Answer, 2026-09-11: No` subsection
  to the file's last section, and a `**Settled:**` line beside the existing
  `**Raised:**`/`**Blocks:**` lines. No other file touched.

## Decisions Made
- Cited ROADMAP content by phase and criterion number throughout, never by line number, per
  the plan's citation-discipline requirement — confirmed no `.planning/ROADMAP.md:<digits>`
  style citation exists in the final text.
- Included the `vice_ping` non-pausing-poll mention from `vice-wedge-triage/SKILL.md:225` in
  the Phase 52 hand-off worklist even though it names a technique rather than a standalone
  tool, since the plan's grep (`requires the fork|fork-only`) matched it and Phase 52
  criterion 3 needs the full inventory, not a filtered one.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<verify>` gates passed, including
the `git status --porcelain` scope assertions confirming no file outside
`.planning/research/questions.md` was modified.

## Issues Encountered

The `Edit` tool's exact-string match failed once on a multi-paragraph `old_string`/`new_string`
pair in Task 3 despite the substring being verifiably present (confirmed via a Python
byte-for-byte containment check) — worked around by performing that one insertion with a
Python script instead. No content difference from what was planned; the file's final byte
content includes every planned paragraph.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 52 (Remove the Fork Backend) is unblocked: its `**Depends on**` line naming this
  question is discharged.
- Phase 52 has a ready-made worklist of 8 surviving `requires the fork` / `fork-only` mentions
  across 7 skill files to rewrite for its own criterion 3.
- The formal dated ACCEPTANCE record is deliberately NOT written here — it remains Phase 52's
  own success criterion 3, to avoid splitting the record across two places.

## Self-Check: PASSED

- FOUND: commit `702da54a`
- FOUND: commit `6a21f3e5`
- FOUND: commit `3c21ce6b`
- FOUND: `.planning/research/questions.md`
- FOUND: `260911-syq-SUMMARY.md`

---
*Phase: quick-260911-syq*
*Completed: 2026-09-11*
