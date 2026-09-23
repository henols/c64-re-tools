---
phase: 64-files-as-bytes-both-directions
plan: 12
subsystem: broker
tags: [relay, attach, tdd, dial, handshake, g-64-4]

# Dependency graph
requires:
  - phase: 64 (plans 64-08..64-11)
    provides: the handle-only relay attach seam (G-64-1) and the live measurement that found this cold-launch race
provides:
  - "the bounded emulator-leg dial (dialEmulatorLeg(), broker-relay.mts) -- retries ECONNREFUSED at a short fixed interval up to a bounded deadline; any other connect error fails at once"
  - "handleRelayAttach() (vice-broker.mts) is now async: marks the channel attached synchronously, pauses the client leg, awaits the bounded dial with an abandonment predicate, re-checks it on connect, and returns a `start` continuation instead of splicing directly"
  - "the `attached` line is written strictly before the emulator socket is ever piped (program order, via the synchronous start continuation), so no emulator byte can overtake it"
  - "a dial that never connects or is abandoned writes no incident record, splices nothing, and leaves the instance and the grant standing; the attached marker clears only when its holder is still current"
  - "an errno-free `emulator_unreachable` wire refusal (buildEmulatorUnreachableMessage()), with the errno/attempt-count/elapsed-time detail going to the broker's own stderr journal line instead"
  - "the client's relay attach-reply wait (DEFAULT_ATTACH_REPLY_TIMEOUT_MS, 8000ms) now exceeds the broker's own emulator-dial deadline (5000ms) by design, so the broker's own answer decides the outcome, not a premature client timeout"
  - "convertHandshakeError() names a StockConnectionClosedError's own truth (unanswered request count, channel-only release, safe to retry) instead of the generic wording"
affects: [64-13, 64-14]

# Actuals (#2632)
actuals:
  tokens: 28541
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deferred acknowledgement via a synchronous `start` continuation: a handler that must both answer success AND wire a side effect (the splice) in a specific order returns the side effect as a closure the caller invokes AFTER writing its own reply, rather than performing the side effect itself before returning"
    - "Bounded connect-with-retry: retry only the ONE errno that means \"nothing is listening yet\" (ECONNREFUSED), up to a deadline; any other connect error fails immediately since retrying it cannot change the outcome"
    - "Abandonment-by-identity: an in-flight async wait re-resolves the SAME lookup it validated at entry and compares by object identity, not by value, to detect that the world moved on (a release, a recycle) while it waited"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-relay.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/stock-handler.ts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/broker-relay-text.test.ts
    - src/mcp/vice/stock-handler.test.ts
    - src/mcp/vice/host-tool-transport.test.ts
    - src/mcp/vice/resources/broker-relay.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-control.mjs

key-decisions:
  - "attached is written before the emulator socket is ever piped via a synchronous `start` continuation RelayAttachOutcome's ok:true branch carries -- broker-control.mts's attach dispatch arm calls it AFTER writeLine(), so program order (not timing) guarantees no emulator byte can overtake the acknowledgement, satisfying the plan's own must-have literally"
  - "abandonment (client leg destroyed, or the instance/holder identity this attach validated no longer matches live state) is answered a silent, generic `denied` with no incident write; a genuine failure (deadline exceeded, or a non-ECONNREFUSED connect error) is answered the distinct `emulator_unreachable` code with an errno-free wire message -- the two are different classes of event and must not share a code or a wire message"
  - "the never-connects wire message names channel/port/deadline only, built once by broker-relay.mjs's buildEmulatorUnreachableMessage(); the errno, attempt count and elapsed time go to the broker's own stderr line instead, so stock-handler.ts's convertHandshakeError() container-bind branch (which matches a raw ECONNREFUSED token) can never misfire and tell an agent to reconfigure VICE_BROKER_BINMON_HOST for an emulator that is merely still starting"
  - "DEFAULT_ATTACH_REPLY_TIMEOUT_MS (8000ms) is a NEW client-side wait used only by relay dials' attach step; the hello race keeps its own, unrelated DEFAULT_REPLY_TIMEOUT_MS (2000ms) unchanged -- pinned by a relation test against both exported constants, never a copied number"
  - "Task 1's own implementation deliberately covers only the success path plus a generic denial, so Task 2's five Behavior tests have a genuine RED phase to prove against (two of five legitimately failed against Task 1's code: the never-binds wire text, and the non-refusal-error case, which needed a connect-override field Task 1 never wired)"

