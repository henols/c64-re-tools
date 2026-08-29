---
status: testing
phase: 28-the-store-core
source: [28-VERIFICATION.md]
started: 2026-08-29T00:52:00Z
updated: 2026-08-29T00:52:00Z
---

## Current Test

number: 1
name: Fault-inject so `pragma integrity_check` itself throws inside `openStore`
expected: |
  `AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned
awaiting: user response

## Tests

### 1. Fault-inject so `pragma integrity_check` itself throws inside `openStore` (filesystem- or SQLite-level), rather than returning a non-`ok` row
expected: `AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned
why_human: Defensive arm with no reachable input without fault injection; presence and wiring re-verified in source (`anno-store.ts:534-539`), but nothing exercises the throw. Open since round 4.
result: [pending]

### 2. Host-level crash / power-loss injection across the `stageSnapshot` fsync -> `publishSnapshot` rename -> pointer-row commit sequence
expected: No surviving state in which a durable `anno_snapshot` pointer row names a snapshot image whose bytes never reached disk; the only reachable outcomes are a missing directory entry or a durable one
why_human: `fsync` has no in-process observable, so the only in-process evidence is the source order of two calls. Filed by 28-17 as a `backstop` truth; the abstention (`insufficient_spec`) is recorded rather than scored.
result: [pending]

### 3. Human review of the FOURTEEN judgment-tier prohibition verdicts, and in particular the TWO recorded `violated` (28-21 P1 and 28-07 P3, both at WR-31's two comments, `anno-store.ts:2131-2139` and `:1918-1922`)
expected: A decision on whether a comment scoped in its own words to *the remainder*, which a reader will take as covering *the row*, is a false guarantee — and whether the correction rides the first future edit to `retype()` (the verifier's recommendation) or needs its own commit
why_human: All fourteen are declared `verification: judgment` by 28-23's own frontmatter. The verifier's verdicts are NON-AUTHORITATIVE LLM-judge readings and must not be absorbed into a silent pass.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
