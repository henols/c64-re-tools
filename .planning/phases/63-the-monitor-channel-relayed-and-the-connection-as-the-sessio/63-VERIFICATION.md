---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
verified: 2026-09-20T12:00:00Z
status: gaps_found
score: 4/6 must-haves verified
behavior_unverified: 1
covered_files:
  - ".planning/REQUIREMENTS.md"
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
  - ".planning/phases/63-the-monitor-channel-relayed-and-the-connection-as-the-sessio/63-REVIEW.md"
  - "src/mcp/vice/README.md"
  - "src/mcp/vice/broker-control.mts"
  - "src/mcp/vice/broker-endpoint.ts"
  - "src/mcp/vice/broker-incident.mts"
  - "src/mcp/vice/broker-launch.mts"
  - "src/mcp/vice/broker-relay.mts"
  - "src/mcp/vice/broker-state.mts"
  - "src/mcp/vice/build.ts"
  - "src/mcp/vice/resources/broker-control.mjs"
  - "src/mcp/vice/resources/broker-incident.mjs"
  - "src/mcp/vice/resources/broker-launch.mjs"
  - "src/mcp/vice/resources/broker-relay.mjs"
  - "src/mcp/vice/resources/broker-state.mjs"
  - "src/mcp/vice/resources/vice-broker.mjs"
  - "src/mcp/vice/stock-connect.ts"
  - "src/mcp/vice/stock-dispatch.ts"
  - "src/mcp/vice/stock-protocol.ts"
  - "src/mcp/vice/test-gate.mjs"
  - "src/mcp/vice/text-connect.ts"
  - "src/mcp/vice/text-protocol.ts"
  - "src/mcp/vice/text-tools.ts"
  - "src/mcp/vice/tsconfig.build.json"
  - "src/mcp/vice/vice-broker-client.ts"
  - "src/mcp/vice/vice-broker.mts"
covered_digest: "v1:sha256:26caac23b3656df8561c54a9f97a6ccb3b56974b46da214e8179a2cdb8531cf3"
behavior_unverified_items:
  - truth: "A JAM behaves exactly the same over the relay as over a direct dial (ROADMAP Success Criterion 1, part of SESS-02)"
    test: "Launch genuine stock VICE, write the KIL opcode plus the JAM target PC over the relay, resume, and wait for the unsolicited JAM (0x61) event within a bounded window."
    expected: "A JAM (0x61) event arrives, matching the documented zero-length-body shape, the same as a direct dial would produce."
    why_human: "Plan 63-06's own live run against genuine stock VICE 3.9 (/usr/bin/x64sc) performed exactly this and no JAM event arrived within 5s under the project's default JamAction, even though the KIL-opcode write and the PC write were independently verified correct by read-back. This narrows Success Criterion 1's stated claim and is already recorded open in .planning/WINDOWS.md (id 70) pending human disposition — accept as a documented stock-VICE protocol nuance unrelated to the relay, or schedule a follow-up plan threading a -jamaction launch override. A related, separate live non-reproduction (the REGISTER_INFO dump-on-open not observed over the relay's second connection) is WINDOWS id 69 and is a lower-severity, plausibly harness-shape-specific finding (a diagnostic REGISTERS_GET succeeded over the same relay connection immediately afterward, proving the pipe itself is intact)."
