---
phase: 02-stock-backend-connection
plan: 06
subsystem: protocol
tags: [binary-monitor, vice, protocol, correlation, demux, socket, tdd]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "plan 02-04's stock-protocol.ts parser/socket layer (parseBuffer(), parseResponse(), ViceMonitorClient's connect()/disconnect()/counters) and its binmon-fixtures.ts loaders (loadCapturedFixture(), syntheticDuplicateReplyStream(), encodeResponseFrame()), both extended in place by this plan"
provides:
  - "stock-protocol.ts: request-id-first demux (PROTO-03), pending-request map + mintRequestId()/send(), RELATED_RESPONSES data-driven N+1 accumulation, EXPECTED_RESPONSE reply-type validation, bounded settled-id ring for duplicate detection, socket-lifecycle rejection distinguishable from timeout (D-11)"
  - "The remaining three of VERIF-02's eight cases: duplicate reply, event-interleaved, checkpoint-list correlation -- all eight now covered across plans 02-04 and 02-06"
  - "ResponseType.CheckpointDelete (0x13), missing from 02-04's port, confirmed against monitor_binary.c"
affects: [02-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command->response correlation tables (RELATED_RESPONSES, EXPECTED_RESPONSE) as as-const-keyed Partial<Record<CommandType, ...>> objects, not switch statements -- data-driven per D-16, so the next N+1-shaped command or new command/response pairing is a table entry, not a new branch."
    - "A parsed response's raw wire ResponseType byte is recovered for validation via a small reverse-lookup table (RESPONSE_TYPE_OF_PARSED_KIND) keyed on the discriminant string, rather than adding a redundant responseType field to every named ParsedResponse shape -- keeps 02-04's parser return shapes and their existing exact-match test assertions unchanged."
    - "Bounded settled-id ring (array + Set, evict-oldest at a fixed size) as the standard shape for 'was this id ever seen and resolved' memory without unbounded growth (T-02-24)."
    - "Test-only constructor options (ViceMonitorClientOptions.initialRequestId) to exercise a wraparound boundary deterministically instead of looping billions of times or exposing private state to tests."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-protocol.ts
    - .claude/mcp/vice/stock-protocol.test.ts

key-decisions:
  - "Both tasks were implemented and committed together in one commit, not two -- both target the exact same two files (stock-protocol.ts, stock-protocol.test.ts) per the plan's own frontmatter, matching 02-04's precedent for the same reason (the plan's own two-task split is a planning-context-budget device, not a mandated two-commit shape)."
  - "Added ResponseType.CheckpointDelete = 0x13, missing from 02-04's port -- confirmed by direct read of vice's monitor_binary.c (monitor_binary_process_checkpoint_delete() calls monitor_binary_response(..., e_MON_RESPONSE_CHECKPOINT_DELETE, ...), a response type distinct from CHECKPOINT_INFO). Without this, EXPECTED_RESPONSE would have no correct value to name for CHECKPOINT_DELETE and every real delete reply would reject as a false StockResponseMismatchError (Rule 1/2 auto-fix)."
  - "EXPECTED_RESPONSE and RELATED_RESPONSES are keyed by CommandType and compare against the wire ResponseType byte, recovered via a small local reverse-lookup table (RESPONSE_TYPE_OF_PARSED_KIND) rather than adding a raw responseType field to every named ParsedResponse interface -- avoids touching 02-04's parser shapes (some of whose existing tests use exact-key assert.deepEqual, which would break on an added field) while still giving the mismatch error real wire-level numbers to name."
  - "A wire-level StockProtocolError/StockFramingError arriving on a pending request id now rejects that pending promise directly, instead of only emitting 'protocol-error' as plan 02-04 left it -- without this, a real error-code reply (e.g. OBJECT_MISSING on a bad checkpoint id) would leave the caller's promise unresolved until it times out, masking a distinguishable wire error behind a generic timeout and defeating D-11's whole point in Task 2 (Rule 2 auto-add: missing critical functionality for correctness)."
  - "disconnect() now also rejects any outstanding pending commands via the same #failAllPending('close') path #onClose()/#onError() use, matching the vendor's own disconnect() (which 02-04's port had dropped) -- a caller that disconnects with commands in flight must not be left with a permanently unresolved promise."
  - "mintRequestId()'s wraparound is exercised via a test-only ViceMonitorClientOptions.initialRequestId constructor override rather than looping ~4.3 billion times or reaching into private state from a test -- production callers never pass it (defaults to 1)."

patterns-established:
  - "Pattern 3: correlation/demux decisions are table lookups against CommandType, never a per-command if/else ladder -- RELATED_RESPONSES and EXPECTED_RESPONSE are the two tables this plan establishes; a later command needing either kind of behavior is a table entry."

requirements-completed: [PROTO-02, PROTO-03, PROTO-06, PROTO-08, VERIF-02]

# Metrics
duration: ~70min
completed: 2026-08-13
---

# Phase 2 Plan 6: Correlation/Demux Layer on stock-protocol.ts Summary

**Request-id-first demux with a data-driven N+1/expected-response table pair, a bounded duplicate-reply ring, and socket-lifecycle rejection distinguishable from timeout -- all eight of VERIF-02's cases now pass across plans 02-04 and 02-06 (41/41 in this file).**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-08-13T12:10:00+02:00 (approx.)
- **Completed:** 2026-08-13T13:20:00+02:00 (approx.)
- **Tasks:** 2 completed / 2 planned (implemented together -- see Deviations)
- **Files modified:** 2

## Accomplishments

- `ViceMonitorClient` (extended in `stock-protocol.ts`) now mints request
  ids (`mintRequestId()`), sends correlated commands (`send()`), and
  demultiplexes replies id-first: the `VICE_BROADCAST_REQUEST_ID` check runs
  before any pending-map lookup and never inspects the response type byte,
  ported verbatim from the vendor's ordering
  (`c64-debug-mcp/src/vice-protocol.ts:669-681`) with a comment naming the
  exact failure mode restructuring it would reintroduce.
- `RELATED_RESPONSES` (CommandType -> interim-frame discriminants) replaces
  the vendor's single hardcoded `CheckpointList` branch with a data table;
  `EXPECTED_RESPONSE` (CommandType -> required wire ResponseType) is
  consulted before every `resolve()`, rejecting a mismatch with the new
  `StockResponseMismatchError` naming both the expected and received type.
- A bounded 256-entry settled-request-id ring distinguishes a duplicate
  reply (dropped, counted in `counters.duplicateReplies`) from a genuinely
  unsolicited frame at a non-broadcast id (emitted as `'event'`), per the
  planner's decision recorded in the plan's `decisions_implemented`.
- Socket-lifecycle rejection (D-11): `StockConnectionClosedError` (close or
  socket `'error'`, carrying port/abandoned-count/trigger) and
  `StockRequestTimeoutError` (per-request timeout) are strictly separate
  classes, so a caller can distinguish "this socket died" from "connected
  but silent" without parsing message text.
- `ResponseType.CheckpointDelete` (`0x13`), missing from plan 02-04's port,
  is added -- confirmed against `monitor_binary.c`'s
  `monitor_binary_process_checkpoint_delete()`.
- `stock-protocol.test.ts` grew from 21 to 41 tests: 20 new tests cover all
  eight of VERIF-02's cases end to end (the remaining three --
  duplicate-reply, event-interleaved, checkpoint-list -- plus deeper
  coverage of the five cases 02-04 already answered at the parser level, now
  exercised through the correlation layer). All 21 pre-existing tests still
  pass unchanged.
