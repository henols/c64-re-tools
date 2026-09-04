---
status: testing
phase: 36-the-sleigh-language-and-the-ghidra-harness
source: [36-VERIFICATION.md]
started: 2026-09-05T00:00:00Z
updated: 2026-09-05T00:00:00Z
---

## Current Test

number: 1
name: GHID-03 — is the `.prg`-route forced-conflict control's absence acceptable, or must the fixture be widened?
expected: |
  Decide whether GHID-03's AMENDED requirement text ("observed red on both import routes,
  not one") is satisfied by exercising the swallowed-`MemoryConflictException` control on
  the `flat64k` route only, given `bank.prg` cannot reach the I/O page at the `.prg`
  route's default load address.

  Either (a) accept this as an intentional, disclosed, unavoidable-with-this-fixture
  narrowing (an override), or (b) require a larger / differently-based `.prg` fixture so
  the same forced-conflict control can also be observed red on the `.prg` route.

  Verifier's judgement: unmet against REQUIREMENTS.md's literal AMENDED text (only
  `flat64k` was ever exercised); arguably met against the ROADMAP's narrower "both routes"
  scoping, whose qualifier is textually attached to the *disappearance* proof rather than
  restated for the loader-owned-block/conflict clause. Disclosed honestly in
  36-05-SUMMARY.md. This is an owner scope decision, not a fix.
awaiting: user response

## Tests

### 1. GHID-03 — `.prg`-route forced-conflict control absent (flat64k only)
expected: Accept the disclosed fixture-limited narrowing as an override, or require a wider `.prg` fixture so the swallowed-`MemoryConflictException` control is observed red on both routes.
result: [pending]

### 2. ROADMAP criterion 5 — "at least one resolved computed jump" met by a disclosed, cross-verified absence?
expected: |
  Decide whether criterion 5's literal wording ("at least one resolved computed jump" as
  one of five structural facts exported "from a real binary") is satisfied when the only
  real corpus available demonstrably contains no such construct at the entry points
  reached — every computed transfer is the "BRK trick" through the unresolvable hardware
  IRQ vector, correctly captured in `## UNRESOLVED_DISPATCH` instead, independently
  confirmed against a second unrelated crack of the same game.

  Either (a) accept the disclosed absence as the milestone's established pattern for
  computed-dispatch measurements (Phase 23 criterion 2 and Phase 38 criterion 2 both treat
  "a corpus containing no computed dispatch" as a reportable fact rather than a failure —
  though neither Phase 36's ROADMAP text nor GHID-04/GHID-05's REQUIREMENTS.md text carries
  that explicit escape clause), or (b) require a corpus search deep enough to reach the
  game's own currently-packed code before this criterion can close.

  Verifier's judgement: unmet against the literal wording — no such fact was exported
  because no such fact exists on the corpus reached. The harness's *capability* to export
  one is not in question; the `COMPUTED_JUMP` reference kind exists and is correctly
  reportable. `ARRAY_BOUND` and `RECORD_STRIDE` are similarly absent on this corpus and
  belong to the same decision.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
