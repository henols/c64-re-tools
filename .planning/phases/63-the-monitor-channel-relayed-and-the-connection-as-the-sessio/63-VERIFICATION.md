---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
verified: 2026-09-20T13:00:00Z
status: gaps_found
score: 5/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/WINDOWS.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-01-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-01-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-02-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-02-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-03-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-03-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-04-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-04-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-05-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-05-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-06-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-06-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-07-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-07-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-08-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-08-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-09-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-09-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-10-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-10-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-REVIEW.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/evidence/phase63-gap-closure-live-measurements.md"
  - "src/mcp/vice/broker-control.mts"
  - "src/mcp/vice/broker-control.test.ts"
  - "src/mcp/vice/broker-relay-text.test.ts"
  - "src/mcp/vice/broker-relay.mts"
  - "src/mcp/vice/broker-relay.test.ts"
  - "src/mcp/vice/broker-state.mts"
  - "src/mcp/vice/resources/broker-state.mjs"
  - "src/mcp/vice/resources/vice-broker.mjs"
  - "src/mcp/vice/stock-connect.ts"
  - "src/mcp/vice/stock-dispatch.ts"
  - "src/mcp/vice/stock-live-relay.test.ts"
  - "src/mcp/vice/text-connect.ts"
  - "src/mcp/vice/text-tools.test.ts"
  - "src/mcp/vice/text-tools.ts"
  - "src/mcp/vice/vice-broker.mts"
covered_digest: "v1:sha256:fc14112c5949d2a0943a370e20c326c6862b49446614ba29884d74e3bbc36012"
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "CR-01 (63-REVIEW.md / prior truth #5 'incident record before reclaim'): handleRelease() and handleRecycleForRealBroker() now both call tearDownRelaySessionsForGrant() before the kill, in delete-then-close order, so the emulator kill's later async socket close finds state.relaySessions already empty and handleRelayDeath()'s early return fires -- no spurious/duplicate record on a grant-level release or recycle. Confirmed by direct code read of vice-broker.mts and by running broker-relay.test.ts's four new regression cases live (all pass, including the re-entrant handleRelayDeath() call proving the async race is closed)."
    - "WR-01 (declare-before-lock-granted ordering asymmetry): text-tools.ts's withTextTool() now declares/clears the grant's operation strictly inside the withTextChannelLock() callback, symmetric with stock-dispatch.ts's acquire-then-declare ordering. Confirmed by direct code read and by running the cross-channel-contention regression case live."
    - "63-REVIEW.md's own WR-01 code-review finding (a leaked process-wide channel-lock mutex in the new contention test) was independently confirmed fixed: text-tools.test.ts's case now releases the lock from an idempotent finally, not a bare statement."
    - "Prior truth #2 (JAM byte-transparency, PRESENT_BEHAVIOR_UNVERIFIED): broker-relay.test.ts now carries three synthetic, deterministic, CI-run cases proving the relay is byte-transparent for a zero-length-body JAM (raw Buffer equality, not just a decoded field), survives a header-split, and correctly demuxes an interleaved JAM by request id rather than arrival order. All three confirmed passing by direct re-run."
    - "WINDOWS id 70 (JAM never observed live) and id 69 (REGISTER_INFO dump not observed over the relay): both measured directly against genuine stock VICE 3.9 by a discriminating direct-dial-vs-relay probe and waived by the pre-committed rule (no variant emitted a bare JAM on a direct dial either, exonerating the relay; the production-shaped first connection was confirmed to consume the one-time greeting). Confirmed present and consistent in .planning/WINDOWS.md (both rows 'waived', counters 45/17/9/71 arithmetically consistent)."
  gaps_remaining:
    - "A NEW instance of the same defect class this whole gap-closure round exists to close: the per-CHANNEL monitor_release path (handleMonitorRelease(), vice-broker.mts:1300) never tears down state.relaySessions, so the client-side socket close that EVERY ordinary text-tool call performs (textConnect()/textDisconnect()'s open-run-close-per-call pattern in text-tools.ts) re-enters handleRelayDeath() and writes a spurious incident record for a completely routine, successful tool call. This was not addressed by any of the four gap-closure plans (63-07..63-10), which only fixed the GRANT-level release/recycle paths (handleRelease()/handleRecycleForRealBroker()). See Gaps below -- this is a newly-discovered failure of the SAME truth (SESS-05 'a routine, quiet release writes no incident'), found by this re-verification's own direct empirical reproduction of the production code path, not carried forward from the prior report."
  regressions: []
