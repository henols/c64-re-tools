---
status: testing
phase: 27-shared-seams-extracted
source: [27-VERIFICATION.md]
started: 2026-08-27T09:48:01Z
updated: 2026-08-27T09:48:01Z
---

## Current Test

number: 1
name: Accept or reject ROADMAP SC-4's literal "green" reading
expected: |
  Exit 1, 44 failures, split 39 `vice-proxy.test.ts` / 5 `r2000-session.test.ts`,
  zero failures in any phase-27 file. Both files were last touched in phase 18 and
  are in no phase-27 plan's `files_modified`.
awaiting: user response

## Tests

### 1. Accept or reject ROADMAP SC-4's literal "green" reading
expected: `cd src/mcp/vice && npm test` exits 1 with 44 pre-existing failures (39 `vice-proxy.test.ts`, needs a live host and is on `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS` list; 5 `r2000-session.test.ts`, `regenerator2000` absent from PATH, logged `D-27-02-A`). Zero failures in any of the 13 files phase 27 touched. The criterion's purpose — proving the extraction is a move, not a change — is met; its literal exit-0 wording is not. Accepting means adding the `overrides:` block drafted in 27-VERIFICATION.md § "Human Verification Required" item 1 to that file's frontmatter. Optional re-run takes 11+ min and needs the hung `vice-proxy.test.ts` child terminated once its results have emitted (`D-27-05-A`).
result: [pending]

### 2. Resolve the backstop-tagged SEAM-03 concurrency abstention
expected: Confirm the concurrency clause on `blockClassAt` is genuinely unexercisable rather than merely unexercised — that no async, generator, worker-thread or re-entrant path reaches it in a state where a future maintainer's memoising cache would matter. Outcome is either an accepted "not applicable — single-threaded, pure, no interruptible path" judgement, or a held-out/property-based test if a later phase introduces such a path. The static half is already fully mechanical and green (`block-class.test.ts` rejects `let`/`var` and the WR-04 `const` mutable-container shape, and asserts an empty import list); a `verification: backstop` truth may never be upgraded on presence + wiring alone.
result: [pending]

### 3. Resolve the three judgment-tier prohibitions
expected: Review `prohibition_items` in 27-VERIFICATION.md's frontmatter. The verifier's verdicts are HOLDS (27-01 ACME no-silent-skip), HOLDS_WITH_RESIDUAL (27-05 no-prefix-justification / nothing-unrecorded), HOLDS (27-05 no-laundered-green) — all non-authoritative LLM-judge dispositions. Outcome is explicit acceptance, or a decision on the two named structural residuals: promote `contested` from prose `note` to a structured field, and extend Direction 4's prefix scan to cover `note`. As it stands nothing mechanical forces a *future* contested verdict to be flagged, or stops a future prefix justification being parked in `note`.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