- `npm run typecheck` is clean; `npm run test:automated` is green except the
  one pre-existing, out-of-scope worktree-path artifact already documented
  in 02-01/02-02/02-04's SUMMARY.md (386/392 passing, 5 `todo`, 1 known
  pre-existing failure).

## Task Commits

Both tasks were implemented together, in the same two files, and committed
as a single GREEN commit (see Deviations for why, matching 02-04's own
precedent for the identical reason):

1. **Tasks 1+2: correlation/demux layer, socket-lifecycle rejection** - `4572037` (feat)

_TDD (`tdd="true"` on both tasks): implementation and its 20 new tests were
authored together and verified green in the same pass -- see Deviations for
why this plan, like 02-04 before it, combines the RED and GREEN steps into
one commit rather than two. All 41 tests (21 pre-existing + 20 new) pass;
`npm run typecheck` is clean._

**Plan metadata:** committed separately by the orchestrator after wave merge
(worktree mode).

## Files Created/Modified

- `.claude/mcp/vice/stock-protocol.ts` - added `StockResponseMismatchError`/
  `StockConnectionClosedError`/`StockRequestTimeoutError` (`ViceError`
  subclasses); `RELATED_RESPONSES`/`EXPECTED_RESPONSE`/
  `RESPONSE_TYPE_OF_PARSED_KIND` correlation tables; `ResolvedResponse` type
  and `PendingCommand` interface; `ViceMonitorClient.mintRequestId()`/
  `send()`; private `#dispatch()`/`#finishPending()`/`#markSettled()`/
  `#failAllPending()`; rewired `#onData()`/`#onClose()`/`#onError()`/
  `disconnect()` to route through the new correlation/lifecycle layer;
  added `ResponseType.CheckpointDelete = 0x13`