gaps:
  - truth: "A relay death's incident record is durably on disk before any claim is released, any socket is destroyed or any kill signal is sent; a second, concurrent drop for the same grant and channel finds the teardown already in progress and writes no second record (63-04-PLAN.md must_have, SESS-05); a grant with nothing declared writes no incident on an ordinary release (vice-broker.mts's own documented invariant, quoted in 63-REVIEW.md CR-01)"
    status: failed
    reason: >-
      handleRelease() (vice-broker.mts:1479) and handleRecycleForRealBroker()
      (vice-broker.mts:1344) both clear the per-channel monitor claim and
      delete the grant/instance records, but neither ever removes the
      grant's entries from state.relaySessions. state.relaySessions is
      written only in handleRelayAttach() and deleted only inside
      handleRelayDeath(). Killing the emulator process eventually closes the
      relay's emulatorSocket, which asynchronously fires
      handleRelayDeath(targetId, channel, trigger, state) — by which time
      handleRelease() has already deleted state.grants[targetId] and
      state.instances[port] synchronously. handleRelayDeath() therefore does
      NOT find its early-return "already torn down" condition (session is
      still present in the map) and proceeds to write a second incident
      record with grant/instance already gone (operation: null, port: null,
      epoch_before: null) for every ordinary release or recycle of a
      session that ever attached a monitor channel — contradicting the
      module's own documented invariant "a grant with NOTHING declared
      writes nothing: a routine, quiet release is not an incident," and
      violating 63-04's own explicit must_have that a second drop for the
      same grant+channel writes no second record. Independently confirmed
      by direct code trace (this verification) and by inspection of
      broker-relay.test.ts's own setupBrokerState() helper, which never
      populates state.relaySessions before exercising any of the three
      handleRelease() test cases — so none of Plan 63-04's own tests can
      observe this path. Also leaves the relay session's live handle
      (sockets, idle timer) un-torn-down by the deliberate-teardown paths,
      relying solely on the emulator kill's own socket close to eventually
      trigger cleanup.
    artifacts:
      - path: "src/mcp/vice/vice-broker.mts"
        issue: "handleRelease() (line ~1479) and handleRecycleForRealBroker() (line ~1344) never touch state.relaySessions; only handleRelayDeath() (line ~1139) ever deletes from it."
      - path: "src/mcp/vice/broker-relay.test.ts"
        issue: "setupBrokerState() (used by all three handleRelease() tests) never populates state.relaySessions, so the async-relay-death-after-release scenario is untested."
    missing:
      - "Before (or instead of relying solely on) killing the process, handleRelease() and handleRecycleForRealBroker() should proactively remove and close any live state.relaySessions entries for the grant's channels (e.g. iterate MONITOR_CHANNELS, delete relaySessionKey(targetId, ch), call that session's own close()) before deleting the grant/instance records, so the later async socket close finds state.relaySessions already empty and handleRelayDeath()'s own early-return fires as designed."
      - "A test that attaches a relay, then releases (or recycles) the grant, and asserts no incident record is written and state.relaySessions is empty afterward."
      - "Separately (WR-01, lower severity, same evidence-attribution concern): text-tools.ts's withTextTool() calls noteOperation() BEFORE withTextChannelLock() grants the shared cross-channel mutex, while stock-dispatch.ts's withChannelLockHeld() declares only AFTER the lock is held — confirmed present in both files by direct read. Under a genuinely concurrent binary+text call on one grant, the queued-but-not-yet-running text operation can overwrite (or be overwritten by) the actually-running binary operation's declaration, so a relay death at that moment can attribute the incident to the wrong operation. Fix: declare the text-channel operation only once the lock is actually granted, mirroring stock-dispatch.ts's ordering."
deferred: []
advisory: []
human_verification:
  - test: "Trigger a genuine machine JAM against real stock VICE over the relay under the project's default launch argv (no -jamaction override) and observe whether a JAM (0x61) event ever arrives."
    expected: "Either a JAM event arrives (Success Criterion 1 fully holds) or a developer accepts WINDOWS.md id 70 as a documented stock-VICE behavior nuance not caused by the relay."
    why_human: "Plan 63-06's own live run against genuine stock VICE 3.9 measured no JAM event within 5 seconds despite correct opcode/PC writes; this needs a human disposition (accept vs. schedule a -jamaction follow-up), not an automated verdict."
---

# Phase 63: The Monitor Channel Relayed, and the Connection as the Session Verification Report

**Phase Goal:** Every `vice_*` tool call reaches the emulator over a connection the
broker relays rather than a socket the client dialled itself, and the broker — not
the client — owns holding and reclaiming that session. The connection IS the
session: when the socket dies the instance is reclaimed, whatever killed the client.

