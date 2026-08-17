---
phase: 05-skill-critical-derived-tools
plan: 05
subsystem: emulator-derived-tools
tags: [vice, c64, vic-ii, sprites, stock-binary-monitor, derived-tool]

requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler
    provides: withDerivedTool() / STOCK_DERIVED_TOOLS seam, stock-handler.ts's stockAnswer()/convertWireError() converters, the StockSessionHandler contract
provides:
  - stock-sprites.ts -- handleSpriteGet and handleSpriteInspect, unregistered (05-07 wires them into stock-dispatch.ts/stock-derived.ts/tools-manifest.stock.json/package.json in wave 3)
  - ported, fixture-verified VIC bank/screen-base/sprite-data-address geometry (vicBank, vicBankBase, screenBase, spriteDataAddress)
  - renderSpriteAscii/renderSpriteBinary render primitives and the SPRITE_ASCII_LEGEND constant
affects: [05-07 (wave 3 registration), any future skill work touching vice_sprite_get/vice_sprite_inspect]

tech-stack:
  added: []
  patterns:
    - "Ported-not-derived arithmetic: dump-artifacts.mjs's vicBank()/screenBase()/pointer-to-address map copied character-for-character into TypeScript, with the exact same fixture re-asserted in the new test file as a cross-check"
    - "Shared private read helper (readSpriteContext) so two handlers cannot diverge on sidefx or read order -- both call sites are grep-counted in the plan's own acceptance criteria"
    - "Sprite index validated as an explicit integer 0..7, never via stock-address.ts's parseByteCount() (which refuses 0)"
    - "Refusal-by-name for format:'png_base64' before any wire send, citing the SHOT-01..SHOT-05 precedent (D-05-03)"

key-files:
  created:
    - .claude/mcp/vice/stock-sprites.ts
    - .claude/mcp/vice/stock-sprites.test.ts
  modified: []

key-decisions:
  - "SPRITE_ASCII_LEGEND emitted as one string, four mappings separated by ', ', matching the plan's exact required text (not the fork manifest's slightly different 'color'/'multi1' wording -- the plan's own D-05-03 text was authoritative here)"
  - "The $ffff bound checks (pointer-table end, sprite-data-block end) are structurally unreachable given the real 2-bit VIC bank / 8-bit pointer-byte domain (max resolved end is 0xfffe for the data block, exactly 0xffff for the pointer table) -- implemented anyway per the threat model's defense-in-depth requirement (T-05-05-01), and the 'still fits' boundary case (bank 3, pointer 0xff) is asserted directly in the test file rather than an unreachable 'exceeds' case"

requirements-completed: [DERIV-06]

duration: ~45min
completed: 2026-08-17
---

# Phase 5 Plan 5: Sprite Pointer-Chain Read and ASCII Inspector Summary

**`vice_sprite_get`/`vice_sprite_inspect` built as unregistered derived-tool handlers in `stock-sprites.ts`, resolving the VIC bank/screen/pointer chain with dump-artifacts.mjs's fixture-verified arithmetic and rendering native-resolution ASCII/binary sprite grids -- registration deferred to 05-07.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 2 (both new)

## Accomplishments

- Ported `vicBank()`, `vicBankBase()`, `screenBase()` and `spriteDataAddress()` verbatim from `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs`, reproducing the committed fixture `dd00_raw=193 (0xC1), d018_raw=49 (0x31) -> screen_base=35840` exactly (also `vicBankBase(193)===32768`, `spriteDataAddress(193,128)===40960`)
- Built `handleSpriteGet`: resolves bank, screen base, the 8-entry pointer table and every sprite's absolute data address over three `sidefx:false` `MEM_GET` reads, with the sprite index validated as an integer `0..7` (accepting `sprite: 0`, unlike `parseByteCount`)
- Built `handleSpriteInspect`: renders a sprite's 63-byte data block as `ascii` (default) or `binary`, refusing `format: 'png_base64'` by name before any send; multicolour is decided **per sprite** from `$D01C` bit N
- `readSpriteContext()` is the single shared private helper both handlers call for their three common reads, so a future read cannot silently pick up a different `sidefx` flag
- 30 tests in `stock-sprites.test.ts`, all passing, using an address-dispatching fake session (not one shared reply) so a read-order/address-computation bug cannot pass silently

## Task Commits