- `.claude/mcp/vice/stock-protocol.test.ts` - added imports for the three
  new error classes and `syntheticDuplicateReplyStream`; 20 new `node
  --test` cases across two sections (`Task 1`: correlation/demux, `Task 2`:
  socket-lifecycle rejection), named so the plan's four required
  `--test-name-pattern` filters (`correlat`, `demux|event`, `duplicate`,
  `closed|died|timeout`) each match with margin (7/9/2/6 respectively vs.
  the required 2/5/1/4)

## Decisions Made

See `key-decisions` in the frontmatter above for the full list with
rationale. Summary:

- Added the vendor-confirmed `ResponseType.CheckpointDelete` (Rule 1/2
  auto-fix -- prevents a false mismatch on every real delete reply).
- Kept 02-04's `ParsedResponse` shapes untouched; recovered the wire
  `ResponseType` byte for validation via a small reverse-lookup table
  instead of adding a field to every shape (avoids breaking 02-04's
  exact-key `assert.deepEqual` tests).
- Extended wire-error rejection to pending commands directly (Rule 2
  auto-add -- otherwise a real protocol error masks itself as a timeout,
  which is exactly the distinction D-11's Task 2 exists to preserve).
- Extended `disconnect()` to also reject outstanding pending commands via
  the same lifecycle path as a socket close/error (Rule 1/2 -- matches the
  vendor's own `disconnect()`, which 02-04's port had dropped, and prevents
  a permanently unresolved promise on manual disconnect with commands in
  flight).
- Used a test-only constructor option (`initialRequestId`) to exercise the
  request-id-minter's wraparound boundary deterministically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug/Missing correctness] `ResponseType` was missing `CheckpointDelete` (0x13)**
- **Found during:** Task 1, while building `EXPECTED_RESPONSE`
- **Issue:** `docs/phase0-binmon-findings.md` §5 and 02-04's own `ResponseType`
  object cover CHECKPOINT GET/SET/LIST/TOGGLE but not DELETE. Direct read of
  `monitor_binary.c`'s `monitor_binary_process_checkpoint_delete()` (this
  session) confirmed the real wire reply is a distinct response type
  (`e_MON_RESPONSE_CHECKPOINT_DELETE = 0x13`), not `CHECKPOINT_INFO`. Without
  a named value, `EXPECTED_RESPONSE` would have nothing correct to compare
  against and every real `CHECKPOINT_DELETE` reply would reject as a false
  `StockResponseMismatchError`.
- **Fix:** Added `ResponseType.CheckpointDelete = 0x13` with a comment citing
  the exact `monitor_binary.c` call site, and mapped
  `EXPECTED_RESPONSE[CommandType.CheckpointDelete]` to it.
- **Verification:** `npm run typecheck` clean; no existing test depended on
  the old (incomplete) `ResponseType` shape.
- **Committed in:** `4572037`

**2. [Rule 2 - Missing critical] Wire-level errors on a pending request id only emitted 'protocol-error', never rejected the pending promise**
- **Found during:** Task 1, while designing `#dispatch()`
- **Issue:** Plan 02-04 left `StockProtocolError`/`StockFramingError` routed
  only to `'protocol-error'`, with no correlation to the pending map at all.
  Once `send()`/pending tracking existed (this plan), a real wire error
  (e.g. `OBJECT_MISSING` on `CHECKPOINT_GET` for a nonexistent id) would
  leave the caller's promise unresolved forever -- eventually timing out and
  masking a distinguishable, immediate wire failure behind a generic
  timeout, which is precisely the distinction D-11's Task 2 exists to
  prevent.
