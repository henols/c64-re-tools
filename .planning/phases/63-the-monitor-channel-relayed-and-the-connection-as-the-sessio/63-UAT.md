---
status: testing
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
source: [63-VERIFICATION.md]
started: 2026-09-21T09:15:44Z
updated: 2026-09-21T09:15:44Z
---

## Current Test

number: 1
name: WR-01 residual-risk decision — handleMonitorRelease()'s no-current-holder branch tears down a relay session it cannot prove is stale
expected: |
  Per ROADMAP Success Criterion 4 ("a drop mid-operation leaves evidence before it
  leaves nothing"), a genuine crash or drop must always produce an incident record
  naming the operation that was in flight.

  broker-launch.mts's handleExit() assigns `record.monitorClients = {}`
  synchronously and unconditionally on every child-process exit, and never touches
  `state.relaySessions`. vice-broker.mts's handleMonitorRelease() `!existing`
  branch now unconditionally calls tearDownRelaySessionForChannel(). So a client's
  own in-flight `monitor_release` for a channel, landing after a crash cleared
  `monitorClients` but before the emulator socket's own asynchronous
  "close"/"error" event is processed, deletes the relaySessions entry and makes
  handleRelayDeath() early-return — silently absorbing an incident record that
  Success Criterion 4 requires.

  Reproduction: clear a channel's per-channel holder record while that channel's
  relay session is still live in `state.relaySessions`, then send a
  `monitor_release` for that exact (grant, channel) pair before the socket's own
  death event has been processed.

  Decide one of:
  (a) ACCEPT as an acceptably narrow edge case — no production client legitimately
      races its own release against an unrelated crash notification; or
  (b) REQUIRE the fix 63-REVIEW.md proposes — either route handleExit()'s own live
      relay sessions through the evidence-writing path, or gate the
      no-current-holder teardown on positive proof the clearing was a deliberate
      release rather than a crash.
awaiting: user response

## Tests

### 1. WR-01 residual-risk decision — handleMonitorRelease()'s no-current-holder branch tears down a relay session it cannot prove is stale
expected: A human decides whether the crash-races-a-release window is an acceptable residual risk (accept) or requires a further fix (remediate). Reachability depends on event-loop timing between a child process "exit" event and a TCP socket "close"/"error" event, which neither this codebase nor Node orders relative to each other — a judgment call, not something a grep or a single test run can settle.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
