---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
plan: 05
subsystem: infra
tags: [vice-mcp, broker-control-plane, session-identity, status-projection, stateless-call]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "01"
    provides: "the attach control op, the per-claim handle, spliceRelay()/RelaySession -- the relay splice this plan's identity work sits beside"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "03"
    provides: "sanitiseSessionLabel(), the eleventh control op operation, GrantRecord.operation -- this plan reuses the sanitiser verbatim and reports the operation field in status"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "04"
    provides: "the evidence-before-reclaim machinery this plan's identity fields ride alongside in the grant record and the status projection"
provides:
  - "vice-broker-client.ts: resolveSessionLabel() -- CLAUDE_CODE_SESSION_ID when set, else cwd basename + pid; both acquire write sites attach it via the same key-omitted-when-absent idiom the profile fragment already uses"
  - "broker-control.mts: the acquire dispatch arm sanitises the wire `label` field and threads it as onAcquire's optional third parameter; StatusInstanceEntry gains sessionLabel/grantId/operation, each nullable and resolved together"
  - "broker-state.mts: GrantRecord.sessionLabel -- required, never an authorisation input"
  - "vice-broker.mts: the single grant-recording step records the label; findOwningGrant()/handleStatus() (now exported) resolve a status entry's owning grant by the SAME (port, pid) identity comparison handleRelease() already uses before it kills anything"
  - "The T-63-17 invariant test: every target-naming op refuses another session's declared label as a target id byte-identically to a bare garbage target id, with the covered op set asserted against the live ControlRequestKind union"
  - "The SESS-01 confirmation: a stateless host_tool call is proven -- by observation of broker state across ten repetitions, and structurally from host-tool-client.ts's own source -- to bind no lease"
affects: [63-06]

actuals:
  tokens: 21900
  tasks: 3
  commits: 3
  plan_head_before: 4855c6e8c29172c436a8a05690456db85ada1fbb

tech-stack:
  added: []
  patterns:
    - "Key-omitted-when-absent, reused for a second field: the session label joins the acquire wire line through the SAME fragment idiom the launch profile already established (acquireProfileFragment()/acquireLabelFragment()), rather than inventing a second decision site for whether a key appears at all."
    - "Identity by (port, pid), not by port alone: findOwningGrant() reuses the EXACT comparison handleRelease() already makes before it kills anything -- a port whose occupant has been replaced by an unrelated process (crash-respawn, recycle, give-up) reports no stale identity, for what status DISPLAYS as much as for what a release KILLS."
    - "Generalisation for identification only, never for authorisation: the session became the primary user-facing identity (status), but every target-naming op still gates on ownsTarget() -- the grant a connection itself holds. A label is never a second credential; proven by an invariant test that compares a label-as-target-id refusal against a garbage-as-target-id refusal for byte-identity, not by reading the code and trusting it."
    - "Confirmation over construction for an ambiguous requirement: SESS-01's edge-probe row was unclassified: rather than build a NEW stateless call path, this plan proved the ALREADY-SHIPPED one (host-tool-client.ts) is genuinely stateless by observing the broker's own state across ten repeated calls, plus a structural source-level proof."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/vice-broker-client.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/host-tool-transport.test.ts
    - src/mcp/vice/README.md
    - src/mcp/vice/broker-state.test.ts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/broker-relay-text.test.ts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/resources/vice-broker.mjs

key-decisions:
  - "resolveSessionLabel() is called with NO overrides at both acquire write sites in vice-broker-client.ts -- a production acquire always attaches the real process's own label; only a direct unit-test call to the exported resolver supplies injected env/cwd/pid overrides. There is no per-call opt-out on the public acquire() API surface, matching the plan-level decision that the label is 'optional on the wire but always present in practice.'"
  - "handleStatus() was widened from a private, non-exported function to an exported one (vice-broker.mts), mirroring handleAcquire()/handleRelease()'s own exported convention -- the identity-resolution logic the plan's read_first names ('the single grant-recording step and the status projection') needed direct test coverage against a hand-built BrokerState, not only through the wire protocol's StatusInstanceEntry shape."
  - "The T-63-17 invariant test compares a label-as-target-id refusal against a GARBAGE-as-target-id refusal for the SAME op, rather than asserting all ops share one denial string -- recycle's own wording differs textually from monitor_claim/monitor_release/operation's shared MONITOR_OWNERSHIP_DENIAL constant, so per-op self-consistency is the correct invariant, not cross-op string equality."

