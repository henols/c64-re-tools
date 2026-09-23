---
phase: 64-files-as-bytes-both-directions
plan: 09
subsystem: broker
tags: [broker-endpoint, stock-connect, text-connect, security, gap-closure, G-64-1]

requires:
  - phase: 64-files-as-bytes-both-directions
    provides: "plan 64-08's broker-side handle-only authority for attach/transfer, dispatched ahead of the per-boot control-token gate"
provides:
  - "no field anywhere in the client tree through which a credential could reach a relay or transfer dial -- DialMonitorRelayOptions, DialFileTransferOptions, StockConnectDeps, TextConnectOptions and StockDispatchDeps all lose their credential field"
  - "wire-level key-set tests (broker-endpoint.test.ts) pinning the attach line to exactly op/target_id/channel/handle and the transfer line to exactly op/direction/handle (download) or op/direction/handle/byteLength/sha256 (upload)"
affects: [64-10, 64-11, phase-66]

actuals:
  tokens: 14884
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "handle-only dial: a relay/transfer connection presents only its broker-minted handle as authority -- the credential slot is deleted, not merely left unfilled, so a future caller cannot re-thread the per-boot token back in without visibly re-adding the field"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/text-connect.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/broker-endpoint.test.ts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/broker-relay-text.test.ts
    - src/mcp/vice/stock-live-relay.test.ts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/transfer-disjoint-roots.test.ts

key-decisions:
  - "Completed G-64-1 route (b): deleted the credential field from every dial option and dependency type rather than leaving it as documented dead weight -- per owner decision 5, the slot itself must be unwritable, not merely unused."
  - "Where a test's local credential variable also fed a control-session operation (acquire, monitor_claim, stage_file, status, or the test listener's own token construction option), kept the variable and removed it only from the relay/transfer dial call -- never touched the control-session token itself (RM-02, Phase 66)."
  - "broker-relay.test.ts's hand-written raw attach line also dropped the credential key, so that test now separately proves a credential-free attach is accepted at the wire, not just that the client stops sending one."

requirements-completed: [XFER-04, XFER-08]

coverage:
  - id: D1
    description: "No production dial path (dialMonitorRelay, dialFileTransfer, the stock-connect/text-connect defaults) can write a credential onto a relay or transfer request line, because the field no longer exists on any option or deps type"
    requirement: XFER-04
    verification:
      - kind: unit
        ref: "npm run typecheck -- zero errors across the whole tree after both commits"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts -- full suite (49 tests) including dialMonitorRelay/dialFileTransfer races, timeouts and error paths with no credential passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The attach line's exact key set (op, target_id, channel, handle) and the transfer line's exact key set (op, direction, handle, plus byteLength/sha256 for upload) are pinned from a real dial against a real fixture, not inferred from the type"
    requirement: XFER-08
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#dialMonitorRelay: the attach line this dial writes carries exactly op, target_id, channel and handle -- no credential of any kind (G-64-1)"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#dialFileTransfer: a download's transfer request line carries exactly op, direction and handle -- no credential of any kind (G-64-1)"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#dialFileTransfer: an upload's transfer request line carries exactly op, direction, handle, byteLength and sha256 -- no credential of any kind (G-64-1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pre-existing relay, transfer, dispatch and text-channel test still passes with the credential removed from its own dial calls, and a credential-free raw attach line is separately proven accepted"
    verification:
      - kind: unit
        ref: "node --test broker-endpoint.test.ts broker-relay.test.ts broker-relay-text.test.ts stock-machine.test.ts transfer-disjoint-roots.test.ts vice-proxy.test.ts -- 195 tests, 192 pass, 0 fail, 3 skipped"
        status: pass
      - kind: integration
        ref: "npm run test:automated -- 4241 tests, 4232 pass, 0 fail, 9 skipped (baseline 4238/4229/0/9, +3 = this plan's new wire-level tests)"
        status: pass
      - kind: integration
        ref: "full glob npm test -- 4411 tests, 4327 pass, 0 fail, 84 skipped (baseline 4408/4324/0/84, +3 = same new tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "stock-live-relay.test.ts (manual-only, needs a real emulator) still typechecks and its three live cases still resolve to skip with no opt-in var set"
    verification:
      - kind: unit
        ref: "node --test stock-live-relay.test.ts -- 3 tests, 0 pass (all skipped, SKIP_REASON), 0 fail"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 09: Client-side credential removal from relay/transfer dials Summary

