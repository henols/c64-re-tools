---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
plan: 11
subsystem: infra
tags: [vice-mcp, broker-control-plane, relay-lifecycle, incident-record, gap-closure]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    plan: "07"
    provides: "vice-broker.mts's tearDownRelaySessionsForGrant(targetId, state) -- the whole-grant loop this plan now re-expresses over a shared per-channel primitive"
provides:
  - "vice-broker.mts: tearDownRelaySessionForChannel(targetId, channel, state) -- the ONE delete-before-close primitive for exactly one (grant, channel) pair, called by both tearDownRelaySessionsForGrant()'s loop and handleMonitorRelease()'s two ok:true paths"
  - "vice-broker.mts: handleMonitorRelease() now tears down the released channel's own live relay session before returning ok, on both the holder-matches and the already-cleared paths, and on neither refusal"
  - "broker-state.mts: relaySessions' own doc comment now names the per-channel primitive as the second removal primitive, with tearDownRelaySessionsForGrant() as its whole-grant caller"
  - "broker-relay-text.test.ts: an end-to-end claim/attach/command/release/close case proving zero incident files on a real production-shaped text round trip"
  - "broker-relay.test.ts: isolation, recorded-order, no-session, idempotent-repeat and two refused-release contract cases, plus an incidents-directory-empty hygiene helper applied to the file's own tracer round trip"
affects: []

actuals:
  tokens: 10747
  tasks: 2
  commits: 2
  plan_head_before: d2cc3b34bc84971a8d602c837c37dd5c9b245517

tech-stack:
  added: []
  patterns:
    - "Per-channel primitive extraction: tearDownRelaySessionForChannel() is now the ONE delete-before-close implementation, and the whole-grant tearDownRelaySessionsForGrant() (Plan 63-07) delegates to it in a loop rather than carrying a second copy of the body -- the same 'one primitive, callers loop or branch over it' shape this file already uses for clearMonitorClient()."
    - "A deliberate teardown is never itself an incident: handleMonitorRelease()'s new call sites tear down the live session with NO write to writeIncident() at all -- only handleRelayDeath() (the unannounced-death path) ever writes evidence, and it does so only when it still finds a map entry, which a prior deliberate teardown has already removed."
    - "Test-hygiene: an ordinary round trip in a relay test file must actually complete the round trip -- broker-relay.test.ts's own binary-channel tracer case was missing the monitor_release() call every real production caller performs, and asserting the incidents directory stays empty surfaced that gap immediately (adding the release call was the fix, not weakening the assertion)."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/broker-relay-text.test.ts
    - src/mcp/vice/broker-relay.test.ts

key-decisions:
  - "tearDownRelaySessionForChannel() is placed BEFORE tearDownRelaySessionsForGrant() in vice-broker.mts, per the plan's own instruction, so a reader meets the primitive before its whole-grant caller."
  - "handleMonitorRelease()'s already-cleared path (`!existing`) ALSO calls the new teardown, not just the holder-matches path -- a channel this broker reports as released must never be left with a live splice behind it, even if the per-channel holder record was already cleared by an earlier call."
  - "resources/broker-state.mjs did NOT change on rebuild despite the corrected relaySessions doc comment, matching 63-07's own precedent exactly: the comment sits on a TypeScript interface property, which compiles to no JS output at all. Confirmed by direct diff of the pre- and post-edit .mjs (byte-identical); only resources/vice-broker.mjs changed."
  - "broker-relay.test.ts's existing binary-channel tracer test was given an explicit handleMonitorRelease() call before client.disconnect() -- without it, the disconnect is an UNANNOUNCED death (no preceding release), which legitimately writes its own incident record and is NOT the hygiene gap this plan closes. Adding the release call is what makes the round trip genuinely 'ordinary' rather than vacuously exempt from the new assertion."

requirements-completed: [SESS-05]

