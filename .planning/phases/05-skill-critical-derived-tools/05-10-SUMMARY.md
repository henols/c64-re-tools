---
phase: 05-skill-critical-derived-tools
plan: 10
subsystem: vice-mcp-stock-backend
tags: [vice-binary-monitor, banks-available, sprites, vicii, cr-02, gap-closure]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-09's resolveRequiredBank() seam in stock-memory.ts and its vice_vicii_get_state/vice_cia_get_state io-bank fix, which this plan's sprite handlers reuse verbatim"
provides:
  - "vice_sprite_get and vice_sprite_inspect resolving the emulator's own io bank for register reads ($D000-$D02E, $DD00) and ram bank for VIC-fetched reads (the sprite pointer table, sprite data), closing CR-02"
  - "a second, independent spriteWindowNote() condition: a resolved address in $D000-$DFFF while VIC bank 3 is selected carries an explicit I/O-window hazard note"
  - "SPRITE_ASCII_LEGEND_HIRES and SPRITE_ASCII_LEGEND_MULTICOLOUR, replacing the single SPRITE_ASCII_LEGEND constant that told an agent a hi-res render could emit '@'/'%' when it never does"
  - "both sprite tools' outputSchema pinning registerBank.name:enum:['io'] and dataBank.name:enum:['ram'], enforced by the conformance harness"
  - "two live regressions against real stock VICE 3.9 proving sprite geometry survives I/O being banked out, and that a live hi-res render carries a legend matching its own alphabet"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A window-hazard note function with two independent conditions (spriteWindowNote(), formerly spriteRomWindowNote()) rather than two separate note functions -- one notes[] array with one shape, matching the existing per-call-site dedupe idiom"
    - "A render-mode legend selected by the same boolean flag that selects the renderer, rather than one shared constant applied regardless of mode -- the legend is a property of the render, not of the tool"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-sprites.ts
    - .claude/mcp/vice/stock-sprites.test.ts
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-live.test.ts

key-decisions:
  - "spriteWindowNote(address, bank, ramBankName) takes the resolved ram bank's own name as a third parameter rather than hardcoding the literal string 'ram' in the I/O-window note's text -- consistent with the fix's own principle of never hardcoding a bank identifier, even in prose"
  - "SpriteContextError.result widened from StockErrorResult to StockToolResult -- resolveRequiredBank()'s failure branch is typed against the wider StockToolResult union (even though it always constructs an error via isErrorText()), so narrowing SpriteContextError to the error-only type produced a real type error, not a false positive"
  - "SPRITE_ASCII_LEGEND is deleted outright, not kept as a deprecated alias -- repo-wide grep confirmed its only consumers were this file and its own test, and an alias would invite the next caller to attach the wrong legend again"

requirements-completed: [DERIV-06]

# Metrics
duration: ~25min
completed: 2026-08-17
---

# Phase 05 Plan 10: CR-02 io/ram-bank fix and legend split for vice_sprite_get/vice_sprite_inspect Summary

**vice_sprite_get and vice_sprite_inspect now resolve the emulator's own `io` bank for register reads and `ram` bank for VIC-fetched reads instead of hardcoding bank 0x0000, and each sprite render carries its own matching ASCII legend instead of one shared constant that lied about hi-res renders.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-17T22:51:22+02:00 (Task 1 commit)
- **Completed:** 2026-08-17T22:56:47+02:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments

- Closed CR-02: `readSpriteContext()` in `stock-sprites.ts` now resolves the emulator's own `io` bank (VIC-II block, `$DD00`) and `ram` bank (sprite pointer table) via `resolveRequiredBank()` before its first send, refusing with zero `MEM_GET` sends if either name is absent from the catalog. `handleSpriteInspect`'s sprite-data read uses the resolved `ram` id too. Both answers now report `registerBank {id,name:"io"}` and `dataBank {id,name:"ram"}`, pinned in `tools-manifest.stock.json` with `enum` pins.
- `spriteRomWindowNote()` renamed to `spriteWindowNote()` and given a second, independent condition: a resolved address in `$D000-$DFFF` while VIC bank 3 is selected now emits an explicit I/O-window hazard note (the existing bank-0/2 character-ROM note is unchanged).
- Split the single `SPRITE_ASCII_LEGEND` constant into `SPRITE_ASCII_LEGEND_HIRES` and `SPRITE_ASCII_LEGEND_MULTICOLOUR`, selected by the same `multicolour` flag that selects the renderer -- closing the live-reproduced defect where a hi-res render's answer claimed `'@'`/`'%'` exist and that `'#'` means a two-bit code.
- Proved both fixes live against a real, genuinely unpatched `/usr/bin/x64sc` (VICE 3.9): sprite geometry (`vicBank`, `screenBase`, `pointerTableAddress`, `cia2PortARaw`) is identical with `$01=$37` and `$01=$34`, with a non-vacuity control proving the banking write actually took effect; and sprite 0's live hi-res render carries a legend naming only `'.'`/`'#'`, cross-checked against every character the render actually emitted.