gaps:
  - truth: "When a connection drops mid-operation, an incident record exists before the instance is reclaimed, carrying a broker-minted reason naming the operation that was in flight, and a routine, quiet release writes no incident (ROADMAP Success Criterion 4, SESS-05)"
    status: failed
    reason: >-
      The grant-level release/recycle paths (handleRelease(), handleRecycleForRealBroker())
      are now correctly fixed by plan 63-07 -- confirmed by direct code read and by running
      the new regression suite live. But `handleMonitorRelease()` (vice-broker.mts:1300),
      the handler for the PER-CHANNEL `monitor_release` control op, was never touched by any
      of the four gap-closure plans and still only calls `clearMonitorClient(instance,
      channel)` -- it never removes or closes the grant's live `state.relaySessions` entry
      for that channel. This op is what `releaseMonitor()` sends, and `releaseMonitor()` is
      exactly what `text-connect.ts`'s `textDisconnect()` (line 216) and `stock-connect.ts`'s
      `stockDisconnect()` (line 576) call immediately AFTER closing their own end of the
      relay socket via `safeDisconnect()`. `text-tools.ts`'s `withTextTool()` -- the ONE
      wrapper every text-channel tool call goes through in production -- performs exactly
      this open-connect/run-one-command/textDisconnect() sequence on EVERY SINGLE CALL (see
      its own header comment: "always tear the session down again (textDisconnect())").
      So the client-side socket close from step one of `textDisconnect()` fires
      `spliceRelay()`'s `"close"` event -> `reportDeath()` -> `onDeath` -> `handleRelayDeath()`,
      which finds the `state.relaySessions` entry STILL PRESENT (nothing removed it) and
      writes a full, real incident record -- for a completely ordinary, successful text tool
      call with nothing dropped and no operation declared. I confirmed this directly and
      empirically, not merely by code trace: I drove the exact real production sequence
      (`handleMonitorClaim()` -> `handleRelayAttach()` -> one `TextMonitorClient.command()`
      round trip -> `client.disconnect()` -> `handleMonitorRelease()`, the identical steps
      `textDisconnect()` performs) against the REAL, unmodified `resources/vice-broker.mjs`
      and `resources/broker-incident.mjs` in a throwaway scratch test (written, run, and
      deleted during this verification), and observed exactly one incident file written:
      `vice-broker: relay death on target grant-scratch-text channel text (trigger
      relay_close, operation none declared) -- incident recorded at
      <dir>/20260920101220925-port1-epochunknown.md`, with `state.relaySessions.size === 0`
      afterward (confirming the map entry really was consumed by `handleRelayDeath()`, not
      left over from a leaked fixture). This means every production use of ANY text-channel
      tool (`vice_device_console` and its siblings) currently writes one incident record,
      per call, into the machine-wide, cross-project `.c64-re-tools/incidents/` directory --
      directly contradicting `vice-broker.mts`'s own documented invariant ("a grant with
      NOTHING declared writes nothing: a routine, quiet release is not an incident"), the
      same invariant 63-07-PLAN.md quotes and the same truth this whole four-plan round set
      out to close. `stock-connect.ts`'s `stockDisconnect()` carries the identical defect for
      the binary channel, triggered less often in practice because `stock-dispatch.ts`'s
      `ensureStockSession()` holds a module-level `heldSession` for the life of the process
      rather than reconnecting per call -- but the same code path fires whenever a lease
      target switches or a stale session is torn down and replaced. Neither
      `broker-relay-text.test.ts` nor `broker-relay.test.ts` has any test that reads the
      `incidentsDir` contents after an ordinary connect/command/disconnect round trip --
      both files mint a scratch `incidentsDir` and remove it in a `finally` without ever
      asserting it is empty, so this defect has zero regression coverage anywhere in the
      current suite (4268/4184/0/84 green does not exercise this assertion at all).
    artifacts:
      - path: "src/mcp/vice/vice-broker.mts"
        issue: "handleMonitorRelease() (line 1300) clears only instance.monitorClients[channel] via clearMonitorClient(); it never touches state.relaySessions for that (targetId, channel) pair before returning."
      - path: "src/mcp/vice/text-connect.ts"
        issue: "textDisconnect() (line 216) runs safeDisconnect(session.client) then releaseMonitor() -- exactly the pairing text-tools.ts's withTextTool() performs after EVERY text tool call in production, making this a per-call, not per-session, defect."
      - path: "src/mcp/vice/stock-connect.ts"
        issue: "stockDisconnect() (line 576) has the identical pairing for the binary channel, triggered on a lease-target switch or a forced reconnect."
      - path: "src/mcp/vice/broker-relay-text.test.ts"
        issue: "startRelayListenerForState()'s incidentsDir is created and removed in every test that uses it, but no test ever reads its contents to assert it stayed empty after an ordinary round trip -- this exact scenario (the file's own 'tracer' test) already exercises the vulnerable sequence and could have caught this."
      - path: "src/mcp/vice/broker-relay.test.ts"
        issue: "Same gap in its own incidentsDir-consuming tests -- the four new 63-07 regression cases prove the grant-level paths but none exercise handleMonitorRelease()."
    missing:
      - "handleMonitorRelease() (or broker-control.mts's monitor_release dispatch arm that calls it) must proactively remove and close the grant's own live state.relaySessions entry for the released channel -- deleting relaySessionKey(targetId, channel) and calling that session's own close() -- BEFORE (or as part of) clearMonitorClient(), in the same delete-before-close order tearDownRelaySessionsForGrant() already uses, so the client-side socket close that follows finds the map entry already gone and handleRelayDeath()'s early return fires. tearDownRelaySessionsForGrant() itself iterates the WHOLE grant across every MONITOR_CHANNELS value and cannot be reused unchanged here without also considering the OTHER channel's still-live session -- a per-channel variant, or a parameterised single-channel path through the same helper, is what's needed."
      - "A regression test driving the REAL production sequence -- claim, attach, one command, then exactly the two steps textDisconnect()/stockDisconnect() perform (client-side socket close, then releaseMonitor()) -- asserting an injected writeIncident recorder's call count is 0 afterward. This is the missing counterpart to plan 63-07's own four regression cases, which covered only the grant-level release/recycle paths and never exercised handleMonitorRelease()."
      - "A decision, recorded in the fix's own header comment, on whether a monitor_release that is NOT immediately followed by a socket close (a client meaning to keep the relay connection open across channel claims) should also tear the session down -- the fix must not assume every monitor_release is followed by a close, only that IF one is (as both existing production callers do), no spurious record results."
