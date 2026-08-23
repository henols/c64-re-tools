---
status: testing
phase: 17-project-identity-and-ledger-close
source: [17-VERIFICATION.md]
started: 2026-08-23T10:00:00Z
updated: 2026-08-23T10:00:00Z
---

## Current Test

number: 1
name: Confirm whether CORE-01's must_have truth 3 is satisfied by what actually happened at the blocking-human gate
expected: |
  A human either (a) confirms that an attended, informed delegation of the
  choice ("you decide") to the orchestrating session — after being shown the
  full evidence at the `gate="blocking-human"` checkpoint — satisfies the
  intent of this must-have and the sibling prohibition ("MUST NOT let an
  executor choose ... unilaterally"), or (b) determines that the literal
  wording ("the option a human selected") was not met and requires either a
  corrected must-have/prohibition wording for future phases, or treats this as
  an accepted, disclosed deviation via an override.
awaiting: user response

## Tests

### 1. Confirm whether CORE-01's must_have truth 3 is satisfied by what actually happened at the blocking-human gate

expected: A human confirms that attended, informed delegation ("you decide") after being shown the full evidence at the `gate="blocking-human"` checkpoint satisfies the intent of must_have truth 3 and its sibling prohibition — or determines the literal wording ("the option a human selected") was not met, and either corrects the wording for future phases or accepts it as a disclosed deviation.
result: [pending]

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
result: [pending]

**Context.** This is task 2's harvested `<human-check>` from `17-02-PLAN.md`,
deferred to end-of-phase per `workflow.human_verify_mode: end-of-phase`. It is
the one check that reaches the "weighed, not bookkeeping" half of CORE-01's
criterion. The verifier's own direct reading found all four sub-criteria
satisfied, but the plan's own workflow contract requires a human to confirm it
rather than accepting the verifier's reading alone.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
