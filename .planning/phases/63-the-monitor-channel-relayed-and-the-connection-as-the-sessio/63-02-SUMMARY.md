---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
plan: 02
subsystem: infra
tags: [vice-mcp, text-monitor, tcp-relay, broker-control-plane, text-connect, reconnect-policy]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "01"
    provides: "broker-relay.mts's dialMonitorRelay()/spliceRelay()/readAttachLine(), the attach control op, the per-claim handle, stock-protocol.ts's attach(socket) entry point, StockConnectDeps.dialMonitorSocket"
provides:
  - "TextMonitorClient.attach(socket, opts) beside connect(host, port) -- text-protocol.ts's own socket-injection entry point, mirroring stock-protocol.ts's exactly"
  - "textConnect() rewired onto the relay via TextConnectOptions.dialMonitorSocket/controlToken -- never a direct dial to the emulator's own text-monitor port again"
  - "broker-relay.mts: resolveRelayChannelTarget() -- the channel-to-emulator-port resolver vice-broker.mts's handleRelayAttach() now calls instead of its own inline fallback conditional"
  - "vice-broker.mts: handleRelayAttach() clears a channel's `attached` marker on the relay connection's own close, making the binary channel's relay genuinely re-establishable"
  - "StockDispatchDeps.dialMonitorSocket/.controlToken -- a test-only relay-socket-source override reaching BOTH channels through one field"
affects: [63-03, 63-04, 63-05, 63-06]

actuals:
  tokens: 20104
  tasks: 2
  commits: 2
  plan_head_before: 08ce56c80c1d4b8ee1e5368ae6525af7b35fef63

tech-stack:
  added: []
  patterns:
    - "Socket-injection entry point (text side): attach(socket, opts) factored out of connect(host, port)'s own listener-wiring via a shared #wireSocket()/#refuseIfLive() pair -- the identical shape stock-protocol.ts's ViceMonitorClient already carries, now mirrored on TextMonitorClient."
    - "Channel-to-port resolver as a single decision point: resolveRelayChannelTarget() replaces an inline ternary that used to silently fall back from a missing text-monitor port to the binary port -- the fallback itself was the defect."
    - "Close-clears-attached: a relay connection's own 'close' event resets InstanceRecord.monitorClients[channel].attached, the narrowest fix that makes a channel re-attachable after its relay dies, without building the fuller incident/idle-timeout machinery later plans in this phase own."
    - "One override field, two channels: StockDispatchDeps.dialMonitorSocket/.controlToken lets a test dial a stub server directly for either the binary or the text channel, mirroring the existing deps.connect/deps.reconnect full-function-override convention rather than inventing a second mechanism."

key-files:
  created:
    - src/mcp/vice/broker-relay-text.test.ts
  modified:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-connect.ts
    - src/mcp/vice/broker-relay.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/broker-relay.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts

key-decisions:
  - "Reused the EXISTING `bad_request` outcome code for a text attach against an instance record with no text-monitor port, rather than widening RelayAttachOutcome with a new discriminant -- broker-control.mts (the type's home) is outside this plan's own file list, and the acceptance criteria only require the refusal to be observable and named, not a specific new wire code. The full descriptive wording (naming the target and the missing port) is logged broker-side via console.error() instead."
  - "Fixed a real, previously-undetected bug: InstanceRecord.monitorClients[channel].attached was never reset on a relay connection's own death (only on a full release/recycle/exit), which would have permanently refused the binary channel's own reconnect this plan's must_haves require. Scoped the fix to exactly one line (clear `attached` on the relay socket's 'close') rather than building broker-incident.mts's fuller SESS-03/04/05 machinery, which stays a later plan's own work."
  - "Dropped TextConnectOptions.connectTimeoutMs entirely rather than keeping it as now-dead plumbing, mirroring stock-connect.ts's own post-relay shape (StockConnectOptions carries no equivalent field either) -- the two remaining call sites in text-connect.test.ts that passed it were updated to omit it."

requirements-completed: []  # SESS-02 is shared with sibling plans 63-01, 63-03..63-06 in this phase; blocked by requirements.ready-ids until every declaring plan has a SUMMARY (per the shared-ID gate). 63-03..63-06 have no SUMMARY yet.

