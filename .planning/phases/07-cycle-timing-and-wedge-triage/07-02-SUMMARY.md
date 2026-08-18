---
phase: 07-cycle-timing-and-wedge-triage
plan: 02
subsystem: api
tags: [binary-monitor-protocol, stock-vice, cpuhistory, resource-get, wire-decoder]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: stock-protocol.ts's framing/parsing seam (parseBuffer/parseResponse), need()-guarded decode discipline, StockFramingError/StockEncodingError hierarchy
provides:
  - "CPUHISTORY_GET (0x86) response parser: ParsedCpuHistoryResponse carrying an exact bigint cycle per entry"
  - "RESOURCE_GET (0x51) request encoder (resourceGetBody) and response parser (ParsedResourceGetResponse, integer/string discriminated union)"
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New ParsedResponse variants follow the existing need()-before-every-offset-read discipline: every wire-derived length (count, item_size, size) is bounds-checked before the byte it gates, so a short or hostile body is a StockFramingError, never a RangeError."
    - "Read-side-only encoder with a mechanically-asserted absence: resourceGetBody() has no RESOURCE_SET sibling, and a comment-filtered structural test (grep-style, filtering `^\\s*(//|*|/*)` lines) proves stock-protocol.ts never defines resourceSetBody() or a case ResponseType.ResourceSet."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-protocol.ts
    - .claude/mcp/vice/stock-protocol.test.ts
    - .claude/mcp/vice/stock-connect.test.ts
    - .claude/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "CPU-history per-entry register block is deliberately skipped, not decoded -- VICE hard-fills LIN/CYC inside CPU-history entries with the sentinel 0xffff (monitor_binary.c:1585-1590), so it carries no real value for this phase's stopwatch use case."
  - "cycle is read via readBigUInt64LE and typed bigint, never narrowed to Number -- a uint64 clock does not fit a JS number safely and the stopwatch's whole value is exactness."
  - "resourceGetBody() is read-side only; no RESOURCE_SET (0x52) encoder is added, since its SET side reaches machine_trigger_reset(POWER_CYCLE) one call deep for MachineVideoStandard/VICIIModel/MachinePowerFrequency."

patterns-established:
  - "Comment-filtered structural absence test: `source.split(\"\\n\").filter(line => !/^\\s*(\\/\\/|\\*|\\/\\*)/.test(line))` isolates non-comment source before substring-checking for a forbidden name, so a JSDoc that quotes the forbidden name (to explain why it doesn't exist) cannot self-invalidate the check."

requirements-completed: [TIME-01]

# Metrics
duration: ~45min
completed: 2026-08-18
---

# Phase 07 Plan 02: CPUHISTORY_GET and RESOURCE_GET Wire Decoders Summary

**CPUHISTORY_GET now decodes to an exact-bigint-cycle typed record and RESOURCE_GET gained a read-only encoder/parser pair, closing the two wire-decode gaps `vice_cycles_stopwatch`'s Route A/Route B need.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-18T07:29Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 planned, 2 additional test-stub fixes)

## Accomplishments
- `ParsedCpuHistoryResponse`/`ParsedCpuHistoryEntry` added, with `case ResponseType.CpuHistoryGet` decoding `count(u32LE)` then per-entry `item_size(1) + register-block(item_size, skipped) + cycle(u64LE) + instruction_length/opcode/p1/p2(1 each) + placeholder(1)`, every offset `need()`-guarded.
- `resourceGetBody({name})` encoder and `ParsedResourceGetResponse` discriminated-union parser (`case ResponseType.ResourceGet`) added, decoding `type(1)/size(1)/payload` into either `{valueType: "integer", value: number}` or `{valueType: "string", value: string}`.
- Zero SET-side resource encoder exists — mechanically proven by a comment-filtered structural test rather than by inspection.
- Fixed a regression the new strict CPUHISTORY_GET parser exposed in two pre-existing test stubs (`stock-connect.test.ts`, `stock-dispatch.test.ts`) that modeled an unrealistic zero-length OK reply.

## Task Commits

Each task was committed atomically:

1. **Task 1: CPUHISTORY_GET response parser case** - `cfb7130` (feat)
2. **Task 2: RESOURCE_GET request encoder and response parser case** - `6746de8` (feat)
3. **Deviation fix: realistic CPUHISTORY_GET stub bodies** - `35ad706` (fix, Rule 1)

