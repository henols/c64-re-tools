---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
plan: 03
subsystem: infra
tags: [vice-mcp, broker-control-plane, incident-record, channel-lock, in-flight-operation]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "01"
    provides: "the attach control op, the per-claim handle, the relay splice broker-incident.mts's own writer serves"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "02"
    provides: "the text channel's own relay attach, the attached-flag close handler broker-incident.mts's consumer (Plan 63-04) will build on"
provides:
  - "The eleventh control op `operation` (broker-control.mts) -- declares or clears the operation a grant's own connection has in flight, gated on the SAME ownsTarget() predicate monitor_claim/monitor_release/recycle already share"
  - "sanitiseSessionLabel() (broker-control.mts) -- strips C0 control characters and both line terminators, trims, caps at 64 characters; exported for Plan 63-05's session label to reuse verbatim"
  - "broker-state.mts: GrantRecord.operation -- a required { name, declaredAt } | null field, the broker's own record of what a grant's connection is doing right now"
  - "vice-broker.mts: handleOperationNote() -- the ONE place a grant's in-flight-operation field is written"
  - "vice-broker-client.ts: BrokerControlSession.noteOperation() -- a typed, never-throwing client method built on the same sendAndAwaitLine() every other method uses"
  - "broker-incident.mts (new, host-bound): BROKER_INCIDENT_VERSION, BrokerIncidentInput, BrokerIncidentTrigger, renderBrokerIncident(), writeBrokerIncident(), brokerIncidentPath(), brokerIncidentStem() -- the broker's own atomic incident writer, rooted at the machine-level incidents directory"
  - "stock-dispatch.ts's withChannelLockHeld()/text-tools.ts's withTextTool() declare and clear the in-flight operation over the lease's own control session, without ever awaiting the reply"
affects: [63-04, 63-05, 63-06]

actuals:
  tokens: 31836
  tasks: 3
  commits: 3
  plan_head_before: 9de25ba610e435612dcc864e64aef78ea63f9573

tech-stack:
  added: []
  patterns:
    - "Fire-and-forget declaration over an already-open session: noteOperation() is built on the SAME sendAndAwaitLine() every other BrokerControlSession method uses (so its response-ordering discipline is preserved), but its two call sites (stock-dispatch.ts, text-tools.ts) never await the returned promise -- a slow or refusing broker degrades the record's detail, never the tool call."
    - "Purpose-built host-bound sibling over a parameterised shared writer: broker-incident.mts mirrors incident-record.ts's field names and atomic-write shape rather than threading a directory parameter through the existing writer -- the two vocabularies are held together by a sync test, not by a shared import (host-bound .mts cannot import container-side .ts at all)."
    - "One in-flight operation per grant, not per channel: GrantRecord.operation is a single field regardless of which channel declared it -- channel-lock.ts's own cross-channel mutex already guarantees only one logical operation runs for a grant at a time, so a second, per-channel field would only invite drift."
    - "Ownership-gated wire op reusing the existing predicate: the `operation` op's dispatch skeleton (target_id check, ownsTarget(), channel resolver) is byte-for-byte the same shape monitor_claim/monitor_release/recycle already established, not a new authorization mechanism."

key-files:
  created:
    - src/mcp/vice/broker-incident.mts
    - src/mcp/vice/broker-incident.test.ts
    - src/mcp/vice/resources/broker-incident.mjs
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/vice-broker-client.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/build.ts
    - src/mcp/vice/tsconfig.build.json
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - Nineteen further test files carrying mechanical fallout from three widened, REQUIRED shapes (GrantRecord.operation, StartControlListenerOptions.onOperation, StockConnectBrokerControl.noteOperation) -- see Deviations.

key-decisions:
  - "GrantRecord.operation is REQUIRED (not optional), matching this record's own `pid` field convention -- every grant is created with it explicitly `null` rather than left absent, so a reader can never mistake 'this field was never wired up' for 'nothing is in flight'."
  - "The `operation` op's channel argument is accepted (wire-shape symmetry with every other target-naming op) but not itself stored -- one grant has exactly one in-flight operation regardless of which channel declared it, so storing it per-channel would invite the two copies to disagree."
  - "broker-incident.mts is a small, purpose-built module rather than a parameterised incident-record.ts -- OQ3's own plan-level decision, recorded in the PLAN.md itself before any code was written."

