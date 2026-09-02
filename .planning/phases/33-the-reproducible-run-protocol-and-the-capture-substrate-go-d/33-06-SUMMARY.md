---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 06
subsystem: infra
tags: [vice, broker, control-plane, warp, headless, launch-profile, warm-floor, eligibility, argv]

# Dependency graph
requires:
  - phase: 33-01
    provides: The frozen GATE-01 decision rules — read to confirm this plan emits no gate line and writes nothing under evidence/
  - phase: 33-02
    provides: The AMENDED 2026-09-02 rider narrowing D-15's byte-identity claim to the fork branch and the profile field, which this plan inherits
  - phase: 33-03
    provides: The measured precondition that licenses profile.warp at all — warp is behaviour-neutral under a frame-anchored protocol (identical registers, one identical 64K sha256 across warped j0/j2500 and unwarped)
  - phase: 33-05
    provides: buildViceArgs()'s optional profile, the exported LaunchProfile type, STOCK_DETERMINISM_SEED/FLAGS, and -console-at-index-1 — the argv-construction end this plan threads into
provides:
  - "normaliseLaunchProfile() in broker-control.mts as the ONE narrowing site for the wire profile — object-or-absent, warp/headless boolean-or-absent, unknown keys refused BY NAME with the existing bad_request code, and a refusal that never enqueues"
  - "onAcquire widened with an OPTIONAL second parameter, so the profile reaches vice-broker.mts without any pre-existing implementation or test stub changing shape"
  - "InstanceRecord.profile — optional, never defaulted, absent means profile-less, and carried forward across crash-respawn and recycle"
  - "profileEligible() plus a SYNCHRONOUS pre-probe continue filter in selectWarmInstance() — D-16's eligibility rule, with the single-owner inFlight launch guard gaining no new await"
  - "An optional profile at BOTH acquire write sites in vice-broker-client.ts, behind one omit-when-absent helper, so a profile-less wire line stays byte-identical"
affects: [33-07, 33-10, 33-11, 33-12]

