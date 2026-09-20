---
created: 2026-09-20T10:00:00.000Z
title: disconnect-while-queued samples once after a fixed deadline instead of polling
area: broker
severity: minor
files:

  - src/mcp/vice/broker-e2e.test.ts:955
  - src/mcp/vice/broker-e2e.test.ts:1055-1065
---

## Problem

`wired disconnect-while-queued: a genuinely queued acquire whose client
disconnects leaves exactly one instance behind, not two` is load-sensitive and
fails intermittently in a full-suite run.

The test closes the queued client, then waits a FIXED wall-clock deadline
(`POLL_MS * 2 + 250` = 1250 ms) via `waitFor()` whose predicate is only
`Date.now() - disconnectedAt >= ...` — a deadline check, not a check of the
condition under test. It then takes ONE sample of `readdirSync(stateDir)` and
asserts exactly one port directory.

When the machine is loaded, the broker's own drain pass runs late, so the second
instance directory is still on disk at the single sampling instant and the
assertion reports a leak that is not there:

```
AssertionError: exactly one instance directory must exist after the queued
acquirer disconnects, found ["7460","7462"]
2 !== 1
```

## Evidence that this is pre-existing, not a Phase 63 regression

Measured 2026-09-20 during `/gsd-execute-phase 63 --gaps-only`:

- `broker-e2e.test.ts` is untouched by every Phase 63 gap plan (63-07..63-10);
  `git log --name-only` over those commits never names it.
- Seven full-suite runs with plan 63-07's relay-teardown change in place were
  green (4268/4184/0/84, exit 0); exactly one was red with this single failure.
- The test passes 3/3 when run in isolation via
  `node --test --test-name-pattern "disconnect-while-queued" broker-e2e.test.ts`.
- 63-07's `tearDownRelaySessionsForGrant()` cannot plausibly be the cause: this
  scenario attaches no relay session, so the helper finds an empty
  `state.relaySessions` map and returns immediately.

## Fix

Poll the condition rather than the clock: keep the "at least two evaluation
passes must have elapsed" floor, then `waitFor()` on
`portDirs.length === 1` with a bounded timeout, so a late drain pass is waited
for instead of being read as a leak. The guard's intent — that the single
instance survives across a RETRY pass — is preserved by keeping the elapsed-time
floor as a precondition of the predicate rather than as the whole predicate.
