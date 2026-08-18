---
phase: 07-cycle-timing-and-wedge-triage
plan: 12
subsystem: protocol
tags: [binary-monitor, cpuhistory, wire-protocol, vice, stock-backend]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage plan 02
    provides: the original (disproven) CPUHISTORY_GET/RESOURCE_GET parser cases in stock-protocol.ts
  - phase: 07-cycle-timing-and-wedge-triage plan 10
    provides: the live-decode-mismatch finding and deferred-items.md's recorded raw-wire probe hex
provides:
  - Three real, non-synthetic CPUHISTORY_GET (0x86) fixtures captured from genuine VICE 3.10 and 3.9 binaries
  - A CpuHistoryGet parser re-derived from monitor_binary_process_cpuhistory() that decodes real replies and rejects hostile count/item_size values as StockFramingError
  - A fixed RESOURCE_GET integer branch (CR-02) that can no longer RangeError out of parseResponse()
  - A corrected "entries[0] is the newest" doc claim (live-disproven; irrelevant to Route A, which always requests count:1)
affects: [07-13 (Route A live stopwatch proof through dispatchStock()), 07-18 (doc corrections)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture-real-bytes-before-fixing-the-parser: fixtures committed and cross-checked against an independent raw-wire hex record BEFORE any parser code changed, so the same wrong assumption cannot be shared between the fixture and the code (the Phase 2/5 post-mortem failure mode)"

key-files:
  created:
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.bin
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.json
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.bin
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.bin
    - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json
  modified:
    - .claude/mcp/vice/probe-binmon.mjs
    - .claude/mcp/vice/stock-protocol.ts
    - .claude/mcp/vice/stock-protocol.test.ts

key-decisions:
  - "item_size in CPUHISTORY_GET denotes everything AFTER the size byte (response_size = 4 + count * (item_size + 1)), not just the register-block length -- the single misreading that produced the previously-shipped, never-live-verified layout"
  - "Fixed a pre-existing, unrelated blocking bug in probe-binmon.mjs's parseTarget(): '--capture <case>' picked up the case name as the VICE_BINMON host fallback, breaking every capture invocation"
  - "CR-02's RESOURCE_GET size check now runs BEFORE need() for the payload bytes, so the thrown StockFramingError names the observed size even when the body is also too short to read"
  - "Corrected the file's 'entries[0] is the newest' claim: the real multi-entry capture proves entries[0] is the OLDEST of the returned window, entries[count-1] the NEWEST -- verified live-disproven, but irrelevant to Route A's actual behavior since it always requests count:1"

requirements-completed: [TIME-01, TIME-03]

# Metrics
duration: ~40min
completed: 2026-08-18
---

# Phase 07 Plan 12: CPUHISTORY_GET real-bytes re-derivation and CR-02 fix Summary

**Captured real CPUHISTORY_GET wire bytes from genuine VICE 3.10/3.9 binaries, re-derived the per-entry layout from monitor_binary.c against those bytes, and fixed a RangeError-out-of-parseResponse() defect in RESOURCE_GET's integer branch.**

## Performance

- **Duration:** ~40 min (includes live VICE 3.10/3.9 capture sessions)
- **Completed:** 2026-08-18T11:12:25Z
- **Tasks:** 3
- **Files modified:** 9 (3 fixture .bin + 3 fixture .json created; probe-binmon.mjs, stock-protocol.ts, stock-protocol.test.ts modified)

## Accomplishments

- Captured three real, non-synthetic CPUHISTORY_GET fixtures from genuine binaries (`/usr/local/bin/x64sc`, VICE 3.10; `/usr/bin/x64sc`, VICE 3.9) via an extended `probe-binmon.mjs --capture` harness.
- Re-derived the CPUHISTORY_GET per-entry wire layout directly from `monitor_binary_process_cpuhistory()` in a real VICE source tree (`/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor/monitor_binary.c:1452-1620`), replacing a layout that was never actually confirmed against a real reply (WR-13).
- Fixed CR-02: `RESOURCE_GET`'s integer branch could throw a bare `RangeError` out of `parseResponse()` on a body like `[0x01, 0x00]`; it now throws a documented `StockFramingError` naming the observed size.
- Found and fixed a genuine, previously-undetected blocking bug in `probe-binmon.mjs`'s argument parsing that broke every `--capture <case>` invocation using the documented `VICE_BINMON` env-var workflow.
- Disproved and corrected an existing but never-live-verified doc claim ("entries[0] is the newest entry") using the real multi-entry capture -- and confirmed the correction is functionally inert for Route A's shipped behavior (`stock-timing.ts` always requests `count:1`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture real CPUHISTORY_GET wire bytes and commit fixtures** - `65130a1` (feat)
2. **Task 2: Re-derive CPUHISTORY_GET layout from source, fix parser and provenance comments** - `d7ab982` (fix)
3. **Task 3: Fix CR-02 (RESOURCE_GET) and add real-bytes/hostile-input regression tests** - `7e28912` (fix)

_All three tasks were `type="auto"`; this plan had no checkpoints._

## Files Created/Modified

- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get.bin` / `.json` - real single-entry (`count:1`) capture from genuine VICE 3.10, 52-byte body, `item_size=0x2f`
- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.bin` / `.json` - real 4-entry capture from the same build, 196-byte body, the stride proof
- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.bin` / `.json` - real refusal frame from genuine VICE 3.9 (no `CPUHISTORY_GET` opcode)
- `.claude/mcp/vice/probe-binmon.mjs` - `cpuHistoryGetBody()`, three new `--capture` cases/runners, a `parseTarget()` blocking-bug fix, extended `--selftest`
- `.claude/mcp/vice/stock-protocol.ts` - re-derived `CpuHistoryGet` case, corrected `ParsedCpuHistoryEntry`/`ParsedCpuHistoryResponse` doc comments, fixed `ResourceGet` case (CR-02)
- `.claude/mcp/vice/stock-protocol.test.ts` - rebuilt `cpuHistoryEntry()` synthetic helper to match the corrected layout; added CR-02, real-fixture, and hostile-input regression tests

## Decisions Made

- **item_size semantics**: `item_size = 2 (regCount) + regCount*(3+1) (register items) + 8 (cycle) + 1 (instruction_length byte) + instruction_length (instruction data)` -- confirmed both from `monitor_binary.c` source arithmetic (`response_size = 4 + count * (item_size + 1)`) and by hand-decoding the real 52-byte single-entry capture (`item_size=0x2f=47` exactly matches `2+32+8+1+4`).
- **CR-02 check ordering**: the `size !== 4` check for the integer branch runs BEFORE `need(body, 2+4, ...)`, not after, so a body that is both wrong-sized AND too short (the plan's own three reproduction cases: `[1,0]`, `[1,2,...]`, `[1,3,...]`) still gets a `StockFramingError` naming the declared size, not a generic "body too short" message from `need()`.
- **`entries[0]` ordering correction**: documented as a live finding rather than silently fixed in consumer code, since `stock-timing.ts`'s Route A always requests `count:1` and is unaffected either way. The corrected claim lives in `ParsedCpuHistoryResponse`'s doc comment and a renamed test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `probe-binmon.mjs`'s `parseTarget()` picking up the `--capture` case name as the VICE_BINMON host fallback**
- **Found during:** Task 1, first live capture attempt
- **Issue:** `parseTarget()` filtered only `--`-prefixed argv tokens before falling back to `VICE_BINMON`. Running `... VICE_BINMON=127.0.0.1:39863 node probe-binmon.mjs --capture cpuhistory-get` picked up the bare word `"cpuhistory-get"` (the case name) as `positional[0]`, which won over the env var, producing `getaddrinfo ENOTFOUND cpuhistory-get`. This broke every `--capture <case>` invocation using the documented `VICE_BINMON` workflow, not just the three new cases.
- **Fix:** `parseTarget()` now excludes `--capture`/`--capture-out` AND the single argv token immediately following each, before falling through to host/port positionals.
- **Files modified:** `.claude/mcp/vice/probe-binmon.mjs`
- **Verification:** `--selftest` still passes; all six live captures (three new plus a live spot-check of the existing flow) succeeded afterward.
- **Committed in:** `65130a1` (Task 1 commit)

**2. [Rule 1 - Bug] Rebuilt `stock-protocol.test.ts`'s `cpuHistoryEntry()` synthetic-body helper to match the corrected layout**
- **Found during:** Task 2, running its own `<verify>` command
- **Issue:** The existing synthetic helper built entry bodies from the disproven layout (`item_size` = raw register-block byte count, no `regCount` field). After Task 2's parser rewrite, the two existing behavior tests using this helper failed: one decoded to `type: undefined` (a `StockFramingError` was thrown instead) and one threw a `TypeError`.
- **Fix:** Rebuilt `cpuHistoryEntry()` to emit a real `regCount(u16LE)` field plus `regCount` properly-strided register items, matching `write_registers()`'s actual wire format. Also raised two arbitrary `instructionLength` values in the order-preservation test from 1/2 to 4/3, since the new parser rejects `instructionLength < 3` as a framing error (a correctness requirement this task's own guard introduces, not a pre-existing test intent).
- **Files modified:** `.claude/mcp/vice/stock-protocol.test.ts`
- **Verification:** `node --test stock-protocol.test.ts stock-timing.test.ts` -- 138/138 passing.
- **Committed in:** `d7ab982` (Task 2 commit, alongside the parser rewrite that necessitated it)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary preconditions for this plan's own tasks to reach their documented `<verify>` state (a working `--capture` harness for Task 1; a passing `stock-protocol.test.ts` for Task 2). No scope creep beyond what each task's own verification required.

## Issues Encountered

None beyond the two deviations above. Both real VICE binaries (`/usr/local/bin/x64sc` VICE 3.10, `/usr/bin/x64sc` VICE 3.9) launched cleanly with `-default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:<port>` and a per-binary scratch `XDG_CONFIG_HOME`, exactly as `07-VALIDATION.md`'s Manual-Only Verifications preamble documented. No leaked `x64sc` processes remained after either session (`pgrep -f x64sc` empty at plan end, confirmed via `ps aux | grep bin/x64sc`).

## Captured Hex Bodies and viceVersion Values

| Fixture | viceVersion | Body length | Notes |
|---------|-------------|-------------|-------|
| `cpuhistory-get.bin` | `3.10.0.0` | 52 bytes | `item_size=0x2f=47`; body hex: `010000002f08000303d1e5030000000301000003020a000304f300030522000335ffff0336ffffec34170300000000048d9202ff` |
| `cpuhistory-get-multi.bin` | `3.10.0.0` | 196 bytes | `count=4`; `4 + 4*(47+1) = 196`, confirming stride `item_size+1` |
| `cpuhistory-get-unsupported.bin` | `3.9.0.0` | 0 bytes (12-byte header-only frame) | `responseType=0x00`, `errorCode=0x83` (`e_MON_ERR_CMD_INVALID_TYPE`) -- see finding below |

`cpuhistory-get.bin`'s structure (count `01000000`, `item_size=0x2f`, 52-byte total body) matches `deferred-items.md`'s independently-recorded raw-wire probe hex exactly in shape (count and item_size identical; the specific register/PC/cycle values differ because it is a different capture session, as expected).

## Re-Derived Layout (Field Table)

Per entry, starting immediately after the 4-byte `count(u32LE)`:

| Field | Size | Notes |
|-------|------|-------|
| `item_size` | 1 byte | byte count of everything below, in this table; entry stride is `1 + item_size` |
| `regCount` | u16LE | number of register items following |
| register items (×`regCount`) | 4 bytes each | `size(1)=3`, `id(1)`, `value(u16LE)` -- not decoded; `LIN`/`CYC` are hard-filled `0xffff` sentinels |
| `cycle` | u64LE | the monotonic absolute clock value Route A's stopwatch reads |
| `instruction_length` | 1 byte | **hardcoded constant 4 in VICE** (`monitor_binary.c:1468`) -- NOT the real decoded instruction length |
| instruction data | ≥3 bytes (4 on real captures) | `opcode`, `p1`, `p2`, and a trailing placeholder byte for a third parameter that exists on some machines |

## Real 3.9 Error Code Finding

The refusal capture against genuine VICE 3.9 (`/usr/bin/x64sc`) returned `responseType=0x00`, `errorCode=0x83` (`e_MON_ERR_CMD_INVALID_TYPE`) -- a 12-byte header-only frame with **no** body. This is **not** the `0x8f` (`e_MON_ERR_CMD_FAILURE`) that `monitor_binary_process_cpuhistory()`'s `#else` branch (compiled when `FEATURE_CPUMEMHISTORY` is undefined) would send. The observed `0x83` indicates VICE 3.9's command dispatcher does not recognize opcode `0x86` as a valid command type at all -- the opcode itself, not just the history feature, appears to be new in 3.10. This is recorded as a finding rather than smoothed over; it does not require any code change in this plan (out of scope: `probeCpuHistory()`'s capability-detection guard is plan 07-01/07-11's territory) but is directly relevant to how any future guard should classify the refusal.

## Observed Entry Order Finding

The real multi-entry capture (`cpuhistory-get-multi.bin`, 4 entries) decodes to **strictly ascending** cycle values across `entries[0..3]` (73493771 → 73493775 → 73493778 → 73493781). This means `entries[0]` is the **OLDEST** of the returned window and `entries[count-1]` is the **NEWEST** -- the opposite of the file's previous, never-live-verified "entries[0] is the newest" claim. Corrected in `ParsedCpuHistoryResponse`'s doc comment and in the renamed order-preservation test. This finding is **functionally inert** for the currently shipped Route A stopwatch (`stock-timing.ts`'s `readCycleBaseline()`), which always requests `CPUHISTORY_GET(count:1)` and therefore only ever has a single entry regardless of ordering semantics.

## Synthetic Tests Rebuilt

- `stock-protocol.test.ts`'s `cpuHistoryEntry()` helper (used by two behavior tests) was rebuilt from the disproven layout to the corrected one -- see Deviation 2 above. No test was deleted; both original behavioral assertions (single-entry decode, order-preservation across two entries) still exist, now built on the correct wire shape.

## User Setup Required

None - no external service configuration required. Live verification used two VICE binaries already present on this machine (`/usr/local/bin/x64sc`, `/usr/bin/x64sc`); no packages were installed.

## Next Phase Readiness

- Route A's decode-side gap (07-10's recorded blocker) is closed: `stock-protocol.ts` now decodes real `CPUHISTORY_GET` replies from a genuine VICE >= 3.10 build.
- 07-13 (the end-to-end live Route A stopwatch proof through `dispatchStock()`) is unblocked -- the parser it depends on now has real-bytes regression coverage.
- 07-18 (doc corrections) can now cite this plan's fixtures and re-derived layout instead of the disproven one.
- The 3.9 `0x83` error-code finding and the `entries[0]` ordering correction are both recorded here for any future plan that touches `probeCpuHistory()`'s capability guard or attempts a multi-entry Route A read.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/fixtures/binmon/cpuhistory-get.bin` / `.json`
- FOUND: `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.bin` / `.json`
- FOUND: `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.bin` / `.json`
- FOUND: `.claude/mcp/vice/probe-binmon.mjs`, `.claude/mcp/vice/stock-protocol.ts`, `.claude/mcp/vice/stock-protocol.test.ts`
- FOUND: commits `65130a1`, `d7ab982`, `7e28912` in `git log --oneline`