requirements-completed: [XFER-08]

coverage:
  - id: D1
    description: "A relay attach made before the emulator binds is answered only after the bind, on both channels, and the client's first command is answered"
    requirement: "XFER-08"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#emulator binds late: a binary attach sent before the emulator's port is bound is answered only after the bind, and the stock handshake's first PING is answered"
        status: pass
      - kind: unit
        ref: "broker-relay-text.test.ts#emulator binds late (text channel): a text attach sent before the text monitor's port is bound is answered after the bind and one allowlisted command round-trips"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dial that never connects or is abandoned writes no incident record, splices nothing, and leaves the instance and the grant in place"
    requirement: "XFER-08"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#emulator never binds: the attach is refused by name once the deadline passes"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#emulator binds late, client gives up first"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#emulator binds late, claim released meanwhile"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#emulator binds late, non-refusal error: a non-ECONNREFUSED connect error fails the attach at once, with no retry"
        status: pass
    human_judgment: false
  - id: D3
    description: "The attached line precedes any emulator byte, by program order"
    requirement: "XFER-08"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#emulator binds late and speaks first"
        status: pass
    human_judgment: false
  - id: D4
    description: "The client's attach wait exceeds the broker's own deadline, and the handshake-failure text is truthful"
    requirement: "XFER-08"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#the client's attach-reply wait for a relay dial exceeds the broker's emulator-dial deadline by at least one retry interval"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#stockConnect: a real never-binding attach's refusal, converted by convertHandshakeError(), names the cause and the retry, and never mentions VICE_BROKER_BINMON_HOST"
        status: pass
      - kind: unit
        ref: "stock-handler.test.ts#convertHandshakeError: a StockConnectionClosedError names the unanswered request count, says only the channel was released, and that retrying is safe (G-64-4, plan 64-12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full-glob suite is green with no broker running"
    verification:
      - kind: unit
        ref: "npm run test:automated (4252 tests, 4243 pass, 0 fail, 9 skipped, exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 73min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 12: Gate the Relay Attach on the Emulator Leg Actually Connecting Summary

**Closes G-64-4: a cold session's first `vice_*` call now waits for the freshly-launched emulator to actually bind its monitor port before the broker ever says `attached`, on both channels, with an errno-free refusal when it never binds.**

## Performance

- **Duration:** 73 min
- **Started:** 2026-09-23T20:58:00Z
- **Completed:** 2026-09-23T22:11:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- The broker's `attach` seam now dials the emulator with a bounded, retrying wait (`dialEmulatorLeg()`) and only acknowledges `attached` once that leg has genuinely connected -- closing the exact race a cold-launched instance's 55-142ms bind latency raced against the client's 17-31ms attach+PING.
- The `attached` line is provably ahead of any emulator byte by program order (a synchronous `start` continuation the attach dispatch arm calls only after writing its own reply), not by timing luck.
- Every way the emulator leg can fail to become usable now ends in either a silent abandonment (client gone, or the claim/instance moved on) or a named, retryable `emulator_unreachable` refusal -- never an incident record, never a half-registered relay session.
- The client's own attach-reply wait (8000ms) is now provably longer than the broker's own dial deadline (5000ms), so the broker's answer -- not a premature client timeout -- decides every attach outcome.
- `convertHandshakeError()` tells the truth about a dropped relay (unanswered request count, channel-only release, safe retry) instead of a generic wire message.

## Task Commits

Each task followed the RED-GREEN cycle (TDD):

1. **Task 1: Tracer -- the binary success path**
   - `910b6351` (test): RED -- regression test for the cold-launch relay-attach race, verified failing against the unmodified broker (verdict `RED_EVIDENCE_OK`)
   - `4d7e4689` (feat): GREEN -- `dialEmulatorLeg()`, async `handleRelayAttach()`, the `start`-continuation ordering, the `Promise`-aware attach dispatch arm; also fixed a Rule-3 blocking type-check regression in `host-tool-transport.test.ts` (see Deviations)
