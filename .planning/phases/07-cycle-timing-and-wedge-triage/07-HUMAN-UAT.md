---
status: complete
phase: 07-cycle-timing-and-wedge-triage
source: [07-VERIFICATION.md]
started: 2026-08-18T12:29:43Z
updated: 2026-08-18
resolved_by: quick-260818-obc
---

## Current Test

None -- resolved 2026-08-18 by quick task 260818-obc's `stock-live-broker-monitor.test.ts`,
a real host broker daemon with two real, independently-acquired sessions against a genuine
crash-respawned stock VICE instance. See Test 1's own `result:` below for the transcript.

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

result: pass (2026-08-18, quick task 260818-obc)

RESOLVED, not by a human -- by a real automated live harness standing up exactly the
scenario this item asked for. `stock-live-broker-monitor.test.ts` spawned a genuine host
broker daemon (`resources/vice-broker.mjs`) against genuine stock VICE, opened two real
`openBrokerControl()` sessions, externally `SIGKILL`ed the first grant's instance, let the
broker's OWN crash supervision relaunch it, and served the second session's acquire from
that same respawned instance (`VICE_BROKER_MAX=1`). The session whose real `claimMonitor()`
arrived second was refused `verdict:"monitor_held_elsewhere"` (never `diagnosis_unavailable`),
naming the OTHER grant's real id, on both genuine `/usr/bin/x64sc` (VICE 3.9) and
`/usr/local/bin/x64sc` (VICE 3.10), settling in **1ms** against the 10000ms bound on both --
comfortably inside the expected result this test named. The same transcript also
independently proved TIME-04's other named residual: a broker-SUPERVISED (not
test-performed) `restarted` respawn, `baselineEpoch:1`/`currentEpoch:2` on both binaries.
No stray `x64sc` or broker process survived teardown on either run.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None remaining.