**Verified:** 2026-09-20T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The relay is byte-transparent for a register read, a memory write and a checkpoint hit (SC1, SESS-02) | ✓ VERIFIED | `broker-relay.mts`'s `spliceRelay()` pipes both legs with `Socket.prototype.pipe()`, never a decode (code read, `broker-relay.mts:392-394`); 11+ synthetic tests in `broker-relay.test.ts` (tracer, two mode boundaries, non-UTF-8 byte runs, concurrency); live proof against genuine stock VICE 3.9 (`/usr/bin/x64sc`) in `stock-live-relay.test.ts` recorded real observed values for register read (10 registers decoded), memory write/read-back (exact Buffer equality) and a checkpoint hit (`hitCount: 1`) — 63-06-SUMMARY.md "Live-run evidence" section |
| 2 | The relay is byte-transparent for a JAM the same way it is for the other three frame kinds (SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Live run performed exactly this against genuine stock VICE 3.9 and no JAM (0x61) event arrived within 5s despite a verified-correct KIL-opcode write and PC write (read back before resuming). Recorded honestly, not asserted away — `.planning/WINDOWS.md` id 70 (`open`), 63-06-SUMMARY.md "Known Findings" §2. Routed to Human Verification below. |
| 3 | Two call shapes each hold exactly what they should: an MCP server's connection holds its instance for the socket's life; a skill script's stateless call binds no lease (SESS-01, SESS-02) | ✓ VERIFIED | `broker-control.test.ts`'s "stateless call (63-05, SESS-01)" case: a `host_tool` request fires none of the seven lease-bearing callbacks across 10 repetitions and leaves broker status byte-identical; `host-tool-transport.test.ts`'s structural proof that `host-tool-client.ts` opens exactly one connection, writes exactly one request line, holds no module-level session handle. "Two sessions, one broker" test proves two unrelated grants are held and reclaimed independently. |
| 4 | A client killed with SIGKILL (no goodbye at all) is reclaimed from socket events alone, and a client producing no FIN is detected within a bounded time rather than the OS's ~2-hour keepalive default (SESS-03, SESS-04) | ✓ VERIFIED | `broker-relay.mts`'s death classification uses Node's own `"close"` event `hadError` boolean (measured against a real loopback probe — `.destroy()`/`.end()` are otherwise indistinguishable); `ArmIdleTimerFn`/`defaultArmIdleTimer` fires at-or-past a configured bound, resets on any byte, suspends/resumes on a declared operation; `resolveRelayIdleMs()`/`resolveRelayKeepAliveMs()` never disable the bound and log a rejected override. 17+ tests in `broker-relay.test.ts`/`broker-relay-text.test.ts` cover the abrupt/graceful/idle-expiry/racing-triggers/two-channel cases (63-04-SUMMARY.md D1-D4, D7). |
| 5 | When a connection drops mid-operation, an incident record exists **before** the instance is reclaimed, carrying a broker-minted reason naming the operation that was in flight, and a routine, quiet release writes no incident (SC4, SESS-05) | ✗ FAILED | `handleRelayDeath()` itself (vice-broker.mts:1105-1147) correctly orders evidence-then-release for a *direct* relay death. But `handleRelease()`/`handleRecycleForRealBroker()` never clear `state.relaySessions`, so the emulator-kill's later, asynchronous socket close re-enters `handleRelayDeath()` against an already-deleted grant/instance, writing a second, content-empty incident record for essentially every ordinary release/recycle that ever attached a channel — confirmed by direct code trace and by `broker-relay.test.ts`'s own `setupBrokerState()` never populating `state.relaySessions` for any of the three `handleRelease()` tests. This is 63-REVIEW.md's CR-01, independently reproduced here. See Gaps below. |
| 6 | A user can tell which live session is their own from broker status, without guessing from port numbers, and the label carries no authority (SESS-06) | ✓ VERIFIED | `resolveSessionLabel()` (CLAUDE_CODE_SESSION_ID, else cwd-basename+pid); `sanitiseSessionLabel()` strips control characters and caps length; `StatusInstanceEntry.sessionLabel/grantId/operation` resolved via `findOwningGrant()`'s `(port, pid)` identity match; T-63-17 invariant test proves every target-naming op refuses another session's label used as a target id, byte-identical to a bare garbage target id; live run confirmed `status`'s reported label matched the live process's own `resolveSessionLabel()` output against a real spawned broker (63-05-SUMMARY.md D1-D6, 63-06-SUMMARY.md "Status identity"). |

**Score:** 4/6 truths verified (1 present, behavior-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/broker-relay.mts` | Byte-transparent splice, idle deadline, death classification | ✓ VERIFIED | `spliceRelay()`, `RelaySession.close()`, `ArmIdleTimerFn`, `resolveRelayIdleMs()`/`resolveRelayKeepAliveMs()` all present, exported, and exercised by tests; confirmed by direct read |
| `src/mcp/vice/broker-control.mts` | `attach` and `operation` control ops, `sanitiseSessionLabel()` | ✓ VERIFIED | Both ops present and dispatched after the token gate; `sanitiseSessionLabel()` exported and unit-tested |
| `src/mcp/vice/broker-incident.mts` | Host-bound atomic incident writer rooted at the machine-level incidents directory | ✓ VERIFIED | `writeBrokerIncident()`/`renderBrokerIncident()`/`brokerIncidentPath()` present; atomic tmp-then-rename write; 15 tests in `broker-incident.test.ts` including a vocabulary-sync case against `incident-record.ts` |
| `src/mcp/vice/vice-broker.mts` | `handleRelayDeath()` (evidence-before-reclaim), `handleRelease()`/`handleRecycleForRealBroker()` extended with the same evidence step | ⚠️ ORPHANED WIRING | `handleRelayDeath()` itself is correctly ordered and wired as the sole production caller of `writeBrokerIncident()` for a direct relay death. `handleRelease()`/`handleRecycleForRealBroker()` were extended with their own evidence step for the *synchronous* control-connection-close case, but the sibling cleanup (clearing `state.relaySessions` before the process is killed) was never added — see Gaps |
| `src/mcp/vice/text-protocol.ts`, `src/mcp/vice/stock-protocol.ts` | Socket-injection `attach(socket, opts)` beside `connect(host, port)` | ✓ VERIFIED | Both present, mirrored shape, exercised by dedicated unit tests |
| `src/mcp/vice/stock-live-relay.test.ts` | Opt-in, default-skipped live byte-transparency proof against genuine stock VICE | ✓ VERIFIED (with disclosed findings) | Present, three-way skip guard confirmed (unset / bad path / armed), registered in `test-gate.mjs`'s `MANUAL_ONLY_TESTS`; live run performed and recorded per-shape observed values; two sub-claims (JAM, register dump-on-open) genuinely did not reproduce and are disclosed, not hidden |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-connect.ts` | `broker-endpoint.ts` | `StockConnectDeps.dialMonitorSocket` → `dialMonitorRelay()` | ✓ WIRED | Confirmed: production default dials the relay, never a direct socket to the emulator's own port |
| `text-connect.ts` | `broker-endpoint.ts` | `TextConnectOptions.dialMonitorSocket` → `dialMonitorRelay(RELAY_TAG_TEXT, ...)` | ✓ WIRED | Confirmed; `resolveRelayChannelTarget()` reads `remoteMonitorPort` for text, refuses rather than falls back to the binary port |
| `stock-dispatch.ts` / `text-tools.ts` | `vice-broker-client.ts` | `noteOperation()` fire-and-forget over the lease's own control session | ⚠️ PARTIAL (ordering) | Wired and functioning for the common case, but declare-order is asymmetric between the two channels (WR-01) — see Gaps' second item |
| `vice-broker.mts` (`handleRelayDeath`) | `broker-incident.mts` | `writeBrokerIncident()` called before `state.relaySessions.delete()`/`clearClaim()`/`session.close()` | ✓ WIRED | Confirmed by direct code read: the ordering inside `handleRelayDeath()` itself is exactly as documented |
| `vice-broker.mts` (`handleRelease`, `handleRecycleForRealBroker`) | `broker-relay.mts` (`state.relaySessions`) | Expected: proactive close/removal of any live relay session before the grant/instance is deleted | ✗ NOT WIRED | Confirmed absent — see Gaps |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite is green | `npm test` (full glob), redirected, `$?` read same line | 4255 tests, 4173 pass, 0 fail, 82 skipped, exit 0 (orchestrator-measured, consistent with 63-06-SUMMARY's own re-run) | ✓ PASS |
| `handleRelease()` never clears `state.relaySessions` | `grep -n "relaySessions" src/mcp/vice/vice-broker.mts` | Only two call sites: `.set()` in `handleRelayAttach()`, `.delete()` in `handleRelayDeath()`; zero references inside `handleRelease()`/`handleRecycleForRealBroker()` | ✓ PASS (confirms the gap) |
| `handleRelease()`'s own tests never populate `state.relaySessions` | Direct read of `broker-relay.test.ts`'s `setupBrokerState()` and all three `handleRelease` tests | `setupBrokerState()` builds only `instances`/`grants`; none of the three tests touch `relaySessions` | ✓ PASS (confirms the gap is untested) |
| `text-tools.ts` declares the operation before the shared lock is granted | Direct read of `text-tools.ts:158-160` vs. `stock-dispatch.ts:550-557` | `noteOperation()` call precedes `withTextChannelLock()` in `text-tools.ts`; `declareOperation()` follows `acquireChannelLock()` in `stock-dispatch.ts` | ✓ PASS (confirms WR-01) |
| No unresolved debt markers in phase-touched implementation files | `grep -nE "TBD|FIXME|XXX"` across all 14 non-test implementation files this phase modified | No matches | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SESS-01 | Stateless skill-script call binds no lease | ✓ SATISFIED | 63-05-SUMMARY.md D6; `broker-control.test.ts`'s stateless-call case |
| SESS-02 | MCP server connection holds its instance for the socket's life; relay is byte-transparent | ✓ SATISFIED (register/memory/checkpoint) / ⚠️ NEEDS HUMAN (JAM sub-claim) | 63-01/63-02/63-06 SUMMARYs; WINDOWS.md id 69/70 |
| SESS-03 | Broker reclaims from socket events alone (SIGKILL with no goodbye) | ✓ SATISFIED | 63-04-SUMMARY.md D1, D2, D7 |
| SESS-04 | A client producing no FIN is detected within a bounded time | ✓ SATISFIED | 63-04-SUMMARY.md D3, D4 |
| SESS-05 | Incident record written before reclaim, naming the in-flight operation | ✗ BLOCKED | CR-01 (this verification's Gaps section) — the mechanism is correct for a direct relay death but produces spurious/duplicate records on ordinary release/recycle, and the accompanying WR-01 declare-order race can misattribute the named operation under concurrent binary+text calls |
| SESS-06 | User can identify their own session in shared-broker status | ✓ SATISFIED | 63-05-SUMMARY.md D1-D5; 63-06-SUMMARY.md live status-identity observation |

REQUIREMENTS.md marks all six as `Complete`; this verification finds SESS-05 not actually satisfied end-to-end and recommends REQUIREMENTS.md be reverted for SESS-05 pending the gap closure (SESS-01/02/03/04/06 stand).

No orphaned requirements found: all six requirement IDs declared across the phase's six plans map onto REQUIREMENTS.md's Phase 63 row, and no other REQUIREMENTS.md row cites Phase 63.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/vice-broker.mts` | 1479, 1344 | Missing cleanup: `handleRelease()`/`handleRecycleForRealBroker()` never remove the grant's `state.relaySessions` entries before killing the process | 🛑 Blocker | Produces a spurious or duplicate incident record on essentially every ordinary release/recycle of a session that ever attached a monitor channel (CR-01) |
| `src/mcp/vice/text-tools.ts` | 158 (vs. `stock-dispatch.ts:550-557`) | Declare-before-lock-granted ordering asymmetry between the two channel wrappers | ⚠️ Warning | Can misattribute an incident's named operation under a genuinely concurrent binary+text call on one grant (WR-01, code-review-confirmed, still present) |
| `src/mcp/vice/broker-relay.mts` | 46-107 | `readAttachLine()`/`MAX_ATTACH_LINE_BYTES` are dead code whose own header comments assert a call relationship to `broker-control.mts` that does not exist; two independently-declared 65536-byte caps with no sync test | ⚠️ Warning | Not load-bearing today (values coincidentally match), but a future editor changing one believing it governs the real parser will silently fail to change actual behavior (WR-02, code-review-confirmed) |
| `src/mcp/vice/broker-endpoint.ts` | 614-654 | `performAttach()`'s client-side reply-accumulation buffer has no byte cap, unlike its server-side counterpart, relying solely on the 2s reply timeout | ℹ️ Info / low-severity Warning | Asymmetric application of an otherwise-enforced discipline on a same-host, trusted connection (WR-03, code-review-confirmed) |

### Human Verification Required

### 1. Machine JAM over the relay against genuine stock VICE

**Test:** Launch genuine stock VICE through the broker, attach the relay, write the KIL opcode and the JAM target PC, resume, and wait for the unsolicited JAM (0x61) event.
**Expected:** A JAM event arrives with the documented zero-length body, the same as a direct dial produces — or a developer accepts this as a stock-VICE default-JamAction behavior unrelated to the relay itself.
**Why human:** Plan 63-06's own live run against `/usr/bin/x64sc` (genuine, unpatched stock VICE 3.9) measured no JAM event within 5 seconds despite independently-verified-correct opcode and PC writes. This is already disclosed and WINDOWS-ledgered (id 70, `open`) rather than hidden, but it directly narrows Success Criterion 1's stated claim ("...and a JAM all behave exactly as they did over the direct dial") and needs a human disposition, not an automated verdict.

## Gaps Summary

One Blocker (CR-01, independently reproduced by this verification through direct code trace, not merely restated from the code review) prevents this phase's SESS-05 requirement — and by extension ROADMAP Success Criterion 4 — from being considered fully achieved: `handleRelease()` and `handleRecycleForRealBroker()` never clear `state.relaySessions`, so the asynchronous socket-close that follows a routine, deliberate release or recycle re-enters `handleRelayDeath()` against already-deleted state and writes a spurious or duplicate incident record. This contradicts the module's own documented design invariant ("a routine, quiet release is not an incident") and 63-04-PLAN.md's own explicit must_have that a second drop for the same grant and channel writes no second record. A related, lower-severity ordering asymmetry (WR-01, also independently confirmed) means the named operation in an incident record can be misattributed under a genuinely concurrent binary+text tool call.

Separately, one Success-Criterion-1 sub-claim (JAM byte-transparency specifically) was attempted live against genuine stock VICE and genuinely did not reproduce; this is honestly disclosed by the executing plan (not asserted away) and is routed here as a human-verification item rather than a code defect, since the KIL-opcode/PC writes were independently verified correct and the relay's own byte-transparent pipe was separately proven intact for real command/reply traffic immediately afterward.

Everything else — the byte-transparent splice for the other three wire shapes, the two call-shape distinction (SESS-01/02), socket-event-only reclaim with a bounded idle deadline (SESS-03/04), and the session-label identity/non-authority mechanism (SESS-06) — is verified against the actual codebase with both synthetic and, where applicable, live evidence, and is not merely asserted by the SUMMARYs.

---

*Verified: 2026-09-20T12:00:00Z*
*Verifier: Claude (gsd-verifier)*
