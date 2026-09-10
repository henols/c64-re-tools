---
status: testing
phase: 44-proof-04-the-independent-external-check
source: [44-VERIFICATION.md]
started: 2026-09-10T16:12:52Z
updated: 2026-09-10T16:12:52Z
---

## Current Test

number: 1
name: The closing record's framing — three prose judgments a command cannot settle
expected: |
  Read `evidence/proof04-false-positives.md` end to end and confirm all three:
    1. The new false-positive count is stated BESIDE PROOF-01's figures
       (`100.00 (24/24)`, `72.39 (97/134)`, `72.46 (100/138)`) — not presented
       as replacing or correcting them.
    2. No sentence anywhere reads as a clean bill of health for never-observed
       addresses. The never-observed population must appear only as the count
       `PROOF04_BLOCK_COVERED_NEVER_OBSERVED`, never converted into a class.
    3. The narrowed run's limits are stated as their own section, not softened
       into a parenthetical.
  The gsd-verifier's own independent reading found all three to hold. This item
  exists because it is a tone/framing judgment, deferred to human sign-off by
  plan 44-03's own <human-check> block under workflow.human_verify_mode=end-of-phase
  — not because the verifier found a defect.
awaiting: user response

## Tests

### 1. The closing record's framing — three prose judgments a command cannot settle

expected: The count reads as stated beside PROOF-01's figures rather than replacing them; no sentence reads as a clean bill of health for never-observed addresses; the narrowed run's limits occupy their own section rather than a parenthetical.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
