---
phase: 05-skill-critical-derived-tools
plan: 09
subsystem: vice-mcp-stock-backend
tags: [vice-binary-monitor, banks-available, vicii, cia, gap-closure, cr-01]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-03/05-04's original vice_vicii_get_state/vice_cia_get_state derived-tool implementations, and 05-07's manifest/conformance-harness scaffolding this plan extends"
provides:
  - "resolveRequiredBank() -- the one exported seam in stock-memory.ts that turns a required bank NAME into the emulator's own wire bank id, or refuses"
  - "vice_vicii_get_state and vice_cia_get_state reading their register blocks through the resolved io bank instead of hardcoded bank 0x0000"
  - "both tools' outputSchema pinning bank.name with enum:[\"io\"], enforced by the conformance harness"
  - "the live CR-01 regression proving true chip registers survive I/O being banked out on real stock VICE 3.9"
affects: [05-10, 05-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mandatory-name bank resolution as a distinct exported function (resolveRequiredBank) sitting beside the existing omitted-means-0x0000 resolveBank(), rather than widening one function's contract to cover two different failure modes"
    - "A live test that first establishes its own precondition empirically (ensureBooted()) rather than assuming a documented behaviour holds under a different connection flow than the one that produced the documentation"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-memory.ts
    - .claude/mcp/vice/stock-memory.test.ts
    - .claude/mcp/vice/stock-vicii.ts
    - .claude/mcp/vice/stock-vicii.test.ts
    - .claude/mcp/vice/stock-cia.ts
    - .claude/mcp/vice/stock-cia.test.ts
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/stock-live.test.ts

key-decisions:
  - "resolveRequiredBank(toolName, bankName, session) is a second, differently-contracted export -- not a widened resolveBank() -- because an omitted bank correctly defaults to 0x0000 for vice_memory_read/write (the caller asked for the CPU view) but must REFUSE for a chip-state read (the caller needs the actual chip registers)"
  - "CIA's bank resolution is hoisted outside the per-chip loop so a both-chips call sends exactly one BanksAvailable, matching the existing per-session cache discipline"
  - "The live test's own connect flow halts the machine at/near the reset vector before the KERNAL has run -- discovered empirically, not assumed from the plan's cited evidence -- so the live regression needed an explicit boot step (hard reset + run_after:true + wait + pause) before the KERNAL-default assertions could hold"

requirements-completed: [DERIV-05]

# Metrics
duration: 17min
completed: 2026-08-17
---

# Phase 05 Plan 09: CR-01 io-bank fix for vice_vicii_get_state/vice_cia_get_state Summary

**vice_vicii_get_state and vice_cia_get_state now resolve the emulator's own `io` bank via a new resolveRequiredBank() seam instead of hardcoding bank 0x0000, closing the defect where I/O banked out via `$01` silently returned RAM as chip registers.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-08-17T22:18:00+02:00 (Task 1 commit)
- **Completed:** 2026-08-17T22:34:37+02:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Added `resolveRequiredBank()` to `stock-memory.ts` -- the one exported seam that turns a required bank name into the emulator's own wire bank id, refusing (never falling back to a hardcoded id) when the emulator's `BANKS_AVAILABLE` catalog has no matching name. The existing private `resolveBank()` now delegates its string branch to it.
- `stock-vicii.ts` and `stock-cia.ts` resolve `"io"` before every `MEM_GET`, pass the resolved id on the wire, and report `bank:{id,name:"io"}` on the answer. CIA's resolution is hoisted outside the per-chip loop so a both-chips call resolves once.
- `tools-manifest.stock.json` pins `bank.name` with `enum:["io"]` and requires `bank` on both tools' `outputSchema`, so the conformance harness fails a regression that reads a different view and honestly reports it.
- Proved the fix live against a real, genuinely unpatched `/usr/bin/x64sc` (VICE 3.9): with `$01=$34` (I/O banked out), `vice_vicii_get_state` still reports `borderColour:14`/`backgroundColour:6` and `vice_cia_get_state` still reports CIA1 `portBDirection.raw:0` -- values the RAM underneath cannot produce -- with an independent non-vacuity control proving the banking write actually took effect.

## Task Commits

1. **Task 1: Export resolveRequiredBank() from stock-memory.ts as the one required-bank seam** - `fcd0eca` (feat)
2. **Task 2: Read VIC-II and CIA registers through the resolved io bank, report it, and pin it in the manifest** - `9803f99` (fix)
3. **Task 3: Live CR-01 regression against real stock VICE with I/O banked out** - `d0d9f7c` (test)

_No plan-metadata commit yet -- this is a worktree-isolated executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `.claude/mcp/vice/stock-memory.ts` - adds `resolveRequiredBank()`; the private `resolveBank()` now delegates its string branch to it
- `.claude/mcp/vice/stock-memory.test.ts` - covers the io hit, case-insensitive hit, no-io refusal wording, and single-fetch-per-session cache
- `.claude/mcp/vice/stock-vicii.ts` - resolves `"io"` before the single `MEM_GET`, passes the resolved id, reports `bank:{id,name}`
- `.claude/mcp/vice/stock-vicii.test.ts` - wire-body bank byte, call order (BanksAvailable before MemoryGet), answer shape, no-io refusal
- `.claude/mcp/vice/stock-cia.ts` - resolves `"io"` once outside the per-chip loop, passes the resolved id into each chip's `MEM_GET`, reports top-level `bank:{id,name}`
- `.claude/mcp/vice/stock-cia.test.ts` - same coverage as stock-vicii.test.ts plus the CIA-specific single-BanksAvailable/two-MemoryGet both-chips case
- `.claude/mcp/vice/tools-manifest.stock.json` - adds `bank:{id,name}` (`name` pinned `enum:["io"]`) to both tools' `outputSchema.properties` and `required`
- `.claude/mcp/vice/stock-dispatch.test.ts` - `chipStateSendImpl()` now answers `BanksAvailable` (io=3, non-zero); both conformance cases assert `bank.name==="io"`/`bank.id===3` through the real dispatch path
- `.claude/mcp/vice/stock-live.test.ts` - three new opt-in, manual-only cases: default-banking baseline, the `$01=$34` regression with a non-vacuity control, and a reachability check that the live catalog names both `io` and `ram`

## Decisions Made

- `resolveRequiredBank()` is a second export beside the existing `resolveBank()`, not a widened contract on the same function -- `vice_memory_read`/`write`'s "omitted bank means 0x0000" default is correct for those tools and would be catastrophic for a chip-state read, so the two behaviours needed two names, matching `plan_decision_D-05-14`.
- CIA's bank resolution is hoisted outside the per-chip `for` loop (`plan_decision_D-05-14`/task instructions) so a `{}` (both-chips) call sends exactly one `BanksAvailable`, not two.
- The live test's boot sequence needed an explicit fix beyond what the plan's `<read_first>` evidence assumed -- see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The live test's own connection flow does not produce a "booted machine" by the time Case A/B run, so the plan's KERNAL-default assertions (borderColour:14/backgroundColour:6/portBDirection.raw:0) failed against a real emulator until an explicit boot step was added**
- **Found during:** Task 3, first live run of the new cases
- **Issue:** `stock-live.test.ts`'s shared `before()` hook connects while the binary monitor halts the machine on the very first inbound byte -- at/near the reset vector, before the KERNAL has ever set `$D020`/`$D021`. Task 1/2's pre-existing register probes never advance execution either (D-05 forbids an unrequested resume). The plan's cited evidence (`05-REVIEW.md` lines 90-153, `fe`/`ff` readings implying `borderColour:14`) was captured through a different flow that had already let the machine run. Against this file's own connection flow, `$D020` read `0xf0` (repeating "f0" pattern across the whole $D011-$D02E block) both before and after the `$01=$34` write -- a plausible-looking but wrong empirical baseline that would have made every KERNAL-default assertion fail, not because the fix is wrong, but because the test's own precondition never held.
- **Fix:** Added `ensureBooted()`: a hard reset with `run_after:true`, a real-time wait (empirically tuned to 3s against this build -- 1.5s was insufficient, confirmed via a standalone debug script that polled `runState` every 500ms and verified `$D020` reached `0xfe` only after ~3s of run time), then `vice_execution_pause()` and `waitForStoppedRunState()`. Called once, idempotently, from both Case A and Case B (Case B's own `$01` restore invariant requires the boot happen before, not between, the two cases).
- **Files modified:** `.claude/mcp/vice/stock-live.test.ts`
- **Verification:** Re-ran `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts` -- all 5 cases (2 pre-existing + 3 new) pass; `borderColour:14`, `backgroundColour:6`, `portBDirection.raw:0`, `timerAControl.raw:1` (not `0xff`) all confirmed live.
- **Committed in:** `d0d9f7c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, discovered only by actually running the live test against real hardware rather than trusting the plan's cited evidence)
**Impact on plan:** Necessary to make the live regression assert anything meaningful; without it every new live assertion would have failed for a reason unrelated to CR-01's actual fix. No scope creep -- the fix is entirely inside the new test file's own setup.

## Issues Encountered

- `.claude/mcp/vice/node_modules` was not provisioned in this worktree (the `SessionStart` hook that normally runs `npm ci` had not fired for this worktree). Ran `npm ci` manually before the first `typecheck`/test invocation; no code change, not a deviation.
- One pre-existing, unrelated test failure surfaces in `npm run test:automated`: `repo-root.test.ts`'s "path agreement ... the agreed path is not under .claude" fails because this worktree's own path (`.claude/worktrees/agent-.../`) contains a `.claude` segment. This is a known, previously-logged environmental issue (see `ff87d94 docs(quick-260817-n6p): log pre-existing worktree-path test failure as deferred` and `5499f10 docs(04-01): log pre-existing worktree-path test failure as deferred` in git history) -- unrelated to this plan's changes and not fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01 is closed for `vice_vicii_get_state`/`vice_cia_get_state`. `05-10` (wave 6) still owns the sprite half of the same defect in `stock-sprites.ts` and the sprite entries in `tools-manifest.stock.json` -- untouched by this plan, as scoped.
- All baseline gates confirmed unmoved: stock manifest 34 tools, fork manifest 62 tools, `package.json` `files[]` 44, `STOCK_DERIVED_TOOLS` size 9, `node scripts/check-skill-tool-coverage.mjs` exit 0.
- `npm run test:automated`: 1360 pass / 1 fail (pre-existing, unrelated) / 5 todo (unchanged) / 1366 total -- pass count rose by the cases this plan added, as the plan's "Baseline gates this plan moves" section predicted.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*
