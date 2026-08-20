---
phase: 09-the-assumption-probe-go-no-go
plan: 07
subsystem: infra
tags: [regenerator2000, go-no-go, verdict, probe-findings, decision-rule]

requires:
  - phase: 09-the-assumption-probe-go-no-go
    provides: "All six evidence transcripts (waves 1-3) and five SUMMARY files (09-01 through 09-06) answering the five R2000-16 sub-assumptions against a real regenerator2000 0.9.20 build"
provides:
  - "docs/phase9-regenerator2000-probe-findings.md: the durable, normative findings document consolidating all five criteria, with a machine-readable verdict in its frontmatter"
  - "The go/no-go verdict: degrade, rule R4 fired (c3_4_vsf_load = partial), mechanically derived from the plan's own binding decision rule"
  - "Two scope amendments for Phase 10/11: machine-type auto-detection from a stock-VICE .vsf must not be trusted (Phase 10 criterion 3 / the ROADMAP's .vsf-over-.raw constraint); use_illegal_opcodes must be set explicitly in generated project files (R2000-09 / Phase 10 criterion 4)"
  - "09-RESEARCH.md corrected in one pass: rustc floor >=1.90 (superseding >=1.88), Assumptions A1-A4 closed, Open Questions 1-3 closed, Pitfall 3 strengthened, Pitfall 4 corrected with measured numbers and the Debian-release glibc finding"
  - "09-VALIDATION.md signed off: nyquist_compliant: true, every criterion has a recorded real outcome (four pass, one partial), Per-Task Verification Map filled"
affects: [09-08]

tech-stack:
  added: []
  patterns: ["binding decision rule written before the run, evaluated first-match-wins against seven named outcome-line inputs, reproduced verbatim in the normative document so the verdict is mechanically re-derivable"]

key-files:
  created:
    - docs/phase9-regenerator2000-probe-findings.md
  modified:
    - .planning/phases/09-the-assumption-probe-go-no-go/09-RESEARCH.md
    - .planning/phases/09-the-assumption-probe-go-no-go/09-VALIDATION.md

key-decisions:
  - "Verdict is degrade via rule R4, not R3 or R5: criteria 2a/2b (pty tolerance, keystroke bootstrap) both passed cleanly, so the ROADMAP's 'documented one-time interactive step' half of the degrade route does not apply; what applies is the 'Phase 10/11 scope amended' half, via the two live scope amendments (criterion 3(2)'s use_illegal_opcodes default, criterion 3(4)'s machine-type coincidental default)"
  - "Criterion 1(5) (container toolchain cost) was fully measured (SINGLE_STAGE_BYTES/MULTI_STAGE_BYTES both numeric) and, per the plan's decision rule, never changes the verdict regardless of outcome -- recorded as measured, not scored as an accepted limit"
  - "Did not touch .planning/STATE.md or .planning/ROADMAP.md, per this plan's own explicit instruction -- plan 09-08 owns those two files and runs outside worktree isolation for exactly that reason"
  - "Carried forward four out-of-scope findings with no other home (r2000_get_address_details u16-overflow defect, the broker's cross-connection session-continuity gap, the harness's own cargo-install classifier denial, and the two self-caught first-attempt discards) under a new '## Other findings' section, rather than dropping them or forcing them into the Accepted limits section where they do not belong (none of the four is a criterion failure)"

requirements-completed: [R2000-16]

duration: ~45min
completed: 2026-08-20
---

# Phase 9 Plan 07: The Go/No-Go Verdict and Research Corrections Summary

**Verdict: `degrade`, rule `R4` fired — criteria 1, 2a, 2b, 3(2) and 3(3) all passed;
criterion 3(4) (`.vsf` machine-type derivation) scored `partial`, triggering the
decision rule's first non-`reconsider` non-`proceed` match.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Consolidated all six evidence transcripts from waves 1-3 into one durable,
  normative document (`docs/phase9-regenerator2000-probe-findings.md`), matching the
  shape this repo already uses for probe evidence (`docs/phase1-probe-results.md`,
  `docs/phase2-backend-probe-evidence.md`), with a deliberate frontmatter departure to
  carry the machine-readable verdict.
- Applied the plan's binding decision rule mechanically against the seven named
  outcome-line inputs, first-match-wins: `R1`/`R2`/`R3` do not fire (`c1_build`,
  `c2a_pty_tolerance`, `c2b_bootstrap_automatable` are all `pass`); `R4` fires because
  `c3_4_vsf_load = partial`. Verdict: `degrade`.
