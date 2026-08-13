---
phase: 02-stock-backend-connection
plan: 08
subsystem: protocol
tags: [binary-monitor, vice, protocol, connect-handshake, capability-gate, restart-detection, tdd]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "02-06's ViceMonitorClient (connect()/disconnect()/send(), StockConnectionClosedError/StockRequestTimeoutError/StockFramingError/StockProtocolError); 02-05's claimMonitor()/releaseMonitor()/MonitorOwnershipError on vice-broker-client.ts's BrokerControlSession; 02-07's readCapabilityRecord()/writeCapabilityRecord() per-binary capability cache on backend-detect.mts"
provides:
  - "stock-connect.ts: stockConnect() -- the one connect handshake for the stock path (claim, dial, api_version assertion, VICE_INFO identity, CPUHISTORY_GET capability gate settled once per binary); stockDisconnect() -- the normal claim-release counterpart; stockReconnect() -- epoch-baseline restart detection reusing vice.ts's existing MachineRestartedError"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A connect handshake claims a broker-owned resource (claimMonitor()) strictly before dialling the resource it protects -- the same claim-before-dial ordering vice-broker-client.ts's own MonitorOwnershipError establishes, now consumed at its intended call site"
    - "A wire-level check that stock-protocol.ts's parser already performs (api_version validation on every frame) is reused as-is by simply propagating client.send()'s own rejection, rather than re-deriving a second api_version assertion in the handshake layer"
    - "A per-binary capability cache's boolean-only schema (backend-detect.mts's cpuHistoryAvailable) is deliberately NOT widened to a three-state enum for a cache HIT -- the three-way distinction (available/absent/not_compiled_in) is only ever meaningful on a FRESH probe; a cache hit collapses the two 'never retry' outcomes into one, documented inline as a deliberate simplification"
    - "Restart detection is 'prove sameness, then re-run the whole handshake' rather than 'patch the existing session in place' -- re-running stockConnect() after a proven-matching epoch means VICE_INFO and the capability gate are always re-evaluated fresh, so a restart that swapped the binary can never inherit a stale capability answer"

key-files:
  created:
    - .claude/mcp/vice/stock-connect.ts
    - .claude/mcp/vice/stock-connect.test.ts
  modified:
    - .claude/mcp/vice/package.json

key-decisions:
  - "api_version assertion (PROTO/D-16) needs no new code path: stock-protocol.ts's own parser already validates api_version on every decoded frame and rejects a pending send() with a typed StockFramingError on mismatch. stockConnect() sends one PING and lets that rejection propagate (after releasing the claim) rather than re-deriving a second, parallel api_version check."
  - "backend-detect.mts's CapabilityRecordResult/BackendCacheRecord schema stores cpuHistoryAvailable as a boolean, not stock-connect.ts's own three-state CpuHistoryCapability ('available'|'absent'|'not_compiled_in') -- widening that schema was out of this plan's files_modified and not requested. A cache HIT therefore reports 'absent' for a cached `false` (documented inline as the more common non-3.10 case); only a FRESH probe (cache miss or stale) can distinguish 'absent' from 'not_compiled_in'. This is a deliberate, documented simplification, not a defect -- both cached outcomes mean the identical thing operationally ('never attempt CPUHISTORY_GET again')."
  - "stockReconnect() re-runs the FULL stockConnect() handshake on a proven-matching epoch, rather than reusing the existing client/capabilities -- this is what makes 'a restart that came with a replaced binary does not inherit the old build's capability answers' true for free: the fresh VICE_INFO read naturally feeds resolveCapabilities()'s own staleness comparison against the (still cached) prior versionQuad."
  - "StockConnectBrokerControl is a narrower structural type than the full BrokerControlSession (claimMonitor/releaseMonitor only) -- any real session satisfies it, and tests inject a two-method stub instead of a five-method one. This mirrors the plan's own read_first note that this handshake never needs acquire/recycle/status/hostState."
  - "Both tasks (handshake + restart detection) landed as one RED commit and one GREEN commit rather than four, matching 02-04's and 02-06's own established precedent for the identical reason: both tasks target the same two files and the plan's own two-task split is a planning-context-budget device, not a mandated four-commit shape. RED was confirmed for real (ERR_MODULE_NOT_FOUND) before any implementation was written."

requirements-completed: [BACK-04, PROTO-06, PROTO-08]

# Metrics
duration: ~50min
completed: 2026-08-13
---