**Deleted the empty-token parameter every relay and transfer dial has written since Phase 63 (`DialMonitorRelayOptions.token`, `DialFileTransferOptions.token`, and the three matching deps fields) and replaced it with wire-level tests that pin the attach/transfer request lines' exact key sets from a real dial — the second half of G-64-1 route (b), closing the slot plan 64-08's broker-side change made obsolete.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 11 (5 production, 6 test)

## Accomplishments

- `broker-endpoint.ts`'s `DialMonitorRelayOptions`/`DialFileTransferOptions` no longer declare a credential field, and `performAttach()`/`performTransfer()` no longer write one onto the wire — the attach line now carries exactly `op`, `target_id`, `channel`, `handle`; the transfer line carries `op`, `direction`, `handle` (plus `byteLength`/`sha256` for an upload).
- `stock-connect.ts`'s `StockConnectDeps` lost `controlToken`; `defaultDialMonitorSocket()` and `defaultTransferFile()` take no credential parameter and pass none to their dials. `text-connect.ts`'s `TextConnectOptions` mirrors the same removal. `text-tools.ts`'s `withTextTool()` stops passing a credential to `textConnect()`. `stock-dispatch.ts`'s `StockDispatchDeps` lost its test-only credential field and its copy in `stockConnectDepsFor()`.
- Every touched JSDoc that described these dials as "authenticated with" a token now states the handle is the only authority the broker checks (G-64-1, owner decision 5).
- Three new wire-level tests in `broker-endpoint.test.ts` capture a real request line from a real dial against a hand-written fixture and assert its exact key set with `Object.keys(...).sort()` — a behavioural observation, never a source-text scan (D-17, 260914-poo D-1) — including asserting the captured attach handle equals the one passed in.
- The credential property was removed from every remaining `dialMonitorRelay()`/`dialFileTransfer()` call across `broker-relay.test.ts`, `broker-relay-text.test.ts`, `stock-live-relay.test.ts`, `stock-machine.test.ts` and `transfer-disjoint-roots.test.ts`. Where a test's local token variable also fed a control-session operation (the listener's own accept token, an `acquire`/`stage_file` call), the variable was kept and only its use in the dial call was removed; where it became fully unused, the variable (or the function parameter carrying it, e.g. `claimAndDialRelay()`'s `token` parameter and `makeRealTransferFile()`'s in two files) was deleted rather than left dangling.
- `broker-relay.test.ts`'s hand-written raw attach line (`"boundary one"` test) also dropped its credential key, so that test separately proves a credential-free attach is accepted by the real production wire format, not merely that the client-side call stopped sending one.

## Task Commits

1. **Task 1 (tracer): the production dials stop declaring, reading or sending a credential** - `5218ddc6` (feat)
2. **Task 2: every caller follows, and the wire itself is pinned** - `67ca06ba` (test)

## Files Created/Modified

- `src/mcp/vice/broker-endpoint.ts` - `DialMonitorRelayOptions`/`DialFileTransferOptions` lose their credential field; `performAttach()`/`performTransfer()` stop writing one
- `src/mcp/vice/stock-connect.ts` - `StockConnectDeps` loses `controlToken`; both default relay/transfer implementations take no credential parameter
- `src/mcp/vice/text-connect.ts` - `TextConnectOptions` loses `controlToken`; its default dial mirrors stock-connect.ts's
- `src/mcp/vice/text-tools.ts` - `withTextTool()` stops passing a credential to `textConnect()`
- `src/mcp/vice/stock-dispatch.ts` - `StockDispatchDeps` loses its test-only credential field and its copy in `stockConnectDepsFor()`
- `src/mcp/vice/broker-endpoint.test.ts` - removed `token` from every `dialFileTransfer()` call; added three wire-level key-set tests plus a raw attach fixture (`startRawAttachFixture()`)
- `src/mcp/vice/broker-relay.test.ts` - removed `token` from every `dialMonitorRelay()` call and from `claimAndDialRelay()`'s own signature; dropped the credential key from the hand-written raw attach line
- `src/mcp/vice/broker-relay-text.test.ts` - removed `token` from every `dialMonitorRelay()` call, mirroring broker-relay.test.ts's changes for the text channel
- `src/mcp/vice/stock-live-relay.test.ts` - removed `token: controlToken` from both live `dialMonitorRelay()` calls, keeping `controlToken` where it still feeds `rawStatus()`
- `src/mcp/vice/stock-machine.test.ts` - `makeRealTransferFile()` loses its `token` parameter; both `dialFileTransfer()` calls inside it drop the credential
- `src/mcp/vice/transfer-disjoint-roots.test.ts` - identical `makeRealTransferFile()` change, mirroring stock-machine.test.ts