2. **Task 2: The never-connects, abandoned and speaks-first dial paths**
   - `8d95a18b` (test): RED -- five Behavior tests; two legitimately failed against Task 1's code (verdict `RED_EVIDENCE_OK`)
   - `c1287eb8` (feat): GREEN -- `buildEmulatorUnreachableMessage()`, the `connect` override, conditional attached-marker clearing, the stderr journal line; also fixed a genuine hang in the new "never binds" test's own retry-and-succeed tail (see Deviations)
3. **Task 3: The client wait, the text channel, and truthful handshake text**
   - `4dfa290d` (test): RED for the `StockConnectionClosedError` case only -- the constants-relation test, the end-to-end never-binds text test, and the text-channel late-bind test all passed immediately (see Deviations for why, and TDD Gate Compliance below)
   - `614417b8` (feat): GREEN -- `convertHandshakeError()`'s new branch

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/broker-relay.mts` - `dialEmulatorLeg()`, `buildEmulatorUnreachableMessage()`, `DEFAULT_RELAY_DIAL_DEADLINE_MS`/`DEFAULT_RELAY_DIAL_RETRY_MS`; `spliceRelay()` now takes an already-connected socket instead of dialling
- `src/mcp/vice/vice-broker.mts` - `handleRelayAttach()` is async, gates on the bounded dial, returns a `start` continuation; `HandleRelayDeathDeps` gains `dialDeadlineMs`/`dialRetryIntervalMs`/`connect`
- `src/mcp/vice/broker-control.mts` - `RelayAttachOutcome`/`onRelayAttach` widened to a Promise; the `attach` dispatch arm awaits it, writes `attached` before splicing, resumes the socket's line reader on refusal
- `src/mcp/vice/broker-endpoint.ts` - `DEFAULT_ATTACH_REPLY_TIMEOUT_MS` (8000ms), a separate attach-reply wait for relay dials
- `src/mcp/vice/stock-handler.ts` - `convertHandshakeError()` gains a `StockConnectionClosedError` branch
- `src/mcp/vice/broker-relay.test.ts` - the late-binding stub-emulator helper, the tracer test, five Task 2 Behavior tests, the constants-relation test, the end-to-end never-binds text test
- `src/mcp/vice/broker-relay-text.test.ts` - the text-channel late-bind test and its own late-binding stub helper
- `src/mcp/vice/stock-handler.test.ts` - the `StockConnectionClosedError` case and a passthrough-wording regression case
- `src/mcp/vice/host-tool-transport.test.ts` - a Rule-3 type-check fix (see Deviations)
- `src/mcp/vice/resources/{broker-relay,vice-broker,broker-control}.mjs` - regenerated

## Decisions Made
See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `host-tool-transport.test.ts` needed an explicit `as const` on `ok: false`**
- **Found during:** Task 1, `npm run typecheck` (Task 1's own `<verify>`)
- **Issue:** `RelayAttachOutcome`'s `ok: true` branch gaining a required `start` field stopped TypeScript's usual leniency for a two-branch boolean-discriminated union from accepting an inferred, WIDENED `{ ok: boolean; code: "internal" }` return type from this pre-existing, unrelated stub -- `npm run typecheck` failed with two errors pointing at this file.
- **Fix:** Added `ok: false as const` (not just `code`) to the one `onRelayAttach` stub in this file.
- **Files modified:** `src/mcp/vice/host-tool-transport.test.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `4d7e4689` (Task 1's GREEN commit)

**2. [Rule 1 - Bug] A genuine hang in the "emulator never binds" test's own retry-and-succeed tail**
- **Found during:** Task 2, running the newly-written Behavior tests
- **Issue:** The test's own second phase (a fresh claim+attach on the same instance, once a stub is finally bound) never destroyed the resulting relay socket or the stub's own accepted connections before calling `server.close()`, whose callback only fires once every currently-open connection closes -- the test hung for the full `--test-timeout`.
- **Fix:** Track and destroy accepted sockets (mirroring this file's own `withStubEmulatorServer()` discipline) and destroy the client-side relay socket once its own assertions have run.
- **Files modified:** `src/mcp/vice/broker-relay.test.ts`
- **Verification:** the isolated test completes in ~330ms; the full `broker-relay.test.ts` + `resources-sync.test.ts` run is 56/56 green.
- **Committed in:** `c1287eb8` (Task 2's GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking type-check regression, 1 bug in newly-authored test code).
**Impact on plan:** Both fixes were necessary for the plan's own `<verify>` gates to pass; neither touches production behavior beyond what the plan specifies. No scope creep.

## TDD Gate Compliance

All three tasks carry `tdd="true"` (Task 1 is also `type="tracer"`). Every task has a `test(64-12): RED` commit followed by a `feat(64-12): GREEN` commit, in order; no REFACTOR commit was needed (each GREEN implementation was already the intended shape). RED evidence was verified via `gsd_run check tdd-red-evidence` for the genuinely-new-logic cases:

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | ✓ (`RED_EVIDENCE_OK`) | ✓ | — | Pass |
| 2 | ✓ (`RED_EVIDENCE_OK`) | ✓ | — | Pass |
| 3 | ✓ (`RED_EVIDENCE_OK` for the `StockConnectionClosedError` case) | ✓ | — | Pass |

**Task 3's own RED phase needs a stated exception.** Of Task 3's five Behavior tests, only the `StockConnectionClosedError` case exercises genuinely new logic and produced a clean assertion-level RED. The other four (the constants-relation test, the end-to-end never-binds text test, and the text-channel late-bind test) passed on their FIRST run, for two different honest reasons, neither of which is "the test doesn't test anything":
- The constants-relation test and the end-to-end text test could not be authored against a truly unmodified codebase at all: `DEFAULT_ATTACH_REPLY_TIMEOUT_MS` did not exist yet, and an ESM named-import of a non-existent export is a whole-file load crash (`fixture_or_load_failure` under `check tdd-red-evidence`), not a legitimate per-test RED — it would have taken down every OTHER test in the same large file. The constant was therefore added as minimal scaffolding (a single exported number, directly set to its final, already-reasoned value from `DEFAULT_ATTACH_REPLY_TIMEOUT_MS`'s own comment) before the test could even be written, and the relation test passed immediately because the value was correct by construction, not because it was iterated on under a red bar.
- The end-to-end never-binds text test and the text-channel late-bind test are, by the plan's own design, PROOFS that Tasks 1 and 2's work already generalizes: Task 2's errno-free `buildEmulatorUnreachableMessage()` already satisfies `convertHandshakeError()`'s generic branch with no code change, and the attach seam Task 1/2 built already covers the text channel with no path-specific code. Their purpose is regression-proofing an already-true claim, not driving new implementation -- passing immediately is the expected, correct outcome the plan's own success criteria predict ("no path-specific readiness code is added anywhere else").

## Issues Encountered
None beyond the two deviations documented above, both resolved within the same task's own GREEN commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-64-4 is closed. Plans 64-13 (G-64-3) and 64-14 (live measurement of both) are next, sharing `vice-broker.mts`, `broker-endpoint.ts`, `stock-handler.ts` and the compiled `resources/vice-broker.mjs` with this plan -- run in sequence per the plan's own frontmatter.
- Full-suite baseline preserved: `npm run test:automated` went from 4241/4232/0/9 (pre-dispatch) to 4252/4243/0/9 (post-64-12) -- exactly the 11 new tests this plan added, zero regressions.
- No live broker was started or left running by this plan; `systemctl --user is-active vice-broker.service` reads `inactive` and no `x64sc`/`vice-broker` process is present.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

- All 6 task commits (`910b6351`, `4d7e4689`, `8d95a18b`, `c1287eb8`, `4dfa290d`, `614417b8`) found in `git log --oneline --all`.
- All 12 key-files found on disk.
- Plan-level `<verification>` re-run: `broker-relay.test.ts` (56/56) + `broker-relay-text.test.ts` (25/25, included in the 197/197 broader run) + `stock-handler.test.ts` (19/19) all green; `systemctl --user list-units 'vice-broker*' --state=active` empty; no `x64sc`/`vice-broker` process running; `npm run test:automated` 4252/4243/0/9, exit 0 (baseline was 4241/4232/0/9 -- exactly +11 tests, 0 regressions).