coverage:
  - id: T1
    description: "A per-channel monitor_release for a channel holding a live relay session removes and closes that session in delete-before-close order before clearing the claim; a real production-shaped claim/attach/command/release/close round trip through the text relay leaves state.relaySessions empty and the scratch incidents directory empty"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay-text.test.ts#gap closure 63-11: a real claim/attach/command/release/close round trip through the text relay leaves state.relaySessions empty and writes zero incident files"
        status: pass
    human_judgment: false
  - id: T2
    description: "Releasing one channel leaves the grant's OTHER channel's live relay session untouched -- a per-channel release is never a grant-level teardown"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: releasing one channel leaves the grant's OTHER channel's live relay session untouched"
        status: pass
    human_judgment: false
  - id: T3
    description: "The map entry is deleted BEFORE the session handle's close() is called, proven by a recorded observation from inside the stand-in's own close(), and a re-entrant handleRelayDeath() call afterward writes nothing"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: deletes the relay-session map entry BEFORE calling the session's own close() -- proven from inside close() itself"
        status: pass
    human_judgment: false
  - id: T4
    description: "A monitor_release for a channel with no live relay session, and a repeated release of an already-released channel, both return ok, close nothing, and write nothing"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: a channel with no live relay session returns ok, closes nothing, and writes nothing"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: a repeated release of an already-released channel returns ok and tears nothing down a second time"
        status: pass
    human_judgment: false
  - id: T5
    description: "A REFUSED monitor_release (non-holder grant id, or an unresolvable target) tears down nothing at all -- the live relay session stays in the map and stays open"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: a release from a grant that is NOT the channel's current holder is denied and leaves the holder's live session open"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleMonitorRelease: a release naming an unresolvable target is bad_request and leaves every live session open"
        status: pass
    human_judgment: false
  - id: T6
    description: "The whole suite is green with the fix as the production default, both host-bound artifacts are rebuilt (broker-state.mjs byte-identical, as expected), and typecheck is clean"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck (exit 0); npm --prefix src/mcp/vice run build (14 artifacts, resources/vice-broker.mjs regenerated); node --test broker-relay.test.ts broker-relay-text.test.ts broker-control.test.ts broker-state.test.ts (185/185 pass)"
        status: pass
    human_judgment: false

duration: ~35 min (approximate -- start not explicitly timestamped; commit span alone was ~6 min)
completed: 2026-09-21
status: complete
---

# Phase 63 Plan 11: The Monitor Channel Relayed, and the Connection as the Session Summary

**`tearDownRelaySessionForChannel()` closes the broker-side half of 63-VERIFICATION.md's newest Blocker (the per-channel `monitor_release` never tore down `state.relaySessions`, so every ordinary text-tool call wrote a spurious incident record) -- production still runs close-then-release until plan 63-12 lands.**

## Performance