requirements-completed: []  # SESS-05 is shared with sibling plan 63-04 in this phase; blocked by requirements.ready-ids until 63-04 also has a SUMMARY (per the shared-ID gate).

coverage:
  - id: D1
    description: "The eleventh control op `operation` declares or clears a grant's own in-flight operation, gated on the same ownsTarget() predicate every other target-naming op uses, with an unrecognised channel or a malformed target_id refused by name before the callback ever runs"
    requirement: "SESS-05"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#operation: a declaration from a connection that owns the named grant is accepted, and the callback observes the ALREADY-SANITISED name"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#operation: a declaration naming a grant this connection does NOT hold is refused denied, with the SAME ownership wording monitor_claim/monitor_release/recycle share, and the callback never runs"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#operation: an unrecognised non-empty channel value is bad_request, naming both accepted values, and the callback never runs"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#operation: name null clears -- the callback observes null verbatim, never an empty string"
        status: pass
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleOperationNote: clearing an ALREADY-clear operation answers ok, not an error -- matching monitor_release's own tolerance"
        status: pass
    human_judgment: false
  - id: D2
    description: "A declared operation name is sanitised (C0 control characters and both line terminators stripped, capped at 64 characters) before the broker's own callback ever sees it, never rejected outright"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#sanitiseSessionLabel: strips every C0 control character (including both line terminators), trims, and caps at 64 characters"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#operation: a name carrying a line terminator and 200 characters is recorded stripped and truncated to at most 64 characters, never rejected outright"
        status: pass
    human_judgment: false
  - id: D3
    description: "noteOperation() is written without being awaited by its two call sites (stock-dispatch.ts, text-tools.ts) and the broker still observes a declare-then-clear pair in order, proving a tool call is never blocked on either reply"
    requirement: "SESS-05"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#operation: Task 3 ordering proof -- a declare, the wrapped work, then a clear are all issued without ever awaiting either reply, and the broker still observes them in order"
        status: pass
      - kind: other
        ref: "grep gate: stock-dispatch.ts/text-tools.ts each reach .noteOperation( at least once, and neither opens a local control session (openBrokerControl( count 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The broker can write an atomic, owner-only incident record into the machine-level incidents directory from its own compiled artifact, with the two record vocabularies (this module and incident-record.ts) held together by a sync test"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-incident.test.ts#writeBrokerIncident() with an explicit dir creates the directory when it does not exist and places the record inside it"
        status: pass
      - kind: unit
        ref: "broker-incident.test.ts#writeBrokerIncident(): the finished file's mode grants no group or other permission bits"
        status: pass
      - kind: unit
        ref: "broker-incident.test.ts#writeBrokerIncident(): no temporary file remains beside the record after a successful write"
        status: pass
      - kind: unit
        ref: "broker-incident.test.ts#renderBrokerIncident(): a null operation renders an explicit absence and a false void flag, never an empty heading"
        status: pass
      - kind: unit
        ref: "broker-incident.test.ts#vocabulary sync: the shared field names (version/at/port/epoch_before/reason) appear, spelled identically, in both incident-record.ts and broker-incident.mts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole suite is green with the new op and writer in place, and the rebuilt host-bound artifacts (14 entries, including the new broker-incident.mjs) are committed with their sources"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck; npm --prefix src/mcp/vice run build (14 artifacts); npm --prefix src/mcp/vice run test:automated; npm --prefix src/mcp/vice test (full glob)"
        status: pass
    human_judgment: false

duration: 45min (approximate -- session start not timestamped; commit span alone was ~37min)
completed: 2026-09-19
status: complete
---

# Phase 63 Plan 3: The Monitor Channel Relayed, and the Connection as the Session Summary

**The broker gained an eleventh control op naming what a grant's connection is doing right now (ownership-gated, sanitised, cleared on release) and a new host-bound `broker-incident.mts` writer that lands an atomic, owner-only record in the machine-level incidents directory -- both wired into the binary and text tool wrappers as fire-and-forget declarations that cost a tool call nothing.**

## Performance

- **Duration:** ~45 min (approximate)
- **Completed:** 2026-09-19T23:52:53+02:00
- **Tasks:** 3 completed
- **Files modified:** 33 (3 created, 30 modified)

## Accomplishments

