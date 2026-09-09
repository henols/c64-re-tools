---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 03
subsystem: protocol
tags: [vice, broker, monitor-claim, channel, text-monitor, binary-monitor, stock-backend, chan-04, d-14]

requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: "plan 41-01's text-connect.ts (textConnect()/textDisconnect(), HeldLease.remoteMonitorPort) and plan 41-02's channel-lock.ts (the actual halting-serialization authority, untouched by this plan)"
provides:
  - "InstanceRecord.monitorClients: the per-channel holder map (broker-state.mts), replacing the single monitorClient field, non-optional and defaulted to {}"
  - "broker-control.mts's monitor_claim/monitor_release wire ops gain a channel field (default binary, bad_request on an unrecognised value), and MonitorHolder/MonitorClaimHolder carry channel"
  - "vice-broker.mts's handleMonitorClaim()/handleMonitorRelease() enforce ownership PER CHANNEL -- claiming binary and text simultaneously by the same grant is normal, and claiming one never evicts or is refused by the other's holder"
  - "stockConnect()/stockDisconnect() claim/release channel binary explicitly; textConnect()/textDisconnect() claim/release channel text explicitly -- a second MCP process attempting the text channel is now refused by name, naming the holder and the channel, instead of vanishing into stock's accepted-then-silent wire state"
affects: [41-04, 41-05, 41-06]

actuals:
  tokens: 28700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Per-channel holder map (Partial<Record<MonitorChannel, Holder>>), non-optional and defaulted to {} at the one construction site -- 'no claim' is an empty map, never an absent field, so a re-introduced single-holder shape fails compilation"
    - "channel field on an existing wire op, default-to-binary-when-absent, bad_request on an unrecognised value -- extends rather than replaces the plan 05 monitor_claim/monitor_release mechanism, matching D-14's own framing"
    - "Requested-channel-as-fallback: extractHolder()/the broker's own WR-08 fallback both default a missing/malformed wire channel to the channel THIS request itself asked for, never a fabricated third value"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-launch.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/text-connect.ts
    - src/mcp/vice/broker-state.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/vice-broker-client.test.ts
    - src/mcp/vice/stock-connect.test.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/broker-kill.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/vice-broker-supervision.test.ts
    - src/mcp/vice/resources/broker-state.mjs
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/resources/broker-launch.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "monitorClients made NON-OPTIONAL (not optional-and-defaulted) -- forced every construction site of a raw InstanceRecord literal (five test-helper functions across four test files this plan does not otherwise touch) to supply monitorClients: {} explicitly, which is exactly the point: an absent field can no longer silently mean 'no claim' the way the old optional monitorClient field could."
  - "MonitorClaimHolder (container-side) and MonitorHolder (broker-side) both gain channel as a REQUIRED field, not optional -- a refusal that cannot name its own channel is not a state this mechanism should produce silently; every fallback path (WR-08 on both sides, extractHolder()) defaults explicitly to the channel the request itself named, never omits the field."
  - "The structural prohibition test (no halting-path module reads monitorClients) is written twice, independently, in broker-control.test.ts and text-connect.test.ts -- one enumerating package.json's files[] (the shipped surface), one enumerating git ls-files (the full tracked tree) -- since the plan named both."

requirements-completed: [CHAN-02]

coverage:
  - id: D1
    description: "InstanceRecord.monitorClients replaces the single monitorClient field, per-channel, non-optional; both channels may be claimed simultaneously by the same grant and claiming one never evicts or is refused by the other's holder (CHAN-02)"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "broker-state.test.ts#InstanceRecord.monitorClients: present and empty on a freshly constructed record"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#monitor_claim (D-14): claiming 'text' on an instance whose 'binary' channel is held by a DIFFERENT grant succeeds -- the two channels are independent"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second MCP process attempting to claim an instance's text monitor is refused by name on a working control socket, naming the holder and the channel"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#monitor_claim (D-14): a 'text' claim from a second grant while a first grant holds 'text' is refused monitor_owned, naming the first grant's id and the text channel, with no wedge/hang/frozen/stuck/unresponsive vocabulary"
        status: pass
      - kind: unit
        ref: "text-connect.test.ts#textConnect: a monitor_owned claim refusal propagates as MonitorOwnershipError, and no dial is ever attempted"
        status: pass
    human_judgment: false
  - id: D3
    description: "A client that omits channel behaves exactly as it does today (backward compatibility); an unrecognised non-empty value is bad_request naming both accepted values"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#monitor_claim (D-14): no channel field at all behaves exactly as channel: 'binary'"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#monitor_claim (D-14): an unrecognised non-empty channel value is bad_request, naming both accepted values"
        status: pass
      - kind: unit
        ref: "vice-broker-client.test.ts#monitor_claim (D-14): claimMonitor() with no channel puts 'binary' on the wire"
        status: pass
    human_judgment: false
  - id: D4
    description: "StatusInstanceEntry's wire shape is unchanged; hasMonitorClient now means 'any channel is claimed'"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#status (D-14): hasMonitorClient is true when only the text channel is claimed"
        status: pass
      - kind: other
        ref: "acceptance criterion checked directly: StatusInstanceEntry declares exactly port, url, state, reason, epoch, hasMonitorClient -- no seventh field"
        status: pass
    human_judgment: false
  - id: D5
    description: "The channel discriminator is bookkeeping for socket ownership only -- no halting operation consults monitorClients, and cross-channel halt serialization stays entirely channel-lock.ts's job"
    verification:
      - kind: other
        ref: "broker-control.test.ts#structural (D-14): no halting-path module reads monitorClients -- enumerated from package.json's files[]"
        status: pass
      - kind: other
        ref: "text-connect.test.ts#structural (D-14): git ls-files agrees -- the identifier appears only in the four broker-side modules, their resources/*.mjs artifacts, and InstanceRecord test fixtures"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-09
