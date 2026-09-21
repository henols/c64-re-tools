---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
reviewed: 2026-09-21T09:02:12Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/mcp/vice/broker-relay-text.test.ts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-state.mts
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/text-connect.ts
  - src/mcp/vice/vice-broker.mts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-09-21T09:02:12Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This is a two-plan gap-closure round: 63-11 (broker-side) adds
`tearDownRelaySessionForChannel()` and wires it into both branches of
`handleMonitorRelease()`; 63-12 (caller-side) reorders `textDisconnect()` and
`stockDisconnect()` from close-then-release to release-then-close. Both
halves are implemented correctly and match their own header comments and the
project's stated evidence-before-reclaim invariant. `resources/vice-broker.mjs`
was confirmed byte-identical to a fresh build of `vice-broker.mts`
(`node --test resources-sync.test.ts` passes), so it carries no drift to
review independently. `npx tsc --noEmit` is clean, and all 111 tests across
the nine required-reading files (plus the sibling suites they belong to) pass.

The one substantive finding (WR-01) is a narrow but real race the 63-11
broker-side fix introduces: `handleMonitorRelease()` now unconditionally
tears down a live relay session even on its "already cleared" branch, which
did not touch `state.relaySessions` at all before this plan. That branch is
reached whenever `instance.monitorClients[channel]` is already empty for
*any* reason -- including a crash that ran `handleExit()`'s direct
`monitorClients = {}` assignment (`broker-launch.mts`, confirmed not to touch
`relaySessions`) moments before the crash's own asynchronous socket
close/error events would otherwise have reported it through
`handleRelayDeath()`. A client's own in-flight `monitor_release` for that
exact channel, landing in this window, now silently absorbs what should have
been a recorded incident. The remaining findings are test-hygiene issues: a
stale test comment describing plan 63-12 as not yet landed, and a genuine
end-to-end coverage gap for the exact defect this round exists to fix.

## Warnings

### WR-01: `handleMonitorRelease()`'s new no-claim teardown can swallow a genuine crash incident

**File:** `src/mcp/vice/vice-broker.mts:1354-1363` (mirrored in
`src/mcp/vice/resources/vice-broker.mjs`)
**Issue:**
Before this plan, `handleMonitorRelease()` never touched
`state.relaySessions` at all -- only the whole-grant paths
(`handleRelease()`/`handleRecycleForRealBroker()`, via
`tearDownRelaySessionsForGrant()`) ever tore a live relay session down
outside of `handleRelayDeath()`'s own announced-death path. Plan 63-11 adds a
call to `tearDownRelaySessionForChannel()` on **both** branches of
`handleMonitorRelease()`, including the "already cleared" (`!existing`)
branch:

```ts
const existing = instance.monitorClients[channel];
if (!existing) {
  tearDownRelaySessionForChannel(targetId, channel, state);
  return { ok: true };
}
```

This branch has no way to distinguish "a prior *release* already ran but the
socket close never followed it" (the scenario the comment above it
describes, and the one this fix is meant to cover) from "this channel's
ownership record was just cleared by `handleExit()` because the emulator
*crashed*." `broker-launch.mts`'s `handleExit()` (confirmed by reading it)
assigns `record.monitorClients = {}` directly and synchronously on **every**
exit path -- crash, recycle, and deliberate teardown -- before doing
anything else, and never touches `state.relaySessions`. A crashed instance's
live relay session is otherwise reported through the ordinary asynchronous
socket `"close"`/`"error"` events (`broker-relay.mts`), which route to
`handleRelayDeath()` and write an incident record.

If a client that legitimately held channel `channel` sends its own
`monitor_release` for that exact (grant, channel) pair in the window between
`handleExit()`'s synchronous clear and the relay socket's own asynchronous
close event being processed (e.g. the client is reacting to the very
operation that the crash just interrupted, and is racing to tear its own
session down), `handleMonitorRelease()` now takes the `!existing` branch and
calls `tearDownRelaySessionForChannel()` itself -- deleting the
`state.relaySessions` entry and destroying both sockets *before*
`handleRelayDeath()` ever gets a chance to run. When the crash's own close
event later fires, `handleRelayDeath()` finds the entry already gone and
"writes nothing" (per its own documented early-return contract). The crash
is still handled correctly by `handleExit()`'s respawn/backoff logic, but
the incident record -- the ONE piece of evidence this whole subsystem exists
to guarantee gets written before any reclaim -- is silently lost for that
relay death.

This is a genuinely new interaction: no version of `handleMonitorRelease()`
before this plan ever called into `state.relaySessions` on the "no current
holder" path, so this exact race could not previously arise from an ordinary
`monitor_release` call. Nothing in `broker-relay.test.ts` or
`broker-relay-text.test.ts` exercises a crash racing a release.
**Fix:**
Either (a) have `handleExit()` also run `tearDownRelaySessionsForGrant()`
(or the per-channel primitive) for the instance's own live sessions,
*through the evidence-writing path* (`handleRelayDeath()`, e.g. by
triggering its own reportDeath rather than a bare `close()`), before or
instead of the bare `monitorClients = {}` assignment, so a crash's relay
death is always recorded regardless of what a racing client does; or (b)
make the `!existing` branch of `handleMonitorRelease()` conditional on
positive evidence that a prior release (not a crash) is what cleared the
holder record -- e.g. a short-lived "recently released" marker distinct from
"never claimed" -- so it never proactively destroys a session it cannot
prove is stale. Add a regression test that drives exactly this ordering
(clear `monitorClients` the way `handleExit()` does, leave a live
`relaySessions` entry behind, then call `handleMonitorRelease()` for that
channel) and asserts an incident is still written once the socket's death is
subsequently observed.