# Phase 2 Plan 8: Stock Connect Handshake Summary

**`stock-connect.ts`'s `stockConnect()` claims the monitor socket before ever dialling it, asserts `api_version` by simply propagating `stock-protocol.ts`'s own frame-level check, reads the build's identity via `VICE_INFO`, and settles `CPUHISTORY_GET`'s three-way capability answer once per binary against `backend-detect.mts`'s cache -- `stockReconnect()` then proves or refuses machine identity across a reconnect using an epoch baseline, reusing `vice.ts`'s existing `MachineRestartedError` rather than inventing a second restart type.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-13
- **Tasks:** 2 completed / 2 planned (implemented together in one RED + one GREEN commit -- see Deviations)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `stock-connect.ts` is the one connect handshake for the stock path:
  `stockConnect({ host, port, targetId, brokerControl, deps })` claims the
  monitor socket via `brokerControl.claimMonitor()` BEFORE opening any TCP
  socket to the binmon port (verified live: no `connect()` is attempted when
  the claim is refused, in both the `monitor_owned` and `timeout` refusal
  cases), then dials, sends one `PING` (api_version assertion), reads
  `VICE_INFO` for the build's version quad, and settles `CPUHISTORY_GET`'s
  three-way capability answer (`available` / `absent` / `not_compiled_in`,
  mapped from wire error codes `0x00` / `0x83` / `0x8f`) exactly once per
  binary against `backend-detect.mts`'s existing capability cache.
- `stockDisconnect()` is the normal claim-release counterpart to
  `stockConnect()`; every failure path inside `stockConnect()` itself also
  releases the claim (via a `try`/`catch`/rethrow, never a swallow) before
  propagating, so a handshake that fails at any step can never leave the
  instance locked.
- `stockReconnect(session)` (Task 2) records the instance's epoch at connect
  time as a baseline (read via `vice.ts`'s existing `readEpoch()`, never a
  new heuristic) and re-proves it before re-running the handshake: an
  advanced epoch, or an epoch that cannot be read at all (on either side of
  the comparison), rejects with `vice.ts`'s existing `MachineRestartedError`
  -- no second restart-error class is defined anywhere in this file
  (`grep -c 'class .*Restart' stock-connect.ts` is 0). A proven match
  re-runs the FULL handshake, so a restart that swapped the underlying
  binary re-validates its capability record against the freshly observed
  version quad rather than inheriting the old build's answer.