deferred: []
advisory: []
human_verification: []
---

# Phase 63: The Monitor Channel Relayed, and the Connection as the Session Verification Report

**Phase Goal:** Every `vice_*` tool call reaches the emulator over a connection the
broker relays rather than a socket the client dialled itself, and the broker — not
the client — owns holding and reclaiming that session. The connection IS the
session: when the socket dies the instance is reclaimed, whatever killed the client.

**Verified:** 2026-09-20T13:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 63-07..63-10)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The relay is byte-transparent for a register read, a memory write and a checkpoint hit (SC1, SESS-02) | ✓ VERIFIED | Unchanged from prior verification: `spliceRelay()`'s pipe-based splice, synthetic and live tests in `broker-relay.test.ts`/`stock-live-relay.test.ts` |
| 2 | The relay is byte-transparent for a JAM the same way it is for the other three frame kinds (SC1, SESS-02) | ✓ VERIFIED | Plan 63-09 added three deterministic, CI-run cases in `broker-relay.test.ts` proving zero-length-body byte-transparency (raw `Buffer.equals`, not just a decoded field, with `programCounter === null`), header-split reassembly into exactly one event, and demux-by-request-id under both same-segment and split-segment interleave with a real command reply — re-run live during this verification, all pass. Plan 63-10's live measurement against genuine stock VICE 3.9 found no `JamAction` variant (default/1, 2, 3) ever emits a bare JAM on a DIRECT dial either (opcode/PC writes independently confirmed correct by read-back), so the earlier live non-reproduction is an emulator-side behavior, not a relay defect — WINDOWS id 70 waived on that measurement, confirmed present in `.planning/WINDOWS.md`. |
| 3 | Two call shapes each hold exactly what they should: an MCP server's connection holds its instance for the socket's life; a skill script's stateless call binds no lease (SESS-01, SESS-02) | ✓ VERIFIED | Unchanged from prior verification |
| 4 | A client killed with SIGKILL is reclaimed from socket events alone, and a client producing no FIN is detected within a bounded time (SESS-03, SESS-04) | ✓ VERIFIED | Unchanged from prior verification |
| 5 | When a connection drops mid-operation, an incident record exists before the instance is reclaimed, and a routine, quiet release writes no incident (SC4, SESS-05) | ✗ FAILED | The prior Blocker (CR-01, grant-level release/recycle) is now correctly fixed and confirmed live. But a NEW, unaddressed instance of the SAME truth failing was found by this verification's own direct empirical test: `handleMonitorRelease()` never tears down `state.relaySessions`, so every ordinary, successful text-channel tool call (which opens and closes a fresh relay connection per call via `textConnect()`/`textDisconnect()`) writes a spurious incident record on completion. See Gaps below. |
| 6 | A user can tell which live session is their own from broker status, without guessing from port numbers, and the label carries no authority (SESS-06) | ✓ VERIFIED | Unchanged from prior verification |