### WR-02: Stale test comment claims plan 63-12 has not landed

**File:** `src/mcp/vice/broker-relay-text.test.ts:291-293`
**Issue:** The header comment on the "gap closure 63-11" hygiene test reads:

```
// release-then-close (the target order plan 63-12 gives the real callers;
// see this plan's own <planner_findings> for why production still runs
// close-then-release until that plan lands).
```

Plan 63-12 (the `text-connect.ts`/`stock-connect.ts` release-then-close
reorder) has already landed in this same commit set, per `text-connect.ts`'s
and `stock-connect.ts`'s own diffs. "Production still runs
close-then-release until that plan lands" is now false: production
(`textDisconnect()`) runs release-then-close today. CLAUDE.md's own
convention for this codebase is that a comment states why a file/test is the
way it is, and a comment that asserts something no longer true about the
current state of the production code will actively mislead a future reader
trying to understand why this test drives the sequence by hand instead of
calling `textDisconnect()`.
**Fix:** Update the comment to state the actual reason this test still
drives claim/release/close by hand (e.g. "this test exercises the
broker-side primitive in isolation from the caller; see WR-02 in
`text-connect.test.ts`/`stock-connect.ts` for the caller-side coverage of
the same order"), and drop the "until that plan lands" framing now that 63-12
is merged.

### WR-03: No automated test exercises the combined fix end-to-end with real production functions on both ends

**File:** `src/mcp/vice/broker-relay.test.ts`,
`src/mcp/vice/broker-relay-text.test.ts`, `src/mcp/vice/text-connect.test.ts`,
`src/mcp/vice/stock-connect.test.ts`
**Issue:** The defect this round of plans closes is specifically: "every
ordinary, successful text-channel tool call wrote a spurious incident
record" -- i.e. the *real* `textDisconnect()`/`stockDisconnect()` (63-12's
release-then-close order) talking to the *real* broker handlers
(63-11's `handleMonitorRelease()`/`tearDownRelaySessionForChannel()`), with
the *real* `writeBrokerIncident()` writer, producing zero incident files.
No test in the reviewed set combines all three of those:
- `text-connect.test.ts`/`stock-connect.test.ts` use a **mocked**
  `brokerControl` and merely assert ordering via `probeAtRelease` (that the
  socket is still connected when `releaseMonitor()` is invoked) -- they never
  touch a real broker or a real incident writer.
- `broker-relay-text.test.ts`'s "gap closure 63-11" test uses a **real**
  broker and a **real** `writeBrokerIncident()`, and does assert zero
  incident files -- but it drives the release-then-close sequence *by hand*
  (`handleMonitorRelease(...)` then `client.disconnect()`), never calling the
  actual `textDisconnect()` production function.
- `broker-relay.test.ts` does call the real `stockDisconnect()` against a
  real broker (in the `stockReconnect` tests), but those tests never assert
  anything about `state.relaySessions` size or incident-file contents
  afterward.

There is consequently no single automated test that would fail today if
either half of this fix were reverted while the other stayed in place, nor
one that reproduces the originally-reported bug end-to-end using the actual
shipped call path.
**Fix:** Add at least one test per channel that calls the real
`textConnect()`/`textDisconnect()` (or `stockConnect()`/`stockDisconnect()`)
against a real `withRelayTestBroker()`-style broker with a real, scratch
`writeBrokerIncident()`, and asserts `state.relaySessions.size === 0` and
zero files in the incidents directory afterward -- the same assertion
`broker-relay-text.test.ts`'s existing hygiene test makes, but reached
through the production disconnect function rather than a hand-rolled
release/close sequence.

## Info

### IN-01: Inconsistent teardown-vs-clear ordering between `handleRelease()` and `handleRecycleForRealBroker()`

**File:** `src/mcp/vice/vice-broker.mts:1522-1535` vs `:1658-1676`
**Issue:** `handleRecycleForRealBroker()` calls `clearMonitorClient(instance)`
*before* `tearDownRelaySessionsForGrant(targetId, state)`, while
`handleRelease()` calls `tearDownRelaySessionsForGrant(requestId, state)`
*before* `markDeliberateDeath()`/`clearMonitorClient(instance)`. The two
calls operate on independent data structures (`instance.monitorClients` vs
`state.relaySessions`), so this ordering difference is not a correctness bug
-- but the file's own extensive commentary elsewhere is emphatic about
ordering being "load-bearing, not incidental" for closely related teardown
steps, which makes this particular asymmetry (pre-existing, not introduced by
this round) worth a one-line note explaining why the two sequences may
legitimately differ, the next time either function is touched.
**Fix:** No functional change needed; consider a short comment noting the two
statements are order-independent of each other, to preempt a future reader
assuming the difference is deliberate signalling of something else.

---

_Reviewed: 2026-09-21T09:02:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