- Eleventh control op `operation` (`broker-control.mts`): declares or clears a grant's own connection's in-flight operation, dispatched AFTER the token gate on the connection's ordinary line reader (never touches `relayMode`), gated on the exact `ownsTarget()` predicate `monitor_claim`/`monitor_release`/`recycle` already share.
- `sanitiseSessionLabel()`: strips every C0 control character (0x00-0x1F, which already covers both line terminators) and caps at 64 characters, run over every declared name before `handleOperationNote()` ever sees it. Exported for Plan 63-05's session label to reuse verbatim.
- `broker-state.mts`: `GrantRecord.operation` -- a REQUIRED `{ name, declaredAt } | null` field, mirroring `pid`'s own "never absent" convention. `vice-broker.mts`'s `handleOperationNote()` is the one place it is written: resolves the grant directly from `state.grants` (never through an instance's monitor-client map), returns `bad_request` for a should-be-unreachable missing grant, and stamps `declaredAt` from an injectable clock.
- `vice-broker-client.ts`: `BrokerControlSession.noteOperation()` -- built on the same `sendAndAwaitLine()` every other method uses, returning a typed outcome that never throws (including when the broker closes mid-request), so a caller can send it without ever awaiting the reply.
- New, purpose-built `broker-incident.mts` (host-bound, 14th `HOST_BOUND_ARTIFACTS` entry): `renderBrokerIncident()`/`writeBrokerIncident()`/`brokerIncidentPath()`/`brokerIncidentStem()`. Resolves its directory through `broker-home.mts`'s `brokerIncidentsDir()` (its first production caller), writes atomically (temp sibling, mode 0600, rename), and never reuses `incident-record.ts` (container-side, per-project-rooted, and unreachable from a compiled host-bound artifact anyway). A `null`/absent operation renders as an explicit "none declared" and `void: false`; a present one sets `void: true`.
- `broker-incident.test.ts` (15 tests): directory-choice, atomicity, permission-mode, malformed-input tolerance, and the vocabulary-sync case that reds if `incident-record.ts` and `broker-incident.mts` ever rename a shared field (`version`/`at`/`port`/`epoch_before`/`reason`) without the other following.
- `stock-dispatch.ts`'s `withChannelLockHeld()` now takes the live `StockConnectSession` and declares the operation (via a new `declareOperation()` helper) on the lease's OWN control session -- never a locally-derived one -- immediately before the wrapped handler runs, clearing it in the same `finally` that releases the channel lock. `text-tools.ts`'s `withTextTool()` does the identical thing around its `withTextChannelLock()` call, on the text channel.
- A wire-level ordering proof in `broker-control.test.ts`: a declare, the "wrapped work", then a clear are all issued without the calling code ever awaiting either reply, and the broker still observes the pair in order for one logical operation.

## Task Commits

Each task was committed atomically:

1. **Task 1: The broker learns what is in flight** - `150f2fee` (feat)
2. **Task 2: A writer the broker can actually reach** - `2a603b20` (feat)
3. **Task 3: The two wrappers declare what they are doing** - `da48ff2a` (test)

_Note: no TDD cycle in this plan -- `type: execute`, not `type: tdd` (though each task itself carries `tdd="true"` and was developed test-first within its own commit)._

## Files Created/Modified

- `src/mcp/vice/broker-incident.mts` - New host-bound module: the broker's own atomic incident writer
- `src/mcp/vice/broker-incident.test.ts` - New: 15 tests covering directory choice, atomicity, permissions, malformed input, and the vocabulary sync
- `src/mcp/vice/resources/broker-incident.mjs` - Compiled twin, committed alongside its source
- `src/mcp/vice/broker-control.mts` - The `operation` op, `OperationNoteOutcome`, `sanitiseSessionLabel()`, the `onOperation` callback
- `src/mcp/vice/broker-control.test.ts` - `operation` op dispatch cases, the ordering proof, `sanitiseSessionLabel()` unit tests, the three `ControlRequestKind`-member-count structural gates updated to eleven
- `src/mcp/vice/broker-state.mts` - `GrantRecord.operation`
- `src/mcp/vice/vice-broker.mts` - `handleOperationNote()`, `onOperation` wiring
- `src/mcp/vice/vice-broker-client.ts` - `NoteOperationOptions`/`NoteOperationOutcome`, `BrokerControlSession.noteOperation()`
- `src/mcp/vice/vice-broker-client.test.ts` - Six new `noteOperation()` outcome-mapping tests (ok, channel default/override, name-null clear, denied/bad_request forwarding, broker-gone, timeout)
- `src/mcp/vice/vice-broker-acquire.test.ts` - Five direct unit tests of `handleOperationNote()` against a hand-built `BrokerState`
- `src/mcp/vice/stock-connect.ts` - `StockConnectBrokerControl` widened with `noteOperation`
- `src/mcp/vice/stock-dispatch.ts` - `declareOperation()`, `withChannelLockHeld()` widened to take the session and declare/clear around the wrapped call
- `src/mcp/vice/text-tools.ts` - `withTextTool()` declares/clears around `withTextChannelLock()`
- `src/mcp/vice/build.ts` / `tsconfig.build.json` - `broker-incident.mjs`/`.mts` added to the host-bound artifact set (14 entries)
- Nineteen further test files (`broker-endpoint.test.ts`, `broker-launch.test.ts`, `broker-relay.test.ts`, `broker-relay-text.test.ts`, `broker-state.test.ts`, `host-tool-transport.test.ts`, `host-tool.test.ts`, `stock-connect.test.ts`, `stock-dispatch.test.ts`, `stock-recycle.test.ts`, `text-connect.test.ts`, `text-tools.test.ts`, `disasm-roundtrip.test.ts`, `anno-tools.test.ts`, `vice-proxy-ping.test.ts`, `vice-proxy.test.ts`) - mechanical fallout from three widened, REQUIRED shapes: `GrantRecord.operation`, `StartControlListenerOptions.onOperation`, `StockConnectBrokerControl`/`BrokerControlSession.noteOperation`

## Decisions Made

- `GrantRecord.operation` is REQUIRED, not optional -- see key-decisions above.
- The `operation` op's `channel` argument is accepted but not stored per-channel -- see key-decisions above.
- `broker-incident.mts` is a small, purpose-built module rather than a parameterised `incident-record.ts` -- OQ3, decided in the PLAN.md itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widening `GrantRecord.operation`/`StartControlListenerOptions.onOperation`/`StockConnectBrokerControl.noteOperation` to REQUIRED rippled into nineteen test files not named in the plan's `files_modified`**
- **Found during:** Task 1's own `npm run typecheck` (whole-project, not scoped to this plan's files)
- **Issue:** Making the grant's own operation field, the listener's `onOperation` callback, and the narrow `StockConnectBrokerControl`/full `BrokerControlSession` interfaces' `noteOperation` member all REQUIRED (matching every sibling field's own convention, per the plan's own design) broke compilation in every fixture across the suite that constructs a raw `GrantRecord` literal, stubs a control listener, or stubs a broker-control session -- `broker-state.test.ts`, `vice-broker-acquire.test.ts`, `broker-relay.test.ts`, `broker-relay-text.test.ts`, `broker-launch.test.ts`, `broker-endpoint.test.ts`, `host-tool-transport.test.ts`, `host-tool.test.ts`, `vice-proxy-ping.test.ts`, `vice-proxy.test.ts`, `stock-connect.test.ts`, `text-connect.test.ts`, `stock-dispatch.test.ts`, `text-tools.test.ts`, `disasm-roundtrip.test.ts`, `anno-tools.test.ts`, `stock-recycle.test.ts` -- the same class of fallout Plans 63-01/63-02 already documented for this same file set.
- **Fix:** Added `operation: null` to every `GrantRecord` literal, `onOperation: () => ({ ok: true })` (or a recording variant) to every `StartControlListenerOptions` literal, and `noteOperation: async () => ({ ok: true })` (or a `throw`-on-unexpected-call stub, where the fixture never legitimately reaches it) to every `StockConnectBrokerControl`/`BrokerControlSession` fixture. No assertion was weakened and no case was deleted. Three structural tests in `broker-control.test.ts` that pinned `ControlRequestKind` at exactly ten members were updated to eleven.
- **Files modified:** the nineteen files named above, plus the three structural-count tests in `broker-control.test.ts`.
- **Verification:** `npm run typecheck` exit 0; each affected file's own suite re-run individually (all green); confirmed again in the full-glob run.
- **Committed in:** `150f2fee` (Task 1 commit)