coverage:
  - id: D1
    description: "TextMonitorClient gains attach(socket, opts), a socket-injection entry point beside connect(host, port), mirroring stock-protocol.ts's own attach() exactly (factored #wireSocket()/#refuseIfLive(), no banner read, opts.pending seeded through the same #onData() path a live event would use)"
    requirement: "SESS-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#attach(): resolves synchronously with no banner read, and the attached socket's own command reply is framed exactly like connect()'s"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#attach(): refused by name when this client already holds a live socket, naming the port and saying to disconnect first"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#attach(): opts.pending is run through the SAME parse path a live 'data' event would use -- a passively-arriving banner in the pending bytes is drained, not dropped"
        status: pass
    human_judgment: false
  - id: D2
    description: "textConnect() dials the relay via an injectable dialMonitorSocket (default: dialMonitorRelay() tagged for the text channel), never the emulator's own text-monitor port directly, and an allowlisted text command round-trips through the relay byte-identically"
    requirement: "SESS-02"
    verification:
      - kind: integration
        ref: "broker-relay-text.test.ts#tracer: an allowlisted text command sent through a relayed TextMonitorClient arrives at the stub text monitor byte-identical and its prompt-framed reply returns unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "The broker dials the text channel's own recorded text-monitor port (never the binary port), and refuses a text attach by name when the instance record carries no text-monitor port recorded rather than dialing a guessed one"
    requirement: "SESS-02"
    verification:
      - kind: integration
        ref: "broker-relay-text.test.ts#tracer: (implicitly, via a DIFFERENT closed binary port than the text port) proves the resolver reads remoteMonitorPort, not port"
        status: pass
      - kind: integration
        ref: "broker-relay-text.test.ts#attach: a text attach against an instance record with no text-monitor port is refused, and the stub text monitor records zero accepted connections"
        status: pass
    human_judgment: false
  - id: D4
    description: "A single write carrying the attach reply and the first prompt/banner bytes is parsed by TextMonitorClient rather than dropped, on both the client's synthetic-broker path and the real broker-relay-text.test.ts path"
    requirement: "SESS-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#attach(): opts.pending is run through the SAME parse path a live 'data' event would use"
        status: pass
      - kind: integration
        ref: "broker-relay-text.test.ts#handover: prompt bytes delivered in the same write as the attach reply are parsed by the client, not dropped"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two channels' relay-death policies are separately implemented and separately proven: the binary channel re-establishes through stockReconnect() (dialing the relay again, rejecting with MachineRestartedError on an advanced epoch), the text channel fails the session outright with a channel-naming refusal and never reconnects"
    requirement: "SESS-02"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#stockReconnect: after the binary relay is destroyed, a fresh session establishment dials the relay again and succeeds on a matching epoch"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#stockReconnect: after the binary relay is destroyed, an advanced epoch rejects with MachineRestartedError rather than reusing the dead relay"
        status: pass
      - kind: integration
        ref: "broker-relay-text.test.ts#relay death (text): after the text relay is destroyed, the next text command rejects with a refusal naming the text channel, no second connection ever reaches the stub text monitor, and the claim can still be released"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#structural: no exported identifier on the text path contains a reconnect entry point"
        status: pass
    human_judgment: false
  - id: D6
    description: "The carried Critical in text-protocol.ts (the unread `_opts: TextCommandOptions` parameter in command()) is provably untouched by this plan"
    requirement: "SESS-02"
    verification:
      - kind: other
        ref: "grep -acF '_opts: TextCommandOptions' text-protocol.ts  (returns 1)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The whole suite is green with both channels' relays as the production default, and the rebuilt host-bound artifacts are committed with their sources"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck; npm --prefix src/mcp/vice run build; npm --prefix src/mcp/vice run test:automated; npm --prefix src/mcp/vice test (full glob)"
        status: pass
    human_judgment: false

duration: 60min (approximate -- session start not timestamped; commit span alone was ~32min)
completed: 2026-09-19
status: complete
---

# Phase 63 Plan 2: The Monitor Channel Relayed, and the Connection as the Session Summary

**The text-monitor channel now rides the same broker relay the binary channel does, with TextMonitorClient.attach(socket), a channel-aware broker-side port resolver that refuses rather than guesses a missing text-monitor port, and the two channels' relay-death policies -- binary reconnects, text fails outright -- separately proven.**

## Performance

- **Duration:** ~60 min (approximate)
- **Completed:** 2026-09-19T23:11:46+02:00
- **Tasks:** 2 completed
- **Files modified:** 16 (1 created, 15 modified)

## Accomplishments