- Three failure meanings are three distinguishable types, confirmed by a
  direct `instanceof` test: `StockRequestTimeoutError` ("connected but
  silent"), `StockConnectionClosedError` ("this socket died"), and the reused
  `MachineRestartedError` ("the machine under you is not the machine you
  handshook with, or its identity could not be proven at all").
- `stock-connect.test.ts` (15 tests) drives a request-decoding loopback
  `net` stub server (extending `stock-protocol.test.ts`'s own
  `withStubNetServer()` harness discipline to decode each incoming binmon
  request frame and answer command-by-command) and an injected two-method
  `StockConnectBrokerControl` stub -- never a real broker process, never a
  real emulator. All four required `--test-name-pattern` filters pass with
  margin: `handshake|api_version|capabilit|cpuhistory|ownership` -> 12
  passing (>= 8 required); `restart|reconnect|epoch` -> 5 passing (>= 5
  required); `ownership` alone -> 2 passing, including the required
  no-TCP-connection-on-refusal assertion.
- `npm run typecheck` is clean. `npm run test:automated` is green except the
  one pre-existing, out-of-scope worktree-path artifact already documented
  in every prior plan's SUMMARY this phase (432/438 passing, 5 `todo`, 1
  known pre-existing failure -- see Issues Encountered).

## Task Commits

Both tasks were implemented together, in the same two files, and committed
as one RED + one GREEN pair (see Deviations for why, matching 02-04's and
02-06's own precedent for the identical reason):

1. **Tasks 1+2 (TDD RED): failing coverage for the connect handshake** - `e6317eb` (test)
2. **Tasks 1+2 (TDD GREEN): claim-then-dial handshake, capability gate, restart detection** - `83354e1` (feat)

_TDD (`tdd="true"` on both tasks): RED commit `e6317eb` confirmed
`ERR_MODULE_NOT_FOUND` (stock-connect.ts did not exist) before any
implementation was written. GREEN commit `83354e1` brought all 15 tests to
green, `npm run typecheck` clean._

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

## Files Created/Modified

- `.claude/mcp/vice/stock-connect.ts` - `StockConnectBrokerControl` (the
  narrow claim/release surface this handshake needs);
  `CpuHistoryCapability`/`StockCapabilities`; `clampCpuHistoryCount()`
  (`CPU_HISTORY_MAX_COUNT = 65535`); `probeCpuHistory()`;
  `resolveCapabilities()` (cache-gated CPUHISTORY_GET probe);
  `StockConnectDeps`/`StockConnectOptions`/`StockConnectSession`;
  `stockConnect()`; `stockDisconnect()`; `StockReconnectOptions`;
  `stockReconnect()`
- `.claude/mcp/vice/stock-connect.test.ts` - 15 `node --test` cases: a
  request-decoding loopback stub server (`withStockStubServer()`,
  `decodeOneRequest()`), a `happyPathResponder()` builder, a
  `makeStubBrokerControl()` builder, and tests covering the full handshake,
  api_version mismatch, all three `CPUHISTORY_GET` outcomes, cache
  short-circuit, single-write, both claim-refusal cases (`monitor_owned`
  and `timeout`), epoch-baseline recording, matching-epoch reconnect,
  advanced-epoch restart, unreadable-epoch restart, the three-way
  `instanceof` distinction, and capability re-validation across a simulated
  binary replacement
- `.claude/mcp/vice/package.json` - additive `"stock-connect.ts"` in
  `files`; no dependency change

## Decisions Made

See `key-decisions` in the frontmatter above for the full list with
rationale. Summary:

- The api_version assertion needed no new code: `stock-protocol.ts`'s
  parser already validates it per-frame, so `stockConnect()` just sends a
  `PING` and lets that rejection (already a typed `StockFramingError`)
  propagate through the same failure-cleanup path every other step uses.
- `backend-detect.mts`'s capability cache stores a boolean, not a three-way
  enum -- a cache HIT therefore reports `"absent"` for a cached `false`
  rather than distinguishing `not_compiled_in`, documented inline as a
  deliberate simplification of an existing, out-of-scope schema (widening
  it was not in this plan's `files_modified`). Both cached outcomes mean
  the identical thing operationally.
- `stockReconnect()` re-runs the entire handshake rather than patching the
  existing session, which is what makes capability re-validation-on-restart
  true for free rather than requiring a second, parallel re-validation path.
- `StockConnectBrokerControl` is a narrow two-method structural type, not
  the full five-method `BrokerControlSession` -- this handshake never
  acquires, recycles, or queries status.
- Both tasks landed as one RED + one GREEN commit, matching 02-04/02-06's
  own established precedent (same two files, same objective, the plan's own
  two-task split is a context-budget device).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a test-only type annotation so `npm run typecheck` passed**
- **Found during:** GREEN commit's own typecheck run
- **Issue:** One test's injected `readCapabilityRecordFn` stub declared its
  second parameter as a required `{ observedVersionQuad?: string }` rather
  than optional, which is incompatible with the real
  `readCapabilityRecord`'s own `(binPath: string, deps?: CapabilityDeps)`
  signature (a caller may omit the second argument entirely).
- **Fix:** Gave the stub's second parameter a default value (`= {}`),
  matching the real function's own optionality.
- **Files modified:** `.claude/mcp/vice/stock-connect.test.ts`
- **Verification:** `npm run typecheck` exits 0; all 15 tests still pass.
- **Committed in:** `83354e1` (GREEN commit -- caught and fixed before that
  commit, since the affected code is the test file the RED commit already
  introduced)

---

**Total deviations:** 1 auto-fixed (Rule 3, test-only type annotation --
no runtime behavior change, necessary for the plan's own `npm run
typecheck` acceptance criterion to pass).

## Manual Reasoning Check (plan's own verification requirement)

Traced both paths the plan's own `<must_haves>` and threat model name:

- **claim -> dial -> handshake -> capability gate -> release:**
  `stockConnect()` calls `brokerControl.claimMonitor({ targetId })` as its
  very first action, strictly before `new ViceMonitorClient()` or
  `client.connect()` are ever reached (confirmed both by source-order
  reading and by the "ownership" test's `connectionCount() === 0` assertion
  on refusal). On a successful claim, `client.connect()` dials, `PING`
  proves `api_version`, `VICE_INFO` names the build, and
  `resolveCapabilities()` either short-circuits against a matching cached
  record or runs `CPUHISTORY_GET` and writes the record exactly once.
  `stockDisconnect()` (the success-path release) and `stockConnect()`'s own
  `catch` block (the failure-path release) are the two `releaseMonitor()`
  call sites the plan's own acceptance criteria name.
- **restart -> reconnect -> re-handshake:** `stockReconnect()` reads the
  current epoch (via the SAME `readEpoch()` `vice.ts` already exports;
  `epochPathFor`/`.vice-supervisor` are never re-derived -- `grep -c
  '"\.vice-supervisor"' stock-connect.ts` is 0), compares it to the
  session's baseline, and rejects with `MachineRestartedError` on any
  difference or on either side being unreadable. On a match, it calls
  `stockConnect()` again in full -- proven live by the "replaced binary"
  test, which shows a second `stockConnect()` call against a server now
  reporting a different `VICE_INFO` version quad correctly re-runs (rather
  than skips) the capability probe, because `resolveCapabilities()`'s own
  staleness comparison catches the version mismatch against the (still
  cached) prior record.

No path in `stock-connect.ts` reaches `client.connect()` without a
preceding successful `claimMonitor()` call, and no failure path returns
without a preceding `releaseMonitor()` call.

## Environment Constraint Compliance

Per this plan's environment constraint, no real stock VICE binary is
reachable and no live socket work against `x64sc` was performed. All 15
`stock-connect.test.ts` tests run against a loopback `net` stub server
standing in for VICE's binary monitor (decoding real binmon request frames
and replying with hand-built, spec-derived response frames per
`docs/phase0-binmon-findings.md` §5) and an injected two-method broker
control stub -- never a real broker process, never a real emulator.
Nothing in this plan's code or tests describes any fixture as recorded or
verified against real hardware.

**Deferred to a later phase (live validation):** actually claiming a
monitor socket through a real broker process and dialling a real stock
`x64sc -binarymonitor` build to confirm (a) its live `api_version` byte is
genuinely `0x02`, (b) its `VICE_INFO` reply parses into the version-quad
shape this handshake assumes, and (c) its real `CPUHISTORY_GET` behavior on
a pre-3.10 build actually returns `0x83` (not `0x8f` or something else) --
both require a real stock VICE binary this environment does not have. This
is tracked against the existing
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
todo (which already covers re-validating the binmon wire-protocol fixtures
this plan's own capability-gate assumptions ultimately rest on); no
duplicate todo was filed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `stockConnect()`/`stockDisconnect()`/`stockReconnect()` are the complete
  connect-time surface for the stock backend; a later plan wiring this into
  the actual dispatch seam (mentioned in this phase's own CLAUDE.md
  constraints as plan 02-10's territory) can call `stockConnect()` once per
  acquired grant and `stockReconnect()` whenever `stock-protocol.ts`'s own
  `StockConnectionClosedError`/`StockRequestTimeoutError` surface and a
  retry is warranted.
- `StockConnectSession`'s `client`/`versionQuad`/`capabilities` fields are
  ready for a caller that needs to gate a version-dependent tool (e.g. a
  future `CPUHISTORY_GET`-backed tool checking
  `session.capabilities.cpuHistory === "available"` before attempting it).
- Live validation against a real stock VICE binary (the deferred items
  above) is expected once a real build is reachable, per this plan's own
  environment constraint and the existing pending todo.
- No blockers to phase progress.

## Issues Encountered

- Same pre-existing worktree-path test artifact every prior plan in this
  phase (02-01, 02-03, 02-04, 02-05, 02-06, 02-07) already documented:
  `repo-root.test.ts`'s "the agreed path is not under .claude" assertion
  fails only because this worktree is checked out under
  `.claude/worktrees/agent-.../`, unrelated to and untouched by this plan's
  two files. Not touched, not auto-fixed, out of scope per the executor's
  scope boundary. `npm run test:automated` is 432/438 passing (5 `todo`, 1
  pre-existing artifact) in this worktree as a result.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-connect.ts`
- FOUND: `.claude/mcp/vice/stock-connect.test.ts`
- FOUND: `.planning/phases/02-stock-backend-connection/02-08-SUMMARY.md`
- FOUND commit `e6317eb` (test: RED, failing coverage for the connect handshake)
- FOUND commit `83354e1` (feat: GREEN, claim-then-dial handshake, capability gate, restart detection)
