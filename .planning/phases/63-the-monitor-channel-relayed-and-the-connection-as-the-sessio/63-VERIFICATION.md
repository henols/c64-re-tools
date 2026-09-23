---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
verified: 2026-09-21T11:00:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
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
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-11-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-11-SUMMARY.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-12-PLAN.md"
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-12-SUMMARY.md"
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
  - "src/mcp/vice/stock-connect.test.ts"
  - "src/mcp/vice/stock-connect.ts"
  - "src/mcp/vice/stock-dispatch.ts"
  - "src/mcp/vice/stock-live-relay.test.ts"
  - "src/mcp/vice/text-connect.test.ts"
  - "src/mcp/vice/text-connect.ts"
  - "src/mcp/vice/text-tools.test.ts"
  - "src/mcp/vice/text-tools.ts"
  - "src/mcp/vice/vice-broker.mts"
covered_digest: "v1:sha256:4a4ffc99780b3d5e5557d5d53640a63846f911df30d3886ebdb3f4f33821df6e"
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "SESS-05 / ROADMAP Success Criterion 4 (per-channel monitor_release spurious incident): plan 63-11 added tearDownRelaySessionForChannel() and wired it into BOTH ok:true branches of handleMonitorRelease() (vice-broker.mts:1349-1368), deleting the state.relaySessions entry BEFORE calling the session's own close() -- confirmed by direct code read. Plan 63-12 reordered textDisconnect() (text-connect.ts:235) and stockDisconnect() (stock-connect.ts:598) to send releaseMonitor() inside a try block with safeDisconnect() in the matching finally -- release now reaches the broker while the socket is still up, confirmed by direct code read of both functions. The composed effect (broker tears down the map entry on release; caller sends release before closing) is what closes the defect: verified by independently re-running the six targeted test files (broker-relay.test.ts, broker-relay-text.test.ts, text-connect.test.ts, stock-connect.test.ts, broker-control.test.ts, broker-state.test.ts) live during this verification -- 242/242 pass, 0 fail. Also independently re-ran the full suite (4281 tests, 4197 pass, 0 fail, 84 skipped, exit 0, matching the claimed baseline exactly) and typecheck (exit 0) and resources-sync.test.ts (2/2 pass, resources/vice-broker.mjs confirmed byte-identical to a fresh build)."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
advisory: []
behavior_unverified_items: []
human_verification:
  - test: >-
      Decide whether WR-01 from 63-REVIEW.md (handleMonitorRelease()'s new
      no-current-holder branch unconditionally tearing down a live relay
      session it cannot prove is stale) is an acceptable residual risk or
      requires a further fix. To reproduce: arrange for a channel's
      per-channel holder record to be cleared (as broker-launch.mts's
      handleExit() does synchronously and unconditionally on every child
      process exit -- confirmed by direct read: it assigns
      `record.monitorClients = {}` and never touches `state.relaySessions`)
      while that channel's relay session is still live in
      `state.relaySessions`, then send a `monitor_release` for that exact
      (grant, channel) pair before the emulator socket's own asynchronous
      "close"/"error" event has been processed.
    expected: >-
      Per ROADMAP Success Criterion 4 ("a drop mid-operation leaves evidence
      before it leaves nothing"), a genuine crash/drop should always produce
      an incident record naming the operation that was in flight. Whether
      this specific interleaving (a client-initiated release racing a
      process-exit-triggered clear, ahead of the socket's own death
      notification) is reachable in production, and whether the current
      code silently absorbs that evidence when it is, needs a human decision
      -- either to accept it as an acceptably narrow edge case (no client
      legitimately races its own release against an unrelated crash
      notification in normal operation) or to require the fix 63-REVIEW.md
      already proposes (make handleExit() itself route the instance's live
      relay sessions through the evidence-writing path, or make
      handleMonitorRelease()'s no-current-holder branch require positive
      proof the clearing was a deliberate release rather than a crash,
      before it tears anything down).
    why_human: >-
      This is a structurally real but narrow race confirmed by direct code
      reading (handleExit() in broker-launch.mts never touches
      relaySessions; handleMonitorRelease()'s `!existing` branch in
      vice-broker.mts unconditionally calls tearDownRelaySessionForChannel()
      with no test exercising this exact interleaving in either direction).
      Its real-world reachability depends on event-loop timing between two
      independent async sources (a child process's "exit" event and a TCP
      socket's "close"/"error" event) that neither this codebase nor Node
      itself orders relative to each other, and on whether any production
      caller would plausibly send a release in that exact window -- a
      judgment call about acceptable risk versus required remediation, not
      a fact a grep or a single test run can settle.
---

# Phase 63: The Monitor Channel Relayed, and the Connection as the Session Verification Report

**Phase Goal:** Every `vice_*` tool call reaches the emulator over a connection
the broker relays rather than a socket the client dialled itself, and the
broker — not the client — owns holding and reclaiming that session. The
connection IS the session: when the socket dies the instance is reclaimed,
whatever killed the client.

**Verified:** 2026-09-21T11:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure round two (plans 63-11, 63-12)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The relay is byte-transparent for a register read, a memory write, a checkpoint hit and a JAM (SC1, SESS-02) | ✓ VERIFIED | Unchanged from prior verification. Independently re-ran the full suite this round (4281/4197/0/84, exit 0) confirming no regression in `broker-relay.test.ts`'s JAM cases or `stock-live-relay.test.ts`'s WINDOWS-waived measurement. |
| 2 | Two call shapes each hold exactly what they should: an MCP server's connection holds its instance for the socket's life; a skill script's stateless call binds no lease (SESS-01, SESS-02) | ✓ VERIFIED | Unchanged from prior verification. |
| 3 | A client killed with SIGKILL is reclaimed from socket events alone, and a client producing no FIN is detected within a bounded time (SESS-03, SESS-04) | ✓ VERIFIED | Unchanged from prior verification. |
| 4 | **A per-channel `monitor_release` tears down its own live relay session, so the client-side socket close that follows it finds the map entry already gone — a routine, successful text- or binary-channel tool call writes no incident record** (SC4, SESS-05 — the Blocker this round targeted) | ✓ VERIFIED | Composed fix confirmed by direct code read of BOTH halves: `handleMonitorRelease()` (`vice-broker.mts:1349-1368`) calls the new `tearDownRelaySessionForChannel()` on both `ok:true` paths, delete-before-close, strictly before `clearMonitorClient()`; `textDisconnect()` (`text-connect.ts:235`) and `stockDisconnect()` (`stock-connect.ts:598`) each send `releaseMonitor()` inside a `try` with `safeDisconnect()` in the matching `finally`, so the release reaches the broker while the socket is still up. Independently re-ran the six targeted test files live (242/242 pass) and the full suite (4281/4197/0/84, exit 0, matching the claimed baseline exactly) and typecheck (exit 0). |
| 5 | When a connection drops mid-operation, an incident record exists before the instance is reclaimed, carrying a broker-minted reason naming the operation that was in flight, and any live capture/checkpoint run is marked void (SC4, SESS-05) | ✓ VERIFIED, with one flagged residual concern | The grant-level release/recycle path (round-one CR-01 fix) and the `operation`/`voided` field wiring (`broker-incident.mts`'s `voided = operationName !== null`) are unchanged and still correct. **63-REVIEW.md's WR-01, independently confirmed by direct code read**, identifies a structurally real but narrow new race: `handleMonitorRelease()`'s no-current-holder branch now unconditionally tears down a relay session it cannot prove is stale, and `broker-launch.mts`'s `handleExit()` clears `monitorClients` synchronously on every exit (crash included) without ever touching `relaySessions` — confirmed by direct read (`grep -n relaySessions broker-launch.mts` returns zero hits). No test in either direction exercises this specific interleaving. Routed to human verification below rather than silently passed or silently failed. |
| 6 | A user can tell which live session is their own from broker status, without guessing from port numbers, and the label carries no authority (SESS-06) | ✓ VERIFIED | Unchanged from prior verification. |

**Score:** 6/6 truths verified (1 carries a flagged, human-decision-required residual concern — see Human Verification Required below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/vice-broker.mts` — `tearDownRelaySessionForChannel()` | The ONE delete-before-close primitive for exactly one (grant, channel) pair, called by both `tearDownRelaySessionsForGrant()`'s loop and `handleMonitorRelease()` | ✓ VERIFIED | Confirmed present at `vice-broker.mts:1211` by direct read; deletes the map entry before calling `session.close()`; `tearDownRelaySessionsForGrant()` re-expressed as a one-line loop over `MONITOR_CHANNELS` calling it |
| `src/mcp/vice/vice-broker.mts` — `handleMonitorRelease()` | Tears down the released channel's own live relay session on both `ok:true` paths, and on neither refusal | ✓ VERIFIED | Confirmed present at `vice-broker.mts:1349-1368` by direct read — calls `tearDownRelaySessionForChannel()` on the already-cleared (`!existing`) path and on the holder-matches path (strictly before `clearMonitorClient()`); neither `denied` nor `bad_request` reaches it |
| `src/mcp/vice/text-connect.ts` — `textDisconnect()` | Releases the per-channel claim BEFORE disconnecting, with the disconnect guaranteed regardless of the release outcome | ✓ VERIFIED | Confirmed present at `text-connect.ts:235-246` by direct read — `releaseMonitor()` in `try`, `safeDisconnect()` in `finally` |
| `src/mcp/vice/stock-connect.ts` — `stockDisconnect()` | Mirrors `textDisconnect()`'s reorder for the binary channel | ✓ VERIFIED | Confirmed present at `stock-connect.ts:598-609` by direct read — identical try/finally shape |
| `src/mcp/vice/broker-relay-text.test.ts` — end-to-end 63-11 case | A real claim/attach/command/release/close round trip asserting zero incident files | ✓ VERIFIED | Confirmed present; re-run live, passes |
| `src/mcp/vice/broker-relay.test.ts` — 63-11 per-channel contract cases | Isolation, recorded delete-before-close order, no-session, idempotent-repeat, two refused-release cases | ✓ VERIFIED | Confirmed present (6 new cases); re-run live, all pass |
| `src/mcp/vice/text-connect.test.ts` / `stock-connect.test.ts` — 63-12 ordering cases | Release-before-close (proven from inside a stub's own `releaseMonitor`), refused-release, throwing-release, per channel | ✓ VERIFIED | Confirmed present (3 cases each); re-run live, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `handleMonitorRelease()` | `tearDownRelaySessionForChannel()` | Called on both `ok:true` paths, delete-before-close, strictly before `clearMonitorClient()` | ✓ WIRED | Confirmed by direct read |
| `textDisconnect()` / `stockDisconnect()` | `releaseMonitor()` → `handleMonitorRelease()` (via broker control) | `releaseMonitor()` sent inside `try`, socket close in matching `finally` — release reaches the broker while the socket is still up | ✓ WIRED | Confirmed by direct read of both functions; the composed ordering (caller sends release first; broker tears down on receipt) is what the six independently re-run 63-11/63-12 test files exercise in decomposed form, and what my own direct trace of both source files confirms end-to-end |
| `resources/vice-broker.mjs` | `vice-broker.mts` | Rebuilt, byte-identical | ✓ WIRED | `resources-sync.test.ts` re-run live: 2/2 pass |
| **`broker-launch.mts`'s `handleExit()`** | **`state.relaySessions`** | **Expected: some accounting for a live relay session when the underlying process exits (crash included)** | **✗ NOT WIRED (flagged, not a Blocker)** | **Confirmed by direct read: `handleExit()` clears `record.monitorClients = {}` synchronously and unconditionally but never touches `state.relaySessions` at all — a crash's own relay-death evidence still depends entirely on the emulator socket's own asynchronous "close"/"error" event reaching `handleRelayDeath()` first. See WR-01 in Human Verification Required.** |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| The six files this round changed are green in isolation | `node --test broker-relay.test.ts broker-relay-text.test.ts text-connect.test.ts stock-connect.test.ts broker-control.test.ts broker-state.test.ts` (re-run live during this verification) | 242 tests, 242 pass, 0 fail | ✓ PASS |
| `resources/` carries no drift from `vice-broker.mts`/`broker-state.mts` | `node --test resources-sync.test.ts` (re-run live) | 2 tests, 2 pass, 0 fail | ✓ PASS |
| Full automated suite is green | `npm --prefix src/mcp/vice test` (re-run live, redirected, `$?` read same line) | 4281 tests, 4197 pass, 0 fail, 84 skipped, exit 0 — matches the independently-measured baseline exactly | ✓ PASS |
| `npm --prefix src/mcp/vice run typecheck` (re-run live) | — | exit 0, no errors | ✓ PASS |
| No unresolved debt markers in this round's touched files | `grep -nE "TBD\|FIXME\|XXX"` across `vice-broker.mts`, `broker-state.mts`, `text-connect.ts`, `stock-connect.ts`, and their four test files | No matches | ✓ PASS |
| The composed fix's caller→broker chain, traced by hand rather than trusted from a SUMMARY | Direct read of `textDisconnect()`/`stockDisconnect()` (release-then-finally-close) composed with direct read of `handleMonitorRelease()` (tears down before returning `ok`) | The sequence textDisconnect() → releaseMonitor() → handleMonitorRelease() → tearDownRelaySessionForChannel() (deletes map entry, closes session) → safeDisconnect() (client-side close) → handleRelayDeath() finds no entry, writes nothing — is unambiguous from source on both ends | ✓ PASS (traced, not executed as one combined test — see WR-03 below) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SESS-01 | Stateless skill-script call binds no lease | ✓ SATISFIED | Unchanged |
| SESS-02 | MCP server connection holds its instance for the socket's life; relay is byte-transparent (including JAM) | ✓ SATISFIED | Unchanged |
| SESS-03 | Broker reclaims from socket events alone | ✓ SATISFIED | Unchanged |
| SESS-04 | A client producing no FIN is detected within a bounded time | ✓ SATISFIED | Unchanged |
| SESS-05 | Incident record written before reclaim, naming the in-flight operation; a routine release writes no incident | ✓ SATISFIED (with a flagged residual concern, WR-01, requiring a human decision — not a functional block) | The specific Blocker this re-verification round targeted (per-channel `monitor_release` never tearing down `state.relaySessions`, producing a spurious incident on every ordinary text-tool call) is confirmed closed by the composed fix (plans 63-11 + 63-12). A narrower, newly-introduced race (WR-01) around a crash racing a client-initiated release is confirmed real by direct code reading, unreproduced by any test, and left open for a human decision on acceptable risk vs. required remediation. |
| SESS-06 | User can identify their own session in shared-broker status | ✓ SATISFIED | Unchanged |

REQUIREMENTS.md marks all six as `Complete` (`.planning/REQUIREMENTS.md:59-64,157-162`). This verification does not recommend reverting any of the six: the specific Blocker the prior verification flagged is now genuinely closed, and the residual WR-01 concern is narrow enough, and sufficiently distinct from the originally-blocked behavior, that it is reported as a flagged decision item rather than grounds to un-complete SESS-05.

No orphaned requirements found: all six requirement IDs declared across the phase's twelve plans map onto REQUIREMENTS.md's Phase 63 row, and no other REQUIREMENTS.md row cites Phase 63.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/vice-broker.mts` | 1354-1363 | `handleMonitorRelease()`'s no-current-holder branch tears down a relay session it cannot prove is stale, and cannot distinguish "a prior release already ran" from "the emulator just crashed" (63-REVIEW.md WR-01, independently confirmed here) | ⚠️ Warning (flagged for human decision, not a Blocker — see Human Verification Required) | A crash racing a client's own in-flight release for the exact same channel, in the narrow window between `handleExit()`'s synchronous `monitorClients` clear and the emulator socket's own asynchronous close event, could absorb what should have been a recorded incident |
| `src/mcp/vice/broker-relay-text.test.ts` | 291-293 | Stale test comment claims "production still runs close-then-release until [plan 63-12] lands" — plan 63-12 has already landed in this same commit set (63-REVIEW.md WR-02, independently confirmed: `text-connect.ts`/`stock-connect.ts` both run release-then-close today) | ⚠️ Warning | Misleads a future reader into believing production still runs the old, buggy order; purely a documentation defect, no functional impact |
| `src/mcp/vice/broker-relay.test.ts`, `broker-relay-text.test.ts`, `text-connect.test.ts`, `stock-connect.test.ts` | various | No single automated test drives the REAL `textDisconnect()`/`stockDisconnect()` against a REAL broker with a REAL `writeBrokerIncident()`, asserting zero incident files end-to-end (63-REVIEW.md WR-03, independently confirmed: the decomposed proof exists across two test files but not combined) | ⚠️ Warning | The composed behavior is provably correct by direct code trace (this report's own spot-check above) and by two decomposed test suites, but a future edit that breaks the seam between them (e.g. changing `releaseMonitor()`'s wire shape on one side only) would not be caught by any single existing test |

### Human Verification Required

1. **WR-01 residual risk decision** (see frontmatter `human_verification` for full detail) — Decide whether the crash-races-a-release window in `handleMonitorRelease()`'s no-current-holder branch is an acceptable residual risk or requires a further fix (either routing `handleExit()`'s own relay sessions through the evidence-writing path, or gating the no-current-holder teardown on positive proof the clearing was a deliberate release rather than a crash).

## Gaps Summary

This re-verification's mandate was narrow and explicit: confirm or reject the COMPOSED fix for the Blocker the prior round found (`handleMonitorRelease()` never tearing down `state.relaySessions`, so every ordinary text-tool call wrote a spurious incident record). That fix is genuinely closed:

- **Broker side (63-11):** `tearDownRelaySessionForChannel()` is a real, correctly-ordered (delete-before-close) primitive, wired into both `ok:true` branches of `handleMonitorRelease()`, confirmed by direct code read at `vice-broker.mts:1211` and `:1349-1368`.
- **Caller side (63-12):** `textDisconnect()` and `stockDisconnect()` both send the release inside a `try` with the socket close in the matching `finally`, confirmed by direct code read at `text-connect.ts:235-246` and `stock-connect.ts:598-609`.
- **Composed:** the ordering now guarantees the broker's map entry is gone before the client-side socket close event can re-enter `handleRelayDeath()`. Traced by hand end-to-end above, and exercised in decomposed form by 242/242 passing tests across the six touched files, plus a clean full-suite run (4281/4197/0/84, exit 0) and clean typecheck — all independently re-run during this verification, not merely read from a SUMMARY.

The fresh code review (63-REVIEW.md) surfaced three findings I independently confirmed against source rather than accepting on the review's word alone:

- **WR-01** is real and narrow: `handleMonitorRelease()`'s no-current-holder branch now unconditionally tears down a live relay session, and `handleExit()` (crash path) never touches `relaySessions` at all — a race between the two could silently swallow a genuine crash's incident. This is a NEW interaction introduced by this exact round's own fix (no prior version of `handleMonitorRelease()` ever touched `relaySessions` on this branch), it is unreproduced by any test in either direction, and its real-world reachability is a judgment call about event-loop timing and realistic client behavior — routed to human verification rather than silently passed or used to revert this round's genuine progress to `gaps_found`.
- **WR-02** (stale test comment) and **WR-03** (no single combined end-to-end test) are both confirmed real but are documentation/coverage gaps, not functional defects — the underlying behavior is correct by direct trace and decomposed test evidence. Listed as Warnings, not gaps.

No item from the previous `gaps:` list remains open. No regression was found in any of the five previously-verified truths.