## Decisions Made

- Deleted the credential field rather than leaving it unfilled — the plan's own stated purpose: a documented-but-unused slot invites a future reader to "fix" it by threading the per-boot token back through (route a), which owner decision 5 rules out. Deleting the slot makes that mistake unwritable rather than merely discouraged.
- Kept every local test variable that serves double duty (feeding a control-session op AND, until now, a dial call) — removed its use from the dial call only, never touched the control-session token itself. `broker-control.mts`, `vice-broker.mts`, `host-tool-client.ts` and every non-attach/non-transfer control op keep the token gate untouched, per the plan's own prohibition.
- Where a variable or function parameter became wholly unused after the dial-call removal (e.g. `claimAndDialRelay()`'s `token` parameter, `makeRealTransferFile()`'s `token` parameter in both `stock-machine.test.ts` and `transfer-disjoint-roots.test.ts`, and a handful of destructured `token` bindings in single-purpose test callbacks), it was deleted rather than left dangling.

## Deviations from Plan

None - plan executed exactly as written. The intermediate typecheck state described in Task 1's action text (28 excess-property errors, all in the six test files named in the plan) matched exactly, and Task 2 closed all of them to zero.

## Issues Encountered

None.

## Verification (measured)

- `npm run typecheck` — exit 0, zero errors, run after both commits.
- `node --test broker-endpoint.test.ts broker-relay.test.ts broker-relay-text.test.ts stock-machine.test.ts transfer-disjoint-roots.test.ts vice-proxy.test.ts` — 195 tests, 192 pass, 0 fail, 3 skipped, exit 0.
- `npm run test:automated` — 4241 tests, 4232 pass, 0 fail, 9 skipped, exit 0 (baseline before this plan: 4238/4229/0/9 — the +3 delta is exactly this plan's three new `broker-endpoint.test.ts` wire-level tests).
- Full glob `npm test` — 4411 tests, 4327 pass, 0 fail, 84 skipped, exit 0 (baseline before this plan: 4408/4324/0/84, same +3 delta).
- `node --test stock-live-relay.test.ts` — 3 tests, 0 pass, 0 fail, 3 skipped (no `VICE_LIVE_RELAY_BIN` set; all cases resolve to `SKIP_REASON` as expected — this file's behaviour is exercised by plan 64-11's live run, not here).
- `ss -ltn | grep -c ':19510 '` → 0, before and after every run — no listener on the real broker port at any point.
- `find installer/skills src/skills -name "zz-scratch*"` → empty before the full glob run (no leaked scratch directory from a prior session).

## Known Stubs

None — every production edit removes a field from a type; there is nothing left to stub. The three new wire-level tests drive real dials against real (if hand-written) TCP fixtures, not mocks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 64-10 (the secondary broker.json state-dir cause) and plan 64-11 (the live emulator run, including `stock-live-relay.test.ts`'s three currently-skipped cases) remain. This plan's `files_modified` list is disjoint from 64-10's (`vice-broker-client.ts`, `vice-broker.mts`, `repo-root.ts`, `broker-home.mts`, `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `package.json`, `CLAUDE.md`), so no merge conflict is expected. The phase is NOT complete — gap closure for G-64-1 continues with 64-10/64-11.

## Self-Check: PASSED

- `FOUND: src/mcp/vice/broker-endpoint.ts`
- `FOUND: src/mcp/vice/stock-connect.ts`
- `FOUND: src/mcp/vice/text-connect.ts`
- `FOUND: src/mcp/vice/text-tools.ts`
- `FOUND: src/mcp/vice/stock-dispatch.ts`
- `FOUND: src/mcp/vice/broker-endpoint.test.ts`
- `FOUND: src/mcp/vice/broker-relay.test.ts`
- `FOUND: src/mcp/vice/broker-relay-text.test.ts`
- `FOUND: src/mcp/vice/stock-live-relay.test.ts`
- `FOUND: src/mcp/vice/stock-machine.test.ts`
- `FOUND: src/mcp/vice/transfer-disjoint-roots.test.ts`
- Commits `5218ddc6`, `67ca06ba` both present in `git log --oneline 29db1cb9..HEAD`

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*