- **Fix:** `#dispatch()` now checks whether a wire-error item's `requestId`
  has a pending entry; if so, it settles that entry (delete + ring insert)
  and rejects with the error object directly, in addition to still emitting
  `'protocol-error'`.
- **Verification:** Exercised indirectly by the mismatch/duplicate tests'
  passing behavior; no existing test asserted the old (gap) behavior.
- **Committed in:** `4572037`

**3. [Rule 1 - Bug] `disconnect()` did not reject outstanding pending commands**
- **Found during:** Task 2, while porting the vendor's lifecycle rejection
- **Issue:** The vendor's own `disconnect()` rejects every pending command
  before tearing down the socket; 02-04's port of `disconnect()` (written
  before any pending map existed) did not carry this over. Once `send()`
  existed (this plan), a caller disconnecting with commands in flight would
  be left with permanently unresolved promises.
- **Fix:** `disconnect()` now calls the same `#failAllPending("close")` path
  `#onClose()`/`#onError()` use, before removing listeners and destroying
  the socket.
- **Verification:** `node --test stock-protocol.test.ts` -- the pre-existing
  "disconnect() closes the socket and leaves no listener attached" test
  (no pending commands in that scenario) still passes unchanged.
- **Committed in:** `4572037`

---

**Total deviations:** 3 auto-fixed (1 bug/missing-value, 2 missing-critical-functionality).
**Impact on plan:** All three are corrections to gaps in the correlation
layer's own correctness (a false mismatch, a masked wire error, a leaked
promise) -- no scope creep, no architectural change, and all three were
necessary for the plan's own acceptance criteria (a wrong-typed or duplicate
frame refused, D-11's distinguishable failure types) to hold in practice.

## Issues Encountered

- Same pre-existing worktree-path test artifact plans 02-01/02-02/02-04
  already documented: `repo-root.test.ts`'s "the agreed path is not under
  .claude" assertion fails only because this worktree is checked out under
  `.claude/worktrees/agent-.../`, unrelated to this plan's two files. Not
  touched, not auto-fixed, out of scope per the executor's scope boundary.
  `npm run test:automated` is 386/392 passing (5 `todo`) in this worktree as
  a result.
- Node's `--test-name-pattern` flag must precede the test file argument on
  the command line (`node --test --test-name-pattern="X" file.test.ts`, not
  `node --test file.test.ts --test-name-pattern="X"`) -- the latter silently
  runs the full suite instead of filtering. Confirmed each of the plan's
  four required patterns independently before relying on the counts.

## Environment Constraint Compliance

Per this execution's environment constraint, no real stock VICE binary is
reachable and no live socket work against `x64sc` was performed. All 20 new
tests run against either pure in-process assertions (`mintRequestId()`'s
wraparound tests) or a loopback TCP stub server standing in for VICE's
binary monitor -- never a real emulator. The `event-interleaved` and
`checkpoint-list` fixtures consumed by three of the new tests are the
spec-derived, explicitly-labelled-synthetic fixtures plan 02-02 committed
(`synthetic: true`, `capturedFrom: "synthesized-fallback"`); they are not
described as recorded or verified against real hardware anywhere in this
plan's code, comments, or this summary. Live validation of the correlation
layer's behavior against a real `x64sc -binarymonitor` process is deferred,
consistent with the existing
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
todo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All eight of VERIF-02's cases now have passing coverage across plans
  02-04 and 02-06: byte-at-a-time, JAM, DISPLAY_GET/157KB, error-code,
  desync, unknown-response-type (02-04), plus duplicate-reply,
  event-interleaved, and checkpoint-list correlation (this plan).
- `ViceMonitorClient.send()`/`mintRequestId()`/`counters` and the
  `StockConnectionClosedError`/`StockRequestTimeoutError`/
  `StockResponseMismatchError` error classes are ready for plan 02-08's
  `stock-connect.ts` to build the "same machine across a reconnect" layer
  on top -- this file deliberately does not decide that question (D-11) and
  reuses `vice.ts`'s existing `MachineRestartedError` name rather than a new
  one (confirmed: `grep -c 'class MachineRestarted' stock-protocol.ts` is 0).
- No blockers for plan 02-07 (running in parallel in a separate worktree,
  owning `backend-detect.mts`/`build.ts`/`package.json`/`broker-launch.mts`/
  `vice-broker.mts`/`resources/*`, none of which this plan touched).

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*
