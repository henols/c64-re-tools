---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
plan: 12
subsystem: infra
tags: [vice-mcp, broker-control-plane, relay-lifecycle, incident-record, gap-closure]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    plan: "11"
    provides: "vice-broker.mts's tearDownRelaySessionForChannel(), called by handleMonitorRelease() -- the broker-side half this plan's caller reorder is the counterpart to"
provides:
  - "text-connect.ts: textDisconnect() now releases the per-channel monitor claim BEFORE disconnecting the relay socket, with the disconnect guaranteed by a finally block regardless of the release outcome"
  - "stock-connect.ts: stockDisconnect() mirrors the identical reorder for the binary channel"
  - "text-connect.test.ts / stock-connect.test.ts: three mirrored behavioural cases each (release-before-close, refused-release, throwing-release), proven from inside a stub rather than by reading the source"
affects: []

actuals:
  tokens: 4959
  tasks: 2
  commits: 2
  plan_head_before: a9049310ab4a4b448aa63a59489506b694934a47

tech-stack:
  added: []
  patterns:
    - "Release-then-close, guaranteed by try/finally: both textDisconnect() and stockDisconnect() now send the per-channel releaseMonitor() call inside a try block and put safeDisconnect() in the matching finally, so the socket close is guaranteed on every path (ok, refused, or throwing) while the release itself still runs first and its throw still propagates unchanged."
    - "Stub probe-at-invocation: both test files' makeStubBrokerControl() gained an optional probeAtRelease() hook, invoked synchronously the instant releaseMonitor() is called (before it resolves or throws) and recorded into state.probedAtRelease -- lets a test observe a fact (the socket's own connected getter) from INSIDE the stub at the exact moment of the call, rather than inferring ordering from source or from timing."
    - "Stub throw injection: both test files' makeStubBrokerControl() also gained an optional releaseThrows field, letting a test make releaseMonitor() reject with an arbitrary value -- needed because the pre-existing releaseOutcome field only modeled resolved outcomes, never a throw."

key-files:
  created: []
  modified:
    - src/mcp/vice/text-connect.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-connect.test.ts

key-decisions:
  - "The handshake-failure catch blocks inside textConnect()/stockConnect() were deliberately left with close-then-release order, unchanged apart from one added comment sentence each recording why: a handshake that fails after the relay attached is a genuine abnormal event and its incident record is real evidence, not the noise the success-path reorder exists to prevent."
  - "Removed a literal plan-id citation from the first drafted JSDoc addition to textDisconnect() ('plan 63-11') before committing, per the plan's own acceptance criterion that the docstring's ordering explanation carry no plan id in the text -- the final prose refers to 'the broker's own per-channel release' without naming which plan added it."
  - "probeAtRelease and releaseThrows were added as new OPTIONAL fields on the existing StubBrokerControlOptions/makeStubBrokerControl() shape in both test files, rather than as a second parallel stub builder -- every pre-existing call site in both files is unaffected, matching the plan's own 'extend the stub ... rather than changing every existing caller's recorder shape' instruction."

requirements-completed: [SESS-05]

