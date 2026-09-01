---
status: testing
phase: 32-the-deletion-and-the-grep-gate
source: [32-VERIFICATION.md]
started: 2026-09-01T13:30:00Z
updated: 2026-09-01T13:30:00Z
---

## Current Test

number: 1
name: Disposition the nine round-4 code-review findings, in particular CR-07 (Critical) and WR-38
expected: |
  A recorded human decision. Neither ROADMAP success criterion is falsified by any of the
  nine — the verifier measured that rather than assuming it — so this is a judgement about
  acceptable residual risk at phase close, not a repair the phase owes.

  The two facts that make it a human call rather than a verifier call:

  - `CR-07` is a **Critical that has now been open across three review rounds and was absent
    from the round-3 report for one full round without ever being fixed**, so the record
    itself failed in the way this phase's own criterion 1 exists against.
  - `WR-38` is a self-applied criterion-1 defect inside the phase's own instrument.

  Choose one of:
    (a) close the phase and carry the nine into the milestone backlog
    (b) run one more gap-closure round scoped to `CR-07` + `WR-38` + `WR-37`
    (c) accept them with a recorded override
awaiting: user response

## Tests

### 1. Disposition the nine round-4 code-review findings (CR-07 Critical, WR-38)

expected: A recorded human decision — (a) close and carry to milestone backlog, (b) one more gap-closure round scoped to CR-07 + WR-38 + WR-37, or (c) accept with a recorded override. Neither ROADMAP success criterion is falsified by any of the nine; this is a residual-risk judgement at phase close.

why_human: Both load-bearing findings are latent, not observed. `CR-07` is a scheduling hazard against the **gitignored** `installer/skills/` tree, so no porcelain assertion in the suite can see it and no run proves it either way — the suite was green for the verifier and green twice for the reviewer. `WR-38` is a judgement about whether a mislabelled assertion inside a case group that *does* bite is acceptable. Neither is decidable by measurement; both are decidable by an owner.

read_first:
  - `.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md` (severity: blocker — the disposition record, with CR-07's cross-round trail)
  - `.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md` (at `de598f2` — full evidence for all nine)
  - `.planning/phases/32-the-deletion-and-the-grep-gate/32-VERIFICATION.md` (§ human_verification, and the WR-38 experiment the verifier ran)

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