1. **Task 1: Create stock-sprites.ts with the ported geometry and handleSpriteGet** - `a5b4f8b` (feat)
2. **Task 2: Add the renderers and handleSpriteInspect** - `77a7d75` (feat)
3. **Task 3: Create stock-sprites.test.ts** - `8d6cb18` (test)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/stock-sprites.ts` - `handleSpriteGet`/`handleSpriteInspect`, the four ported geometry helpers, `readSpriteContext()`, `renderSpriteAscii()`/`renderSpriteBinary()`, `SPRITE_ASCII_LEGEND`. NOT registered in `stock-dispatch.ts`/`stock-derived.ts`/`tools-manifest.stock.json`/`package.json` -- 05-07 owns that.
- `.claude/mcp/vice/stock-sprites.test.ts` - 30 tests covering both tools' argument validation, read order/sidefx, short-read refusals, the fixture cross-check, per-sprite multicolour, both render modes, the `png_base64` refusal, the `$ffff` bound, and the character-ROM window note.

## Answer Key Reference (for 05-07's outputSchema and conformance stub)

### `vice_sprite_get`

**Read order (3 reads, all `sidefx: false`):**
1. VIC-II block: `start=0xd000, end=0xd02e` (47 bytes)
2. `$DD00`: `start=0xdd00, end=0xdd00` (1 byte)
3. Sprite pointer table: `start=screenBase+0x3f8, end=screenBase+0x3ff` (8 bytes)

**Answer keys:**
- `sprite` (number, **conditional** -- present only when a single index was requested)
- `vicBank` (number, 0-3)
- `vicBankBase` (number)
- `cia2PortARaw` (number, raw `$DD00` byte)
- `memorySetupRaw` (number, raw `$D018` byte)
- `screenBase` (number)
- `pointerTableAddress` (number)
- `spriteMulticolour1` (number, `$D025 & 0x0f`)
- `spriteMulticolour2` (number, `$D026 & 0x0f`)
- `sprites` (array -- always present; 1 element when `sprite` given, 8 otherwise). Each element:
  - `index`, `enabled` (bool), `x` (number, 9-bit), `y` (number), `colour` (0-15), `multicolour` (bool, per-sprite from `$D01C`), `expandX` (bool), `expandY` (bool), `priorityBehindBackground` (bool), `pointer` (number, raw pointer byte), `dataAddress` (number)
- `count` (number, `sprites.length`)
- `notes` (`string[]`, always present, possibly empty)
- `runState` (added by `stockAnswer()`, never supplied by the handler)

### `vice_sprite_inspect`

**Read order (4 reads, all `sidefx: false`):** the same 3 reads as `vice_sprite_get`, plus:
4. Sprite data block: `start=spriteDataAddress(dd00,pointer), end=start+62` (63 bytes)

**Answer keys:**
- `sprite` (number, the requested index)
- `format` (string, `"ascii"` or `"binary"`)
- `multicolour` (bool, from `$D01C` bit N -- per sprite)
- `enabled`, `x`, `y`, `colour`, `expandX`, `expandY`, `priorityBehindBackground` (same shapes as the `sprites[]` element above)
- `spriteMulticolour1`, `spriteMulticolour2`
- `vicBank` (number)
- `pointer` (number), `dataAddress` (number)
- `width` (24 for hi-res, 12 for multicolour -- D-05-04, native resolution, no scaling)
- `height` (always 21)
- `bytes` (`number[]`, the 63 raw sprite-data bytes)
- `rows` (`string[21]` -- ASCII grid when `format:"ascii"`, binary grid when `format:"binary"`)
- `ascii` (string, **conditional** -- present only for `format:"ascii"`: `rows.join("\n")`)
- `legend` (string, **conditional** -- present only for `format:"ascii"`: exactly `SPRITE_ASCII_LEGEND`)
- `notes` (`string[]`, always present -- carries the ROM-window note when applicable and an expansion note whenever `expandX`/`expandY` is set for the inspected sprite)
- `runState` (added by `stockAnswer()`)

**Exact `SPRITE_ASCII_LEGEND` string:**
```
'.' = transparent (00), '#' = sprite colour (10), '@' = multicolour 1 (01), '%' = multicolour 2 (11)
```

**`format` values:** served = `["ascii", "binary"]` (exported as `SERVED_INSPECT_FORMATS`); refused by name = `["png_base64"]` (exported as `REFUSED_INSPECT_FORMATS`), with refusal text citing `SHOT-01..SHOT-05`.

## Decisions Made

- `SPRITE_ASCII_LEGEND` uses the plan's exact prescribed text (British "colour", four mappings joined by `", "`) rather than copying the fork manifest's own slightly different wording (`'#'=sprite color(10)` vs. `'#' = sprite colour (10)`) -- the plan's D-05-03/task-1 text was treated as the authoritative source since it explicitly dictates the string's construction.
- The `$ffff`-exceeds bound checks on both the pointer-table read and the sprite-data-block read are mathematically unreachable through any legitimate wire byte combination (2-bit VIC bank x 8-bit pointer byte bounds the maximum resolved end to `0xfffe` for the data block and exactly `0xffff` for the pointer table). Implemented per the threat model's defense-in-depth requirement (T-05-05-01) anyway. The test file asserts the actual maximum ("still fits") boundary case (`dd00=0xc0` bank 3, pointer `0xff` -> data end `65534`) rather than an unreachable "exceeds" case, since no combination of real `$DD00`/pointer-table bytes can trigger the refusal branch.

## Deviations from Plan

None - plan executed as written, with the one documented boundary-testing adjustment noted above under Decisions Made (not a code deviation -- the refusal branches exist exactly as specified; only the test's specific numeric scenario was adjusted to a reachable one).

## Issues Encountered

- `npm ci` had not yet been run in this worktree (no `node_modules/`), so `npm run typecheck` initially failed with `tsc: not found`. Ran `npm ci` in `.claude/mcp/vice` before proceeding -- this is normal worktree setup, not a plan issue.
- The full `npm run test:automated` suite has one pre-existing failure unrelated to this plan: `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test, already logged as a deferred pre-existing worktree-path issue in `.planning/STATE.md`'s quick-task log (`ff87d94`). Not touched by this plan's files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `stock-sprites.ts` is ready for 05-07 (wave 3) to register both tools in `stock-dispatch.ts`/`stock-derived.ts`, add the `tools-manifest.stock.json` entries (input schema keeps `sprite`/`sprite_number`/`format`; `format` enum narrowed to `ascii`/`binary` per D-05-03), and add `stock-sprites.ts` to `package.json`'s `files[]` in the same commit that makes it reachable.
- The complete answer key list and exact read order above are provided specifically so 05-07 can write the `outputSchema` and its conformance stub's address-dispatching `sendImpl` directly from this document, without re-reading `stock-sprites.ts` line-by-line.
- No blockers.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-sprites.ts`
- FOUND: `.claude/mcp/vice/stock-sprites.test.ts`
- FOUND commit: `a5b4f8b` (Task 1)
- FOUND commit: `77a7d75` (Task 2)
- FOUND commit: `8d6cb18` (Task 3)
