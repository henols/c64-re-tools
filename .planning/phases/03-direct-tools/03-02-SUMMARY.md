---
phase: 03-direct-tools
plan: 02
subsystem: api
tags: [vice-binary-monitor, protocol-encoding, typescript, stock-vice, wire-format]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: stock-protocol.ts's response parsers (parseResponse/parseBuffer), encodeRequestHeader(), the CommandType/ResponseType/ErrorCode wire constants, and the ViceMonitorClient socket/demux layer this plan's encoders plug into
provides:
  - Sixteen request-body encoders in stock-protocol.ts covering every Phase 3 tool family's wire body: memGetBody, memSetBody, cpNumBody, checkpointSetBody, checkpointToggleBody, conditionSetBody, registersSetBody (plus memspaceByte/memspaceBody helpers and the CheckpointOperation const), advanceInstructionsBody, keyboardFeedBody, joyportSetBody, resetBody (plus ResetMode const), autostartBody, dumpBody, undumpBody
  - StockEncodingError, a new error class for caller-argument validation failures raised before any bytes are written
  - Byte-offset round-trip test coverage for every encoder in stock-protocol.test.ts
affects: [03-06, 03-07, 03-08, 03-09, 03-10, 03-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Request-body encoders are pure functions taking one options object, validating with StockEncodingError before any Buffer.alloc/write, matching encodeRequestHeader()'s existing style"
    - "Five encoders ported near-verbatim from probe-binmon.mjs's already offline-tested builders; the rest derived from the official VICE manual and marked [CITED], with behavioural (not wire-shape) unknowns marked [ASSUMED] and tied to a named RESEARCH.md Assumptions Log row"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-protocol.ts
    - .claude/mcp/vice/stock-protocol.test.ts

key-decisions:
  - "Added a new StockEncodingError class (extends ViceError, same constructor shape as the file's other error subclasses) for encoder-side argument validation, distinct from the wire-level StockProtocolError/StockFramingError raised by the parsing seam"
  - "registersSetBody()'s itemSize wire byte is hardcoded to 3 (regId + u16LE value) regardless of the optional RegisterSetItem.size field, per the plan's explicit 'itemSize = 3' spec"
  - "resetBody()'s JSDoc explicitly documents RESEARCH.md's Pitfall 1: RESET (0xcc) is not the RESOURCE_SET (0x52) power-cycle hazard CLAUDE.md warns about, and needs no deny-list"

requirements-completed: [DIRECT-01, DIRECT-02, DIRECT-03, DIRECT-04, DIRECT-06, DIRECT-07, DIRECT-08, DIRECT-09]

# Metrics
duration: ~40min
completed: 2026-08-14
---

# Phase 3 Plan 2: Request-Body Encoders Summary

**Sixteen request-body encoders for stock VICE's binary monitor, in stock-protocol.ts's one wire-format seam -- memory, registers, checkpoints, conditions, execution control and machine control -- five ported near-verbatim from probe-binmon.mjs's offline-tested builders, the rest cited against the official VICE manual with every unverified behavioural claim explicitly labelled [ASSUMED].**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-14
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Every Phase 3 tool family (memory/registers, checkpoints, execution control, machine control) now has a request-body encoder to call, satisfying DIRECT-01 through DIRECT-09 (partial, per plan scope) for the encoding layer.
- `memGetBody()`'s `sidefx` byte defaults to `0x00` (false), so a default memory read is side-effect-free -- DIRECT-01's threat mitigation T-3-01, asserted by a test.
- `conditionSetBody()` refuses an empty expression, any non-ASCII byte (naming the offending index), and any expression over 255 bytes, before encoding a single byte -- the ASVS V5 control this file's threat model (T-3-02/T-3-04) requires.
- Every variable-length field across all sixteen encoders (`conditionSetBody`, `keyboardFeedBody`, `autostartBody`, `dumpBody`, `undumpBody`, `registersSetBody`) is range-checked before encoding, so no encoder can emit a frame whose declared length disagrees with its payload (T-3-04).
- Behavioural assumptions RESEARCH.md flags as unverified (A2: `stepOver`'s skip-subroutine semantic, A3: `JOYPORT_SET`'s bit layout, A5: `AUTOSTART`'s `fileIndex` behaviour when `runAfter` is false) are named in the relevant encoder's JSDoc, never claimed as verified.
- `resetBody()`'s JSDoc documents RESEARCH.md's Pitfall 1 explicitly, so a later reviewer does not "fix" a non-existent power-cycle hazard by adding a deny-list entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Memory, register, checkpoint and condition body encoders** - `4aa4ee7` (feat)
2. **Task 2: Execution and machine-control body encoders** - `d25ee54` (feat)

_Note: both tasks touch the same two files (a single continuous encoder section per the plan's own design); they were staged and committed separately by temporarily isolating Task 2's block, verifying Task 1 alone, committing, then restoring Task 2's block and committing again -- so each commit's diff matches only its own task's scope._

## Files Created/Modified

- `.claude/mcp/vice/stock-protocol.ts` - Adds `StockEncodingError` and a new "Request-body encoders (Phase 3)" section with all sixteen encoders plus `CheckpointOperation`/`ResetMode` consts, placed after `encodeRequestHeader()` and before the response-parser section
- `.claude/mcp/vice/stock-protocol.test.ts` - Adds byte-offset round-trip test cases for every new encoder, hand-decoding each field at its literal offset rather than re-calling the encoder

## Decisions Made

- New `StockEncodingError` class added (Rule 2 -- missing critical functionality): the plan calls for encoder-side validation errors "of a `StockProtocolError`-family" character, but `StockProtocolError` itself carries wire-reply semantics (`errorCode`/`responseType` from an actual VICE response) that don't fit a pre-send argument-validation failure. A sibling class following the same `ViceError` subclass constructor convention as every other error type in the file was the correct fit, not a reuse of `StockProtocolError` itself.
- `registersSetBody`'s `RegisterSetItem.size` field is accepted per the plan's literal interface spec but not used to vary the wire `itemSize` byte, which the plan's own prose fixes at `3`. Documented in the field's own JSDoc so a future reader isn't surprised it's inert.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two off-by-one byte-offset errors in the plan's own illustrative test values**
- **Found during:** Task 1 (writing the required test cases)
- **Issue:** The plan's `<action>` text specifies two test expectations that are numerically inconsistent with the plan's own documented wire layout: (a) `conditionSetBody({ checkpointNum: 1, expression: "(RL == $64) && (CY == $14)" })` was claimed to produce `body[4] === 25`, but that exact string is 26 ASCII characters long (confirmed via `"...".length` and independently via `node -e`) -- 25 would silently truncate the last character. (b) `registersSetBody` with two items was claimed to produce `body[2] === 3` and `body[6] === 3` (itemSize bytes), but the plan's own documented layout (`memspace(1) count(u16LE)` = a 3-byte header before the first item) places the two items' itemSize bytes at offsets 3 and 7, not 2 and 6 -- confirmed against `docs/phase0-binmon-findings.md` §5's REGISTERS_SET layout and cross-checked against a sibling plan's (03-07) analogous test description, which shows the same drafting pattern.
- **Fix:** Implemented `conditionSetBody`/`registersSetBody` per the plan's own prose-described wire layout (which is internally consistent and matches the official VICE protocol), and wrote the test assertions using the arithmetically correct offsets/lengths (26, and 3/7 respectively), with an inline comment at each site explaining the discrepancy from the plan's illustrative numbers.
- **Files modified:** `.claude/mcp/vice/stock-protocol.test.ts`
- **Verification:** `node --test stock-protocol.test.ts` -- both tests pass; the encoder's `body.length` assertions (8 total-length checks and `3 + 2 * 4 = 11`) match the plan's own length arithmetic, which was correct even where its byte-offset illustrations were not.
- **Committed in:** `4aa4ee7` (Task 1 commit)

**2. Logged (not fixed) a pre-existing, out-of-scope test failure**
- **Found during:** running `npm run test:automated` after Task 2
- **Issue:** `repo-root.test.ts`'s "path agreement... the agreed path is not under .claude" test fails because this execution runs inside a GSD worktree whose own filesystem path (`.claude/worktrees/agent-<id>/`) trips the test's own "must not sit under `.claude`" invariant. Confirmed pre-existing and unrelated to this plan's files by running `repo-root.test.ts` in isolation with an identical failure.
- **Action:** Logged to `.planning/phases/03-direct-tools/deferred-items.md` per the SCOPE BOUNDARY rule (pre-existing failures in unrelated files are logged, not fixed); no code change made.
- **Files modified:** `.planning/phases/03-direct-tools/deferred-items.md` (new)

---

**Total deviations:** 2 (1 Rule 1 auto-fix, 1 logged-and-deferred out-of-scope item)
**Impact on plan:** The Rule 1 fix corrects the plan's own worked examples to match its own documented wire layout -- no behavioural or scope change to the encoders themselves. The deferred item is unrelated to this plan's file scope and requires no action here.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All sixteen encoders plus `CheckpointOperation`/`ResetMode` are exported from `stock-protocol.ts` and ready for plans 03-06 through 03-11 (the four family handler modules) to import directly.
- `grep -c '^export function' stock-protocol.ts` confirms exactly 19 exported functions (3 pre-existing + 16 new), matching the plan's verification requirement.
- `node --test stock-protocol.test.ts` (100/100 passing) and `npm run typecheck` are both green; `npm run test:automated` is green except the one pre-existing, unrelated, worktree-path-caused failure logged in `deferred-items.md`.
- No handler, dispatch-table, or manifest changes were made in this plan's diff, matching the plan's own success criteria.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*