requirements-completed: [SESS-01]
# SESS-02 and SESS-06 are shared with sibling plan 63-06 in this phase (and
# SESS-02 additionally with 63-01/63-02); both stay unmarked pending 63-06's
# own SUMMARY, per the shared-ID gate (requirements.ready-ids).

coverage:
  - id: D1
    description: "resolveSessionLabel() prefers CLAUDE_CODE_SESSION_ID when set, otherwise falls back to the working directory's base name joined to the process id, with injectable env/cwd/pid overrides for testing"
    requirement: "SESS-06"
    verification:
      - kind: unit
        ref: "vice-broker-client.test.ts#resolveSessionLabel(): returns the agent-session environment value verbatim when it is a non-empty string"
        status: pass
      - kind: unit
        ref: "vice-broker-client.test.ts#resolveSessionLabel(): falls back to the working directory's base name joined to the process id when the env var is unset"
        status: pass
      - kind: unit
        ref: "vice-broker-client.test.ts#resolveSessionLabel(): falls back the same way when the env var is present but empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both acquire write sites attach the resolved session label via the same key-omitted-when-absent idiom the launch profile fragment uses, and the broker's acquire dispatch arm sanitises it before threading it to onAcquire's third parameter"
    requirement: "SESS-06"
    verification:
      - kind: integration
        ref: "vice-broker-client.test.ts#acquire label (63-05, write site 1 of 2): acquireOverControlPlane() puts a resolved session label on the wire and it arrives at the broker's onAcquire's third argument"
        status: pass
      - kind: integration
        ref: "vice-broker-client.test.ts#acquire label (63-05, write site 2 of 2): openBrokerControl().acquire() puts a resolved session label on the wire and it arrives at the broker's onAcquire's third argument"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#acquire session label (63-05, SESS-06): a label carrying a line terminator and 200 characters arrives stripped and truncated to at most 64 characters"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#acquire session label (63-05, edge: empty): an acquire with NO label key reaches onAcquire's third argument as null, never fabricated"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status reports, per instance, the owning grant's session label, grant id and in-flight operation, resolved by the same (port, pid) identity comparison handleRelease() already uses -- absent together when no grant matches or the port's occupant has been replaced"
    requirement: "SESS-06"
    verification:
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleStatus: an instance whose owning grant declared a label reports that label, the grant id and the in-flight operation"
        status: pass
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleStatus: an instance with no matching grant at all reports every identity field absent"
        status: pass
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleStatus: an instance whose CURRENT pid differs from the grant's recorded pid (a replaced occupant) reports every identity field absent, never the stale grant's"
        status: pass
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleStatus: two unrelated grants on two unrelated instances are each named separately, never cross-matched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two unrelated sessions on one broker are each separately named in status and separately reclaimed -- closing one connection releases only its own grant"
    requirement: "SESS-02"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#two sessions, one broker: two connections declaring two labels each acquire their own grant against distinct ports, status names both separately, and closing one releases only that one"
        status: pass
    human_judgment: false
  - id: D5
    description: "The session label is provably a display value with no authority: every target-naming op refuses another session's label used as a target id, byte-identically to a bare garbage target id, never quoting the label back, and the covered op set is asserted against the live ControlRequestKind union"
    requirement: "SESS-06"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#invariant (63-05, T-63-17): every target-naming op refuses ANOTHER session's declared label used as a target id, byte-identically to a bare unrelated garbage target id, and never quotes the label back; the covered op set is asserted against ControlRequestKind"
        status: pass
    human_judgment: false
  - id: D6
    description: "A stateless host_tool call leaves the broker's observable state exactly as it found it -- no lease-bearing callback fires across ten repetitions, closing the connection triggers no release, and status is unchanged -- confirmed by observation rather than by reading a comment"
    requirement: "SESS-01"
    verification:
      - kind: integration
        ref: "broker-control.test.ts#stateless call (63-05, SESS-01): a host_tool request never fires an acquire, release, recycle, monitor-claim, monitor-release, attach or operation callback, the closed connection's own close triggers no release, and status is unchanged across ten sequential calls"
        status: pass
      - kind: unit
        ref: "host-tool-transport.test.ts#structural (63-05, SESS-01): host-tool-client.ts's container route opens exactly one connection and writes exactly one request line, never an acquire line, and holds no module-level session handle"
        status: pass
    human_judgment: false
  - id: D7
    description: "The whole suite is green with the identity/status machinery as the production default, and the rebuilt host-bound artifacts are committed with their sources; no dependency was added"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck; npm --prefix src/mcp/vice run build (14 artifacts); resources-sync.test.ts pass; npm --prefix src/mcp/vice run test:automated (4081/4090 pass, 0 fail, 9 skipped); npm --prefix src/mcp/vice test (4173/4254 pass, 0 fail, 81 skipped); git diff --stat -- src/mcp/vice/package.json empty"
        status: pass
    human_judgment: false