actuals:
  tokens: 23770
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Optional-and-absent-by-default field widening, third application in this phase (after 33-05's buildViceArgs profile and the pre-existing backend?: ViceBackend precedent)"
    - "A single narrowing site at a trust boundary, with an explicit WHAT-MUST-NEVER-BE-ADDED-HERE banner naming the argv-injection surface it closes"
    - "An eligibility filter placed by line-number-verifiable position rather than by comment, because its position — not merely its presence — is the invariant"
    - "A shared fragment helper as the single decision site for whether an optional wire key appears at all, so two independent write sites cannot drift apart on that decision"
    - "Element-wise argv assertion against a literal-token allow-list built FROM the exported flag block, so the allow-list cannot drift away from the block it describes"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-launch.mts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/resources/broker-state.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-launch.mjs
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/broker-state.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/vice-broker-client.test.ts
    - src/mcp/vice/broker-launch.test.ts

key-decisions:
  - "The launch profile is carried on handleAcquire()'s existing HandleAcquireDeps options bag rather than as a fifth positional parameter. The real broker wiring already constructs a fresh bag PER ACQUIRE, so per-request data threads through it naturally, and `backend` already sets the precedent of a non-injected configuration value living there. A fifth positional after an optional fourth would have been legal but unreadable."
  - "The launch profile is carried FORWARD across crash-respawn and recycle (broker-launch.mts's handleExit -> launchSupervised), which the plan did not name. Without it a recycled {warp:true} instance comes back UNWARPED while its fresh record still claims warp — after which profileEligible() hands that instance to the next warp request. That is exactly the undetectable lie D-16 exists to exclude, reintroduced one respawn later. Applied as deviation Rule 2, mirroring CR-02's own remoteMonitorPort carry-forward line for line."
  - "buildViceArgs() deliberately does NOT re-validate the profile shape. `profile?.warp` stays a truthiness test, so a (boundary-refused) string value still switches the fixed literal flag on. Re-deriving the check there would create the second narrowing site this plan exists to avoid, and the VALUE remains structurally unreachable either way — asserted, not assumed, by a test that drives an unsound cast and requires the smuggled string to appear in no argv element and as no substring of one."
  - "_snapshotState() gained an explicit copy of `profile`. It is the record's SECOND nested object after viceArgs, and this file's own snapshot test asserts that mutating a nested value in the result leaves live broker state unchanged — a spread alone would have quietly made that documented contract false."

patterns-established:
  - "Pattern: a positional code invariant whose violation is silent (an await entering a guarded region) is pinned by a line-number comparison inside the extracted function body, in BOTH the plan's verify block and a committed structural test — never by a comment alone"
  - "Pattern: a two-write-site wire field gets a shared omit-when-absent fragment helper plus a structural test that COUNTS the sites, so 'both' is an assertion rather than 'at least one'"

requirements-completed: [REPRO-05]

coverage:
  - id: D1
    description: "A launch profile travels as an additive optional field on the EXISTING acquire op — narrowed once at the boundary, delivered to onAcquire, and never an eighth op"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-control.test.ts#ControlRequestKind (33-06, D-15): still exactly seven members -- the launch profile is a FIELD on the existing acquire op, never an eighth op"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, D-15, tracer): {op:'acquire', profile:{warp:true}} arrives at onAcquire as {warp:true}, over a REAL control-plane round trip"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, D-15): both knobs together arrive as {warp:true, headless:true}, and a both-false profile arrives as {warp:false, headless:false} -- never coerced away"
        status: pass
    human_judgment: false
  - id: D2
    description: "An acquire with no profile behaves exactly as it does today — the warm floor serves it, the wire line is byte-identical, and no profile key is written to the InstanceRecord"
    requirement: REPRO-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, edge: empty): an acquire with NO profile key reaches onAcquire with `undefined`, and its wire line is byte-identical to the pre-33-06 line"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, edge: empty): a profile-less acquire against a profile-less warm ready instance is served from the warm floor exactly as it is today -- no launch, and no profile key written"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-client.test.ts#acquire profile (33-06, write site 1 of 2, edge: empty): acquireOverControlPlane() with no profile writes a line with NO profile key -- byte-identical to the pre-33-06 line"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-client.test.ts#acquire profile (33-06, write site 2 of 2, edge: empty): openBrokerControl().acquire() with no profile writes a line with NO profile key, and a timeout-only options object does not introduce one"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every malformed profile shape is refused by name with the existing bad_request code, never coerced and never silently dropped, and a refusal does not enqueue the request (T-33-03)"
    requirement: REPRO-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, T-33-03): {a string | a number | a bare boolean | an array | a non-boolean warp value | a non-boolean headless value | an unknown key alongside a valid one} is refused bad_request naming the offending value, and onAcquire is never called (7 cases)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, T-33-03): a bad_request refusal does not enqueue the request -- the pending-acquire queue length is unchanged"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06, T-33-03): `profile: null` is accepted as profile-less rather than refused"
        status: pass
    human_judgment: false
  - id: D4
    description: "No profile VALUE can become an argv element — profile maps to exactly two literal flag tokens and to nothing else (T-33-04)"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-launch.test.ts#buildViceArgs (33-06, T-33-04): with {warp:true, headless:true} every returned element is either a literal stock flag token or the ip4:// address string -- no argv element is ever derived from a profile VALUE"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/broker-launch.test.ts#buildViceArgs (33-06, T-33-04): the same element-wise property holds with a SECOND (-remotemonitor) port requested, where two computed address strings exist"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/broker-launch.test.ts#buildViceArgs (33-06, T-33-04): a profile carrying a STRING value cannot reach argv -- the type forbids it, and even an unsound cast produces no element carrying the string"
        status: pass
    human_judgment: false
  - id: D5
    description: "A mismatched warm instance is INELIGIBLE — skipped by a synchronous pre-probe filter, never killed, never retro-warped, and the request is served by a dedicated cold launch whose argv carries the requested flags (D-16, T-33-24)"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, D-15/D-16, tracer): a {warp:true} acquire against a pool holding ONE profile-less warm ready instance cold-launches an instance whose viceArgs carry -warp, and leaves the warm instance ready and un-killed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, D-16): a profile-less acquire is INELIGIBLE for a {warp:true} warm instance -- the mismatch is refused in BOTH directions, and falls through to a cold launch"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, D-16, headless): a {headless:true} acquire against a profile-less warm instance cold-launches with -console at argv index 1, and never retro-fits the warm one"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, D-16): a warm instance recorded {warp:true} IS granted to a {warp:true} acquire, with no launch at all"
        status: pass
    human_judgment: false
  - id: D6
    description: "Absent, {} and both-false are ONE request; {warp:true} and {warp:true,headless:true} are DIFFERENT profiles; and the comparison is symmetric"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#profileEligible (33-06, D-16, absent-equals-false): an absent profile, an explicit {} and {warp:false,headless:false} are all mutually eligible"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#profileEligible (33-06, D-16): {warp:true} is ineligible against a profile-less, empty or both-false record and vice versa, and {warp:true} differs from {warp:true,headless:true}"
        status: pass
    human_judgment: false
  - id: D7
    description: "The single-owner inFlight launch guard gains no new await, and exactly one grant is recorded on both the warm-hit and the ineligible-miss-then-cold path (T-33-23)"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#structural (33-06, T-33-23): the profile-eligibility filter is a synchronous `continue` placed BEFORE the readiness-probe await inside selectWarmInstance() -- the single-owner launch guard gains no new await"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#structural (33-06, T-33-24): the eligibility miss opens no second grant -- state.grants.set() still appears exactly once in vice-broker.mts's handleAcquire()"
        status: pass
      - kind: other
        ref: "awk-extracted selectWarmInstance() body, line-number comparison profileEligible(34) < await deps.probe((37) -> FILTER_BEFORE_PROBE"
        status: pass
    human_judgment: false
  - id: D8
    description: "An ineligible miss at capacity is refused with the EXISTING at_capacity outcome rather than granted the mismatched instance"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#handleAcquire (33-06, D-16, capacity interaction): an ineligible miss AT CAPACITY is refused with the existing at_capacity outcome rather than granted the mismatched warm instance"
        status: pass
    human_judgment: false
  - id: D9
    description: "A state-directory record written before the profile field existed round-trips valid and is treated as profile-less — the case a broker restarted mid-phase actually reads (T-33-25)"
    requirement: REPRO-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-state.test.ts#InstanceRecord.profile (33-06, T-33-25, restart tolerance): a record SERIALISED WITHOUT a profile key round-trips to a valid InstanceRecord and is treated as profile-less by profileEligible -- the case a broker restarted mid-phase actually reads"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/broker-state.test.ts#InstanceRecord.profile (33-06): absent by default, and accepts the documented warp/headless shape with no default value of its own"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/broker-state.test.ts#_snapshotState (33-06): profile survives the snapshot's deep copy, and mutating the copy does not reach live broker state / a profile-less record's snapshot carries no `profile` key"
        status: pass
    human_judgment: false
  - id: D10
    description: "The profile reaches the broker from BOTH client-side acquire write sites — a request written by only one of them would silently never arrive"
    requirement: REPRO-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/vice-broker-client.test.ts#acquire profile (33-06, write site 1 of 2): acquireOverControlPlane() puts {warp:true} on the wire and it arrives at the broker's onAcquire"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-client.test.ts#acquire profile (33-06, write site 2 of 2): openBrokerControl().acquire({profile}) puts {warp:true, headless:true} on the wire and it arrives at the broker's onAcquire"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-broker-client.test.ts#structural (33-06): BOTH acquire write sites in vice-broker-client.ts include the profile fragment -- a field added to only one would silently never arrive for callers on the other path"
        status: pass
    human_judgment: false
  - id: D11
    description: "A queued acquire retried on a later drain pass carries the profile it was MADE with, not a profile-less one"
    requirement: REPRO-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/broker-control.test.ts#acquire profile (33-06): the profile survives being QUEUED behind an in-flight launch -- a retried acquire carries the profile it was made with, not a profile-less one"
        status: pass
    human_judgment: false
  - id: D12
    description: "All four host artifacts regenerated by node build.ts and staged in the SAME commit as their .mts sources; HOST_BOUND_ARTIFACTS unchanged at eight entries"
    requirement: REPRO-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/resources-sync.test.ts#resources/ is byte-identical to a fresh build of its TypeScript source"
        status: pass
      - kind: other
        ref: "git show --name-only 11f897d | grep -c '^src/mcp/vice/resources/.*\\.mjs$' -> 4; HOST_BOUND_ARTIFACTS.length -> 8"
        status: pass
    human_judgment: false