## Task Commits

1. **Task 1: Read registers through the io bank and VIC-fetched memory through the ram bank, and add the bank-3 I/O-window note** - `409073e` (fix)
2. **Task 2: Split the ASCII legend into hi-res and multicolour constants selected on the per-sprite flag** - `3b4b90b` (fix)
3. **Task 3: Live CR-02 and legend regressions against real stock VICE** - `08e6005` (test)

_No plan-metadata commit yet -- this is a worktree-isolated executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `.claude/mcp/vice/stock-sprites.ts` - `readSpriteContext()` resolves `io`/`ram` via `resolveRequiredBank()`, no literal `bank:` id remains; `spriteWindowNote()` (renamed from `spriteRomWindowNote()`) gains the bank-3 I/O-window condition; both answers report `registerBank`/`dataBank`; `SPRITE_ASCII_LEGEND_HIRES`/`SPRITE_ASCII_LEGEND_MULTICOLOUR` replace the single legend constant, selected by `multicolour`
- `.claude/mcp/vice/stock-sprites.test.ts` - `banksAvailableReply()`/`noRamBanksAvailableReply()` helpers; per-read wire-body bank assertions (io=3 for register reads, ram=1 for VIC-fetched reads); single-`BanksAvailable`-per-call assertions; the bank-3 I/O-window note case; the no-`ram` refusal case; `registerBank`/`dataBank` answer-shape assertions; the rewritten hi-res/multicolour legend assertions plus a cross-check against the characters each render actually emits
- `.claude/mcp/vice/tools-manifest.stock.json` - `vice_sprite_get`/`vice_sprite_inspect` `outputSchema` gain `registerBank`/`dataBank` with `enum:["io"]`/`enum:["ram"]` pins, both listed in `required`; no other entry touched
- `.claude/mcp/vice/stock-live.test.ts` - two new opt-in, manual-only cases: Case D (sprite geometry survives `$01=$34` with a non-vacuity control) and Case E (the live hi-res legend names only `'.'`/`'#'`)

## Decisions Made

- `spriteWindowNote()` takes the resolved `ram` bank's own name as a parameter rather than hardcoding the literal string `"ram"` in the note's prose -- matches the fix's own principle of never hardcoding a bank identifier, even in a human-readable message.
- `SpriteContextError.result`'s type was widened from `StockErrorResult` to `StockToolResult` to match `resolveRequiredBank()`'s actual failure-branch type (a real type error surfaced by `tsc`, not a stylistic choice).
- `SPRITE_ASCII_LEGEND` was deleted outright per `plan_decision_D-05-17`, confirmed by a repo-wide grep that its only consumers were this file and its own test.

## Deviations from Plan

None - plan executed exactly as written. The only adjustment was a type-level widening (`SpriteContextError.result: StockErrorResult` → `StockToolResult`) required to satisfy `tsc --noEmit`, which is a direct, in-scope consequence of consuming `resolveRequiredBank()`'s declared return type rather than a deviation from the plan's intent.

## Issues Encountered

None beyond the type-widening noted above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-02 is closed for `vice_sprite_get`/`vice_sprite_inspect`. Combined with 05-09's `vice_vicii_get_state`/`vice_cia_get_state` fix, every stock derived tool that reads VIC-II/CIA-adjacent state now resolves its bank through the emulator's own catalog -- no literal bank id remains anywhere in `stock-sprites.ts`, `stock-vicii.ts`, or `stock-cia.ts` (05-12, running after this plan in the same wave, applies the same discipline to `stock-cia.ts`'s remaining scope).
- All baseline gates confirmed unmoved: stock manifest 34 tools, fork manifest 62 tools, `package.json` `files[]` 44, `node scripts/check-skill-tool-coverage.mjs` exit 0.
- `npm run test:automated`: 1373 pass / 1 fail (pre-existing, unrelated -- `repo-root.test.ts`'s worktree-path assertion, logged in prior summaries) / 5 todo / 1379 total -- pass count rose by 2 from 05-09's baseline (1377), matching the new cases this plan added; `stock-live.test.ts` stays in `MANUAL_ONLY_TESTS` and contributes nothing to this count.
- Both new live cases (D and E) confirmed passing against `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc`, and the whole file confirmed all-skipped with 0 failures when run with no env var.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 4 declared files_modified plus this SUMMARY.md verified present on disk. All 4 commit hashes (`409073e`, `3b4b90b`, `08e6005`, `54b37c4`) verified present in `git log --oneline --all`.
