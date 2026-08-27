---
status: complete
phase: 27-shared-seams-extracted
source: [27-VERIFICATION.md]
started: 2026-08-27T09:48:01Z
updated: 2026-08-27T10:13:53Z
---

## Current Test

[testing complete]

## Tests

### 1. Accept or reject ROADMAP SC-4's literal "green" reading
expected: `cd src/mcp/vice && npm test` exits 1 with 44 pre-existing failures (39 `vice-proxy.test.ts`, needs a live host and is on `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS` list; 5 `r2000-session.test.ts`, `regenerator2000` absent from PATH, logged `D-27-02-A`). Zero failures in any of the 13 files phase 27 touched. The criterion's purpose — proving the extraction is a move, not a change — is met; its literal exit-0 wording is not. Accepting means adding the `overrides:` block drafted in 27-VERIFICATION.md § "Human Verification Required" item 1 to that file's frontmatter. Optional re-run takes 11+ min and needs the hung `vice-proxy.test.ts` child terminated once its results have emitted (`D-27-05-A`).
result: pass
note: "SC-4 accepted as met-in-intent. The `overrides:` block is applied to 27-VERIFICATION.md frontmatter (overrides_applied: 1). Suite not re-run: the 44 / 39+5 split is the recorded pre-existing environmental red in files phase 27 never touched."

### 2. Resolve the backstop-tagged SEAM-03 concurrency abstention
expected: Confirm the concurrency clause on `blockClassAt` is genuinely unexercisable rather than merely unexercised — that no async, generator, worker-thread or re-entrant path reaches it in a state where a future maintainer's memoising cache would matter. Outcome is either an accepted "not applicable — single-threaded, pure, no interruptible path" judgement, or a held-out/property-based test if a later phase introduces such a path. The static half is already fully mechanical and green (`block-class.test.ts` rejects `let`/`var` and the WR-04 `const` mutable-container shape, and asserts an empty import list); a `verification: backstop` truth may never be upgraded on presence + wiring alone.
result: pass
note: "Accepted as 'not applicable - single-threaded, pure, no interruptible path'. Checked at resolution time: `blockClassAt` is a synchronous arrow function over its two arguments with no closure or module-level binding, no suspension point (no `await`/`yield`) inside it, and nothing to observe even if re-entered; `r2000-coverage.ts` contains zero occurrences of `async`/`await`/`worker_threads`/`new Worker`/`function*`, and its sole production call site resolves the classifier once at `r2000-coverage.ts:2173` inside the synchronous `computeReproducibility` (`r2000-coverage.ts:1854`). The failure mode the clause guards - a future maintainer's memoising cache - is exactly what `block-class.test.ts`'s no-module-level-mutable-binding gate (incl. the WR-04 `const` mutable-container shape) goes red on, so the guard exists mechanically even though the concurrency path does not. Held: if a later phase introduces an async, generator or worker path to this module, the backstop must be upgraded to a held-out or property-based test at that time."

### 3. Resolve the three judgment-tier prohibitions
expected: Review `prohibition_items` in 27-VERIFICATION.md's frontmatter. The verifier's verdicts are HOLDS (27-01 ACME no-silent-skip), HOLDS_WITH_RESIDUAL (27-05 no-prefix-justification / nothing-unrecorded), HOLDS (27-05 no-laundered-green) — all non-authoritative LLM-judge dispositions. Outcome is explicit acceptance, or a decision on the two named structural residuals: promote `contested` from prose `note` to a structured field, and extend Direction 4's prefix scan to cover `note`. As it stands nothing mechanical forces a *future* contested verdict to be flagged, or stops a future prefix justification being parked in `note`.
result: pass
note: "All three judgment-tier prohibition verdicts explicitly accepted (HOLDS / HOLDS_WITH_RESIDUAL / HOLDS). The two named structural residuals from item 2 are accepted as residuals rather than fixed in phase 27, and are now logged as `D-27-05-B` in deferred-items.md so the unguarded future cases survive the phase close: `contested` stays prose-only in `note`, and Direction 4's prefix scan still exempts `note`. Both are about future entries - every present entry is correct, Direction 4's non-vacuity is proven both ways, and Direction 1 was proven against a real unclassified r2000-*.ts on disk."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
