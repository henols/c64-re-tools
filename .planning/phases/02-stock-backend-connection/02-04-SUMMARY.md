---
phase: 02-stock-backend-connection
plan: 04
subsystem: protocol
tags: [binary-monitor, vice, protocol, framing, parser, socket, tdd]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "plan 02-01's binmon-fixtures.ts (encodeResponseFrame(), synthetic VERIF-02 builders, chunkBytes(), loadCapturedFixture()) and plan 02-02's committed display-get fixture, both consumed by stock-protocol.test.ts"
provides:
  - "stock-protocol.ts: the ONE authoritative binmon framing/parsing seam -- encodeRequestHeader(), parseResponse(), parseBuffer() (never throws out of the loop; StockProtocolError/StockFramingError returned inside its responses array instead), plus ViceMonitorClient (EventEmitter) driving parseBuffer() off a real net.Socket with a bounded, never-poisoned buffer"
  - "Five of VERIF-02's eight cases, named and gated: byte-at-a-time, jam, display-get/157KB, error-code/protocol-error, desync, unknown-response-type"
  - "StockProtocolError/StockFramingError/StockDesyncError -- ViceError subclasses ready for plan 02-06's correlation/demux layer to build on in this same file"
affects: [02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as const object + derived type alias in place of TypeScript `enum` -- this package has no build step at all (Node's native strip-only type-stripping runs .ts files directly), and strip-only mode rejects `enum` outright (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX). No other file in this package uses `enum` for the same reason; this is now the first file to need enum-like ergonomics and establishes the idiom."
    - "Domain errors (StockProtocolError, StockFramingError) are thrown by the low-level parseResponse() but caught and returned inside parseBuffer()'s responses array rather than escaping -- 'never throw out of the parse loop' as a caller contract, with throw/catch still used internally as an implementation detail."
    - "net.Server has no closeAllConnections() (that exists only on http.Server) -- a test harness for a raw net server must track accepted sockets itself and destroy them in a finally block before server.close(), or a lingering handle wedges the whole test process."

key-files:
  created:
    - .claude/mcp/vice/stock-protocol.ts
    - .claude/mcp/vice/stock-protocol.test.ts
  modified:
    - .claude/mcp/vice/package.json

key-decisions:
  - "CommandType/ResponseType/ErrorCode are `as const` objects with a derived type alias, not TypeScript `enum` -- Node's strip-only type-stripping rejects `enum` with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, confirmed by running the file. Same names/values as the plan specified, same `CommandType.Ping`-style access; only the underlying construct differs (Rule 3 auto-fix, not an architectural change)."
  - "The enum's opcode set is `docs/phase0-binmon-findings.md` §5's full normative set (adding RESOURCE_GET/SET and CPUHISTORY_GET beyond the plan's literally-named single addition, USERPORT_SET) -- the plan's own stated goal was 'the enum matches this project's own normative document rather than the vendor's subset,' and the vendor is missing four opcodes against that document, not one."
  - "A fourth vendor defect, not one of D-16's three named ones, was found and fixed while porting: DisplayGet's imageBytes slice starts at `infoLength + 4`, the same offset its own 4-byte imageLength field occupies, overlapping it instead of starting after it. Fixed to derive `bufStart = buflenOffset + 4`, matching this repo's own already-tested probe-binmon.mjs:parseDisplayGet(), whose comment explicitly warns against hardcoding this offset (Rule 1 auto-fix)."
  - "Checkpoint parsing carries a raw `operation` byte instead of the vendor's mapped `kind: BreakpointKind` field -- that mapping (cpuOperationToBreakpointKind) lives in the vendor's contracts.ts, which this module must not import (D-16, zod-free). A later plan that needs the named mapping owns re-deriving it without that dependency."
  - "Tasks 1 and 2 were implemented and committed together in one GREEN commit (be40274), not two -- both target the exact same two files (stock-protocol.ts, stock-protocol.test.ts) per the plan's own frontmatter, and the parser/socket layers were written as one coherent unit. The plan's stated reason for splitting the objective into two tasks was a planning-context-budget concern, not a mandated two-commit execution shape."

patterns-established:
  - "Pattern 1: parseBuffer() is a total function over any byte stream -- STX mismatch, an implausible declared body length, and any domain error from parseResponse() are all absorbed into either a one-byte resync-and-count or a typed entry in the responses array, never a throw that escapes the loop."
  - "Pattern 2: a socket-driving client (ViceMonitorClient) wraps its pure parser in a try/catch that treats ANY unexpected throw as a desync (drop buffer, emit, keep the connection usable) as a second, call-site-level backstop on top of the parser's own never-throw contract."

requirements-completed: [PROTO-01, PROTO-04, PROTO-05, PROTO-07]

# Metrics
duration: ~75min
completed: 2026-08-13
---

# Phase 2 Plan 4: Stock Binmon Framing/Parsing Seam Summary

**`stock-protocol.ts` ports henrik/c64-debug-mcp's binary-monitor client (v1.0.14, MIT), fixing four defects (three named by D-16 plus one found while porting) and never throwing out of its parse loop -- five of VERIF-02's eight cases are unit-tested green, with a real net.Socket driving the same parser underneath a bounded, never-poisoned client.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-08-13T11:05:00+02:00 (approx.)
- **Completed:** 2026-08-13T11:25:00+02:00 (approx.)
- **Tasks:** 2 completed / 2 planned (implemented together -- see Deviations)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `stock-protocol.ts` (790 lines) is the one place that frames and parses the
  stock binary-monitor wire protocol: `encodeRequestHeader()`,
  `parseResponse()`, `parseBuffer()`, three `ViceError` subclasses
  (`StockProtocolError`, `StockFramingError`, `StockDesyncError`), and
  `ViceMonitorClient` (a real `net.Socket`-driven `EventEmitter`).
- All three of D-16's named vendor defects are fixed: the zero-length JAM
  body no longer throws (`programCounter: null`, never a fabricated `0`);
  an STX mismatch or an implausible declared body length resyncs one byte
  at a time instead of throwing and wedging the connection; the
  `api_version` byte is read and validated, surfacing a mismatch as a
  distinguishable `StockFramingError`.
- A fourth defect (not named by D-16) was found while porting and fixed:
  the vendor's `DisplayGet` case sliced `imageBytes` starting at the same
  offset its own `imageLength` field occupies. Fixed to match this repo's
  own already-tested `probe-binmon.mjs:parseDisplayGet()`.
- `stock-protocol.test.ts` (21 tests) covers every named VERIF-02 case
  pattern (`byte-at-a-time`, `jam`, `display.*get|157`,
  `error.*code|protocol.*error`, `desync`, `unknown.*response.*type`) at
  both the pure-parser level and, for the framing-relevant subset, the
  real-socket level via `ViceMonitorClient`.
- `npm run test:automated` is green except for the one pre-existing,
  out-of-scope worktree-path artifact already documented in 02-01/02-02's
  SUMMARY.md (see Issues Encountered) -- 347/353 passing, 5 `todo`.
- `npm run typecheck` is clean.

## Task Commits

Both tasks were implemented together, in one file, and committed as a
single RED/GREEN pair (see Deviations for why):

1. **Tasks 1+2 (TDD RED): failing coverage for the framing/parsing seam** - `296dd7d` (test)
2. **Tasks 1+2 (TDD GREEN): frame decoder, response parser, defect fixes, socket layer** - `be40274` (feat)

_TDD (`tdd="true"` on both tasks): RED commit `296dd7d` confirmed
`ERR_MODULE_NOT_FOUND` (stock-protocol.ts did not exist) before any
implementation was written. GREEN commit `be40274` brought all 21 tests to
green. No REFACTOR commit was needed._

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

## Files Created/Modified

- `.claude/mcp/vice/stock-protocol.ts` - `VICE_STX`/`VICE_API_VERSION`/`VICE_BROADCAST_REQUEST_ID`/`RESPONSE_HEADER_LEN`/`REQUEST_HEADER_LEN`/`MAX_BODY_LEN`; `CommandType`/`ResponseType`/`ErrorCode` (`as const` objects + derived types); `StockProtocolError`/`StockFramingError`/`StockDesyncError` (`ViceError` subclasses); `encodeRequestHeader()`; the full `ParsedResponse` union and `parseResponse()`; `parseBuffer()`; `ViceMonitorClient` (`connect()`/`disconnect()`/`counters`/`'response'`/`'protocol-error'`/`'desync'`/`'transport-error'`/`'close'` events)
- `.claude/mcp/vice/stock-protocol.test.ts` - 21 `node --test` cases: request-header encoding, byte-at-a-time framing (pure and socket-driven), JAM's fixed zero-length body, the captured + synthetic DISPLAY_GET frames, error-code-as-`StockProtocolError`, api_version-mismatch-as-`StockFramingError`, unknown-response-type fallback, desync (garbage byte and implausible length), the error-class hierarchy, and five `ViceMonitorClient` socket-layer behaviors including the `MAX_BODY_LEN` cap and the uncaught-exception absence check
- `.claude/mcp/vice/package.json` - additive `"stock-protocol.ts"` in `files`; no dependency change (verified: `git diff` on this commit touches only that one line)

## Decisions Made

- Ported `CommandType`/`ResponseType`/`ErrorCode` as `as const` objects
  rather than the plan's literally-specified "plain TypeScript enum" --
  Node's strip-only type-stripping mode (this package's entire runtime
  model; there is no build step) throws
  `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not
  supported in strip-only mode` for both plain and `const` enums. Confirmed
  by actually running the file before making this change. No other file in
  this package uses `enum`, for the same reason. This is a Rule 3
  (blocking-issue) auto-fix: same member names, same numeric values, same
  `CommandType.Ping` access syntax -- only the underlying TS construct
  changed.
- Included `RESOURCE_GET`/`RESOURCE_SET`/`CPUHISTORY_GET` in the enums
  alongside the plan's literally-named `USERPORT_SET` addition, since the
  plan's own stated goal ("the enum matches this project's own normative
  document rather than the vendor's subset") requires all four -- the
  vendor is missing four opcodes against `docs/phase0-binmon-findings.md`
  §5, not the one the plan's prose singles out.
- Fixed the vendor's `DisplayGet` `imageBytes` off-by-four (Rule 1 bug, not
  one of D-16's three named defects) rather than porting it faithfully,
  because this repo's own `probe-binmon.mjs:parseDisplayGet()` already
  derives the correct offset and explicitly comments on avoiding exactly
  this mistake ("never hardcoded to 17/21"). Porting the vendor's version
  verbatim would have silently corrupted the first 4 bytes of every
  `DISPLAY_GET` image.
- Represented checkpoint `kind` as a raw wire `operation` byte instead of
  the vendor's mapped `BreakpointKind` enum, since that mapping function
  lives in the vendor's `contracts.ts`, which D-16 forbids importing
  (zod-free constraint). Left for whichever later plan needs the named
  mapping to re-derive without that dependency.
- Implemented both tasks in one GREEN commit rather than two, since both
  target the identical two files and the plan's own text frames the
  two-task split as a planning-context-budget device ("splitting them
  keeps each within a working context budget"), not a mandated two-commit
  execution shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `enum` is unsupported by this package's runtime; used `as const` objects instead**
- **Found during:** Task 1 first test run (`node --test stock-protocol.test.ts`)
- **Issue:** The plan's action text specifies "plain TypeScript enums (not
  `const enum`)" for `CommandType`/`ResponseType`/`ErrorCode`. Running the
  file with a real `enum` produced
  `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not
  supported in strip-only mode` -- this package has no build step at all
  (Node's native type-stripping runs the `.ts` files directly at runtime),
  and strip-only mode rejects real enums outright, plain or `const`.
- **Fix:** Replaced all three with `export const X = { ... } as const;
  export type X = (typeof X)[keyof typeof X];` -- identical member names,
  identical numeric values, identical `CommandType.Ping`-style access.
- **Verification:** `node --test stock-protocol.test.ts` runs clean;
  `npm run typecheck` reports no errors.
- **Committed in:** `be40274` (no separate commit -- caught before the
  first GREEN attempt, so the GREEN commit already reflects the fix)

**2. [Rule 1 - Bug] Test harness's `server.closeAllConnections()` doesn't exist on `net.Server`**
- **Found during:** Task 2 first full-suite run (`node --test
  stock-protocol.test.ts` hung indefinitely with no TAP output at all)
- **Issue:** `withStubNetServer()`'s `finally` block called
  `server.closeAllConnections()`, mirroring `vice-probe.test.ts`'s
  `withStubServer()` harness -- but that method exists only on
  `http.Server`, not `net.Server`. Calling it threw a `TypeError`
  synchronously inside the `finally` block, which meant `server.close()`
  right after it never ran. The listening socket stayed open forever,
  keeping the event loop alive and hanging the whole `node --test`
  process (confirmed by isolating to a standalone script and by checking
  `Object.getOwnPropertyNames` on `net.Server`'s prototype).
- **Fix:** Track every accepted socket in a `Set`, remove it on `'close'`,
  and `destroy()` all tracked sockets in the `finally` block before calling
  `server.close()` -- the `net.Server` equivalent of `http.Server`'s
  `closeAllConnections()`.
- **Files modified:** `.claude/mcp/vice/stock-protocol.test.ts`
- **Verification:** Full suite (`node --test stock-protocol.test.ts`)
  completes in ~1.3s, 21/21 passing, process exits cleanly with no
  lingering handle.
- **Committed in:** `be40274` (no separate commit -- caught before the
  GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/runtime-syntax, 1 bug/test-harness).
**Impact on plan:** Both were necessary to make the plan's own verification
commands runnable at all. Neither changed the parser's or client's observable
behavior, names, or shapes -- both are Rule 1/Rule 3 fixes at the tooling
level, not scope creep.

## Issues Encountered

- Same pre-existing worktree-path test artifact plans 02-01/02-02 already
  documented: `repo-root.test.ts`'s "the agreed path is not under .claude"
  assertion fails only because this specific worktree is checked out under
  `.claude/worktrees/agent-.../`, an artifact of nested worktree-based
  parallel execution unrelated to this plan's two files. Not touched, not
  auto-fixed, out of scope per the executor's scope boundary. `npm run
  test:automated` is 347/353 passing (5 `todo`) in this worktree as a
  result.

## Environment Constraint Compliance

Per this execution's environment constraint, no real stock VICE binary is
reachable and no live socket work against `x64sc` was performed. All 21
`stock-protocol.test.ts` tests run against either pure in-process byte
buffers or a loopback TCP stub server standing in for VICE's binary
monitor -- never a real emulator. The `display-get` fixture consumed by
three of those tests is the spec-derived, explicitly-labelled-synthetic
fixture plan 02-02 committed (`synthetic: true`, `capturedFrom:
"synthesized-fallback"`); it is not described as recorded or verified
against real hardware anywhere in this plan's code or comments. Live
validation of `ViceMonitorClient` against a real `x64sc -binarymonitor`
process is deferred, consistent with the existing
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
todo (which already covers re-validating the underlying fixtures this
plan's tests load).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `stock-protocol.ts`'s `parseBuffer()`/`parseResponse()`/`ViceMonitorClient`
  are ready for plan 02-06 to build request-id correlation, a pending-request
  map, and event demux directly on top, in this same file (`ResponseType`,
  `ErrorCode`, `StockProtocolError`/`StockFramingError`/`StockDesyncError`,
  and `ViceMonitorClientCounters`'s reserved `duplicateReplies` field are all
  already in place for that layer).
- The remaining three of VERIF-02's eight cases (duplicate reply,
  event-interleaved, checkpoint-list correlation) are plan 02-06's to cover,
  once the correlation layer exists to make them meaningful.
- No blockers for plan 02-05 (running in parallel in a separate worktree,
  owning `broker-*.mts`/`vice-broker.mts`/`vice-broker-client.ts`, none of
  which this plan touched) or for plan 02-06.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-protocol.ts`
- FOUND: `.claude/mcp/vice/stock-protocol.test.ts`
- FOUND: `.planning/phases/02-stock-backend-connection/02-04-SUMMARY.md`
- FOUND commit `296dd7d` (test: RED, failing coverage)
- FOUND commit `be40274` (feat: GREEN, parser + socket layer)
- FOUND commit `2298588` (docs: plan summary)
