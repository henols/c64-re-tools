---
phase: 07-cycle-timing-and-wedge-triage
plan: 11
subsystem: stock-backend-connect
tags: [vice-binary-monitor, stock-vice, capability-detection, error-handling, node-test]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage (07-VERIFICATION.md gap 1 / finding CR-01)
    provides: the reproduced live failure this plan closes
provides:
  - "probeCpuHistory() answers a CpuHistoryCapability value for every decode failure (StockFramingError/StockDesyncError/StockResponseMismatchError), not just recognized StockProtocolError wire codes"
  - "resolveCapabilities() guards its probeCpuHistory() call site so no uninterpreted error can reach stockConnect()'s fatal catch -- transport/instance failures still reject, anything else degrades to absent without persisting a cache record"
  - "6 regression tests pinning the decode-vs-transport rule, including CR-01's exact live-reproduced message string"
affects: [07-12 (CPUHISTORY_GET layout fix), 07-13 (live proof against both binaries), 07-18 (docs/stock-vice-parity.md correction)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decode failure vs. transport failure is a hard classification boundary in capability probes: a class that means 'the wire answered, this client just could not read it' degrades to a capability value; a class that means 'the connection/instance is gone' must always propagate."
    - "Tests that must survive a future parser fix inject the error directly at the client method boundary (ViceMonitorClient.prototype.send() patched per-test) instead of constructing wire-accurate bytes that would stop reproducing the failure once the parser is corrected."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-connect.ts
    - .claude/mcp/vice/stock-connect.test.ts

key-decisions:
  - "Updated one pre-existing test (07-01's 'classification set is closed' case, the 0x82/InvalidApiVersion sub-case) whose assertion encoded the pre-fix behavior (unclassified error code rejects). Per this plan's own Task 1b, an unclassified error at resolveCapabilities() level now degrades to absent instead of failing the handshake -- the old assertion was testing exactly the bug this plan fixes, so it was corrected rather than left green-but-wrong."
  - "Task 2's 6 new regression cases inject errors by patching ViceMonitorClient.prototype.send() for the single CPUHISTORY_GET call, rather than building a 52-byte wire body -- per the plan's explicit instruction, since 07-12 will make that body decode successfully and a bytes-based test would silently stop exercising this guard once that lands."

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-04]

# Metrics
duration: 35min
completed: 2026-08-18
---

# Phase 07 Plan 11: Guard CPUHISTORY_GET decode failures against killing the stock handshake Summary

**`probeCpuHistory()` now answers a capability value for any CPUHISTORY_GET decode failure and `resolveCapabilities()` cannot propagate an uninterpreted error into `stockConnect()`'s fatal catch, closing CR-01's whole-backend outage on any genuine VICE >= 3.10.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-18T11:00:09Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `probeCpuHistory()` maps `StockFramingError`, `StockDesyncError` and `StockResponseMismatchError` to `"absent"` -- a decode failure (the opcode answered, this client just could not read it) is no longer indistinguishable from a fatal handshake failure.
- `resolveCapabilities()`'s `probeCpuHistory()` call site is now guarded: `StockConnectionClosedError`, `StockRequestTimeoutError` and `MachineRestartedError` still reject the handshake (real transport/instance failures); anything else degrades to `{ cpuHistory: "absent" }` **without** writing a capability cache record, so a transient/unclassifiable fault can never pin a wrong route selection for future connects.
- 6 new regression tests pin the classification table end-to-end through the public `stockConnect()` entry point, including CR-01's exact live-reproduced message (`response type 0x86 body is 52 byte(s), needs at least 65`) as a committed fixture string.
- One pre-existing test corrected to match the plan-mandated new behavior (see Decisions Made).

## Final Classification Table (error class -> outcome)

| Error class | Origin | Outcome |
|---|---|---|
| `StockProtocolError` (`0x83` InvalidType) | pre-3.10 opcode absent | `cpuHistory: "absent"` (unchanged, 07-01) |
| `StockProtocolError` (`0x8f` CmdFailure) | compiled without support | `cpuHistory: "not_compiled_in"` (unchanged, 07-01) |
| `StockProtocolError` (`0x81` InvalidParameter) | minimal well-formed request rejected | `cpuHistory: "absent"` (unchanged, 07-01) |
| `StockProtocolError` (any other code, e.g. `0x82`) | unmapped wire error code | `cpuHistory: "absent"` via `resolveCapabilities()`'s new guard (**changed this plan** -- previously rejected) |
| `StockFramingError` | decode failure -- CR-01's exact case | `cpuHistory: "absent"` (**new this plan**) |
| `StockDesyncError` | decode failure | `cpuHistory: "absent"` (**new this plan**) |
| `StockResponseMismatchError` | decode failure | `cpuHistory: "absent"` (**new this plan**) |
| Any other unclassified `Error` | unknown | `cpuHistory: "absent"`, no cache write (**new this plan**) |
| `StockConnectionClosedError` | transport -- socket died | rejects `stockConnect()` (unchanged) |
| `StockRequestTimeoutError` | transport -- connected but silent | rejects `stockConnect()` (unchanged) |
| `MachineRestartedError` | instance identity failure | rejects `stockConnect()` (unchanged) |