status: complete
---

# Phase 41 Plan 03: The Text Channel, Its Serialization Authority, and the Contention Verdict Summary

**Promoted `InstanceRecord.monitorClient` to a per-channel holder map (`monitorClients`) and threaded an explicit `channel` field through the broker control wire, the container-side client, and both connect paths, so a second MCP process claiming an instance's text-monitor socket is now refused by name -- naming the holder and the channel -- instead of vanishing into stock's measured accepted-then-silent wire state.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files modified:** 20 (16 source/test, 4 regenerated `resources/*.mjs`)

## Accomplishments

- `broker-state.mts` exports `MONITOR_CHANNELS`/`MonitorChannel` and replaces `InstanceRecord.monitorClient?` with a non-optional `monitorClients: Partial<Record<MonitorChannel, {grantId; claimedAt; pid}>>`, defaulted to `{}` at the one construction site (`spawnAndRecordInstance()`). `clearMonitorClient(record, channel?)` clears one channel or every channel. The stale MONITOR-OWNERSHIP DECISION banner (which handed the discriminator to "Phase 7" and asserted nothing dials the text port) is rewritten to state the current, correct decision.
- `broker-control.mts`'s `monitor_claim`/`monitor_release` wire ops gain a `channel` field: absent means `binary` (backward compatible with a broker restarted mid-phase against an older client), an unrecognised non-empty value is `bad_request` naming both accepted values. `MonitorHolder` carries `channel`; the `monitor_owned` refusal names it, in the established non-wedge vocabulary.
- `vice-broker.mts`'s `handleMonitorClaim()`/`handleMonitorRelease()` are now per-channel: a repeated claim from the same grant on the same channel is idempotent, a claim from a different grant on an already-held channel is refused naming that channel's holder, and a different channel's holder is irrelevant to the decision -- claiming `text` never evicts or is refused by a `binary` holder. `handleStatus()`'s `hasMonitorClient` now means "at least one channel is claimed," with `StatusInstanceEntry`'s wire shape unchanged.
- `vice-broker-client.ts` extends `ClaimMonitorOptions`/`ReleaseMonitorOptions` with an optional `channel` (default `binary`), `MonitorClaimHolder`/`MonitorOwnershipError` carry `channel`, and `extractHolder()` defaults a missing/malformed wire channel to the channel the request itself asked for -- never fabricated.
- `stock-connect.ts` claims/releases `channel: "binary"` explicitly at every call site; `text-connect.ts` claims/releases `channel: "text"` explicitly, and its `monitor_owned` refusal message now states that another client holds the instance's single text-monitor socket -- the exact state Phase 39 measured as accepted-then-silent at the wire, refused here at the control plane instead.
- Five test-helper functions across four test files this plan's own `files_modified` list does not name (`broker-launch.test.ts`, `broker-kill.test.ts`, `vice-broker-acquire.test.ts`, `vice-broker-supervision.test.ts`) needed `monitorClients: {}` added to their `InstanceRecord` literals once the field became non-optional -- a Rule 3 (blocking) fix, tracked below.

## Task Commits

1. **Task 1: Promote monitorClient to a per-channel holder map, broker-side** - `d96f37ab` (feat)
2. **Task 2: Thread the channel through the client and both connect paths** - `da01fc05` (feat)

**Plan metadata:** committed separately (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md), see the `docs(41-03)` commit following this file.

## Files Created/Modified