duration: 33 min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 06: The Launch Profile Threaded from the Acquire Op to argv — Summary

**A run can now REQUEST warp and headless as an additive optional `profile` field on the broker's existing seven-op `acquire` — narrowed exactly once at the trust boundary with unknown keys refused by name, carried on the instance record, honoured by a synchronous pre-probe eligibility filter that makes a mismatched warm instance ineligible rather than retro-warped or killed, and emitted into argv by the builder `33-05` widened — with an absent profile behaving byte-identically to today at every layer.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-02T19:56Z
- **Completed:** 2026-09-02T20:29Z
- **Tasks:** 2 of 2
- **Files modified:** 14

## Accomplishments

- **`normaliseLaunchProfile()` is the ONE narrowing site, and the boundary refuses by name.** `ControlRequest` carries an index signature, so *anything* a container writes parses — and the profile then feeds an `execve(x64sc, argv)` on the host. The narrowing accepts absent/`null` as profile-less, a plain object whose keys are a subset of `{warp, headless}` with boolean values, and refuses everything else with the **existing** `bad_request` code and a message naming the offending value. Arrays are excluded explicitly (`typeof [] === "object"`, so without the `Array.isArray()` arm a JSON array would have passed the key walk *vacuously* — an empty array has no own keys). Seven malformed shapes are driven and each is asserted refused, with `turbo` appearing by name in the unknown-key case. A refusal answers and drops the request: it never reaches `onAcquire`, and it is never queued for a later drain pass.
- **`ControlRequestKind` is still seven members, asserted off the type's own declaration.** This is `D-15`'s field on an existing op, not an eighth op — and the test reads the union from the source rather than from a second hand-maintained list, because a second list would be the very drift it asserts against.
- **The eligibility filter's POSITION is the invariant, and it is pinned by line number twice.** `profileEligible()` sits as a synchronous `continue` immediately beside the `record.state !== "ready"` check and **before** `await deps.probe(record.port)`. Verified by the plan's own awk-extracted line-number comparison (`profileEligible` at 34, the probe await at 37) *and* by a committed structural test that additionally asserts no `await`, no `deps.kill(` and no `markDeliberateDeath(` appears between the two. The single-owner `inFlight` guard — a synchronous check-and-set by requirement, because of the 2026-08-01 triple-launch outage — gains no new suspension point, and an ineligible candidate costs no probe.
- **`D-16` is implemented as ineligibility, and both wrong answers are asserted absent.** A mismatched warm instance is skipped: after the miss it is still `state: "ready"`, still in `state.instances`, and the kill dependency was **not called**. There is no retro-warp (there is no runtime `WarpMode` resource on stock at all) and no preemptive kill (a named anti-pattern — it would make an interactive session's emulator vanish because a capture run asked for warp). The mismatch is refused in **both** directions: a `{warp:true}` acquire will not take a profile-less instance, and a profile-less acquire will not be handed a warped one.
- **Exactly one grant on both arms, and the at-capacity interaction is the honest refusal.** `state.grants.set(` still appears exactly once in `handleAcquire()` (structurally counted), and both the warm-hit and the ineligible-miss-then-cold paths add exactly one entry. Because `atCapacity()` gates only the cold arm (WR-01), an eligibility miss now reaches it — and the answer is the **existing** `at_capacity` refusal rather than a silent downgrade to the mismatched instance. No new outcome was invented.
- **The profile is written at BOTH client acquire write sites, behind one omit-when-absent helper.** `acquireOverControlPlane()`'s raw `socket.write` and `openBrokerControl()`'s `sendAndAwaitLine` are independent writers; a field added to one silently never arrives for callers on the other. Both are asserted on the **bytes that left the client** and on the value that arrived at the host's `onAcquire`, and a structural test *counts* the sites so "both" is an assertion rather than "at least one". A profile-less line's key set is asserted to be exactly `["id","op","token"]`.
- **`profile` maps to two literal flag tokens and to nothing else, asserted element-wise.** The allow-list is built **from** `STOCK_DETERMINISM_FLAGS`, so it cannot drift away from the block it describes; the one computed element (the `ip4://` address) is matched by shape. Driven with `{warp:true, headless:true}`, again with a second `-remotemonitor` port, and again under a deliberately unsound cast planting `"--attack-flag"` as a profile value — which appears in no argv element and as no substring of one, because no interpolation site for a profile value exists.
- **Restart tolerance is pinned, not assumed.** `InstanceRecord.profile` is optional with **no default**: an absent key and an explicit `{}` behave identically. A record serialised with no `profile` key round-trips to a valid `InstanceRecord` and is treated as profile-less by the **real** `profileEligible()` read out of the built artifact — which is precisely what a broker restarted mid-phase reads, degrading to today's semantics rather than to an error (`T-33-25`'s accepted basis).
- **All four host artifacts regenerated by their build step and staged in the same commit as their sources.** `resources-sync.test.ts` is green in both directions, no `resources/*.mjs` was hand-edited, and `HOST_BOUND_ARTIFACTS` is unchanged at eight entries. The three type-only imports added (`broker-state.mts` → `broker-launch.mjs`, `broker-control.mts` → `broker-launch.mjs`, `vice-broker-client.ts` → `broker-launch.mts`) are verified **fully erased** in the emitted artifacts, so no load-time cycle was created.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): one acquire carrying `profile.warp`, end to end — client write sites, control-plane narrowing, instance record, warm-eligibility filter, argv** — `11f897d` (feat)
2. **Task 2: harden the boundary and the eligibility rule** — `5a9655c` (test)