**Score:** 5/6 truths verified (1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/vice-broker.mts` — `tearDownRelaySessionsForGrant()` | Enumerates `MONITOR_CHANNELS`, delete-before-close, wired into `handleRelease()` (both branches) and `handleRecycleForRealBroker()` | ✓ VERIFIED | Confirmed present at `vice-broker.mts:1191` by direct read; wired at three call sites (`handleRelease()` pid-match branch, mismatched-occupant branch, `handleRecycleForRealBroker()`); regression tests re-run live, all pass |
| `src/mcp/vice/vice-broker.mts` — `handleMonitorRelease()` | Should tear down a released channel's own live relay session the same way, so a per-channel release cannot leave a stale map entry for a client-initiated socket close to trip over | ✗ MISSING | Confirmed absent by direct read at `vice-broker.mts:1300` — the function touches only `instance.monitorClients[channel]`, never `state.relaySessions`. This is the artifact gap underlying the Gaps section below. |
| `src/mcp/vice/text-tools.ts` — `declareTextOperation()` | Declares/clears the grant's operation only while the shared cross-channel mutex is held | ✓ VERIFIED | Confirmed present and correctly ordered inside `withTextChannelLock()`'s callback; regression tests re-run live, all pass |
| `src/mcp/vice/broker-relay.test.ts` — JAM wire-shape cases | Byte-transparency, header-split, interleave-demux, all through the real `spliceRelay()`/`dialMonitorRelay()`/parser | ✓ VERIFIED | Confirmed present (`syntheticJamFrame` at 4 lines, `VICE_BROADCAST_REQUEST_ID` at 7 lines); re-run live, all 3 new cases pass |
| `src/mcp/vice/stock-live-relay.test.ts` — gap-probe cases | Opt-in, default-skipped, RECORD-only live measurement of the JAM and REGISTER_INFO questions | ✓ VERIFIED | Confirmed present, both default-skip (unset env) and armed-run (per SUMMARY's own re-run) behave as specified |
| `.planning/phases/.../evidence/phase63-gap-closure-live-measurements.md` | Verbatim measurement, per-variant/per-connection tables, T-33-04 note | ✓ VERIFIED | Present at the phase `evidence/` path (never `docs/`), quotes both `GAP-PROBE OBSERVED` JSON blocks verbatim |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `handleRelease()`/`handleRecycleForRealBroker()` | `tearDownRelaySessionsForGrant()` | Called strictly before the kill, delete-then-close order | ✓ WIRED | Confirmed by direct read and by the async-re-entry regression case (calls `handleRelayDeath()` again after `handleRelease()` and asserts the write count stays at 0) |
| `text-tools.ts` (`withTextTool`) | `stock-dispatch.ts` (`withChannelLockHeld`) | Symmetric declare-after-lock-granted ordering | ✓ WIRED | Confirmed by direct read of both files; text side proven behaviorally under real cross-channel contention, binary side proven by source-symmetry assertion (plan's own authorized fallback) |
| `broker-relay.test.ts`'s JAM cases | `spliceRelay()`/`dialMonitorRelay()`/`stock-protocol.ts` | Real loopback sockets, real parser, real relay | ✓ WIRED | Confirmed: every JAM case runs through `withRelayTestBroker()`/`claimAndDialRelay()`, never a bare parser-only assertion |
| **`handleMonitorRelease()`** | **`state.relaySessions`** | **Expected: proactive close/removal of the released channel's live relay session before returning** | **✗ NOT WIRED** | **Confirmed absent — see Gaps. This is the link CR-01's own fix pattern (`tearDownRelaySessionsForGrant()`) was never extended to cover.** |
| `text-connect.ts` (`textDisconnect`) / `stock-connect.ts` (`stockDisconnect`) | `handleMonitorRelease()` via `releaseMonitor()` | Client-side socket close followed by a control-plane per-channel release | ⚠️ PARTIAL (produces a spurious incident) | Both functions correctly release the claim; neither is aware that the subsequent (or preceding) socket close re-enters `handleRelayDeath()` against a still-populated map entry |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite is green | `npm --prefix src/mcp/vice test`, redirected, `$?` read same line | 4268 tests, 4184 pass, 0 fail, 84 skipped, exit 0 (independently re-run during this verification; matches 63-10-SUMMARY.md's own recorded counts exactly) | ✓ PASS |
| `npm --prefix src/mcp/vice run typecheck` | — | exit 0, no errors | ✓ PASS |
| Targeted regression files (`text-tools.test.ts`, `broker-relay.test.ts`, `broker-control.test.ts`, `broker-state.test.ts`) | `node --test --test-reporter=tap <files>` | 239 tests, 238 pass, 0 fail, 1 opt-in skip | ✓ PASS |
| `handleRelease()`'s new regression cases (63-07) actually re-enter `handleRelayDeath()` and assert zero writes | `node --test --test-reporter=tap broker-relay.test.ts` | All 4 new cases (release-with-live-relay, mismatched-occupant, recycle-with-live-relay, MONITOR_CHANNELS-enumeration) pass | ✓ PASS |
| `text-tools.ts`'s cross-channel-contention regression case (63-08) | `node --test --test-reporter=tap text-tools.test.ts` | Passes; the mutex-leak fix (a `finally`-guarded, idempotent release) confirmed present in source | ✓ PASS |
| JAM wire-shape cases (63-09) | `node --test --test-reporter=tap broker-relay.test.ts` | All 3 new cases pass; `programCounter === null` asserted with the fabricated-PC failure mode named in the message | ✓ PASS |
| **A real production-shaped connect/command/disconnect sequence writes no incident** | **Direct-drive scratch reproduction of `handleMonitorClaim()` → `handleRelayAttach()` → one command → `client.disconnect()` → `handleMonitorRelease()` against the real compiled `resources/vice-broker.mjs`, `resources/broker-incident.mjs`** | **One incident file WAS written for an entirely ordinary, successful round trip; `state.relaySessions.size === 0` afterward confirms the entry was consumed by `handleRelayDeath()`** | **✗ FAIL — this is the gap** |
| No unresolved debt markers in phase-touched files | `grep -nE "TBD\|FIXME\|XXX"` across the gap-closure round's touched files | No matches | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SESS-01 | Stateless skill-script call binds no lease | ✓ SATISFIED | Unchanged; 63-05-SUMMARY.md D6 |
| SESS-02 | MCP server connection holds its instance for the socket's life; relay is byte-transparent (including JAM) | ✓ SATISFIED | Now fully closed: relay-side JAM proof (63-09) plus the WINDOWS-ledgered emulator-side measurement (63-10) |
| SESS-03 | Broker reclaims from socket events alone | ✓ SATISFIED | Unchanged |
| SESS-04 | A client producing no FIN is detected within a bounded time | ✓ SATISFIED | Unchanged |
| SESS-05 | Incident record written before reclaim, naming the in-flight operation; a routine release writes no incident | ✗ BLOCKED | The grant-level release/recycle mechanism (CR-01) and the declare-ordering race (WR-01) are both now correctly fixed. But `handleMonitorRelease()` — the per-channel release every ordinary text-tool call exercises — still writes a spurious incident on every completed call. SESS-05 is not end-to-end satisfied. |
| SESS-06 | User can identify their own session in shared-broker status | ✓ SATISFIED | Unchanged |

**REQUIREMENTS.md marks all six as `Complete`. This verification finds SESS-05 still not actually satisfied end-to-end (for a different reason than the prior report) and recommends REQUIREMENTS.md be reverted for SESS-05 pending this gap's closure. SESS-01/02/03/04/06 stand — SESS-02 is now fully closed, unlike the prior report which left its JAM sub-claim as human-verification.**

No orphaned requirements found: all six requirement IDs declared across the phase's ten plans map onto REQUIREMENTS.md's Phase 63 row, and no other REQUIREMENTS.md row cites Phase 63.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/vice-broker.mts` | 1300 | Missing cleanup: `handleMonitorRelease()` never removes or closes the released channel's own `state.relaySessions` entry | 🛑 Blocker | Every ordinary text-tool call (and any binary-channel lease-target switch) writes a spurious incident record on an entirely successful, routine disconnect — the same class of bug CR-01 fixed for the grant-level paths, now confirmed live for the per-channel path |
| `src/mcp/vice/broker-relay-text.test.ts`, `src/mcp/vice/broker-relay.test.ts` | various | Test-hygiene gap: `incidentsDir` is minted and cleaned up in every relay test but its contents are never asserted empty after an ordinary round trip | ⚠️ Warning | Exactly how this defect escaped both the original six plans (63-01..63-06) and all four gap-closure plans (63-07..63-10) — the tracer test that exercises the vulnerable sequence already exists and could have caught this with one added assertion |

### Human Verification Required

None. The one item the prior report routed to a human (the live JAM non-reproduction) was resolved by direct, pre-committed-disposition measurement in plan 63-10 and is now recorded in `.planning/WINDOWS.md` (id 70, waived) rather than left open. This verification's own new finding (the per-channel `monitor_release` incident spam) is a code-level defect confirmed by direct, reproducible empirical drive of the real production functions — not something requiring human judgment to resolve.

## Gaps Summary

Four of the five items the prior verification round set out to fix are genuinely closed, confirmed by direct code read and live re-run, not by trusting the SUMMARYs:

- **CR-01** (the sole prior Blocker): `handleRelease()` and `handleRecycleForRealBroker()` now both tear down a grant's live relay sessions before the kill, in delete-then-close order, closing the async-socket-close race that used to write a spurious or duplicate incident record on every ordinary release/recycle.
- **WR-01** (declare-before-lock-granted ordering): `text-tools.ts` now declares/clears the grant's operation strictly inside the granted lock, symmetric with the binary side, proven under real cross-channel contention. The code review's own WR-01 finding on the new test's mutex-leak risk is independently confirmed fixed.
- **The JAM sub-claim of Success Criterion 1**: now proven synthetically, deterministically and in CI for the relay's own guarantee, and the emulator-side non-reproduction is honestly measured and ledgered (WINDOWS id 70, waived) rather than left as an open human-verification item.
- **WINDOWS id 69** (REGISTER_INFO): measured and waived on the same principled basis.

But this re-verification's own independent, adversarial check — driving the real production functions directly rather than trusting that "the gap-closure plans' own tests pass" — found a new, unaddressed instance of the exact SAME class of defect this whole round exists to close: `handleMonitorRelease()`, the per-channel `monitor_release` handler that every ordinary text-tool call's `textDisconnect()` (and the binary channel's `stockDisconnect()`) invokes immediately around a client-side socket close, never tears down `state.relaySessions`. The result, confirmed by direct, reproducible drive of the real compiled broker code (not a mock, not an inference): a completely ordinary, successful text-channel tool call writes one incident record on completion. This means SESS-05 / ROADMAP Success Criterion 4 ("a routine, quiet release writes no incident") remains unmet in production, on the single most common code path in the whole tool surface — every text tool call — even though the grant-level release/recycle paths this round explicitly targeted are now correct. This is not new scope: it is the identical must-have (SESS-05's "routine release" clause) still failing, discovered via a code path none of the four gap-closure plans' own tests exercised.
