---
status: testing
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
source: [48-VERIFICATION.md]
started: 2026-09-13T00:00:00Z
updated: 2026-09-13T00:00:00Z
---

## Current Test

number: 1
name: The full, combined synthetic subject shows its documented on-screen behaviour in a real VICE
expected: |
  Assemble `hazard-subject.a` under real ACME (already proven byte-identical by the
  reassembly test), load `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` into a
  real stock `x64sc`, run it to a settled screen, and look at the screen.

  Predicted: a recognisable sprite, a recognisable custom glyph, a horizontal colour split
  from the raster routine, and a changed border colour — all visible together on the
  settled screen.

  Actually observed and disclosed in `FIXTURE-DESIGN.md`: the settled COMBINED image shows
  a plain `READY.` prompt — none of the four predicted effects. Each construction shown in
  ISOLATION (built without the raster construction present) DOES take its own visible
  effect. The disagreement was investigated across multiple load paths and with an entry
  point that never returns to BASIC; the timer-stabilised raster construction's shared IRQ
  vector and VIC-II/CIA1 state get reverted during normal execution. The root cause of the
  reversion in the combined image was not pinned down.

  The judgment call: does this disclosed, investigated disagreement satisfy the roadmap's
  Success Criterion 1 ("runs in VICE with visible on-screen behaviour") for the DELIVERED
  subject, or does it leave that criterion unmet until the interaction is understood or the
  subject is revised so the full combination settles visibly?
awaiting: user response

## Tests

### 1. The full, combined synthetic subject shows its documented on-screen behaviour in a real VICE
expected: A sprite, a custom glyph, a horizontal colour split and a changed border colour, all visible together on the settled screen of a real stock x64sc running the committed `hazard-subject.prg`. Observed instead: a plain `READY.` screen, with each construction confirmed to work in isolation. Judge whether the disclosed disagreement satisfies Success Criterion 1.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