- Named two live scope amendments against specific Phase 10/11 targets (not merged,
  not generic): machine-type auto-detection from a `.vsf` must not be trusted (Phase 10
  criterion 3 / the ROADMAP's standing `.vsf`-over-`.raw` constraint), and
  `use_illegal_opcodes` must be set explicitly in generated project files (`R2000-09` /
  Phase 10 criterion 4's deletion decision, which is still earned since criterion 3(2)
  itself passed against real illegal opcodes).
- Applied every `## RESEARCH CORRECTIONS` block from the six evidence files to
  `09-RESEARCH.md` in one pass — the single collection point three parallel wave-3 plans
  were deliberately forbidden from touching individually.
- Signed off `09-VALIDATION.md` honestly: `nyquist_compliant: true` because every
  criterion has a real recorded outcome (the standard is honesty, not universal success
  — a `partial` with its own accepted limit counts).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the durable findings document covering all five criteria** -
   `ed2bef0` (docs)
2. **Task 2: Apply the decision rule and set the machine-readable verdict** -
   `a4b86c0` (docs)
3. **Task 3: Apply every research correction and sign off the validation contract** -
   `455461c` (docs)

## Files Created/Modified

- `docs/phase9-regenerator2000-probe-findings.md` - the durable, normative go/no-go
  document: `## Verdict` (first body section, decision rule reproduced verbatim), run
  date/host/build, summary table, one section per criterion (1, 1(5), 2a, 2b, 3(2),
  3(3), 3(4)), `## Accepted limits`, `## Other findings`, `## Corrections to prior
  documents`, `## Reproducing this`.
- `.planning/phases/09-the-assumption-probe-go-no-go/09-RESEARCH.md` - inline
  `[CORRECTED]`/`[CLOSED]` markers on Assumptions A1-A4, Open Questions 1-3, Pitfalls 3
  and 4, the Architecture Patterns bootstrap diagram, the `.vsf` machine-type claim in
  the Summary, and the Metadata confidence breakdown — every marker citing the evidence
  file that settled it, original text preserved alongside the correction.
- `.planning/phases/09-the-assumption-probe-go-no-go/09-VALIDATION.md` - frontmatter
  set to `status: complete`, `wave_0_complete: true`, `nyquist_compliant: true`;
  Per-Task Verification Map's Status column filled with real outcomes per row; Wave 0
  Requirements and Validation Sign-Off checklists checked honestly against what actually
  ran.

## Decisions Made

- **Verdict is `degrade` via `R4`, not `R3`.** Criteria 2a/2b both passed cleanly, so the
  ROADMAP's "documented one-time interactive step" framing for `degrade` does not apply
  here — what fired is the "Phase 10/11 scope amended" framing, via the two live
  amendments named above.
- **Criterion 1(5) never gates the verdict, by the rule's own explicit text**, regardless
  of its outcome — it was fully measured here (`SINGLE_STAGE_BYTES: 1256576420`,
  `MULTI_STAGE_BYTES: 250820636`), so no accepted limit applies to it at all.
- **`.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately left untouched**,
  per this plan's own explicit instruction — plan 09-08 owns verdict discoverability in
  those two files and needs to run outside worktree isolation to do it.
- **Four out-of-scope findings were carried forward under a new `## Other findings`
  section** rather than dropped or force-fit into Accepted limits (none is a criterion
  failure): the `r2000_get_address_details` u16-overflow defect, the broker's
  cross-connection session-continuity gap, this agent harness's own `cargo install`
  classifier denial, and the two self-caught first-attempt discards (09-05's
  fork-vs-stock PATH shadowing, 09-06's cross-connection snapshot) — recorded as evidence
  the live-validation discipline is working, not merely asserted.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' automated verification commands
were run and passed before each commit; the plan-level `<verification>` block's seven
checks (verdict/rule present, all five criteria sectioned, Accepted limits present,
research corrections applied, validation signed off, STATE/ROADMAP untouched, no change
under `.claude/mcp/vice/`) all pass.

## Known Stubs

None. This plan produces documentation only; no code, UI, or data-flow stubs were
introduced.

## Threat Flags

None. This plan's own threat model disposed all five identified threats as `mitigate`
(T-09-07-A through -C) or `accept`/`N/A` (T-09-07-D, -E), and no new security-relevant
surface was introduced beyond what those already cover — no network endpoints, auth
paths, or schema changes were added; the document is read-only evidence consolidation.

## Next Steps

- Plan 09-08 makes the `degrade` verdict discoverable from `.planning/STATE.md` and
  `.planning/ROADMAP.md` (a decision entry and ROADMAP pointers), completing criterion 5.
- Phase 10 planning must read `docs/phase9-regenerator2000-probe-findings.md`'s
  frontmatter `verdict` key before any plan is written, per `R2000-16`'s own wording,
  and must apply the two named scope amendments (machine-type trust, explicit
  `use_illegal_opcodes` setting) at their named targets.

## Self-Check: PASSED

- FOUND: `docs/phase9-regenerator2000-probe-findings.md`
- FOUND: `.planning/phases/09-the-assumption-probe-go-no-go/09-07-SUMMARY.md`
- FOUND commit `ed2bef0` (Task 1: findings document)
- FOUND commit `a4b86c0` (Task 2: verdict set)
- FOUND commit `455461c` (Task 3: research corrections + validation sign-off)