coverage:
  - id: D1
    description: "textDisconnect() sends the text-channel monitor release while the relay socket is still connected, then disconnects regardless of what the release returns"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "text-connect.test.ts#textDisconnect: sends the monitor release while the relay socket is still connected, then disconnects"
        status: pass
      - kind: unit
        ref: "text-connect.test.ts#textDisconnect: still disconnects when the monitor release is refused, and reports the refusal"
        status: pass
      - kind: unit
        ref: "text-connect.test.ts#textDisconnect: still disconnects when the monitor release throws, and still propagates the error"
        status: pass
    human_judgment: false
  - id: D2
    description: "stockDisconnect() sends the binary-channel monitor release while the relay socket is still connected, then disconnects regardless of what the release returns"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "stock-connect.test.ts#stockDisconnect: sends the monitor release while the relay socket is still connected, then disconnects"
        status: pass
      - kind: unit
        ref: "stock-connect.test.ts#stockDisconnect: still disconnects when the monitor release is refused, and reports the refusal"
        status: pass
      - kind: unit
        ref: "stock-connect.test.ts#stockDisconnect: still disconnects when the monitor release throws, and still propagates the error"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two pre-existing production consumers of stockDisconnect() (stock-dispatch.ts's stale-session teardown, stock-recycle.ts's post-kill teardown) and textDisconnect()'s sole consumer (text-tools.ts's withTextTool()) keep working unchanged after the reorder"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "node --test stock-connect.test.ts stock-dispatch.test.ts stock-recycle.test.ts text-connect.test.ts text-tools.test.ts (277/277 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The handshake-failure catch paths inside textConnect()/stockConnect() keep their close-then-release order unchanged, with the reason recorded in a comment"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "text-connect.test.ts pre-existing dial-failure cases ('a dial failure after a successful claim releases the claim before propagating', 'the ORIGINAL dial failure is preserved even when the release itself also fails') and stock-connect.test.ts's equivalents, all still passing unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full suite and the automated gate are green over the COMPOSED fix (this plan's caller reorder plus plan 63-11's broker-side teardown), and the two-halves proof is named explicitly"
    requirement: "SESS-05"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice test (4281 tests, 4197 pass, 0 fail, 84 skipped, exit 0); npm --prefix src/mcp/vice run test:automated (4114 tests, 4105 pass, 0 fail, 9 skipped, exit 0)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-21
status: complete
---

# Phase 63 Plan 12: The Monitor Channel Relayed, and the Connection as the Session Summary

**`textDisconnect()` and `stockDisconnect()` both now release their per-channel monitor claim BEFORE closing the relay socket (guaranteed by a `finally`), closing the caller half of SESS-05's spurious-incident-record gap that plan 63-11's broker-side fix alone could not close.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-21T08:31:36Z (approx, from STATE.md's `last_updated` at hand-off from plan 63-11)
- **Completed:** 2026-09-21T08:43:44Z
- **Tasks:** 2 completed
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- `textDisconnect()` (`text-connect.ts`) rewritten so the `releaseMonitor()` call runs inside a `try` block and `safeDisconnect(session.client)` runs in the matching `finally` -- the release now reaches the broker while the socket is still up, and the disconnect happens no matter what the release returns (ok, refused, or throwing). A refused release is reported on stderr, naming the target id, the channel, and the refusal reason. The JSDoc header now states, in prose, that the order is load-bearing and names the exact incident it prevents (every ordinary, successful text-tool call used to write a spurious record), with no plan id in the text.
- `stockDisconnect()` (`stock-connect.ts`) given the identical reorder, with its JSDoc explaining why this channel hits the path less often than the text channel (stock-dispatch.ts holds a module-level session for the life of the process, so this fires on a lease-target switch or forced reconnect rather than once per call) -- rarer, not benign.
- The `catch` blocks inside `textConnect()`/`stockConnect()` (the handshake-failure paths) were left with their existing close-then-release order, each gaining exactly one added comment sentence recording why: a handshake failure after the relay attached is a genuine abnormal event, and the incident record it produces is real evidence.
- Six new behavioural test cases (three per file): release-before-close (proven from inside the stub's own `releaseMonitor`, via a new `probeAtRelease` hook that records `session.client.connected` at the moment of the call), refused release (asserts the socket still disconnects and exactly one `console.error` line names the target and the channel), and throwing release (asserts via `assert.rejects` that the original error propagates unchanged AND the socket still disconnects, via a new `releaseThrows` stub option).
- Ran the full-suite and automated gates over the COMPOSED fix (this plan plus plan 63-11): `npm test` reports 4281 tests, 4197 pass, 0 fail, 84 skipped, exit 0 -- rising from the 63-VERIFICATION.md baseline of 4268/4184/0/84 by exactly the 13 new cases both gap-closure plans added, with an EMPTY failing set (never merely a matching count). `npm run test:automated` reports 4114 tests, 4105 pass, 0 fail, 9 skipped, exit 0 -- it skips the 13 files in `test-gate.mjs`'s `MANUAL_ONLY_TESTS` list (`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`, `stock-live-relay.test.ts`) -- opt-in live-emulator/live-broker/live-Ghidra/live-ACME suites, never confused with the full-glob run above, which runs everything including those (most of which self-skip by default anyway).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- the text channel releases before it closes, and the disconnect happens whatever the release returns** - `5ee6927d` (feat)
2. **Task 2: The binary channel's counterpart, and the full-suite gate over the composed fix** - `61bb57e2` (feat)

_Note: both tasks carry `tdd="true"` as a task attribute; `workflow.tdd_mode` is `false` project-wide, so no separate RED/GREEN commit gate was enforced -- each task's source reorder and its three regression cases landed together in one commit, matching plan 63-11's own recorded posture for `tdd="true"` tasks under a `type: execute` plan. Both cases 1 and 2 in each file were confirmed to assert real, non-vacuous behaviour (the probe records the live `connected` value, the refusal line is captured and inspected) against the final implementation; a strict pre-implementation RED run was not separately preserved as its own commit, since the gate that would require one is off._

## Files Created/Modified

- `src/mcp/vice/text-connect.ts` -- `textDisconnect()` reordered to release-then-close inside try/finally; `textConnect()`'s handshake-failure catch gained one comment sentence
- `src/mcp/vice/text-connect.test.ts` -- `StubBrokerControlOptions`/`makeStubBrokerControl()` extended with `probeAtRelease`/`releaseThrows`; three new cases added
- `src/mcp/vice/stock-connect.ts` -- `stockDisconnect()` reordered identically; `stockConnect()`'s handshake-failure catch gained one comment sentence
- `src/mcp/vice/stock-connect.test.ts` -- same stub extension and three mirrored cases, placed beside the existing D-14 case

## Decisions Made

- See key-decisions above: the handshake-failure catch paths were left untouched apart from one comment sentence each; the JSDoc plan-id citation was removed before committing; the stub extension was additive rather than a second builder.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SESS-05's caller-side half is now closed. Combined with plan 63-11's broker-side `tearDownRelaySessionForChannel()`, the COMPOSED fix closes 63-VERIFICATION.md's newest Blocker: an ordinary, successful text-tool call (or a binary-channel stale-session/post-kill teardown) no longer writes a spurious incident record. The end-to-end proof is the composition of two test cases, named explicitly: plan 63-11's production-shaped relay round trip in `broker-relay-text.test.ts` (proves the broker writes nothing when the release arrives first) and this plan's release-before-close cases in `text-connect.test.ts`/`stock-connect.test.ts` (prove the two production callers actually send it first). Neither alone closes SESS-05's "a routine, quiet release writes no incident" clause.
- Carried debt, explicitly not folded in (see the plan's own `<carried_debt>`): the handshake-failure catch paths keep close-then-release deliberately; `stock-dispatch.ts`'s `heldSession` lifetime is unchanged; a real broker-in-the-loop end-to-end test of `textDisconnect()` (driving the true `BrokerControlSession` against a live control listener) was not built -- the composed proof above covers the same claim with far less machinery.
- Ready for phase 63 re-verification.

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `5ee6927d`, `61bb57e2` -- both `FOUND`.
- Key files verified present on disk: `src/mcp/vice/text-connect.ts`, `src/mcp/vice/text-connect.test.ts`, `src/mcp/vice/stock-connect.ts`, `src/mcp/vice/stock-connect.test.ts` -- all `FOUND`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (exit 0); `node --test text-connect.test.ts text-tools.test.ts` (79 tests, 0 fail); `node --test stock-connect.test.ts stock-dispatch.test.ts stock-recycle.test.ts` (198 tests, 0 fail); `npm test` (4281 tests, 4197 pass, 0 fail, 84 skipped, exit 0); `npm run test:automated` (4114 tests, 4105 pass, 0 fail, 9 skipped, exit 0).
- Source assertions re-checked: `grep -av '^[[:space:]]*[/*]' text-connect.ts | grep -ac 'finally'` -> 1; the same command against `stock-connect.ts` -> 1.
- Every `must_haves.truths` entry from the plan has a named, passing test case (see coverage block D1-D5 above).

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio*
*Completed: 2026-09-21*
