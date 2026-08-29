---
status: complete
phase: 28-the-store-core
source: [28-VERIFICATION.md]
started: 2026-08-29T00:52:00Z
updated: 2026-08-29T01:14:00Z
corrected: 2026-08-29 # two false passes reverted to `unverified`; see .planning/notes/uat-gate-launders-abstentions.md
---

## Current Test

[testing complete]

## Tests

### 1. Fault-inject so `pragma integrity_check` itself throws inside `openStore` (filesystem- or SQLite-level), rather than returning a non-`ok` row
expected: `AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned
why_human: Defensive arm with no reachable input without fault injection; presence and wiring re-verified in source (`anno-store.ts:534-539`), but nothing exercises the throw. Open since round 4.
result: unverified
reason: fault_injection_required
carried: true
corrected: 2026-08-29 — was `pass`. No fault injection was ever performed. `28-VERIFICATION.md:6`
  records `behavior_unverified: 2` and its prohibition 28-18 P3 ("MUST NOT close, silently drop, or
  re-file as done a carried-forward `behavior_unverified` item", verdict `held` at `:349`) forbids
  the `pass`; `.planning/REQUIREMENTS.md:252-257` still lists this item STILL OPEN. The `pass` was
  the UAT gate's empty-response default, not a verification.

### 2. Host-level crash / power-loss injection across the `stageSnapshot` fsync -> `publishSnapshot` rename -> pointer-row commit sequence
expected: No surviving state in which a durable `anno_snapshot` pointer row names a snapshot image whose bytes never reached disk; the only reachable outcomes are a missing directory entry or a durable one
why_human: `fsync` has no in-process observable, so the only in-process evidence is the source order of two calls. Filed by 28-17 as a `backstop` truth; the abstention (`insufficient_spec`) is recorded rather than scored.
result: unverified
reason: insufficient_spec
carried: true
corrected: 2026-08-29 — was `pass`. Same prohibition (28-18 P3) and same still-open row at
  `.planning/REQUIREMENTS.md:252-257`. The item's own `why_human` already says the abstention "is
  recorded rather than scored", which the `pass` on the next line contradicted.

### 3. Human review of the FOURTEEN judgment-tier prohibition verdicts, and in particular the TWO recorded `violated` (28-21 P1 and 28-07 P3, both at WR-31's two comments, `anno-store.ts:2131-2139` and `:1918-1922`)
expected: A decision on whether a comment scoped in its own words to *the remainder*, which a reader will take as covering *the row*, is a false guarantee — and whether the correction rides the first future edit to `retype()` (the verifier's recommendation) or needs its own commit
why_human: All fourteen are declared `verification: judgment` by 28-23's own frontmatter. The verifier's verdicts are NON-AUTHORITATIVE LLM-judge readings and must not be absorbed into a silent pass.
result: pass
source: human_decision
decided: 2026-08-29
decision: >-
  Reviewed both flagged sites against the code. SPLIT VERDICT, and the correction did NOT wait for a
  future edit — it is applied in this commit.

  `anno-store.ts:1918-1922` (`splitReinterpretation`'s docstring) is NOT a false guarantee. It names
  its own limit in its own words: "the caller's range leaves NO remainder of this row. Nothing
  survives, so no preservation is claimed and none is owed. A full cover is a deletion, and a
  deletion is already visible in the row set." A reader is told exactly what the `null` return does
  not cover. 28-07 P3 is over-read here; no change made.

  `anno-store.ts` "THE GATE" (cited `:2131-2139` at review time — that range now holds the new
  clause, and the ordering comment it displaced moved to `:2142-2151`) IS under-scoped, though
  every sentence in it is literally true. Read against the loop it heads, the shape question is asked only of remainders — `row.start
  < start` (head) and `row.end_inclusive > endInclusive` (tail). A row the caller's range covers in
  full takes neither branch and is never shape-checked; it is deleted outright by the second loop.
  That behaviour is correct (a deletion owes no shape) but the comment's absolute framing invites a
  reader to treat the gate as a validity check over `overlapping`, which would justify skipping
  validation elsewhere for malformed legacy rows. 28-21 P1 stands. Fixed by adding the
  "WHAT THIS GATE DOES NOT ASK" clause naming the non-coverage; comment-only, no behaviour change,
  typecheck clean.

  The remaining twelve judgment-tier verdicts are `held` and need no action.

## Summary

total: 3
passed: 1
issues: 0
unverified: 2
pending: 0
skipped: 0
blocked: 0

## Gaps