_No plan-metadata commit yet — orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified
- `.claude/mcp/vice/stock-protocol.ts` - `ParsedCpuHistoryResponse`/`ParsedCpuHistoryEntry`, `case ResponseType.CpuHistoryGet`; `resourceGetBody()`, `ParsedResourceGetResponse`, `case ResponseType.ResourceGet`; `RESPONSE_TYPE_OF_PARSED_KIND` entries for both
- `.claude/mcp/vice/stock-protocol.test.ts` - 13 new tests: 4 CPUHISTORY_GET cases (single-entry exact bigint, two-entry ordering, truncated-cycle framing error, oversized-item_size framing error), 9 RESOURCE_GET cases (encoder shape, 4 rejection cases, integer/string response parse, truncated-body framing error, structural absence-of-SET-side test)
- `.claude/mcp/vice/stock-connect.test.ts` - `happyPathResponder`'s `CpuHistoryGet` arm now sends a realistic 4-byte zero-count body on the OK path instead of an empty body
- `.claude/mcp/vice/stock-dispatch.test.ts` - CR-06's inline loopback binmon stub gained a dedicated `0x86` arm sending a realistic 4-byte zero-count body

## Decisions Made
- CPU-history's per-entry register block is skipped entirely rather than decoded, per the plan's own instruction (VICE's `0xffff` sentinel fill makes it meaningless for this phase).
- `resourceGetBody()`'s printable-ASCII bound is `0x20-0x7e` (stricter than `requireAsciiFilename()`'s `<=0x7f`), matching the task's explicit "printable ASCII" wording for resource *names* as distinct from filenames.
- The structural absence test checks specifically for `resourceSetBody` and `case ResponseType.ResourceSet` substrings (not the broader "any mention of ResponseType.ResourceSet"), since the pre-existing `EXPECTED_RESPONSE` correlation table already legitimately maps `CommandType.ResourceSet` to `ResponseType.ResourceSet` as protocol-constant data (not an encoder or parser branch) — a broader check would have false-failed on code this plan didn't touch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing test stubs modeled an impossible CPUHISTORY_GET success reply**
- **Found during:** Post-Task-2 full-suite verification (`npm run test:automated`)
- **Issue:** `stock-connect.test.ts`'s `happyPathResponder` and `stock-dispatch.test.ts`'s inline CR-06 loopback stub both answered CPUHISTORY_GET's capability-probe OK reply with a zero-length body. Before this plan, that body was never parsed (fell through to `"unknown"`), so it worked by accident. After Task 1 added `need(body, 4, ...)` for the count field, both stubs' OK replies started throwing `StockFramingError`, breaking `stockConnect()`'s whole handshake in 9 downstream tests across both files. No real stock VICE build would ever send a zero-length OK reply — the wire always includes at least the count field, even for zero history entries.
- **Fix:** Both stubs now send a 4-byte all-zero body (`count = 0`) on the OK path only; the error-code paths were already correct (parseResponse() throws on the error-code check before reaching the CPUHISTORY_GET switch case, so they never needed a body).
- **Files modified:** `.claude/mcp/vice/stock-connect.test.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-connect.test.ts stock-dispatch.test.ts` — 140/140 pass; full `npm run test:automated` returns to exactly 1 failure (the pre-existing, unrelated "path agreement" test, confirmed failing identically on the pre-plan base commit via `git stash`).
- **Committed in:** `35ad706`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix surfaced directly by this plan's own stricter, correct parser. No scope creep — no other file or behavior touched.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `vice_cycles_stopwatch`'s Route A (CPU-history newest-entry cycle read) and Route B (`MachineVideoStandard` resource read for cycles-per-line/lines-per-frame constants) both now have a working, tested wire decoder to build on.
- `.claude/mcp/vice/stock-protocol.ts` remains the sole authoritative decode seam — no other file in this tree decodes CPUHISTORY_GET or RESOURCE_GET bytes.
- No blockers for subsequent 07-* plans that consume these two decoders.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/stock-protocol.ts
- FOUND: .claude/mcp/vice/stock-protocol.test.ts
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-02-SUMMARY.md
- FOUND: cfb7130 (feat: CPUHISTORY_GET parser)
- FOUND: 6746de8 (feat: RESOURCE_GET encoder/parser)
- FOUND: 35ad706 (fix: CPUHISTORY_GET stub regression)
- FOUND: 1f9f3d5 (docs: SUMMARY)