- `src/mcp/vice/broker-state.mts` - `MONITOR_CHANNELS`, `MonitorChannel`, `InstanceRecord.monitorClients`, widened `clearMonitorClient(record, channel?)`, rewritten ownership banner
- `src/mcp/vice/broker-control.mts` - `MonitorHolder.channel`, `onMonitorClaim`/`onMonitorRelease` gain a `channel` parameter, `resolveMonitorChannel()`, updated wire dispatch and refusal wording
- `src/mcp/vice/broker-launch.mts` - `spawnAndRecordInstance()` defaults `monitorClients: {}`; `handleExit()` assigns `{}` in place of `undefined`
- `src/mcp/vice/vice-broker.mts` - `handleMonitorClaim()`/`handleMonitorRelease()` per-channel; `handleStatus()`'s `hasMonitorClient` computation
- `src/mcp/vice/vice-broker-client.ts` - `MonitorClaimChannel`, `ClaimMonitorOptions.channel`/`ReleaseMonitorOptions.channel`, `MonitorClaimHolder.channel`, `MonitorOwnershipError.channel`, `extractHolder()` widened
- `src/mcp/vice/stock-connect.ts` - explicit `channel: "binary"` at every claim/release call site
- `src/mcp/vice/text-connect.ts` - explicit `channel: "text"` at every claim/release call site, refusal wording updated
- `src/mcp/vice/broker-state.test.ts` - `MONITOR_CHANNELS` and per-channel `clearMonitorClient()` invariant tests
- `src/mcp/vice/broker-control.test.ts` - per-channel `monitor_claim`/`monitor_release` wire tests, `hasMonitorClient` text-only case, structural prohibition test
- `src/mcp/vice/vice-broker-client.test.ts` - wire-level `channel` field assertions, holder-channel defaulting
- `src/mcp/vice/stock-connect.test.ts` - `channel: "binary"` assertions on claim/release
- `src/mcp/vice/text-connect.test.ts` - `channel: "text"` assertions, structural prohibition test (git ls-files variant)
- `src/mcp/vice/broker-launch.test.ts`, `src/mcp/vice/broker-kill.test.ts`, `src/mcp/vice/vice-broker-acquire.test.ts`, `src/mcp/vice/vice-broker-supervision.test.ts` - `monitorClients: {}` added to raw `InstanceRecord` literals (Rule 3 fix)
- `src/mcp/vice/resources/broker-state.mjs`, `resources/broker-control.mjs`, `resources/broker-launch.mjs`, `resources/vice-broker.mjs` - regenerated via `npm run build`, committed alongside their `.mts` sources

## Decisions Made

