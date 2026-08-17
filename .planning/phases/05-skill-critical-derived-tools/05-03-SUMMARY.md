---
phase: 05-skill-critical-derived-tools
plan: 03
subsystem: api
tags: [vice-mcp, stock-vice, binary-monitor, vic-ii, derived-tool, typescript]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler
    provides: "withDerivedTool() / STOCK_DERIVED_TOOLS derived-tool seam, stock-handler.ts's stockAnswer()/convertWireError()/isErrorText() converters, memGetBody() in stock-protocol.ts"
provides:
  - "stock-vicii.ts: decodeVicii() pure bit-field decoder over the 47-byte $D000-$D02E VIC-II register block, VICII_UNAVAILABLE_FIELDS registry (6 members), and handleViciiGetState StockSessionHandler"
  - "stock-vicii.test.ts: exhaustive per-field decode assertions, sidefx wire-body pin, and never-zero/never-absent unavailable-field assertions"
affects: ["05-07 (wire-up wave: registers vice_vicii_get_state in stock-dispatch.ts/stock-derived.ts/tools-manifest.stock.json/package.json files[])"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unavailable-field registry pattern: a frozen array of [name, reason] pairs is the single source both the answer's unavailable object and the never-zero test loop are built from, so registry and answer cannot drift"
    - "One unconditional sidefx:false MEM_GET over a whole chip register block, never a per-register side-effect branch"

key-files:
  created:
    - .claude/mcp/vice/stock-vicii.ts
    - .claude/mcp/vice/stock-vicii.test.ts
  modified: []

key-decisions:
  - "Only the six enumerated internal-only fields carry the {available:false,reason} wrapper; all ~40 readable registers are plain decoded values (D-05-07)"
  - "vice_vicii_get_state decodes only $D000-$D02E; $D018's screen/charset/bitmap pointers are reported as bank-relative offsets (relativeTo: \"vic bank\"), not resolved to absolute addresses -- that requires $DD00, owned by vice_cia_get_state/vice_sprite_get (D-05-10)"

patterns-established:
  - "Chip-state decoder module shape: memGetBody({sidefx:false,...}) -> one MemoryGet send -> response.type/length guards -> pure decode function -> stockAnswer(). Sibling stock-cia.ts (05-04) repeats this shape exactly."

requirements-completed: [DERIV-05]

duration: 25min
completed: 2026-08-17
---

# Phase 5 Plan 3: Stock VIC-II State Decoder Summary

**`vice_vicii_get_state` handler decoding one sidefx:false 47-byte MEM_GET over $D000-$D02E into ~30 named bit-fields, with six internal-only fields honestly reported as `{available:false, reason}` instead of `0`**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-17T17:10:00Z
- **Completed:** 2026-08-17T17:35:19Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `decodeVicii()`: a pure, exhaustively-named decoder over the VIC-II's 47-byte memory-mapped register block, correctly reconstructing the two 9-bit fields that span two registers each (`spriteX[i]` across `$D000+2i`/`$D010` bit `i`, and `rasterLine` across `$D012`/`$D011` bit 7)
- `VICII_UNAVAILABLE_FIELDS`: a frozen registry of the six VIC-II fields the binary monitor's register map cannot express (`rasterIrqLine`, `videoCounter`, `rowCounter`, `badLineCondition`, `borderFlipFlops`, `spriteDmaState`), each with a >40-character reason naming why it is unreadable and what is readable instead
- `handleViciiGetState`: refuses any argument at all (matching the fork's `additionalProperties:false` schema), sends exactly one `sidefx:false` `MEM_GET`, refuses a short read as a wrong answer rather than a partial success, and answers through `stockAnswer()`
- 26 unit tests: full per-field decode correctness against one deliberately-distinguishable 47-byte fixture, the never-zero/never-absent loop over `VICII_UNAVAILABLE_FIELDS`, and the wire-body/guard assertions (sidefx byte, address range, argument refusal, short-read refusal, wrong-response-type refusal, send-rejection conversion)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stock-vicii.ts -- decodeVicii() and handleViciiGetState** - `eb6c8b7` (feat)
2. **Task 2: Create stock-vicii.test.ts -- per-field decode, sidefx wire guard, never-zero assertions** - `ace8ac1` (test)

**Plan metadata:** commit pending (docs: complete plan)

## Complete Answer Key List

For 05-07's `outputSchema` authoring (including the `enum: [false]` pins on the six unavailable fields):

**Top-level (added by `handleViciiGetState` around `decodeVicii()`'s output):**
- `base` (number, `0xd000`), `end` (number, `0xd02e`), `length` (number, `47`), `runState` (string, added by `stockAnswer()`)

**From `decodeVicii()`:**
- `registersHex` (string, 94 lowercase hex chars)
- `spriteX` (`number[8]`), `spriteY` (`number[8]`)
- `spriteEnabled` (`boolean[8]`), `spriteExpandY` (`boolean[8]`), `spritePriorityBehindBackground` (`boolean[8]`), `spriteMulticolour` (`boolean[8]`), `spriteExpandX` (`boolean[8]`)
- `spriteColour` (`number[8]`, 0-15)
- `control1`: `{ raw, yScroll, rows25, screenOn, bitmapMode, extendedBackgroundMode, rasterMsb }`
- `control2`: `{ raw, xScroll, columns40, multicolourMode }`
- `rasterLine` (number, 0-511)
- `lightPenX` (number, 0-255), `lightPenY` (number, 0-255)
- `memorySetup`: `{ raw, screenOffset, charsetOffset, bitmapOffset, relativeTo: "vic bank" }`
- `interruptStatus`: `{ raw, rasterIrq, spriteBackgroundCollisionIrq, spriteSpriteCollisionIrq, lightPenIrq, anyIrqPending }`
- `interruptEnable`: `{ raw, rasterIrqEnabled, spriteBackgroundCollisionIrqEnabled, spriteSpriteCollisionIrqEnabled, lightPenIrqEnabled }`
- `spriteSpriteCollision`: `{ raw, sprites: boolean[8] }`
- `spriteBackgroundCollision`: `{ raw, sprites: boolean[8] }`
- `borderColour`, `backgroundColour`, `extraBackgroundColour1`, `extraBackgroundColour2`, `extraBackgroundColour3`, `spriteMulticolour1`, `spriteMulticolour2` (each number, 0-15)
- `unavailable`: object keyed by the six names below, each `{ available: false, reason: string }`

**The six `unavailable` field names** (05-07's `enum: [false]` schema pins target these): `rasterIrqLine`, `videoCounter`, `rowCounter`, `badLineCondition`, `borderFlipFlops`, `spriteDmaState`.

## Files Created/Modified
- `.claude/mcp/vice/stock-vicii.ts` - `decodeVicii()`, `VICII_UNAVAILABLE_FIELDS`, `handleViciiGetState`, plus `VICII_BASE`/`VICII_END`/`VICII_LENGTH` constants
- `.claude/mcp/vice/stock-vicii.test.ts` - 26 unit tests against the fake-session harness copied from `stock-disassemble.test.ts`

## Decisions Made
None beyond the plan's own D-05-07 and D-05-10, both followed as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npm run test:automated` reported 1 pre-existing failure unrelated to this plan's files: `repo-root.test.ts`'s "path agreement ... the launcher's own repo_root ... agrees with Node's supervisorDir()" test, in `.claude/mcp/vice/repo-root.test.ts`. This is the worktree-path test failure already logged as deferred in the `quick-260817-n6p` quick task (commit `ff87d94`), predates this plan's changes, and touches neither `stock-vicii.ts` nor `stock-vicii.test.ts`. Not auto-fixed (out of scope per the deviation rules' scope boundary).

All of this plan's own gates pass: `npm run typecheck`, `node --test stock-vicii.test.ts` (26/26), `node --test test-gate.test.ts`, `node --test fork-manifest-surface.test.ts`, `node --test hostpath-consumers.test.ts` (EXPECTED_IMPORTERS still exactly five).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`stock-vicii.ts` is a standalone, fully-tested module not yet wired into `stock-dispatch.ts`/`stock-derived.ts`/`tools-manifest.stock.json`/`package.json` `files[]` by design (05-07 owns that wire-up in the same commit that makes it reachable, per Phase 3 Rule 2). No blockers for 05-04 (sibling `stock-cia.ts`, same shape) or 05-07 (wire-up wave).

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*
