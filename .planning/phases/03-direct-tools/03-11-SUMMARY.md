---
phase: 03-direct-tools
plan: 11
subsystem: api
tags: [typescript, stock-vice, binary-monitor, petscii, joystick, keyboard]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-01's stock-handler.ts (StockSessionHandler, stockAnswer, convertWireError) and stock-runstate.ts (runStateFor); 03-02's stock-protocol.ts request-body encoders (keyboardFeedBody, joyportSetBody)"
provides:
  - stock-petscii.ts -- the one ASCII<->PETSCII conversion table in this tree (asciiToPetscii, PETSCII_RETURN, StockPetsciiError), exhaustively tested over all 256 input code points
  - stock-input.ts -- handleKeyboardType, handleKeyboardPetscii, handleJoystickSet: the input half of Family D (keyboard + joystick), each a StockSessionHandler ready for 03-12's dispatch-table wiring
affects: [03-12, 03-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side ASCII->PETSCII conversion (charset_p_topetscii()-style case swap), range-checked explicitly rather than a single 0x20 XOR shortcut"
    - "StockSessionHandler modules that already receive a resolved session (no ensureStockSession() call inside the handler itself -- that seam belongs to 03-12's dispatch wiring)"
    - "An [ASSUMED]-labelled bit-mapping constant (JOYPORT_BITS) as the single correction point for unverified wire behaviour, with every answer reporting both the composed value and its decoded bit names for diagnosability"

key-files:
  created:
    - .claude/mcp/vice/stock-petscii.ts
    - .claude/mcp/vice/stock-petscii.test.ts
    - .claude/mcp/vice/stock-input.ts
    - .claude/mcp/vice/stock-input.test.ts
  modified:
    - .claude/mcp/vice/package.json

key-decisions:
  - "asciiToPetscii() checks converted length (== input length, since the mapping is 1:1) before the per-character loop, so an over-255-byte string is refused up front naming the 255-byte limit, rather than partway through conversion"
  - "handleJoystickSet's contradictory-pair refusal (up+down, left+right, center+anything) happens entirely before any client.send() call, matching every other refusal path's zero-wire-traffic-on-refusal discipline"
  - "Added stock-petscii.ts and stock-input.ts to package.json's files array (Rule 2), matching 03-01's precedent of proactively shipping modules not yet reachable from the dispatch table"

patterns-established:
  - "Pattern: a StockSessionHandler that needs no deps beyond the session declares only (args, session) -- TypeScript's structural typing permits fewer parameters than the StockSessionHandler type's own (args, session, deps) signature"

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-14
---

# Phase 3 Plan 11: Input Handlers (Keyboard, Joystick) Summary

**A from-scratch client-side ASCII-to-PETSCII conversion table (no analog existed anywhere in the repo) plus three StockSessionHandlers -- vice_keyboard_type, vice_keyboard_petscii, vice_joystick_set -- with vice_joystick_tap deliberately omitted and its reasoning recorded in the source.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-14T16:55:00Z (approx.)
- **Completed:** 2026-08-14T17:10:00Z (approx.)
- **Tasks:** 3/3 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `stock-petscii.ts`: the one ASCII->PETSCII conversion in this tree, matching VICE's own `charset_p_topetscii()` case-swap rule range by range (never a uniform 0x20 XOR), refusing every unmapped byte -- PETSCII control codes, the 0x00-0x1f/0x7f gaps, non-Latin-1 code units -- by naming the offending index and hex code, never passing one through silently.
- `stock-petscii.test.ts`: exhaustive round-trip over all 256 input code points for both `upper: true` and `upper: false`, computed from an independently-written expectation table (not by calling the implementation), plus explicit named cases, refusal cases, and a boundary sweep across all four range edges (40 tests total in the combined suite).
- `handleKeyboardType`/`handleKeyboardPetscii`: the fork's exact argument names (`text`/`petscii_upper`, `data`) preserved; every answer reports the exact bytes sent (`petsciiHex`) and states the machine is halted until the agent explicitly resumes (D-05).
- `handleJoystickSet`: composes `JOYPORT_SET`'s value from the single `[ASSUMED]`-labelled `JOYPORT_BITS` constant, refuses contradictory direction pairs and invalid ports before any send, and reports the composed `value` plus decoded `valueBits` so a wrong bit mapping is diagnosable from the answer alone.
- `vice_joystick_tap` is deliberately absent -- the reason (an unrequested resume D-05 forbids, plus a timing route stock does not have until Phase 7) is named in the source and matches `docs/stock-vice-parity.md`'s own recorded divergence.

## Task Commits

Each task was committed atomically:

1. **Task 1: The ASCII-to-PETSCII table** - `9c0286e` (feat)
2. **Task 2: Keyboard handlers** - `dcd894f` (feat)
3. **Task 3: Joystick set, and the deliberate absence of joystick tap** - `0a33cd4` (feat)

_Note: Tasks 2 and 3 both touch `stock-input.ts`/`stock-input.test.ts` (a single continuous handler module per the plan's own design); they were staged and committed separately by temporarily isolating Task 3's block (JOYPORT_BITS/handleJoystickSet and its tests), verifying Task 2 alone, committing, then restoring Task 3's block and committing again -- matching 03-02's own precedent for the identical situation._

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/stock-petscii.ts` - `asciiToPetscii()`, `PETSCII_RETURN`, `StockPetsciiError`
- `.claude/mcp/vice/stock-petscii.test.ts` - 17 tests: two exhaustive 256-code-point sweeps (upper true/false), explicit named cases, refusals, boundary sweep
- `.claude/mcp/vice/stock-input.ts` - `handleKeyboardType`, `handleKeyboardPetscii`, `handleJoystickSet`, `JOYPORT_BITS`
- `.claude/mcp/vice/stock-input.test.ts` - 23 tests: DI-stub (fake session, `send` spy) coverage of all three handlers, including zero-sends-on-refusal assertions and the no-`handleJoystickTap`-export check
- `.claude/mcp/vice/package.json` - added `stock-petscii.ts`/`stock-input.ts` to the `files` array (see Deviations)

## Decisions Made

- `asciiToPetscii()`'s length check happens before the per-character conversion loop (the mapping is 1:1, so converted length always equals input length) -- simpler and fails faster than checking after conversion.
- `handleJoystickSet`'s direction-input normalization (trim + lowercase) happens once per array element before validation, so `"UP"`, `" up "`, and `"up"` are all accepted identically.
- Every `StockSessionHandler` in this plan takes only `(args, session)`, omitting the unused `deps` parameter -- TypeScript's structural typing permits this against the `StockSessionHandler` type's full `(args, session, deps)` signature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `stock-petscii.ts`/`stock-input.ts` to `package.json`'s `files` array**
- **Found during:** Task 3 (after `handleJoystickSet` completed the module)
- **Issue:** Neither new file was in the plan's own `files_modified` list for `package.json`, but both are runtime modules a later plan (03-12) will import from the dispatch table. Publishing without this fix would ship a package where `stock-input.ts` (once wired in) resolves to nothing.
- **Fix:** Added both files to `.claude/mcp/vice/package.json`'s `files` array, alongside 03-01's identical precedent for `stock-runstate.ts`/`stock-address.ts`.
- **Files modified:** `.claude/mcp/vice/package.json`
- **Verification:** `node scripts/check-npm-packages.mjs` passes (35 files in the `@henols/vice-mcp` tarball, no leaked test files); JSON validated with `node -e "JSON.parse(...)"`.
- **Committed in:** `0a33cd4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical/shipping-correctness)
**Impact on plan:** Necessary for the published package to work once 03-12 wires these handlers into the dispatch table. No scope creep -- neither file is yet reachable at runtime (no dispatch-table entry references them), but both are the same kind of shipping gap 03-01 already fixed proactively for its own new modules.

## Issues Encountered

- **Pre-existing, environment-only test failure (not caused by this plan):** `repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails in this worktree for the same documented reason as every prior Phase 3 plan (the worktree checkout itself sits under a `.claude/` path segment). Already logged in `deferred-items.md`; not re-logged here per this plan's own environment note.
- **New, unrelated flaky failure found during full-suite verification:** `build-atomic.test.ts`'s "the private temp directory is cleaned up on both the success and the failure path" test fails only when the full `npm run test:automated` suite runs together (reproduced twice), but passes cleanly in isolation (6/6). Confirmed unrelated to this plan's diff (`stock-petscii.ts`/`stock-input.ts` never touch `build.ts` or its test). Logged to `deferred-items.md` (item 3) per the Scope Boundary rule -- not fixed here.
- `npm run test:automated` therefore reports 729 pass / 2 fail / 5 todo in this worktree, both failures being the two pre-existing/unrelated items above; every test in `stock-petscii.test.ts` and `stock-input.test.ts` passes (40 total), and `npm run typecheck` exits 0.

## User Setup Required

None - no external service configuration required.

## Requirements Tracking Note

This plan's frontmatter lists `[DIRECT-07]` as the requirement it contributes
to. **`.planning/REQUIREMENTS.md`'s DIRECT-07 checkbox was deliberately NOT
flipped to complete.** This plan ships the handler layer only (no dispatch
table or manifest wiring -- that is explicitly plans 03-12 and 03-13's
scope, per this plan's own objective). DIRECT-07 ("a user can type text and
drive the joystick on the stock backend") is only true end-to-end once
`vice_keyboard_type`/`vice_keyboard_petscii`/`vice_joystick_set` are
reachable through the actual MCP tool surface, which those later plans
provide. Marking it complete here would be inaccurate ahead of that wiring
landing.

## Next Phase Readiness

- `stock-petscii.ts` and `stock-input.ts` are ready for 03-12 to import
  `handleKeyboardType`/`handleKeyboardPetscii`/`handleJoystickSet` directly
  into `STOCK_DISPATCH_TABLE`, and for 03-13 to add the corresponding
  `tools-manifest.stock.json` entries (`vice_keyboard_type`,
  `vice_keyboard_petscii`, `vice_joystick_set` -- explicitly NOT
  `vice_joystick_tap`).
- `JOYPORT_BITS`'s `[ASSUMED]` label and the probe-debt todo path are both
  present in the source; nothing here claims the mapping as verified.
- No dispatch, manifest, or `stock-dispatch.ts` edits were made in this
  plan's diff, matching the plan's own success criteria and scope boundary.
- No blockers for 03-12/03-13.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

All created/modified files verified present on disk (`stock-petscii.ts`/
`.test.ts`, `stock-input.ts`/`.test.ts`, `package.json`, `deferred-items.md`,
this `03-11-SUMMARY.md`). All three task commit hashes (`9c0286e`,
`dcd894f`, `0a33cd4`) confirmed present via `git log --oneline --all`.