**2. [Rule 1 - Bug] The Edit tool wrote raw control bytes (0x00, 0x01, 0x1F) into `broker-control.mts` and `broker-control.test.ts` where the source was meant to carry the literal 6-character escape text ` `/``/``**
- **Found during:** Task 1, while verifying the newly-added `sanitiseSessionLabel()` and its test case with `grep` -- multiple `grep` invocations against `broker-control.test.ts`/`broker-control.mts` silently returned zero matches for strings known to be present, the exact symptom this project's own standing note (`nul-escape-in-tool-params-writes-raw-nul.md`) describes for ` ` specifically; this session additionally found the SAME corruption for `` (and, in the test's own hostile-input literal, ``).
- **Issue:** A raw NUL byte (and other raw C0 control bytes) landed inside a `.mts`/`.ts` source file instead of the 6-character escape sequence, which corrupts the file for any tool that treats a NUL byte as "this is binary" (plain `grep` skips it silently, matching this project's own documented NUL-byte gotcha for four OTHER files) and changes the RUNTIME semantics of the regex character class and the test's own string literal, since a raw control byte in source is not the same thing as its `\uXXXX` escape once concatenated with adjacent text.
- **Fix:** Located every raw control byte (`python3` byte-level scan) in both files and replaced it with its intended literal escape text (` `, ``, ``), verified the fix left zero stray control bytes across every file touched by this plan, and re-ran the affected test file and the full typecheck/test suite to confirm no other behavior changed.
- **Files modified:** `src/mcp/vice/broker-control.mts`, `src/mcp/vice/broker-control.test.ts`
- **Verification:** `python3` byte-level scan across all 22 files this plan touched confirms zero stray control bytes; `node --test broker-control.test.ts` green; full typecheck/build/test:automated/npm test all green.
- **Committed in:** `150f2fee` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking ripple across nineteen files plus three structural-count updates, 1 tooling-caused source-corruption bug caught and fixed before it ever reached a commit)
**Impact on plan:** Both were necessary for correctness -- the ripple keeps the whole suite green after a deliberate, plan-required widening of three shapes to REQUIRED; the control-byte fix corrects a tool-level corruption that would otherwise have shipped invisible-to-`grep` bytes into two source files. No scope creep beyond what proving this plan's own must_haves demanded.

