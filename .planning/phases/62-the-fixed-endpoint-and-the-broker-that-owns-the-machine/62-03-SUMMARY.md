---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
plan: 03
subsystem: broker-control-plane
tags: [networking, interface-enumeration, tcp, bind-narrowing, node-net, node-os]

# Dependency graph
requires:
  - phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine (plan 01)
    provides: "The hello handshake dispatched ahead of the token gate, which is why the bind set is now the first line of defence"
provides:
  - "src/mcp/vice/broker-control.mts: BRIDGE_INTERFACE_ALLOWLIST, enumerateBindHosts(), startControlListenerOnHosts() -- a multi-address listener sharing one pending-acquire queue"
  - "src/mcp/vice/vice-broker.mts: startup wired to the enumerated bind set, with asymmetric loopback-fatal/bridge-non-fatal failure handling and an explicit-wildcard refusal"
affects: [62-04, 62-05, phase-66-convergence]

# Actuals (#2632)
actuals:
  tokens: 18069
  tasks: 2
  commits: 2
plan_head_before: 8a4e917573476a91e5c88873f5c86f60683e78e8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface enumeration keyed on the INTERNAL flag for loopback identification (never the interface name, which is 'lo0' not 'lo' on macOS/BSD) plus a NAME allowlist for the bridge subset, filtered to IPv4"
    - "N binds sharing ONE pending-acquire queue: bindControlListener()/attachControlProtocol() called once per host with the SAME queue reference, never startControlListener() looped (which would allocate N independent queues)"
    - "Per-host bind failures surfaced as a data structure (never thrown, never swallowed), leaving fatality judgement to the caller -- which alone knows whether the failing host was loopback (always fatal) or a bridge (never fatal on its own)"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/vice-broker-launch.test.ts
    - src/mcp/vice/broker-e2e.test.ts
    - src/mcp/vice/broker-kill.test.ts
    - src/mcp/vice/vice-broker-supervision.test.ts

key-decisions:
  - "startControlListener() keeps its original single-host signature and every existing caller unedited (per the plan's own instruction); only its wildcard DEFAULT was removed, replaced with an explicit rejection when neither opts.host nor VICE_BROKER_CONTROL_HOST resolves a host"
  - "Every successfully-bound listener is closed before any fatal early return in the loopback-failure path -- discovered as a real hang (not a hypothetical) when a bridge address bound successfully alongside a failing loopback bind, leaving an open net.Server keeping the process's event loop alive despite process.exitCode being set"
  - "bindHosts[0] is the one address this startup treats as 'loopback' for fatality purposes in BOTH modes: the explicit-host case has exactly one entry (fatal, matching every prior version of this function), and enumerateBindHosts() is contracted to always return loopback first"
  - "The non-EADDRINUSE bind-failure message text was kept as 'failed to start control listener on <host>: ...' (rather than a fresh wording) specifically so a pre-existing test in broker-control.test.ts (VICE_BROKER_CONTROL_HOST set to an invalid address) kept passing without editing a file outside this plan's declared scope"

requirements-completed: [BROKER-03, BROKER-04]

coverage:
  - id: D1
    description: "The broker binds loopback plus every address on an interface whose NAME matches the allowlist, enumerated once from the live interface list, never the wildcard address or a hardcoded gateway literal"
    requirement: "BROKER-03"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#BRIDGE_INTERFACE_ALLOWLIST has exactly four entries, each of the four D-09 names matches exactly one"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#enumerateBindHosts (7 behavior-driven tests: loopback+bridge, loopback-only, virtual/wireless exclusion, IPv4-only dual-stack, per-pattern recognition, no-loopback empty result, single-call proof)"
        status: pass
      - kind: other
        ref: "grep gates: VICE_BROKER_CONTROL_HOST ?? \"0.0.0.0\" absent from both broker-control.mts and its compiled copy; 'never 127.0.0.1' absent; 'enumerated bridge' present"
        status: pass
    human_judgment: false
  - id: D2
    description: "N bound addresses share exactly one pending-acquire queue, serving acquires in arrival order regardless of which address each arrived on"
    requirement: "BROKER-01, BROKER-03"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#two listeners on two different bound addresses share exactly one pending-acquire queue, serving two acquires in arrival order"
        status: pass
    human_judgment: false
  - id: D3
    description: "The broker binds the enumerated set at startup; loopback failing is always fatal, a single bridge address failing is logged and non-fatal, an explicit wildcard control-host is refused by name, and the discovery record's field set is unchanged"
    requirement: "BROKER-04"
    verification:
      - kind: unit
        ref: "vice-broker-launch.test.ts#emitted artifact starts a LONG-LIVED broker: writes the fourteen-field discovery record (mode 0600), binds a control listener on loopback (D-09)"
        status: pass
      - kind: unit
        ref: "broker-e2e.test.ts#end-to-end acquire test (control_host now 127.0.0.1)"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts singleton tests (live second broker, stale-record squatter, non-EADDRINUSE bind failure) -- all pre-existing, all still pass under the new enumeration path"
        status: pass
      - kind: other
        ref: "grep gates: VICE_BROKER_CONTROL_HOST ?? \"0.0.0.0\" absent from vice-broker.mts and its compiled copy; startControlListenerOnHosts/enumerateBindHosts present; no stale 0.0.0.0 literal in either D-12 test file"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-19