- **Duration:** ~35 min (approximate)
- **Completed:** 2026-09-21
- **Tasks:** 2 completed
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- New exported `tearDownRelaySessionForChannel(targetId, channel, state): boolean` in `vice-broker.mts`, placed immediately before `tearDownRelaySessionsForGrant()`. Computes its key with `relaySessionKey()` (never hand-formatted a second time), deletes the `state.relaySessions` entry FIRST, then calls the session's own `close("relay_close")`, then returns `true` -- `false` when no live session exists for that exact pair.
- `tearDownRelaySessionsForGrant()` re-expressed as a one-line loop over `MONITOR_CHANNELS` calling the new helper -- its signature, return type and semantics are byte-identical to before; only the duplicated delete-before-close body is gone. The delete-before-close rationale moved down onto the new helper's own header, with a one-line pointer left behind.
- `handleMonitorRelease()` now calls the new helper on BOTH its `ok: true` paths -- the already-cleared path (before returning) and the holder-matches path (strictly before `clearMonitorClient()`) -- and on NEITHER refusal (`denied`, `bad_request`), so a spoofed release can never destroy another grant's live connection.
- Corrected the now-outdated "the TWO places an entry is ever removed" language in both `broker-state.mts`'s `relaySessions` doc comment and `vice-broker.mts`'s own `handleRelayDeath()` header, naming the new per-channel primitive rather than the whole-grant function it now backs.
- Rebuilt `resources/vice-broker.mjs` (14 artifacts total, regenerated and committed). `resources/broker-state.mjs` rebuilt too but came out byte-identical -- see Decisions below, the exact same reason 63-07-SUMMARY.md recorded for its own corrected doc comment.
- New end-to-end case in `broker-relay-text.test.ts`: a real `handleMonitorClaim()` → `dialMonitorRelay()` → `TextMonitorClient`/`attach()` → one `device c:` command round trip → asserts `state.relaySessions.has(...)` is true (proving the scenario is real, not vacuous) → `handleMonitorRelease()` → `client.disconnect()` → settles one event-loop turn → asserts `state.relaySessions.size === 0`, the per-channel holder record is `undefined`, and the scratch incidents directory has zero files.
- Six new contract cases in `broker-relay.test.ts` against the compiled broker artifact: isolation (releasing one channel leaves the grant's other channel's live session untouched, selected by iterating `MONITOR_CHANNELS` rather than naming either channel), recorded order (proven from inside a stand-in's own `close()`, not inferred from source), no-live-session, idempotent repeat, and two refused-release cases (non-holder `denied`, unresolvable-target `bad_request`) -- both proving the live session survives untouched.
- Closed the file's own Warning-severity test-hygiene gap: a guarded `assertIncidentsDirEmpty()` helper (no-op when `incidentsDir` is `null`, i.e. for the deliberate relay-death cases that inject their own capturing writer) applied to `broker-relay.test.ts`'s existing binary-channel tracer round trip. That test was missing the `handleMonitorRelease()` call every real production caller performs before disconnecting -- adding it, plus the assertion, is what actually closes the gap (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- a per-channel release tears down its own relay session, and a production-shaped text round trip writes zero incident files** - `fb9c7e99` (feat)
2. **Task 2: The per-channel contract -- isolation, recorded order, the no-session case, the refused release, and an incidents directory that is read rather than merely deleted** - `19180ed3` (test)

_Note: Task 2 carries `tdd="true"` as a task attribute; `workflow.tdd_mode` is `false` project-wide, so no separate RED/GREEN gate was enforced -- the tests were written against the primitive Task 1 already implemented and committed as a single `test` commit, matching 63-04/63-07's own recorded posture for `tdd="true"` tasks under a `type: execute` plan._

## This plan closes the broker HALF of the gap only (stated per the plan's own `<planner_findings>`)

`63-VERIFICATION.md`'s gap description assumed the client-side socket close FOLLOWS the release. Direct read of the current production code (`text-connect.ts`'s `textDisconnect()` line 216, `stock-connect.ts`'s `stockDisconnect()` line 577) shows the OPPOSITE order today: `safeDisconnect()` runs first, `releaseMonitor()` second. So in production TODAY, the client's socket close still arrives before `monitor_release` reaches the broker, `handleRelayDeath()` still finds the map entry present, and a spurious incident record is STILL written on every ordinary text-tool call -- this plan's fix, alone, does not yet change that.

What this plan proves, correctly stated: the broker-side teardown is now correct and complete for the order plan 63-12 will impose (release-then-close). Task 1's own new end-to-end case deliberately drives release-then-close to prove exactly that. Plan 63-12 reorders both real callers (`textDisconnect()`/`stockDisconnect()`) to release-then-close; only once BOTH plans have landed does the spurious-record defect actually disappear from production.

## Files Created/Modified

- `src/mcp/vice/vice-broker.mts` -- `tearDownRelaySessionForChannel()`, `tearDownRelaySessionsForGrant()` re-expressed as its loop, `handleMonitorRelease()` wired on both `ok:true` paths, two corrected doc comments
- `src/mcp/vice/broker-state.mts` -- `relaySessions`' doc comment corrected (source-only; see Decisions)
- `src/mcp/vice/resources/vice-broker.mjs` -- rebuilt twin
- `src/mcp/vice/broker-relay-text.test.ts` -- new end-to-end regression case, `readdirSync` import added
- `src/mcp/vice/broker-relay.test.ts` -- six new contract cases, `tearDownRelaySessionForChannel` added to the compiled-module type block, a guarded `assertIncidentsDirEmpty()` helper, the existing tracer test extended with a `monitor_release` call, `readdirSync` import added

## Decisions Made

- `tearDownRelaySessionForChannel()` placed before `tearDownRelaySessionsForGrant()` -- see key-decisions above.
- `handleMonitorRelease()`'s already-cleared path also tears down a live session, not just the holder-matches path -- see key-decisions above.
- `resources/broker-state.mjs` rebuild is byte-identical -- see key-decisions above.
- The existing binary-channel tracer test in `broker-relay.test.ts` was given an explicit `handleMonitorRelease()` call before `client.disconnect()` -- see key-decisions above and Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The existing binary-channel tracer test in `broker-relay.test.ts` did not model an ordinary round trip**
- **Found during:** Task 2, while applying the incidents-directory-empty hygiene helper the plan instructed be applied to "the file's own ordinary tracer relay round trip case"
- **Issue:** The existing tracer test (`"tracer: a command sent through a relayed ViceMonitorClient..."`) completes a successful command and then calls only `client.disconnect()` -- it never calls `handleMonitorRelease()`. A disconnect with no preceding release is an UNANNOUNCED death from the broker's own perspective, and `handleRelayDeath()` correctly (and separately, per SESS-05's own "genuine drop" clause) writes a real incident record for it. Applying the hygiene assertion to the test AS WRITTEN would therefore fail -- not because the fix is broken, but because the test itself was never actually exercising an "ordinary, released" round trip in the first place. I confirmed this directly with a throwaway scratch probe against the real compiled broker before touching the test (one incident file written, exactly as expected for an unreleased disconnect), then discarded the probe.
- **Fix:** Added an explicit `handleMonitorRelease("release-tracer", "grant-tracer", "binary", state)` call, asserted `ok`, immediately before the existing `client.disconnect()` in the test's `finally` block -- matching the real production shape every caller (`textDisconnect()`/`stockDisconnect()`) uses. This is what makes the round trip genuinely ordinary, and it is now what the new hygiene assertion (added after a settling `setImmediate` tick) correctly proves empty.
- **Files modified:** `src/mcp/vice/broker-relay.test.ts`
- **Verification:** `node --test broker-relay.test.ts` (48/48 pass, including this modified test); full 4-file group re-run (185/185 pass, 0 fail).
- **Committed in:** `19180ed3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (a pre-existing test's scenario was incomplete relative to what the new hygiene assertion needed to mean anything). No scope creep -- required by the plan's own explicit instruction to close this exact hygiene hole without weakening the discrimination it provides.
**Impact on plan:** None on any must_have or success criterion; strictly required to make the new assertion test the real defect rather than a vacuous scenario.

## Known Stubs

None.

## Threat Flags

None -- no new network endpoint, auth path, file-access pattern or schema change was introduced. This plan's `<threat_model>` register (T-63-11-01 through T-63-11-04, plus T-63-11-SC accepted) is satisfied by the implementation above: T-63-11-01 and T-63-11-02 by the two refusal contract cases (`denied`/`bad_request` tear down nothing, and the teardown keys on the exact `(targetId, channel)` pair); T-63-11-03 by every pre-existing relay-death case in both test files staying green (a genuine drop still writes its record); T-63-11-04 by the rebuilt, committed `resources/vice-broker.mjs` and the build verify step confirming regeneration actually happened.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None.

## Next Phase Readiness

- 63-VERIFICATION.md's newest Blocker (the per-channel `monitor_release` teardown) is now closed on the broker side. SESS-05 remains not-yet-fully-satisfied end-to-end in production until plan 63-12 reorders `textDisconnect()`/`stockDisconnect()` to release-then-close -- see "This plan closes the broker HALF" above.
- Any later plan needing to tear down a single (grant, channel) pair's relay session should call `tearDownRelaySessionForChannel()` directly, never re-derive a second single-channel removal.
- Ready for 63-12.

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `fb9c7e99`, `19180ed3` -- both `FOUND`.
- Key files verified present on disk: `src/mcp/vice/vice-broker.mts`, `src/mcp/vice/broker-state.mts`, `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/broker-relay-text.test.ts`, `src/mcp/vice/broker-relay.test.ts` -- all `FOUND`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (exit 0), `npm run build` (14 artifacts, `resources/vice-broker.mjs` regenerated, no drift on re-run), `node --test broker-relay.test.ts broker-relay-text.test.ts broker-control.test.ts broker-state.test.ts` (185/185 pass, 0 fail).
- Source assertions re-checked: `tearDownRelaySessionForChannel` appears at 4 non-comment lines in both `vice-broker.mts` and `resources/vice-broker.mjs`; `state.relaySessions.delete` appears exactly 2 times in `vice-broker.mts`; the helper's own region computes its key via exactly 1 `relaySessionKey(` call.
- Every `must_haves.truths` entry from the plan has a named, passing test case (see coverage block T1-T5 above; T6 covers the whole-suite gate).

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio*
*Completed: 2026-09-21*