- `TextMonitorClient.attach(socket, opts)`: a new socket-injection entry point beside `connect(host, port)`, sharing a factored `#wireSocket()`/`#refuseIfLive()` pair with `connect()` -- the exact shape Plan 63-01 gave `ViceMonitorClient`. Resolves synchronously (no Promise, no banner read, matching D-13(a)) and seeds `opts.pending` through the same `#onData()` path a live socket event uses.
- `textConnect()` rewired onto the relay: an injectable `dialMonitorSocket`/`controlToken` on `TextConnectOptions`, defaulting to `dialMonitorRelay()` tagged for the text channel -- the ONE dial this handshake makes is now a relay connection, never a direct dial to the emulator's own text-monitor port.
- `broker-relay.mts` gains `resolveRelayChannelTarget()`: the binary channel resolves to the instance's primary port, the text channel to its own `remoteMonitorPort`, with NO fallback from one to the other. `vice-broker.mts`'s `handleRelayAttach()` now calls this resolver instead of its own inline conditional, which used to silently fall back to the binary port when `remoteMonitorPort` was absent -- exactly the guessed-port hazard the client side already refused.
- New `broker-relay-text.test.ts` (7 tests): the text channel's own relay-lifecycle cases -- a byte-identical `device c:` round trip through a real relay, the missing-text-port refusal, the attach-reply/prompt-bytes handover, and the text relay-death proving case (channel-naming refusal, exactly one lifetime connection to the stub, the claim still releasable afterward).
- **Deviation fix (Rule 1, bug):** `InstanceRecord.monitorClients[channel].attached` was never reset when a relay connection died on its own -- only a full `release`/`recycle`/process-exit ever cleared it. Without a fix, the binary channel's own reconnect (this plan's own must_have) would be permanently refused `denied` on every re-attach after the FIRST relay death. Fixed with the narrowest possible change: `handleRelayAttach()` now registers a `clientSocket.once("close", ...)` that clears `attached`, deliberately not building the richer incident-record/idle-timeout machinery `broker-incident.mts` (a later plan in this phase) owns.
- Two new proving tests in `broker-relay.test.ts`: destroying the binary relay mid-session and calling `stockReconnect()` now dials the relay again and completes a fresh handshake on a matching epoch, and rejects with `MachineRestartedError` on an advanced one -- exercised against a REAL relay (real `startControlListener()`, real `dialMonitorRelay()`), not a direct-dial stub.
- A structural gate (`broker-relay.test.ts`) proves the text path declares no `export function text*Reconnect` anywhere across `text-connect.ts`/`text-protocol.ts`/`text-tools.ts`.
- **Deviation fix (Rule 3, blocking):** `text-tools.test.ts`'s and `stock-dispatch.test.ts`'s own text-tool conformance tests broke once `textConnect()`'s default socket source became the relay -- both files' deps builders now inject the SAME test-only `StockDispatchDeps.dialMonitorSocket`/`.controlToken` seam (new, threaded through `stockConnectDepsFor()` for the binary channel and `text-tools.ts`'s `withTextTool()` for the text channel) so a test can dial a stub server directly for either channel.

## Task Commits

Each task was committed atomically:

1. **Task 1: The text monitor accepts a socket it did not dial** - `4a9ed21e` (feat)
2. **Task 2: Two channels, two death policies, proven apart** - `bba7a44e` (test)
   - Includes the `attached`-flag fix (vice-broker.mts), the command() refusal wording (text-protocol.ts), the stockReconnect() doc-comment update (stock-connect.ts), and the `dialMonitorSocket`/`controlToken` seam plus its two consumers' test fixes (stock-dispatch.ts, text-tools.ts, stock-dispatch.test.ts, text-tools.test.ts) -- all discovered and fixed while proving Task 2's own must_haves, so folded into this single commit rather than split further.

_Note: `type: execute`, not `type: tdd` -- no RED/GREEN/REFACTOR cycle in this plan._

## Files Created/Modified

- `src/mcp/vice/broker-relay-text.test.ts` - New: the text channel's own relay-lifecycle proving suite (7 tests)
- `src/mcp/vice/text-protocol.ts` - `TextMonitorClient.attach()`/`TextAttachOptions`, factored `#wireSocket()`/`#refuseIfLive()`, `command()`'s dead-socket refusal now names the text channel
- `src/mcp/vice/text-connect.ts` - `dialMonitorSocket`/`controlToken` on `TextConnectOptions`, the default `dialMonitorSocket` dialing `dialMonitorRelay()` tagged for text, `connectTimeoutMs` dropped
- `src/mcp/vice/broker-relay.mts` - `resolveRelayChannelTarget()`/`RelayChannelTarget`/`RelayChannelInstance`
- `src/mcp/vice/vice-broker.mts` - `handleRelayAttach()` now calls the resolver and clears `attached` on the relay socket's own close
- `src/mcp/vice/resources/broker-relay.mjs` / `resources/vice-broker.mjs` - Rebuilt twins
- `src/mcp/vice/text-connect.test.ts` - Direct-dial `textConnect()` wrapper (mirrors `stock-connect.test.ts`'s own), `connectTimeoutMs` call sites updated
- `src/mcp/vice/text-protocol.test.ts` - Three new `attach()` unit tests
- `src/mcp/vice/broker-control.test.ts` - Structural allow-list entry for `broker-relay-text.test.ts`
- `src/mcp/vice/broker-relay.test.ts` - Two `stockReconnect()`-after-relay-death proving tests, the text-path structural no-reconnect gate, a full-handshake stub responder, `makeRealBrokerControl()`
- `src/mcp/vice/stock-connect.ts` - `stockReconnect()`'s doc comment now states a relay death is one of the conditions it covers
- `src/mcp/vice/stock-dispatch.ts` - `StockDispatchDeps.dialMonitorSocket`/`.controlToken`, threaded through `stockConnectDepsFor()`
- `src/mcp/vice/stock-dispatch.test.ts` - `buildTextConformanceDeps()` now injects a direct-dial `dialMonitorSocket`
- `src/mcp/vice/text-tools.ts` - `withTextTool()` threads `deps.dialMonitorSocket`/`.controlToken` into `textConnect()`
- `src/mcp/vice/text-tools.test.ts` - `makeDeps()`/`makeDepsWithBrokerIdentity()` now inject a direct-dial `dialMonitorSocket`

## Decisions Made

- Reused the existing `bad_request` outcome code for the missing-text-monitor-port refusal rather than widening `RelayAttachOutcome` (see key-decisions above) -- `broker-control.mts` stayed untouched.
- Fixed the `attached`-flag stuck-state bug narrowly (one `close` listener), leaving the fuller incident/idle-timeout machinery to a later plan in this phase.
- Dropped `TextConnectOptions.connectTimeoutMs` entirely, matching `stock-connect.ts`'s own post-relay shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `InstanceRecord.monitorClients[channel].attached` was never reset on a relay connection's own death**
- **Found during:** Task 2 (writing the binary-channel `stockReconnect()`-after-relay-death proving test)
- **Issue:** Nothing in `broker-control.mts`/`vice-broker.mts`/`broker-relay.mts` ever cleared a channel's `attached` marker except a full `monitor_release`/`recycle`/process-exit. A relay connection dying on its own (the exact scenario this plan's own must_have -- "a dead binary relay may still be re-established" -- describes) left `attached: true` stuck forever, so a re-attach on the SAME channel was permanently refused `denied`. This was a genuine, previously-undetected gap: nothing in Plan 63-01's own suite exercised a re-attach after a relay death.
- **Fix:** `handleRelayAttach()` (`vice-broker.mts`) now registers `clientSocket.once("close", () => { holder.attached = false; })` immediately after a successful splice.
- **Files modified:** `src/mcp/vice/vice-broker.mts`, `src/mcp/vice/resources/vice-broker.mjs`
- **Verification:** `broker-relay.test.ts#stockReconnect: after the binary relay is destroyed, a fresh session establishment dials the relay again and succeeds on a matching epoch` -- fails without the fix (confirmed by running the test before the fix landed), passes with it.
- **Committed in:** `bba7a44e` (Task 2 commit)

**2. [Rule 3 - Blocking] `text-tools.test.ts` and `stock-dispatch.test.ts`'s own text-tool conformance tests broke after `textConnect()`'s default socket source changed**
- **Found during:** Task 2 (running `npm run test:automated` after Task 1's own changes)
- **Issue:** Every text-tool test that resolves a REAL `textConnect()` session (rather than short-circuiting on argument validation) went through `textConnect()`'s new DEFAULT dial -- `dialMonitorRelay()` against a broker that is not running in the test process -- producing "no broker answered on either candidate" failures. 47 failures in `text-tools.test.ts`, 9 conformance failures in `stock-dispatch.test.ts`.
- **Fix:** Added `StockDispatchDeps.dialMonitorSocket`/`.controlToken` (threaded through `stockConnectDepsFor()` for the binary channel and `text-tools.ts`'s `withTextTool()` for the text channel), then updated both test files' shared deps builders (`makeDeps()`/`makeDepsWithBrokerIdentity()` in `text-tools.test.ts`; `buildTextConformanceDeps()` in `stock-dispatch.test.ts`) to inject a direct-dial `dialMonitorSocket`, mirroring `text-connect.test.ts`'s own established pattern. No assertion weakened, no case deleted.
- **Files modified:** `src/mcp/vice/stock-dispatch.ts`, `src/mcp/vice/text-tools.ts`, `src/mcp/vice/text-tools.test.ts`, `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `text-tools.test.ts` 62/62 pass (was 15/62); `stock-dispatch.test.ts` 123/123 pass (was 114/123); full `npm run test:automated` 4000/4000 pass, 0 fail, 9 skipped.
- **Committed in:** `bba7a44e` (Task 2 commit)

**3. [Rule 2 - Missing Critical] `command()`'s dead-socket refusal did not name the text channel or state the session's loss of account**
- **Found during:** Task 2 (writing the text relay-death proving test's own acceptance criterion, which requires the refusal to name the text channel)
- **Issue:** The pre-existing wording ("text-protocol: cannot send, the text-monitor connection is not open") satisfied the BEHAVIOR (refuse rather than reconnect) but not the plan's own required wording discipline ("a refusal that names the channel and says the session lost account of what happened on it").
- **Fix:** Rewrote the ONE guard in `command()` that discovers a dead socket to name the text channel explicitly and state that the session has lost account of what happened on it.
- **Files modified:** `src/mcp/vice/text-protocol.ts`
- **Verification:** `broker-relay-text.test.ts#relay death (text): ...` asserts the message matches both `/text channel/i` and `/lost account/i`.
- **Committed in:** `bba7a44e` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking ripple across four files, 1 missing-critical wording)
**Impact on plan:** All three were necessary to make this plan's own must_haves actually true and provable (the reconnect proving case genuinely did not work without the `attached`-flag fix) or to keep the whole suite green after a deliberate, plan-required default-socket-source change. No scope creep beyond what proving Task 2's own required behaviors demanded.

## Known Stubs

None. `DEFAULT_RELAY_IDLE_MS`/`DEFAULT_RELAY_KEEPALIVE_MS`/`resolveRelayIdleMs()` (declared by Plan 63-01, still unwired) remain explicit, plan-documented groundwork for Plan 63-04 -- unchanged by this plan.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 63-03 (per the phase's own later-plans symbol list: `broker-incident.mts`, session-label/grant-id/operation fields, `VICE_BROKER_RELAY_IDLE_MS`/`VICE_BROKER_RELAY_KEEPALIVE_MS`).
- `SESS-02` stays unmarked-complete in REQUIREMENTS.md pending the sibling plans (63-03..63-06) in this same phase that also declare it (the shared-ID gate blocks it until every declaring plan has a SUMMARY).
- Both monitor channels now reach the emulator exclusively through the broker relay; any later plan touching either channel's socket source should thread through the existing `dialMonitorSocket`/`controlToken` seam, never re-add a direct dial.
- The `attached`-flag fix landed here is the MINIMAL correctness fix; Plan 63-04/63-05's own incident-record/idle-timeout machinery should build on the SAME `clientSocket.once("close", ...)` event this plan introduced, not a second listener.

## Self-Check: PASSED

- Created file verified on disk: `src/mcp/vice/broker-relay-text.test.ts` -- `FOUND`.
- Commit hashes verified in `git log --oneline --all`: `4a9ed21e`, `bba7a44e` -- both `FOUND`.
- All plan-level `<verification>` commands re-run and passing: typecheck (exit 0), build (13 artifacts, resources/broker-relay.mjs and resources/vice-broker.mjs the only ones to change across both commits), `resources-sync.test.ts` (2/2 pass), `test:automated` (4000/4009 pass, 0 fail, 9 skipped, exit 0), full `npm test` glob (4092/4173 pass, 0 fail, 81 skipped, exit 0), `git diff` for `text-protocol.ts` shows the carried-debt line (`_opts: TextCommandOptions`) present and unchanged (`grep -acF` returns 1), `broker-relay-text.test.ts` confirmed absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`.
- All plan `<success_criteria>` re-checked against this SUMMARY's own coverage table (D1-D7) -- every one has a passing verification entry.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session*
*Completed: 2026-09-19*