status: complete
---

# Phase 62 Plan 3: The Fixed Endpoint and the Broker That Owns the Machine Summary

**Interface enumeration (loopback plus a four-pattern bridge allowlist) feeding a multi-address control-plane listener that shares one pending-acquire queue, wired into the broker's own startup with asymmetric loopback-fatal / bridge-non-fatal failure handling and an explicit-wildcard refusal.**

## Performance

- **Duration:** 70 min (approximate)
- **Started:** 2026-09-19T15:12:00Z (approximate)
- **Completed:** 2026-09-19T16:22:00Z (approximate)
- **Tasks:** 2
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments
- `src/mcp/vice/broker-control.mts` gains `BRIDGE_INTERFACE_ALLOWLIST` (four mutually-exclusive patterns: `docker0` exact, `br-`, `podman`, `cni-` prefixes), `enumerateBindHosts()` (loopback via the record's own INTERNAL flag, never the interface name, plus IPv4-only allowlisted bridge addresses, loopback always first, de-duplicated, never throwing), and `startControlListenerOnHosts()` (binds N hosts via the existing `bindControlListener()`/`attachControlProtocol()` pair, sharing exactly ONE pending-acquire queue rather than forking fairness into per-listener silos).
- `startControlListener()`'s single-host default no longer falls back to the wildcard address -- it rejects explicitly when neither `opts.host` nor `VICE_BROKER_CONTROL_HOST` resolves a host, while its signature, its one existing caller and its behavior for every already-supplied host stay untouched.
- The module header no longer prescribes "bind `0.0.0.0` explicitly, never `127.0.0.1`" -- it states the v2.0.0 rule (loopback plus enumerated bridge gateways from a name allowlist) and explains why the bind set is now the first line of defence: `hello` answers unconditionally, with no credential, so a wildcard bind would let any network peer complete a handshake for free.
- `src/mcp/vice/vice-broker.mts`'s startup resolves the bind set once: an explicit `VICE_BROKER_CONTROL_HOST` is honoured verbatim as the sole host and refused by name before any bind attempt if it classifies as a wildcard (a small locally-mirrored classifier, per this codebase's host/container boundary convention); otherwise `enumerateBindHosts()` is called exactly once and held for the process's life (D-10 -- no timer, no watch-and-warn).
- Failure handling is asymmetric per D-09: a bridge address failing to bind is logged by name and the broker continues on the reduced set; loopback failing is routed through the pre-existing EADDRINUSE/liveness classification (quiet exit against a live sibling, loud FATAL naming the port against a squatter) -- unchanged in spirit, now scoped to the loopback entry specifically rather than "the" bind attempt as a whole.
- The discovery record's `control_host` field now carries the loopback address the broker actually enumerated (e.g. `127.0.0.1`), never the wildcard address; its field count and names are unchanged (still fourteen). The full bound set (every address that actually bound) is additionally printed on stderr as one labelled line for operator auditability.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate the bind set once, and serve every bound address from one queue** - `409ea057` (feat)
2. **Task 2: Bind the set at startup, refuse loudly, and update the two assertions this changes** - `94c8645f` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/mcp/vice/broker-control.mts` - `BRIDGE_INTERFACE_ALLOWLIST`, `enumerateBindHosts()`, `startControlListenerOnHosts()`, rewritten header, wildcard-fallback removed from `startControlListener()`
- `src/mcp/vice/resources/broker-control.mjs` - regenerated compiled copy
- `src/mcp/vice/broker-control.test.ts` - 10 new tests (allowlist, 7 enumerator behaviors, shared-queue arrival order) plus one structural-test literal updated for the renamed call site (deviation)
- `src/mcp/vice/vice-broker.mts` - startup wired to the enumerated bind set; `isWildcardBindHostLocal()`; asymmetric loopback/bridge failure handling; listener-leak-safe early returns; stderr audit line
- `src/mcp/vice/resources/vice-broker.mjs` - regenerated compiled copy
- `src/mcp/vice/vice-broker-launch.test.ts` - test title and `control_host` assertion updated to the loopback literal (D-12)
- `src/mcp/vice/broker-e2e.test.ts` - header comment and `control_host` assertion updated to the loopback literal (D-12)
- `src/mcp/vice/broker-kill.test.ts` - two structural-test literals updated for the renamed call site (deviation)
- `src/mcp/vice/vice-broker-supervision.test.ts` - ordering-predicate regex and anchor literal updated for the renamed call site (deviation)

## Decisions Made
- **`bindHosts[0]` is the universal "loopback for fatality purposes" address** in both the explicit-host and enumerated modes, rather than a separately-tracked flag -- the explicit-host array always has exactly one entry (which must behave exactly as the old single-host function did: fatal), and `enumerateBindHosts()`'s own contract guarantees loopback sorts first, so a single index expresses both cases without a second code path.
- **`startControlListenerOnHosts()` never throws** -- per-host failures are returned as a `failures` array so the caller (this plan's own Task 2 startup code) makes the fatality judgement, which needed both the specific failing host's identity and knowledge of which host is "loopback" -- neither of which the lower-level bind function can know on its own.
- **Every successfully-bound listener is explicitly closed before a fatal early return.** This surfaced as a genuine test-suite hang (not a theoretical concern) during verification: two singleton tests in `broker-control.test.ts` squat only the loopback address, letting the broker under test bind successfully on this sandbox's `docker0` bridge gateway (`172.17.0.1`) while failing on loopback as intended -- the open bridge listener then kept the process's event loop alive indefinitely after `process.exitCode` was set, since `exitCode` only takes effect once nothing is left running. Fixed by calling `.server.close()` on every bound listener in both fatal-return branches before returning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three structural tests outside this plan's declared files broke on the `startControlListener(` -> `startControlListenerOnHosts(` rename**
- **Found during:** Task 2 (full `npm run test:automated` regression pass)
- **Issue:** `vice-broker-supervision.test.ts` (two tests: Ghidra-handle-ordering predicate and its planted-violation control) and `broker-kill.test.ts` (two tests: banner-before-listener ordering, reap-before-listener ordering) each scan `vice-broker.mts`'s raw source for the literal substring `startControlListener(` or the exact anchor `listener = await startControlListener({` to prove a source-ordering invariant. Renaming the call site to `startControlListenerOnHosts(bindHosts, {` (required by this plan's own Task 2 action) made every one of these literals stop matching, since `startControlListenerOnHosts(` does not contain `startControlListener(` as a substring (the character after `startControlListener` is `O`, not `(`).
- **Fix:** Updated each regex/literal to the new call-site spelling (`startControlListenerOnHosts\(` / `await startControlListenerOnHosts(bindHosts, {`), preserving each test's original ordering assertion and its planted-violation controls unchanged.
- **Files modified:** `src/mcp/vice/vice-broker-supervision.test.ts`, `src/mcp/vice/broker-kill.test.ts`, `src/mcp/vice/broker-control.test.ts` (a fourth, similarly-shaped structural test in the SAME file this plan already edits for Task 1)
- **Verification:** All four tests pass; `npm run test:automated` returns to exactly the one known pre-existing failure (`phase58-citation-ledger.test.ts`).
- **Committed in:** `94c8645f` (Task 2 commit)

**2. [Rule 1 - Bug] A pre-existing non-EADDRINUSE bind-failure test's message-regex assertion broke on the new per-host wording**
- **Found during:** Task 2 (re-running `broker-control.test.ts` after wiring)
- **Issue:** `broker-control.test.ts`'s pre-existing test "a bind failure whose cause is NOT address-in-use..." sets `VICE_BROKER_CONTROL_HOST` to an invalid address string and asserts `stderr` matches `/failed to start control listener/i`. The initial non-EADDRINUSE failure message this plan wrote (`failed to bind loopback address ...`) did not contain that substring.
- **Fix:** Reworded the message to `failed to start control listener on <host>: ...`, preserving the required substring while still naming the specific failing host.
- **Files modified:** `src/mcp/vice/vice-broker.mts`
- **Verification:** The test passes; no other assertion depends on the exact previous wording.
- **Committed in:** `94c8645f` (Task 2 commit)

**3. [Rule 1 - Bug] A real process hang from an unclosed bridge listener on a loopback-fatal failure path**
- **Found during:** Task 2 (full-suite verification -- two singleton tests hung the test run past its timeout, leaving two orphaned `vice-broker.mjs` processes bound to a real Docker bridge address on this sandbox)
- **Issue:** When loopback fails to bind (e.g. squatted by a test fixture) but a bridge address binds successfully in the same `startControlListenerOnHosts()` call, the successfully-bound bridge listener remained open when the startup code returned on the fatal path. `process.exitCode` alone does not terminate a process with an active `net.Server` still listening -- the event loop had no other reason to exit, so the process ran forever until killed.
- **Fix:** Added `for (const bound of bindResult.listeners) bound.server.close();` immediately before every fatal early return in the loopback-failure and defensive-fallback branches.
- **Files modified:** `src/mcp/vice/vice-broker.mts`
- **Verification:** Re-ran `broker-control.test.ts`'s two affected singleton tests (both spawn a real broker without an explicit `VICE_BROKER_CONTROL_HOST`, so they exercise the enumerated multi-host path against this sandbox's real `docker0` bridge) -- both complete and exit within their existing timeouts, with no leftover `vice-broker.mjs` processes (`ps aux` confirmed clean before and after).
- **Committed in:** `94c8645f` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 -- direct, necessary consequences of this plan's own required rename and startup restructuring; no scope creep).
**Impact on plan:** All three fixes were necessary for the plan's own new/changed code to leave the pre-existing suite green. The third (the listener-leak fix) is also a genuine correctness bug this plan's own design would otherwise have shipped -- a broker that loses the loopback singleton race while a bridge interface happens to be present would never exit, which is exactly the kind of silent failure this project's CLAUDE.md and this plan's own threat register (T-62-14, Denial of Service) exist to prevent.

## Issues Encountered

- `npm run test:automated` (the full suite, 3959 tests after this plan's additions) reproduces the same single pre-existing failure plans 62-01/62-02 already logged: `phase58-citation-ledger.test.ts`'s citation-anchor drift in `.planning/PROJECT.md` (line 2083). Confirmed unrelated -- `.planning/PROJECT.md` carries no changes from this plan. Already recorded in `deferred-items.md`; not re-logged here.
- No macOS host was available to directly measure the "empty bridge subset, loopback-only bind" steady state this plan's own design accepts on faith from D-09/CONTEXT.md (Docker Desktop's VM architecture). The code path is exercised on this Linux sandbox with a real `docker0` bridge present (both the loopback-only and loopback-plus-bridge cases are covered by synthetic-interface-map unit tests in `broker-control.test.ts`, and the live singleton tests exercise the real enumerator against this host's actual interfaces), but the macOS-specific "no bridge interface exists at all" case is asserted only by the synthetic `enumerateBindHosts` unit test, not by a live macOS run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The broker now binds only what BROKER-03/D-09 permit, refuses loudly on the failure modes BROKER-04 names, and reports its bound set on stderr for operator auditability -- the security posture the per-boot token used to provide now rests structurally on this narrowing, matching this plan's own stated purpose.
- `enumerateBindHosts()`/`startControlListenerOnHosts()` are ready for any later plan that needs to reason about the broker's own multi-address reachability (e.g. plan 62-04's machine-level wiring).
- `startControlListener()` (single-host) remains available, unchanged in shape, for any test or future caller that genuinely wants a one-address bind with no enumeration.
- The `phase58-citation-ledger.test.ts` failure remains open in `deferred-items.md` for whichever phase or hygiene pass owns `.planning/PROJECT.md`'s citation ledger.
- D-11's ledger reconciliation note from plan 62-01/62-02 stands: this plan completed D-11's last two named sites (the `broker-control.mts` header and its compiled copy); `RM-04` still maps to Phase 66 in `REQUIREMENTS.md`'s traceability table and will find that work already done -- bookkeeping, not code, and not this plan's to fix.

---
*Phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine*
*Completed: 2026-09-19*

## Self-Check: PASSED

All modified files verified present on disk; both task commit hashes (`409ea057`, `94c8645f`) verified present in `git log`.