## Task Commits

1. **Task 1: Make probeCpuHistory() answer a capability value on any decode failure, and guard resolveCapabilities()** - `94d534f` (fix)
2. **Task 2: Pin the rule with regression tests, including the exact CR-01 error** - `56ec6a5` (test)

_Note: Task 1's commit also includes a necessary correction to one pre-existing test in `stock-connect.test.ts` (see Decisions Made) -- without it the suite would have regressed to 28/29 passing under Task 1's own verification requirement._

## Files Created/Modified
- `.claude/mcp/vice/stock-connect.ts` - `probeCpuHistory()` extended catch (decode classes -> `"absent"`); `resolveCapabilities()`'s probe call site now try/catch-guarded (transport/instance classes rethrow, everything else degrades without a cache write); imports `StockFramingError`, `StockDesyncError`, `StockResponseMismatchError`, `StockConnectionClosedError`, `StockRequestTimeoutError` from `./stock-protocol.ts`.
- `.claude/mcp/vice/stock-connect.test.ts` - corrected one pre-existing assertion (0x82 case); added a `withCpuHistoryRejecting()` test helper (patches `ViceMonitorClient.prototype.send()` for the single CPUHISTORY_GET call) and 6 new regression tests.

## Decisions Made
- **Updated 07-01's "classification set is closed" test.** Its third sub-case asserted that an unclassified `StockProtocolError` code (`0x82`/`InvalidApiVersion`) still rejected the whole handshake. That assertion encoded exactly the pre-fix behavior this plan's Task 1b changes: `resolveCapabilities()`'s new guard degrades ANY error it cannot interpret (not only decode classes) to `"absent"`, so the test was corrected to assert the session resolves with `cpuHistory: "absent"` instead of rejecting. Renamed the test title to name CR-01 and the corrected expectation.
- **Regression tests inject errors at the client-method boundary, not via wire bytes.** The plan explicitly required this: a test that manufactured a 52-byte CPUHISTORY_GET body to trigger `StockFramingError` naturally would silently stop testing this guard the moment 07-12 makes that same body decode successfully. `withCpuHistoryRejecting()` patches `ViceMonitorClient.prototype.send()` so only the `CommandType.CpuHistoryGet` call rejects with the injected error, while every other command (PING, VICE_INFO, EXIT) is still answered for real by the existing net-based `happyPathResponder()` stub server -- reusing the file's existing stub-server style for the rest of the handshake rather than introducing a second, unrelated mocking framework.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a pre-existing test asserting the pre-fix (buggy) behavior**
- **Found during:** Task 1 verification (`node --test stock-connect.test.ts`)
- **Issue:** `stock-connect.test.ts`'s "the classification set is closed" test's third sub-case asserted `stockConnect()` rejects on an unclassified CPUHISTORY_GET wire error code (`0x82`). After Task 1b's fix, `resolveCapabilities()` deliberately degrades this exact case to `cpuHistory: "absent"` instead of failing the handshake -- the assertion was now testing the bug CR-01 exists to remove.
- **Fix:** Updated the assertion to expect `session.capabilities.cpuHistory === "absent"` and a completed (non-rejected) `stockConnect()`; renamed the test title to name CR-01 and the corrected expectation.
- **Files modified:** `.claude/mcp/vice/stock-connect.test.ts`
- **Verification:** `node --test stock-connect.test.ts` passes 29/29 immediately after this fix (before Task 2's additions).
- **Committed in:** `94d534f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-class test correction)
**Impact on plan:** Necessary and expected -- the plan's own `<output>` instructions explicitly ask whether any existing test needed adjustment. No scope creep; the correction is a direct, single-line consequence of Task 1b's mandated behavior change.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route A (`CPUHISTORY_GET`) remains **unusable** on any genuine VICE build until 07-12 lands -- this plan makes a decode failure **degrade** the capability to `"absent"` (Route A absent, everything else reachable), it does **not** make Route A **work**. `TIME-01..04` are unblocked at the connect/reachability level only; the stopwatch's actual CPUHISTORY_GET consumer still needs 07-12's layout fix before Route A itself functions.
- Every stock tool (`vice_ping`, `vice_diagnose`, `vice_recycle`, and by extension every dispatch-level tool) is reachable again on a genuine VICE >= 3.10 build, since `stockConnect()` no longer fails outright on this decode bug.
- 07-12 (parser re-derivation) and 07-13 (live proof against both binaries) are unblocked and can proceed independently, as the plan's own objective states.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
