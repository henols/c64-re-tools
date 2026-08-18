---
status: partial
phase: 07-cycle-timing-and-wedge-triage
source: [07-VERIFICATION.md]
started: 2026-08-18T12:29:43Z
updated: 2026-08-18T12:29:43Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Broker-mediated `monitor_held_elsewhere` verdict, live end-to-end

Stand up the host broker control plane with two real, independently-acquired stock
sessions against the same live instance (not the dispatch-level harness that
`stock-live.test.ts` / `stock-live-triage.test.ts` use), and call `vice_diagnose`
from the second session while the first still holds the monitor via a real
`claimMonitor()` / `MonitorOwnershipError` round trip.

expected: `vice_diagnose` answers `verdict: "monitor_held_elsewhere"` (not
`diagnosis_unavailable`) within its configured session-acquisition bound, using the
real broker-refused grant's `holderGrantId` / `holderClaimedAt` / `port` evidence
fields.

why_human: Requires standing up the actual host broker daemon with two concurrent,
genuinely broker-managed leases — out of scope for the per-test emulator harnesses
this phase's live tests use (07-13 Task 3's own recorded scope boundary). Both
`REQUIREMENTS.md` (TIME-04: Partial) and `07-VALIDATION.md`
(`nyquist_compliant: false`) already name this as the one remaining item. The
closely-related but distinct socket-level contention bound was independently
confirmed live during verification (settles ~1502ms against a 1500ms bound,
answering `diagnosis_unavailable (monitor_acquisition_timeout)` — not a hang, but
not literally the verdict either).

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