- **`monitorClients` is non-optional**, not optional-and-defaulted -- this is what forces every raw `InstanceRecord` construction site to state its intent explicitly, closing the exact "absent field silently means no claim" gap the single `monitorClient?` field left open.
- **`MonitorClaimHolder`/`MonitorHolder` both make `channel` a required field** -- every fallback path (both sides' WR-08 defaulting, `extractHolder()`) names the requested channel explicitly rather than omitting the field or fabricating a value.
- **The structural "no halting-path module reads monitorClients" prohibition is proven twice**, independently, since the plan named both an enumeration of `package.json`'s `files[]` and one derived from `git ls-files` -- the two use disjoint discovery mechanisms and therefore disjoint blind spots.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Five InstanceRecord test-fixture literals across four files outside this plan's own `files_modified` list needed `monitorClients: {}`**
- **Found during:** Task 1's own `npm run typecheck` verification, immediately after making `monitorClients` non-optional
- **Issue:** `broker-launch.test.ts`'s `makeInstance()` and two standalone literals, `broker-kill.test.ts`'s `makeInstance()`, `vice-broker-acquire.test.ts`'s `makeReadyInstance()`, and `vice-broker-supervision.test.ts`'s `stockInstanceRecord()` all construct a raw `InstanceRecord` object without a `monitorClients` key. None of these files is named in this plan's own `files_modified`, but the plan's own Task 1 action explicitly makes the field non-optional, which is a compile-time-enforced consequence that reaches every construction site in the package, not only the ones the plan happened to list.
- **Fix:** Added `monitorClients: {}` to each of the five literals, with a one-line comment citing this plan and D-14.
- **Files modified:** `src/mcp/vice/broker-launch.test.ts`, `src/mcp/vice/broker-kill.test.ts`, `src/mcp/vice/vice-broker-acquire.test.ts`, `src/mcp/vice/vice-broker-supervision.test.ts`
- **Verification:** `npm run typecheck` clean; `node --test` on all four files plus the full Task 1 test set (246/246 pass).
- **Committed in:** `d96f37ab` (Task 1 commit)

**2. [Rule 3 - Blocking] Both structural "no halting-path module reads monitorClients" tests needed to allow-list `text-connect.test.ts` itself**
- **Found during:** Task 2's own verification run, after adding the second (git-ls-files-based) structural test to `text-connect.test.ts`
- **Issue:** Both structural tests search the repository's own tracked source for the literal identifier `monitorClients`. Each test's own source code necessarily contains that literal string (as the value it searches for), so each test's `git ls-files`-based sibling in `broker-control.test.ts` initially flagged `text-connect.test.ts` as an "offender," and `text-connect.test.ts`'s own git-ls-files variant flagged itself.
- **Fix:** Added `text-connect.test.ts` to the `ALLOWED` set in both structural tests' `git ls-files` variants, with a comment explaining the self-reference is not a halting-path consumer.
- **Files modified:** `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts`
- **Verification:** `node --test broker-state.test.ts broker-control.test.ts vice-broker-acquire.test.ts broker-launch.test.ts broker-kill.test.ts vice-broker-supervision.test.ts vice-broker-client.test.ts stock-connect.test.ts text-connect.test.ts channel-lock.test.ts text-protocol.test.ts stock-dispatch.test.ts` -- 509/509 pass.
- **Committed in:** `da01fc05` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed, both Rule 3 (blocking) fixes required by this plan's own stated verification (`npm run typecheck` and the two structural tests it specifies). **Impact on plan:** Neither expanded scope beyond CHAN-02 -- both were mechanical consequences of the non-optional field and the self-referential structural test, not new functionality.

## Issues Encountered

- **`npm run test:automated` under a short (~2 min) command timeout produces a cascade of unrelated `'Promise resolution is still pending but the event loop has already resolved'` failures across many test files** -- this is the harness killing the whole `node test-gate.mjs` process mid-run, not a real per-file failure; every one of those files passes standalone. Re-running with a longer budget (`timeout 580 npm run test:automated`) completes cleanly at the documented floor: **3 failures**, confined to `anno-register.test.ts` (`DIRECTION 5`, `planted violation`) and `anno-import.test.ts` (`annoRegisterEntryFor()`), matching this project's own documented pre-existing baseline exactly (`test-automated-hides-ci-failures`, `test-suite-races-on-repo-tree-scratch-files`). None of the three failing tests touch a file this plan modified. This plan's own `<verify>` line cites a "2-failure baseline," which is the OLDER of two documented floors on this tree -- the 41-01/41-02 SUMMARYs and this project's own environment notes both independently confirm 3 is now the correct floor.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **D-14 is closed.** `monitorClients` is the per-channel holder map every future plan on this monitor-ownership seam builds on; `channel-lock.ts` (plan 41-02) remains the ONLY cross-channel halt-serialization authority, untouched by this plan, exactly as the recorded `go` verdict requires.
- Plan 41-04's `vice_diagnose` and plan 41-06's `handleDeviceConsole`/`handleWarpSet` can now rely on `textConnect()`'s claim genuinely enforcing one-text-client-per-instance -- the gap both 41-01's and 41-02's own "Next Phase Readiness" sections flagged as still open is now closed.
- `evidence.channelContention` (plan 41-04) has a real refusal state to observe: `handleMonitorClaim()`'s per-channel `monitor_owned` outcome, distinguishable from `channel-lock.ts`'s own contention (different mechanism, different layer).
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All 11 key modified source files confirmed present via `[ -f ]`: `broker-state.mts`, `broker-control.mts`, `broker-launch.mts`, `vice-broker.mts`, `vice-broker-client.ts`, `stock-connect.ts`, `text-connect.ts`, and the four regenerated `resources/*.mjs` siblings.
- Both task commits (`d96f37ab`, `da01fc05`) confirmed present via `git log --oneline --all`.
- `npm run typecheck` clean (re-confirmed).
- `node --test resources-sync.test.ts` -- 2/2 pass (regenerated `resources/*.mjs` byte-identical to a fresh build).
- `! grep -aq 'is the right place to add' broker-state.mts` and `! grep -aq 'NOTHING IN PHASE 3 DIALS THIS PORT' broker-state.mts` both succeed -- the stale banner sentences are gone.
- `StatusInstanceEntry` confirmed to declare exactly `port`, `url`, `state`, `reason`, `epoch`, `hasMonitorClient` -- no seventh field.
- `node --test broker-state.test.ts broker-control.test.ts vice-broker-acquire.test.ts broker-launch.test.ts broker-kill.test.ts vice-broker-supervision.test.ts vice-broker-client.test.ts stock-connect.test.ts text-connect.test.ts channel-lock.test.ts text-protocol.test.ts stock-dispatch.test.ts` -- 509/509 pass.
- `npm run test:automated` (full run, no timeout truncation) -- 3665 tests, 3 failures, all confined to the documented `anno-register.test.ts`/`anno-import.test.ts` baseline; no failure touches a file this plan modified.
- No unexpected deletions in either task commit (`git diff --diff-filter=D --name-only` empty for both).
