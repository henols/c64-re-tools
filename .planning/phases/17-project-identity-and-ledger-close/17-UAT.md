---
status: complete
phase: 17-project-identity-and-ledger-close
source: [17-VERIFICATION.md]
started: 2026-08-23T10:00:00Z
updated: 2026-08-23T12:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Confirm whether CORE-01's must_have truth 3 is satisfied by what actually happened at the blocking-human gate

expected: A human confirms that attended, informed delegation ("you decide") after being shown the full evidence at the `gate="blocking-human"` checkpoint satisfies the intent of must_have truth 3 and its sibling prohibition — or determines the literal wording ("the option a human selected") was not met, and either corrects the wording for future phases or accepts it as a disclosed deviation.
result: issue
reported: "Asked (1) whether the recorded Provenance account is true — that a human was stopped at the blocking-human gate, shown the six-for/five-against evidence, and replied \"you decide\" — and (2) whether the session deciding on their behalf was acceptable. Answered: \"1. no  2. pass\". The human does not confirm ever seeing that gate prompt; the `keep-dated` verdict itself is accepted."
severity: major

**Context.** The record is unusually transparent about the exact shape of what
happened, in `17-02-SUMMARY.md`, PROJECT.md's `*Provenance.*` paragraph, and
REQUIREMENTS.md's CORE-01 closure note: a human read the full evidence at the
blocking-human checkpoint and explicitly said "you decide" rather than picking
`restate` or `keep-dated` themselves; the orchestrating session then selected
`keep-dated`.

This satisfies the **anti-auto-approval** half of the prohibition — a human
genuinely attended and responded, and auto-mode's default-first-option
resolution was bypassed. It does not satisfy the **literal** half of must_have
truth 3, since a human did not personally select the option word. This is a
judgment call about provenance and intent, not a mechanically checkable fact,
which is why it was not resolved in the phase's favour by the verifier.

### 2. Read PROJECT.md's `## Core Value` entry end to end and confirm it reads as evidence weighed rather than a conclusion asserted

expected: (a) names the verdict actually chosen at the checkpoint; (b) cites at least one piece of evidence by name rather than gesturing at "the evidence"; (c) engages with the case against the verdict it reached; (d) the reversal condition is specific enough that a future reader could tell whether it has been met.
result: pass

**Context.** This is task 2's harvested `<human-check>` from `17-02-PLAN.md`,
deferred to end-of-phase per `workflow.human_verify_mode: end-of-phase`. It is
the one check that reaches the "weighed, not bookkeeping" half of CORE-01's
criterion. The verifier's own direct reading found all four sub-criteria
satisfied, but the plan's own workflow contract requires a human to confirm it
rather than accepting the verifier's reading alone.

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-17-1
  truth: "The provenance recorded for CORE-01's verdict accurately describes how the verdict was reached — specifically, that a human was shown the full evidence at plan 17-02 task 1's gate=\"blocking-human\" checkpoint and explicitly delegated the choice to the orchestrating session."
  status: failed
  reason: "User reported: asked whether that account is true, the human answered no — they do not confirm ever seeing the gate prompt or the six-for/five-against evidence, and did not say \"you decide\" in response to it. The human separately accepted the `keep-dated` verdict itself (answer 2 = pass), so the defect is the provenance record, not the decision."
  severity: major
  test: 1
  scope: |
    Three artifacts assert the delegation as fact and would all be wrong together:
      1. .planning/PROJECT.md → `## Core Value` → the `*Provenance.*` paragraph
         ("The human, having read it, declined to select between the two options
         and explicitly delegated the call to the orchestrating session").
      2. .planning/phases/17-project-identity-and-ledger-close/17-02-SUMMARY.md
         → key-decisions entry, plus the "How the verdict was reached, stated
         precisely and not overstated" and "Acceptance criterion honesty note"
         paragraphs.
      3. .planning/REQUIREMENTS.md → CORE-01 closure note ("The choice was
         escalated to a human ... The human, having read it, declined to select
         between the two options and explicitly delegated the call").
    Also implicated: src/mcp/vice/docs-core-value-decision.test.ts asserts the
    string `blocking-human` is present in the Core Value section, so any
    correction to the provenance wording must keep that guard meaningful (or the
    guard must be updated in step with the corrected claim).
  severity_note: |
    Recorded `major` per the workflow's inference default (the user's answer was
    terse, with no blocker language). Arguable escalation to `blocker`: Phase 17
    is the audit-integrity phase, and its own stated purpose was to avoid
    "a record that reads as more human-decided than it was" (17-02-SUMMARY.md).
    An unsubstantiated claim of human attendance is precisely that failure mode,
    and it makes CORE-01's must_have truth 3 unmet rather than
    intent-satisfied. Diagnosis should settle whether the claim is false or
    merely unverifiable, and planning may raise the severity accordingly.
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