## Files Created/Modified

- `src/mcp/vice/broker-control.mts` — `normaliseLaunchProfile()` + `NormaliseLaunchProfileResult` + the frozen `LAUNCH_PROFILE_KEYS` list; a `WHAT MUST NEVER BE ADDED HERE` banner naming the argv-injection surface; `onAcquire` widened with an optional second parameter; the profile threaded through `attemptAcquire` and the `enqueueAcquire` retry closure; a comment on `ControlRequestKind` recording that seven is deliberate
- `src/mcp/vice/broker-state.mts` — `InstanceRecord.profile` (optional, never defaulted, with the two-reason banner for why absence means profile-less); `_snapshotState()` given an explicit copy of the record's second nested object
- `src/mcp/vice/vice-broker.mts` — `profileEligible()` with the three-answers banner recording why the other two are undetectable lies; the synchronous pre-probe filter inside `selectWarmInstance()`; `HandleAcquireDeps.profile`; the cold arm's pass-through to `acquirePortAndLaunch()`; `run()`'s `onAcquire` closure widened to receive and forward the narrowed profile
- `src/mcp/vice/broker-launch.mts` — `profile` on `TryLaunchDeps` and `AcquirePortAndLaunchDeps`; `spawnAndRecordInstance()` feeding it to `buildViceArgs()` and mirroring a **copy** onto the record with the key omitted when absent; carried forward across recycle and crash-respawn via a new optional `launchSupervised()` parameter
- `src/mcp/vice/vice-broker-client.ts` — `AcquireProfileOptions`, the `acquireProfileFragment()` single decision site, and the profile at both acquire write sites; `BrokerControlSession.acquire()`'s signature widened
- `src/mcp/vice/resources/{broker-control,broker-state,vice-broker,broker-launch}.mjs` — regenerated by `node build.ts`
- `src/mcp/vice/broker-control.test.ts` — 15 new cases (seven-member gate, the round-trip tracer, both-knobs/both-false, absent, `null`, seven malformed refusals, no-enqueue, queued-retry-keeps-profile); two pre-existing structural tests' pinned `attemptAcquire` signature updated, and one match relaxed from `.onAcquire(requestId)` to the invocation prefix
- `src/mcp/vice/vice-broker-acquire.test.ts` — 10 new cases (the cold-launch tracer, the profile-less warm hit, absent-equals-false, both-direction ineligibility, matching warm hit, headless with `-console` at index 1, capacity interaction, and the two structural gates)
- `src/mcp/vice/broker-state.test.ts` — 4 new cases (absent by default, snapshot deep copy, snapshot invents no key, and the `T-33-25` restart round trip)
- `src/mcp/vice/vice-broker-client.test.ts` — 5 new cases (both write sites × present/absent, plus the site-counting structural gate); `FullBrokerDeps.onAcquire` widened
- `src/mcp/vice/broker-launch.test.ts` — 3 new cases (the element-wise `T-33-04` assertions)

