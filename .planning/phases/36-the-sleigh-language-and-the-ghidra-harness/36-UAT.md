---
status: passed
phase: 36-the-sleigh-language-and-the-ghidra-harness
source: [36-VERIFICATION.md]
started: 2026-09-05T00:00:00Z
updated: 2026-09-05T00:00:00Z
resolved_by: override
resolved_by_name: "Henrik Olsson"
---

## Current Test

number: —
name: —
expected: |
  All items resolved. Both were owner scope decisions rather than testable behaviours, and
  both were accepted as overrides on 2026-09-05. The accepted wording is recorded verbatim
  in `36-VERIFICATION.md`'s `overrides:` frontmatter block.
awaiting: nothing

## Tests

### 1. GHID-03 — `.prg`-route forced-conflict control absent (flat64k only)
expected: Accept the disclosed fixture-limited narrowing as an override, or require a wider `.prg` fixture so the swallowed-`MemoryConflictException` control is observed red on both routes.
result: passed — accepted as override by Henrik Olsson, 2026-09-05. `bank.prg` cannot reach the I/O page at the `.prg` route's default load address, so `flat64k` is the only route on which a loader-owned-block conflict is naturally reachable with this fixture. The project therefore states that this control is proven on `flat64k` only. Disclosed in `36-05-SUMMARY.md` at the time, not discovered afterwards.

### 2. ROADMAP criterion 5 — "at least one resolved computed jump" met by a disclosed, cross-verified absence?
expected: Accept the disclosed corpus absence as the milestone's established pattern for computed-dispatch measurements, or require a deeper corpus search before the criterion closes.
result: passed — accepted as override by Henrik Olsson, 2026-09-05. The only real corpus available (`danish.d64`, cross-verified against `saeger.d64`, an independent crack of the same game) contains no resolved computed jump at the entry points this phase's harness reaches; every computed transfer is the BRK trick through the unresolvable hardware IRQ vector, correctly reported as unresolved dispatch. `ARRAY_BOUND` and `RECORD_STRIDE` are absent on the same corpus and ride the same decision. The harness's capability to export a `COMPUTED_JUMP` is not in question — only a real instance is absent.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. Both items were resolved by accepted owner override rather than by a code change; see
`36-VERIFICATION.md`'s `overrides:` block for the accepted wording and attribution.
