---
phase: 05-skill-critical-derived-tools
plan: 04
subsystem: api
tags: [vice-mcp, stock-vice, binary-monitor, cia, derived-tool, mem-get]

# Dependency graph
requires:
  - phase: 05 (wave 1, sibling plans)
    provides: withDerivedTool()/STOCK_DERIVED_TOOLS seam (Phase 4), stock-handler.ts's stockAnswer()/convertWireError(), stock-protocol.ts's memGetBody()
provides:
  - "stock-cia.ts: decodeCia() pure per-chip bit-field decoder and handleCiaGetState session handler for vice_cia_get_state"
  - "CIA_UNAVAILABLE_FIELDS: the 5-member registry (timerALatch, timerBLatch, interruptEnableMask, todAlarmTime, todLatchState) rendering write-side/internal fields as {available:false, reason}"
affects: [05-07 (wave 3, registers vice_cia_get_state into STOCK_DISPATCH_TABLE and writes its outputSchema from this summary's answer-key list)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One sidefx:false MEM_GET per chip over its 16-byte block, decoded entirely client-side (no binary-monitor CIA opcode exists)"
    - "D-05-11: a read/write address collision is reported as two distinct named fields (readable side named for what it is, e.g. timerA.current; unreadable side an explicit {available:false, reason} field, e.g. timerALatch) rather than one field under an ambiguous name"

key-files:
  created:
    - .claude/mcp/vice/stock-cia.ts
    - .claude/mcp/vice/stock-cia.test.ts
  modified: []

key-decisions:
  - "plan_decision_D-05-11 implemented exactly as written: three read-vs-write address collisions ($xx04-$xx07 timer current vs. latch, $xx0D interrupt status vs. enable mask, $xx08-$xx0B TOD vs. alarm) each produce a readable-side field named for what it is and a separate write-side field in CIA_UNAVAILABLE_FIELDS"
  - "cia argument accepts both the number and string forms of 1/2 (normalised), refusing 0, 3, 1.5 and \"both\" by naming the received value, with zero wire sends on any refusal"
  - "sidefx is hardcoded false with no argument to override it, since $DC0D/$DD0D clear pending interrupt flags on read in hardware"

patterns-established: []

requirements-completed: [DERIV-05]

# Metrics
duration: 25min
completed: 2026-08-17
---

# Phase 5 Plan 04: CIA1/CIA2 chip-state decode (read side) Summary

**`stock-cia.ts` decodes CIA1/CIA2 into per-chip bit fields from one `sidefx:false` MEM_GET per chip, with the three read-vs-write address collisions reported as distinct named fields per D-05-11, and five write-side/internal fields explicitly `{available:false, reason}`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-17T17:13:00Z (approx.)
- **Completed:** 2026-08-17T17:38:11Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- Built `decodeCia(chip, bytes)`, a pure 16-byte-block decoder for CIA1 ($DC00-$DC0F) and CIA2 ($DD00-$DD0F), naming every readable field distinctly per chip (joysticks on CIA1, VIC bank/serial bus on CIA2) and encoding active-low polarity and BCD TOD correctly.
- Built `handleCiaGetState`, the `StockSessionHandler` for `vice_cia_get_state`, reading one or both chips (`cia: 1 | 2 | omitted`), refusing a bad `cia` value or unexpected key before any wire send, and refusing a non-16-byte reply as a short read rather than a partial success.
- Implemented `CIA_UNAVAILABLE_FIELDS`, a 5-member frozen registry rendering the two timer latches, the interrupt-enable mask, the TOD alarm time and the internal TOD latch/halt flip-flop as explicit `{available: false, reason}` fields — never `0`, never absent.
- 31 unit tests in `stock-cia.test.ts` cover per-chip decode correctness (active-low polarity, BCD decoding, VIC-bank inversion, per-chip field-set isolation), the three D-05-11 pairing assertions, the `sidefx=0x00` wire-body regression guard on every call, and every argument/response-shape refusal path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stock-cia.ts -- decodeCia() and handleCiaGetState** - `2552b61` (feat)
2. **Task 2: Create stock-cia.test.ts -- per-chip decode, per-chip sidefx wire guards, and the never-zero assertions** - `a7ca028` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/stock-cia.ts` - `decodeCia()`, `handleCiaGetState`, `CIA_UNAVAILABLE_FIELDS`, `CIA1_BASE`/`CIA2_BASE`/`CIA_LENGTH` constants
- `.claude/mcp/vice/stock-cia.test.ts` - 31 `node:test` cases covering decode correctness, D-05-11 pairing, wire-body guards, and argument/response refusals

## Decisions Made

- Followed `plan_decision_D-05-11` verbatim: the readable half of each read/write collision keeps a name describing what it actually is (`timerA.current`, `timerB.current`, `interruptStatus`, `tod`), and the unreadable half is a distinct, explicit `{available:false, reason}` field in `CIA_UNAVAILABLE_FIELDS`, each reason naming the sharing address.
- `cia` argument validation accepts the numeric literals `1`/`2` and their string forms `"1"`/`"2"` (normalised to the number), refusing everything else (`0`, `3`, `1.5`, `"both"`) by naming the received value, mirroring `parseByteCount`'s bound-checking idiom in spirit without reusing it directly (since `cia` is validated as an explicit 1-or-2 literal, not a byte count).
- `sidefx` is hardcoded `false` at the single `memGetBody()` construction site with no argument path to override it, since `$DC0D`/`$DD0D` clear pending interrupt flags on read in hardware — a sharper hazard than VIC-II's collision registers, since it destroys an interrupt the running program has not yet serviced.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run typecheck` initially failed with `tsc: not found` because `.claude/mcp/vice/node_modules` did not exist in this fresh worktree. Ran `npm ci` (not a deviation requiring documentation — dependency provisioning, not a code change) to restore the already-committed `package-lock.json`'s exact dependency tree before typechecking.
- The full `npm run test:automated` suite (1226 tests) reports one pre-existing, unrelated failure: `repo-root.test.ts`'s "path agreement ... the agreed path is not under .claude" assertion fails because this worktree's own checkout path (`.claude/worktrees/agent-a78e263de6df78f4b/`) is itself nested under a `.claude/` directory — an artifact of the parallel-worktree execution environment, not of any file this plan touches. Out of scope per the deviation rules' scope boundary (pre-existing failures in unrelated files); not fixed. All of `stock-cia.test.ts`, `test-gate.test.ts`, `fork-manifest-surface.test.ts` and `hostpath-consumers.test.ts` — the plan's own named verification targets — pass cleanly.

## Next Phase Readiness

For 05-07 (wave 3), the complete per-chip answer key list `handleCiaGetState`/`decodeCia` produce, for writing `vice_cia_get_state`'s `outputSchema` (including the `enum: [false]` pins on the five unavailable fields):

**Top-level answer (`stockAnswer()` payload):**
- `requested`: `1 | 2 | "both"`
- `cias`: array (always an array, even for a single chip)
- `count`: number (`cias.length`)
- `runState`: string enum `["running", "stopped", "unknown"]` (added automatically by `stockAnswer()`)

**Each `cias[]` entry (one per requested chip, `decodeCia()`'s return shape) — shared item schema, chip-specific keys modelled as OPTIONAL properties of that one shared shape (not a discriminated union, not two separate schemas):**

- `chip`: `1 | 2`
- `base`: number (`0xdc00` or `0xdd00`)
- `registersHex`: string, 32 lowercase hex characters
- `portA`: object
  - `raw`: number
  - **chip 1 only:** `joystick2`: object `{ up, down, left, right, fire }` (all boolean)
  - **chip 2 only:** `vicBank` (number 0-3), `vicBankBase` (number), `rs232Txd`, `serialAtnOut`, `serialClockOut`, `serialDataOut`, `serialClockIn`, `serialDataIn` (all boolean)
- `portB`: object
  - `raw`: number
  - **chip 1 only:** `joystick1`: object `{ up, down, left, right, fire }` (all boolean)
  - **chip 2 only:** `rs232Rxd`, `ri`, `dcd`, `userPortH`, `cts`, `dsr` (all boolean)
- `portADirection`: object `{ raw: number, outputs: boolean[8] }`
- `portBDirection`: object `{ raw: number, outputs: boolean[8] }`
- `timerA`: object `{ current: number }`
- `timerB`: object `{ current: number }`
- `tod`: object `{ tenths: number, seconds: number, minutes: number, hours: number, pm: boolean, rawHex: string }`
- `serialShiftRegister`: number
- `interruptStatus`: object `{ raw: number, timerAUnderflow: boolean, timerBUnderflow: boolean, todAlarm: boolean, serialShiftComplete: boolean, flagPin: boolean, interruptGenerated: boolean, interruptKind: "irq" | "nmi" }`
- `timerAControl`: object `{ raw: number, started: boolean, underflowOnPortB: boolean, underflowPulseMode: boolean, oneShot: boolean, forceLoad: boolean, countsCntPin: boolean, serialOutput: boolean, todFrequency50Hz: boolean }`
- `timerBControl`: object `{ raw: number, started: boolean, underflowOnPortB: boolean, underflowPulseMode: boolean, oneShot: boolean, forceLoad: boolean, countSource: number (0-3), countSourceMeaning: string, todWriteSetsAlarm: boolean }`
- `unavailable`: object with exactly these 5 keys, each `{ available: false, reason: string }` (pin `available` to `enum: [false]`):
  - `timerALatch`
  - `timerBLatch`
  - `interruptEnableMask`
  - `todAlarmTime`
  - `todLatchState`

**Chip-specific-keys note for 05-07:** `portA.joystick2`/`portB.joystick1` exist ONLY on chip-1 entries; `portA.vicBank`/`portA.vicBankBase`/`portA.rs232Txd`/`portA.serialAtnOut`/`portA.serialClockOut`/`portA.serialDataOut`/`portA.serialClockIn`/`portA.serialDataIn` and `portB.rs232Rxd`/`portB.ri`/`portB.dcd`/`portB.userPortH`/`portB.cts`/`portB.dsr` exist ONLY on chip-2 entries. This was modelled as one shared `portA`/`portB` object schema with all chip-specific properties declared optional (not `required`), rather than a `oneOf`/discriminated union keyed on `chip` — matching this codebase's existing `checkAgainstSchema()` capability (object-shaped keyword branch checks declared `properties` independently and only enforces `required` for keys actually listed), confirmed live in `stock-schema-check.ts` during 05-RESEARCH.md's own investigation.

No stub tracking needed — every field is wired to a real decoded value or an explicit `{available:false, reason}`; nothing is hardcoded to an empty placeholder.

---
*Phase: 05-skill-critical-derived-tools*
*Plan: 04*
*Completed: 2026-08-17*