## Known Stubs

None. `writeBrokerIncident()` has no production caller yet -- this is explicit, plan-documented groundwork for Plan 63-04 ("both have to exist before Plan 63-04 can order a write ahead of a reclaim"), not a silently-introduced gap, exactly like Plan 63-01's `DEFAULT_RELAY_IDLE_MS`/`DEFAULT_RELAY_KEEPALIVE_MS` before it.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 63-04, which is expected to consume `broker-incident.mts`'s `writeBrokerIncident()` and `vice-broker.mts`'s `GrantRecord.operation` field to implement `handleRelayDeath()` -- writing an incident record BEFORE reclaiming a dead relay connection, naming whatever operation was in flight.
- `SESS-05` stays unmarked-complete in REQUIREMENTS.md pending sibling plan 63-04 in this same phase, which also declares it (the shared-ID gate blocks it until every declaring plan has a SUMMARY).
- Any later plan reaching for "what is this grant doing right now" should read `GrantRecord.operation` directly; any later plan needing a broker-side incident write should call `broker-incident.mts`'s `writeBrokerIncident()`, never re-derive a second host-bound writer.

## Self-Check: PASSED

- Created files verified on disk: `src/mcp/vice/broker-incident.mts`, `src/mcp/vice/broker-incident.test.ts`, `src/mcp/vice/resources/broker-incident.mjs` -- all `FOUND`.
- Commit hashes verified in `git log --oneline --all`: `150f2fee`, `2a603b20`, `da48ff2a` -- all `FOUND`.
- All plan-level `<verification>` commands re-run and passing: typecheck (exit 0), build (14 artifacts, `resources/broker-incident.mjs` present), `resources-sync.test.ts` (passes as part of the 150-test Task 1 verify run), `test:automated` (4038/4047 pass, 0 fail, 9 skipped, exit 0), full `npm test` glob (4130/4211 pass, 0 fail, 81 skipped, exit 0), `git diff --stat -- src/mcp/vice/package.json` empty, `broker-incident.test.ts` confirmed absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`.
- All plan `<success_criteria>` re-checked against this SUMMARY's own coverage table (D1-D5) -- every one has a passing verification entry.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session*
*Completed: 2026-09-19*