## Decisions Made

1. **`profile` lives on the existing `HandleAcquireDeps` bag, not as a fifth positional parameter.** The real broker wiring already builds a fresh bag per acquire, so per-request data threads through it naturally, and `backend` already establishes the precedent of a non-injected configuration value living there. A fifth positional argument after an optional fourth is legal TypeScript but unreadable at every call site.
2. **The profile is carried forward across respawn and recycle** — see the Deviations section. The plan did not name it; leaving it out would have reintroduced `D-16`'s undetectable lie one respawn later.
3. **`buildViceArgs()` deliberately does not re-validate the profile.** `profile?.warp` stays a truthiness test. Adding a second shape check there would create the second narrowing site this plan exists to avoid; the argv-injection risk is closed by the fact that no argv element is a *function* of a profile value, which is asserted directly rather than inferred from the type.
4. **The literal-token allow-list for the element-wise argv assertion is built FROM `STOCK_DETERMINISM_FLAGS`,** not typed out. A hand-copied list would have to be maintained in step with the exported block, and the whole reason `33-05` exported that block frozen was to stop exactly that kind of second copy from existing.
5. **The two pre-existing structural tests that pinned `attemptAcquire`'s literal signature had their expected strings updated, and one match was deliberately loosened.** `.onAcquire(requestId)` became `.onAcquire(requestId` — matched on the invocation *prefix* — so the WR-03 ordering assertion those tests actually police survives a further widening of the callback instead of failing for a reason it does not police. The pinned function signature itself was left as a full literal, because a signature change there IS worth a deliberate look.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The launch profile was not carried forward across crash-respawn or recycle**