duration: ~30min (approximate -- session start not explicitly timestamped; commit span alone was ~10min)
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 5: The Monitor Channel Relayed, and the Connection as the Session Summary

**A client-resolved session label now rides every acquire, lands on the grant, and is reported in `status` beside the grant id and in-flight operation -- resolved by the same (port, pid) identity comparison the release path already trusted -- while an invariant test proves the label can never become a second credential, and a separate proof confirms the already-shipped stateless `host_tool` call binds no lease.**

## Performance

- **Duration:** ~30 min (approximate)
- **Completed:** 2026-09-20T01:25:01+02:00
- **Tasks:** 3 completed
- **Files modified:** 15 (0 created, 15 modified)

## Accomplishments

- `vice-broker-client.ts`: `resolveSessionLabel()` -- prefers `CLAUDE_CODE_SESSION_ID` (the same env var `stock-recycle.ts`'s own incident-record `session_id` field already reads), otherwise falls back to the working directory's base name joined to the process id. Both acquire write sites (`acquireOverControlPlane()`, `BrokerControlSession.acquire()`) attach it via a new `acquireLabelFragment()`, mirroring the launch profile's own key-omitted-when-absent idiom exactly -- a `label` key now always joins a production acquire's wire line.
- `broker-control.mts`: the acquire dispatch arm reads `req.label`, runs it through Plan 63-03's own `sanitiseSessionLabel()`, and threads the sanitised value through `attemptAcquire()` (surviving a queued retry) as `onAcquire`'s optional third parameter -- the same widening discipline the launch profile's own second parameter already established. `StatusInstanceEntry` gains three nullable fields: `sessionLabel`, `grantId`, `operation`.
- `broker-state.mts`: `GrantRecord.sessionLabel` -- required (never absent-by-omission, matching `pid`/`operation`'s own convention), explicitly documented as carrying no authority.
- `vice-broker.mts`: the single `state.grants.set()` call records the label. A new `findOwningGrant()` resolves each status entry's owning grant by scanning for a `(port, pid)` match -- the EXACT identity comparison `handleRelease()` already makes before it kills anything -- so a port whose occupant has been replaced by an unrelated launch reports no stale identity. `handleStatus()` was exported (alongside the already-exported `handleAcquire`/`handleRelease`) for direct testing.
- The T-63-17 invariant test (`broker-control.test.ts`): every target-naming op (`monitor_claim`, `monitor_release`, `recycle`, `attach`, `operation`) refuses another session's declared label as a target id, and the refusal is asserted BYTE-IDENTICAL to the same op's refusal of an unrelated garbage target id -- never a claim that all ops share one denial string (`recycle`'s own wording differs textually from `MONITOR_OWNERSHIP_DENIAL`). The covered op set is checked against `ControlRequestKind`'s own live declaration, so a future target-naming op reds this test until classified.
- A two-session behavioural proof (`broker-control.test.ts`): two connections declaring two labels each acquire against distinct ports, `status` names both exactly once against their own port, and closing one connection releases only its own grant while the other stays named.
- SESS-01 confirmed rather than built: `broker-control.test.ts` proves a stateless `host_tool` call fires none of the seven lease-bearing callbacks across ten sequential repetitions and leaves `status` byte-identical; `host-tool-transport.test.ts` adds the structural half, asserting from `host-tool-client.ts`'s own source (tied to identifiers, not prose) that its container route opens exactly one connection, writes exactly one request line, never an `acquire` line, and holds no module-level session handle.
- `README.md` documents what the session label is, where its value comes from, that it is capped and sanitised, and that it carries no authority.

## Task Commits

Each task was committed atomically:

1. **Task 1: A session declares its own name, and status says it back** - `38c8545d` (feat)
2. **Task 2: Two sessions, one broker, and a label that is not a credential** - `8b0f1eea` (test)
3. **Task 3: A stateless call leaves the broker exactly as it found it** - `7fb26902` (test)

_Note: no TDD cycle in this plan -- `type: execute`, not `type: tdd` (Task 1 itself carries `tdd="true"` and was developed test-first within its own single commit)._

## Files Created/Modified

- `src/mcp/vice/vice-broker-client.ts` - `resolveSessionLabel()`, `ResolveSessionLabelOptions`, `acquireLabelFragment()`; both acquire write sites widened
- `src/mcp/vice/broker-control.mts` - the acquire dispatch arm's label sanitisation/threading; `StatusInstanceEntry.sessionLabel/grantId/operation`; `onAcquire`'s widened third parameter; `ControlRequest.label`
- `src/mcp/vice/broker-state.mts` - `GrantRecord.sessionLabel`
- `src/mcp/vice/vice-broker.mts` - the grant-recording step records the label; `findOwningGrant()`; `handleStatus()` (now exported) resolves the three identity fields
- `src/mcp/vice/broker-control.test.ts` - the label-parsing dispatch cases, the two-session test, the T-63-17 invariant test, the stateless-call behavioural proof
- `src/mcp/vice/vice-broker-client.test.ts` - `resolveSessionLabel()` unit tests, both acquire-write-site label wire tests, the label-fragment structural test, the export-surface list update, the two pre-existing "edge: empty" key-set assertions updated for the now-always-present label key
- `src/mcp/vice/vice-broker-acquire.test.ts` - `handleAcquire()`'s sessionLabel-recording tests, `handleStatus()`'s identity-resolution/absence tests
- `src/mcp/vice/host-tool-transport.test.ts` - the SESS-01 structural proof
- `src/mcp/vice/README.md` - the session-label identity note
- `src/mcp/vice/broker-state.test.ts`, `src/mcp/vice/broker-relay.test.ts`, `src/mcp/vice/broker-relay-text.test.ts`, `src/mcp/vice/broker-launch.test.ts` - mechanical ripple: `sessionLabel: null` added to twelve pre-existing raw `GrantRecord` literals now that the field is required
- `src/mcp/vice/resources/broker-control.mjs`, `src/mcp/vice/resources/vice-broker.mjs` - rebuilt twins (`resources/broker-state.mjs` is byte-identical: `broker-state.mts`'s own change is type-only)

## Decisions Made

- `resolveSessionLabel()` has no per-call override on the public acquire API -- see key-decisions above.
- `handleStatus()` was exported for direct testability -- see key-decisions above.
- The invariant test compares per-op self-consistency (label vs. garbage for the SAME op), not cross-op string equality -- see key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `GrantRecord.sessionLabel` (required field) rippled into twelve pre-existing raw `GrantRecord` literals not named in the plan's `files_modified`**
- **Found during:** Task 1's own `npm run typecheck`
- **Issue:** Making the grant's own session label REQUIRED (matching `pid`/`operation`'s own "never absent" convention) broke compilation in every fixture across the suite that constructs a raw `GrantRecord` literal directly -- `broker-state.test.ts`, `broker-relay.test.ts` (5 literals), `broker-relay-text.test.ts`, `broker-launch.test.ts`, `vice-broker-acquire.test.ts` (7 literals) -- the same class of fallout Plans 63-03/63-04 already documented for this same file set when they widened `GrantRecord.operation`.
- **Fix:** Added `sessionLabel: null` to every literal. No assertion was weakened and no case was deleted.
- **Files modified:** the five files named above.
- **Verification:** `npm run typecheck` exit 0; each affected file's own suite re-run individually (all green); confirmed again in the full-glob run.
- **Committed in:** `38c8545d` (Task 1 commit)

**2. [Rule 2 - Missing Critical] `handleStatus()`'s real identity-resolution logic (`findOwningGrant()`) had no direct test coverage under the plan's own named files**
- **Found during:** Task 1, while implementing the status projection's `(port, pid)` identity comparison
- **Issue:** The plan's `<files>` list for Task 1 named only `broker-control.test.ts`/`vice-broker-client.test.ts` for new test cases, but those files exercise `broker-control.mts`'s DISPATCH plumbing against STUBBED `onAcquire`/`onStatus` callbacks -- they cannot observe `vice-broker.mts`'s own `findOwningGrant()`/`handleStatus()` logic (the identity match, the pid-mismatch absence rule) directly. Leaving this unproven at the production-logic level would let a future refactor of `findOwningGrant()` silently regress the exact property Task 1's own acceptance criteria require.
- **Fix:** Exported `handleStatus()` from `vice-broker.mts` (mirroring the already-exported `handleAcquire`/`handleRelease`) and added six direct tests against a hand-built `BrokerState` in `vice-broker-acquire.test.ts` -- the file that already tests `handleAcquire()`/`handleRelease()`/`handleOperationNote()` the same way.
- **Files modified:** `src/mcp/vice/vice-broker.mts`, `src/mcp/vice/vice-broker-acquire.test.ts`.
- **Verification:** all six new tests pass; the file's full 47-test suite passes; no structural export-surface test in this codebase pins `vice-broker.mts`'s export list, so nothing else was affected by widening it.
- **Committed in:** `38c8545d` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking ripple across five test files, 1 missing-critical test-coverage addition). No scope creep beyond what proving this plan's own must_haves demanded -- both are necessary either for the whole suite to stay green after a deliberate REQUIRED-field widening, or for the plan's own acceptance criteria to be provably true at the production-logic level rather than only at the wire-dispatch level.
**Impact on plan:** None of the deviations changed this plan's own scope or must_haves.

## Known Stubs

None.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 63-06, the final plan in this phase's Wave 5 -- per the phase's own later-plans symbol list, it owns `stock-live-relay.test.ts` and touches only that file plus `test-gate.mjs`, neither of which this plan created or edited.
- `SESS-01` is marked complete in `REQUIREMENTS.md`. `SESS-02` and `SESS-06` stay unmarked pending Plan 63-06's own `SUMMARY.md` (the shared-ID gate: both are also declared by 63-06, and `SESS-02` additionally by 63-01/63-02).
- Any later plan needing "what is this grant's own declared identity" should read `GrantRecord.sessionLabel` directly, or the `status` reply's `sessionLabel`/`grantId`/`operation` triple; any later plan needing to resolve an instance's owning grant should call `findOwningGrant()`, never re-derive a second (port, pid) scan.
- `resolveSessionLabel()`'s `ResolveSessionLabelOptions` injection register is the established seam for any future test needing a deterministic label without touching the real process environment.

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `38c8545d`, `8b0f1eea`, `7fb26902` -- all `FOUND`.
- Created files: none. Modified files spot-checked with `[ -f ]`: all `FOUND` (`vice-broker-client.ts`, `broker-control.mts`, `broker-state.mts`, `vice-broker.mts`, `broker-control.test.ts`, `vice-broker-client.test.ts`, `vice-broker-acquire.test.ts`, `host-tool-transport.test.ts`, `README.md`, `resources/broker-control.mjs`, `resources/vice-broker.mjs`).
- All plan-level `<verification>` commands re-run and passing: typecheck (exit 0), build (14 artifacts), `resources-sync.test.ts` (pass), `test:automated` (4081/4090 pass, 0 fail, 9 skipped, exit 0), full `npm test` glob (4173/4254 pass, 0 fail, 81 skipped, exit 0), `git diff --stat -- src/mcp/vice/package.json` empty.
- All plan `<success_criteria>` re-checked against this SUMMARY's own coverage table (D1-D7) -- every one has a passing verification entry.
- Byte-level control-character scan (the project's own documented NUL/control-byte hazard) across every file this plan touched: zero stray control bytes found.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session*
*Completed: 2026-09-20*