- **Found during:** Task 1 (threading the profile into the cold-launch arm)
- **Issue:** `handleExit()` → `launchSupervised()` (`broker-launch.mts`) builds a **brand new** `InstanceRecord` on every replacement, and threads exactly four facts forward across it (`crashTimes`, `backoffMs`, the pre-kill `granted` state, and — per `CR-02` — `remoteMonitorPort`). The plan named none for `profile`. The consequence is not cosmetic: a recycled or crash-respawned `{warp:true}` instance would come back **unwarped**, while `spawnAndRecordInstance()` would leave the fresh record carrying no profile at all (making it wrongly eligible for profile-less acquires) — or, had the record been repopulated without the argv being rebuilt, carrying a profile it was not launched with (making it wrongly eligible for warp acquires). Either way `profileEligible()` would then hand out an instance that does not match what the caller asked for. That is precisely the undetectable mismatch `D-16` and `T-33-24` exist to structurally exclude, reintroduced one respawn later — and it is the same defect class `CR-01` already caused once in this exact function (a stock instance respawning with the *fork's* argv).
- **Fix:** An optional seventh parameter on `launchSupervised()`, threaded into `tryLaunchOne()`'s deps, and read from the crashed record at **both** `handleExit()` call sites (`preKillProfile` captured before the map entry is overwritten, mirroring `preKillRemoteMonitorPort` line for line; `record.profile` on the crash branch). Because `spawnAndRecordInstance()` derives the record's `profile` from the same value it passes to `buildViceArgs()`, the replacement's argv and its recorded profile are written in one step and cannot disagree.
- **Files modified:** `src/mcp/vice/broker-launch.mts`, `src/mcp/vice/resources/broker-launch.mjs`
- **Verification:** `node --test broker-launch.test.ts vice-broker-launch.test.ts` → `pass 90 / fail 0` (the respawn and recycle cases in those files exercise both `handleExit()` branches); `npm run typecheck` clean.
- **Committed in:** `11f897d` (part of the Task 1 commit)

**2. [Rule 1 - Bug] `_snapshotState()`'s documented deep-copy contract became false the moment `profile` was added**

- **Found during:** Task 1 (adding `InstanceRecord.profile`)
- **Issue:** `_snapshotState()` is documented as a "deep, plain-object copy… for tests" and `broker-state.test.ts` asserts that *mutating a nested value in the result leaves the broker's own state and a later snapshot unchanged*. It achieved that with `{ ...r, viceArgs: [...r.viceArgs] }` — correct while `viceArgs` was the record's only nested value. `profile` is the second, so a bare spread would have handed callers a live reference into broker state while the file's own test kept passing (it only mutates `viceArgs`).
- **Fix:** `...(r.profile === undefined ? {} : { profile: { ...r.profile } })` — copied when present, and the key **not** invented when absent, so a snapshot cannot add a `profile: undefined` key the record itself does not carry.
- **Files modified:** `src/mcp/vice/broker-state.mts`, `src/mcp/vice/resources/broker-state.mjs`, `src/mcp/vice/broker-state.test.ts` (two new cases asserting both halves)
- **Verification:** `node --test broker-state.test.ts` → `pass 22 / fail 0`, including the mutation-does-not-reach-live-state case and the no-invented-key case.
- **Committed in:** `11f897d` (code) and `5a9655c` (the two assertions)

**3. [Rule 3 - Blocking] Task 1's `<verify>` gate and the plan's task split were mutually unsatisfiable for two test files**

- **Found during:** Task 1
- **Issue:** The plan assigns the boundary refusals and the eligibility cases to Task 2, while Task 1's own `<verify>` block requires `node --test broker-control.test.ts … vice-broker-acquire.test.ts …` to report `fail 0`. Those tests are purely additive, so either split satisfies `fail 0` — but two *pre-existing* structural tests in `broker-control.test.ts` pin `attemptAcquire`'s literal signature (`function attemptAcquire(requestId: string): Promise<boolean> {`), and Task 1's own action text widens exactly that signature. Both went red at Task 1's first run. Honouring the split literally for the file those tests live in would have committed a knowingly-red suite. (This is the same shape as `33-05`'s own deviation 1, and for the same structural reason.)
- **Fix:** The two pinned signatures were updated inside Task 1's commit as mechanical expected-value updates, and — since both files were already open and being edited in that commit — the boundary-refusal and eligibility cases the plan assigns to Task 2 landed there too. Task 2 then delivered its full remaining scope: the element-wise `T-33-04` argv assertions in `broker-launch.test.ts`, the `T-33-25` restart round trip and the two snapshot cases in `broker-state.test.ts`, and the five both-write-site cases in `vice-broker-client.test.ts`. Every acceptance criterion of both tasks is met and nothing the plan asked for was dropped; no commit in this plan's history is red at any point.
- **Files modified:** `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/vice-broker-acquire.test.ts`
- **Verification:** `node --test broker-control.test.ts` → `pass 59 / fail 0` at Task 1's commit; `node --test broker-control.test.ts vice-broker-acquire.test.ts broker-state.test.ts broker-launch.test.ts` → `pass 188 / fail 0` at Task 2's.
- **Committed in:** `11f897d`

**4. [Rule 1 - Bug] The `T-33-25` round-trip case asserted a state value its own fixture does not produce**

- **Found during:** Task 2
- **Issue:** The new restart-tolerance case asserted `revived.state === "ready"`, but `broker-state.test.ts`'s `makeInstance()` helper defaults to `"launching"` (unlike `vice-broker-acquire.test.ts`'s `makeReadyInstance()`). The test failed on its own hardcoded expectation, not on the property under test.
- **Fix:** Asserted against the fixture's own value (`preFieldRecord.state`) with a comment recording why, so the case stays about the `profile` field and not about the helper's defaults.
- **Files modified:** `src/mcp/vice/broker-state.test.ts`
- **Verification:** `node --test broker-state.test.ts` → `pass 22 / fail 0`.
- **Committed in:** `5a9655c`

---

**Total deviations:** 4 auto-fixed (2 × Rule 1 — a real deep-copy bug and a wrong test expectation; 1 × Rule 2 — missing respawn carry-forward; 1 × Rule 3 — a blocking conflict in the plan's own task/verify structure). No Rule 4 deviations; no architectural change; no new dependency; no scope removed.
**Impact on plan:** Every `must_haves` truth and every acceptance criterion of both tasks holds. Deviations 1 and 2 *strengthen* the plan's own stated guarantees (`D-16`'s no-mismatched-grant property now survives a respawn, and `_snapshotState()`'s documented contract stays true) rather than trading them away. Deviation 3 moves test content one commit earlier so no commit in this plan is red. Deviation 4 fixed a test, not production code.

## Known Stubs

None. Every declared file carries real implementation, every task `<verify>` command was run and is recorded below, and no test was skipped, `todo`'d or commented out by this plan.

## Threat Flags

None. No new network endpoint, no new auth path, no new file-access pattern, and no new trust-boundary schema — the `profile` field enters through the **existing** `acquire` op on the **existing** TCP control plane, under the **existing** constant-time token gate, and is answered with the **existing** `bad_request` / `at_capacity` error codes. No new `ControlErrorCode` and no eighth op were added.

All six mitigations the plan's `<threat_model>` assigns to this plan are in place and asserted:

| Threat ID | Disposition | Status |
|---|---|---|
| T-33-03 (`profile` → tampering/EoP at the wire) | mitigate | **Done.** `normaliseLaunchProfile()` is the single narrowing site; seven malformed shapes refused with the offending value named; refusals do not enqueue and never reach `onAcquire`. |
| T-33-04 (`profile` → argv) | mitigate | **Done.** Asserted element-wise against a literal-token allow-list built from `STOCK_DETERMINISM_FLAGS`, twice more under a second bind address and under a planted `"--attack-flag"` string value. `VICE_ARGS` remains the single operator-only whole-argv override. |
| T-33-05 (binmon bind) | mitigate | **Done, by construction.** `profile` has no path to `binmonHost`; the `127.0.0.1` default and both one-time widened-bind stderr notes are untouched (verified by `broker-launch.test.ts`'s pre-existing note-once tests, still green). |
| T-33-23 (the single-owner `inFlight` guard) | mitigate | **Done.** The filter is synchronous and pre-probe, verified by line-number comparison in the plan's own `<verify>` **and** by a committed structural test that additionally forbids any `await`, kill or death-marker between the filter and the probe. |
| T-33-24 (a grant that does not match the request) | mitigate | **Done, and hardened beyond the plan** — the mismatch is structurally excluded at acquire time *and* across respawn/recycle (deviation 1). The kill dependency is asserted not called and the instance asserted still `ready`. |
| T-33-25 (older state-directory records) | accept | **Pinned rather than left implicit,** as the register requires: a record with no `profile` key round-trips valid and is profile-less to the real `profileEligible()`. |
| T-33-SC (package installs) | accept | **Confirmed absent.** This plan adds no dependency; `src/mcp/vice/package-lock.json` and both `package.json` files are untouched. |

## Verification Results

Every command below was re-run at the end of the plan, on a host with **no broker and no `x64sc` process** (a live broker reddens `BACK-05` deterministically).

| Check | Command | Result |
|---|---|---|
| Host artifact build | `node build.ts` | `build: wrote 8 artifact(s)` |
| Artifact drift guard | `node --test resources-sync.test.ts` | `tests 2 / pass 2 / fail 0` |
| `HOST_BOUND_ARTIFACTS` unchanged | `node -e '…HOST_BOUND_ARTIFACTS.length'` | `8` |
| Typecheck | `npm run typecheck` | clean, zero lines matching `error TS` |
| Task 1 unit suite | `node --test broker-control.test.ts broker-state.test.ts vice-broker-acquire.test.ts vice-broker-client.test.ts resources-sync.test.ts` | `tests 141 / pass 141 / fail 0` |
| Task 2 unit suite | `node --test broker-control.test.ts vice-broker-acquire.test.ts broker-state.test.ts broker-launch.test.ts` | `tests 188 / pass 188 / fail 0` |
| Launch-path regression | `node --test broker-launch.test.ts vice-broker-launch.test.ts` | `tests 94 / pass 90 / fail 0` (4 opt-in live cases skipped) |
| Filter placement (T-33-23) | awk-extracted `selectWarmInstance()` body, line-number comparison | `FILTER_BEFORE_PROBE (P=34 A=37)` |
| Both client write sites | `grep -c 'op: "acquire"' vice-broker-client.ts` ≥ 2, `grep -c 'profile'` ≥ 2 | pass |
| Same-commit staging (Task 1) | `git show --name-only 11f897d \| grep -c '^src/mcp/vice/resources/.*\.mjs$'` | `4` |
| Task 2 count gates | `grep -v '^//' broker-control.test.ts \| grep -c 'bad_request'` ≥ 7; `… vice-broker-acquire.test.ts \| grep -c 'profileEligible\|profile:'` ≥ 6 | `11` and `25` |
| Type-only imports erased | `grep '^import' resources/broker-state.mjs resources/broker-control.mjs` | no `broker-launch.mjs` import in either — no load-time cycle |
| Frozen files untouched | `git status --short` over `evidence/{DECISION-RULE,SCHEMA,README}.md` | no change; nothing written under `evidence/` |
| No deletions | `git diff --diff-filter=D --name-only` per commit | `NO_DELETIONS` (both commits) |
| **Wave gate** | `cd src/mcp/vice && npm run test:automated` | `tests 3049 / pass 3041 / fail 2`, both in `anno-register.test.ts` (`:385`, `:479`) |

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

The two failures are the phase's recorded out-of-phase baseline (`evidence/README.md` § *Evidence conventions* 4): the anno register cites requirement ids (`STORE-01`, `STORE-04`, `STORE-06`, `MCP-04`) that `.planning/REQUIREMENTS.md` no longer declares since the v0.8.0 milestone open — a root cause this phase did not create and this plan does not touch. **The count and the file name are identical to the baseline `33-03` and `33-05` recorded, so this plan introduced no regression.** The total test count rose from `3013` to `3049` (+36, this plan's new cases) with the pass count rising by the same 36.

**Wave-gate note for the wave-3 orchestrator:** this run measured the gate with **only `33-06` landed** in wave 3. `33-VALIDATION.md` § Sampling Rate makes the gate a **wave** gate, run once after every plan in the wave has landed — so this result is a per-plan datum proving `33-06` regressed nothing, not the wave verdict. The wave verdict must still be taken after `33-07` lands.

## Gate Lines

This plan emits **no** `GATE-01` outcome line. It is not the declared source file for any of the five gate inputs, nor for any never-gate line in `evidence/SCHEMA.md` § 3, and it writes nothing whatsoever under `evidence/`. `SLICER:` is deliberately **not** emitted — that belongs to `33-07`, in this same wave. The `BROKER_STATE:` / `TEST_AUTOMATED_BASELINE:` pair above is recorded because this plan ran the automated suite on a live host; both are declared never-gate lines whose source is "every evidence file carrying a live run", and neither is a verdict input. The three frozen files (`evidence/DECISION-RULE.md`, `evidence/SCHEMA.md`, `evidence/README.md`) are unmodified.

## Issues Encountered

None beyond the four documented deviations. One thing worth naming for the next executor, since it is easy to trip over:

- **`D-18` is NOT in this plan, deliberately, and its absence is not an omission.** `REPRO-05` asks for `probeReady`'s real-time timeouts to be re-checked under warp "in the same plan that adds the profile". That re-check is a **live, broker-stopped measurement**, governed by `D-10`/`D-11`, and it lives in `33-11` — still inside this phase — widened there to cover `-console` as well as `-warp` (research observed one `-console` launch not yet bound at 3000 ms and bound at 5000 ms). This plan's own `<objective>` states that placement and `33-11` cites it. Nothing here changes `probeReady`'s timeouts.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **`33-11` can perform `D-18`'s measurement against a real requestable warp.** `openBrokerControl().acquire({ profile: { warp: true } })` and `acquireOverControlPlane(dir, { profile: { warp: true } })` are both live, and a granted instance's `InstanceRecord.profile` records what it was actually launched with — so a probe measuring readiness under warp can *prove* the instance it measured was warped rather than assuming it.
- **`33-10` / `33-12` can key a capture record on a launch's full launch intent.** `record.viceArgs` and `record.profile` are written in the same step from the same value, so an argv digest and the profile that produced it cannot disagree; `STOCK_DETERMINISM_SEED` / `STOCK_DETERMINISM_FLAGS` remain the one definition for the seed half.
- **A warm floor and a warp request now coexist.** A profile-less acquire is still served from the warm floor with zero behaviour change, so nothing that already worked got slower or more conditional; a profile-bearing acquire gets a dedicated instance.
- **One carry-forward, not a blocker:** the second `-remotemonitor` port and the launch profile are now the two facts a replacement instance must inherit, and they inherit through the *same* `launchSupervised()` parameter list. A third such fact should extend that list rather than adding a parallel mechanism — the list is the reason `CR-01`'s launch/respawn divergence cannot recur.
- **No blockers.**

## Requirements Bookkeeping

`REPRO-05` is declared by **three** plans in this phase — `33-05`, `33-06` and `33-11`. The shared-ID gate (`requirements.ready-ids`) therefore holds it until the last declaring plan produces a SUMMARY, and `33-11` has not run yet. This plan delivered its half (the control-plane thread and the eligibility rule) and says so here rather than flipping a checkbox its sibling has not earned; the id flips automatically when `33-11` finishes its own `update_requirements` step.

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*

## Self-Check: PASSED

- All 14 declared `key-files.modified` paths exist on disk (`[ -f ]` per path).
- Both task commits are reachable (`11f897d`, `5a9655c`).
- Neither commit deleted a tracked file (`git diff --diff-filter=D` empty for both).
- `evidence/DECISION-RULE.md`, `evidence/SCHEMA.md` and `evidence/README.md` are unmodified, and nothing was written anywhere under `evidence/`.
- Every task `<verify>` command and every plan-level `<verification>` item was re-run at the end of the plan; all results are in the Verification Results table above.
- No `resources/*.mjs` was hand-edited — all four were produced by `node build.ts` and `resources-sync.test.ts` is green in both directions.
