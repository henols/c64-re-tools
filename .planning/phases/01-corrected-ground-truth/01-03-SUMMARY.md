---
phase: 01-corrected-ground-truth
plan: 03
subsystem: testing
tags: [vice, binary-monitor, probe, node-net, wire-protocol, selftest]

# Dependency graph
requires:
  - phase: 01-corrected-ground-truth
    provides: corrected protocol facts (RL/CY, event-type count, CPUHISTORY_GET version gate) used to design the new checks
provides:
  - Extended `.claude/mcp/vice/probe-binmon.mjs` covering all of phase success criterion 3 and all five UNVERIFIED items
  - An offline `--selftest` mode proving every wire-body builder and response parser without an emulator
affects: [01-04 (runs the extended probe against real x64sc builds and records docs/phase1-probe-results.md)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Numbered-check pattern extended: each new check is an independently try/catch-wrapped block in main(), logging one aligned result line and recording onto the shared results accumulator"
    - "Offline self-test pattern: synthesise wire buffers in-process and assert builder/parser round-trips with no socket, gated behind --selftest in argv"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/probe-binmon.mjs

key-decisions:
  - "parseDisplayGet derives the buflen field position and pixel-buffer start from infoLen (4 + infoLen, 4 + infoLen + 4) instead of hardcoding 17/21, fixing the defect the ROADMAP flagged in the original check 5"
  - "Check 13 (drive-ROM MEM_SET) is gated on check 11's Drive8TrueEmulation/Drive8Type evidence, not assumption, since silent-zero reads with TDE off would produce a meaningless no-op answer"
  - "Check 13's catch block treats a crashed/closed socket as the recorded answer to UNVERIFIED item 3, and the cleanup EXIT/socket.end() calls tolerate that so the verdict still prints"

patterns-established:
  - "New wire commands are built via small top-level camelCase body builders + parsers, all offline-testable, matching the existing BinMon/encode() single-framing-implementation rule"

requirements-completed: [VERIF-01, VERIF-04]

# Metrics
duration: 12min
completed: 2026-08-12
---

# Phase 1 Plan 03: Extend probe-binmon.mjs Summary

**Extended the binary-monitor probe from 6 checks (0% UNVERIFIED coverage) to 13 checks covering PALETTE_GET, RL/CY conditions, 8-vs-9-byte CHECKPOINT_SET, Drive8TrueEmulation, drive-ROM MEM_SET, and an offline `--selftest` mode that proves every wire encoder/parser without an emulator.**

## Performance

- **Duration:** ~12 min (commits span 15:19:44 to 15:29:43 local)
- **Started:** 2026-08-12T13:17:00Z (approx.)
- **Completed:** 2026-08-12T13:29:43Z
- **Tasks:** 3 completed
- **Files modified:** 1 (`.claude/mcp/vice/probe-binmon.mjs`, 289 -> 870 lines)

## Accomplishments
- `CMD`, `RESP_NAME` extended with all opcodes/event types phase success criterion 3 and the five UNVERIFIED items need (`MEM_SET`, `CHECKPOINT_GET/SET/DELETE`, `CONDITION_SET`, `RESOURCE_GET`, `PALETTE_GET`, `CHECKPOINT_INFO`, `REGISTER_INFO`)
- `BinMon` now captures the response header's observed `api_version` byte and surfaces it on every resolved `send()` result, without touching framing/resync/demux
- Six new request-body builders (`memGetBody`, `memSetBody`, `checkpointSetBody`, `conditionSetBody`, `resourceGetBody`, `paletteGetBody`) and four response parsers (`parsePalette`, `parseResource`, `parseCheckpointInfo`, `parseDisplayGet`), all matching `01-PATTERNS.md`'s cross-checked layouts
- `parseDisplayGet` derives buffer offsets from `infoLen` instead of the old hardcoded 17/21 — closes the defect the ROADMAP explicitly flagged
- An offline `node probe-binmon.mjs --selftest` mode asserting every builder/parser against synthesised buffers, in under a second, with no socket opened
- Checks 7-13 added to `main()`: `PALETTE_GET` entry count, `DISPLAY_GET` pixel-vs-live-`$D020`/`$D021` register, 8-byte-vs-9-byte `CHECKPOINT_SET`, `RL`/`CY` condition acceptance + `LIN`/`CYC` negative control + fire test, `Drive8TrueEmulation`/`Drive8Type`/fallback-name resource probe, `ADVANCE_INSTRUCTIONS` event-pair observation, and the drive-ROM `MEM_SET` probe (sequenced last, crash-tolerant)
- The verdict block now reports every field success criterion 3 names plus every UNVERIFIED item's outcome and the full ordered unsolicited-event sequence, and survives check 13 crashing/closing the socket

## Task Commits

Each task was committed atomically:

1. **Task 1: Add opcode/event tables, api_version capture, wire-body builders/parsers, --selftest** - `a3d9c38` (feat)
2. **Task 2: Add checks 7-12** - `1fab1cd` (feat)
3. **Task 3: Add check 13 (drive-ROM MEM_SET), extend verdict block** - `7b57e7e` (feat)

_Plan metadata commit deferred to orchestrator per worktree execution mode (STATE.md/ROADMAP.md are updated centrally after merge)._

## Files Created/Modified
- `.claude/mcp/vice/probe-binmon.mjs` - Extended from 6 checks / 289 lines to 13 checks / 870 lines: new opcode tables, api_version capture, 6 body builders, 4 response parsers, an offline `--selftest`, checks 7-13, and an extended verdict block

## Decisions Made
- Kept the `parseResource(r)` signature taking the whole `{ errCode, body }` result object (not just `body`) to match `01-PATTERNS.md` exactly, since `OBJECT_MISSING` must be read from `errCode`, not decoded from a body that doesn't exist on that path
- Added one small unenumerated helper, `cpNumBody(checkpointNum)`, for the bare `checkpointNum(u32LE)` body shared by `CHECKPOINT_GET`/`CHECKPOINT_DELETE` — kept separate from the plan's ten offline-tested builders/parsers since it has no independent layout to validate (single u32LE field), and confirmed it does not collide with the Task 1 acceptance grep (which enumerates exactly those ten names)
- Check 10's fire test relaxes the condition to `(RL == $64)` alone (dropping the `CY == $14` clause) specifically to make a hit reachable within one frame on a full-range exec checkpoint, per the plan's explicit guidance, rather than risk the two-clause condition never firing during the probe's ~500ms window

## Deviations from Plan

None — plan executed exactly as written. All body-builder layouts, check ordering, cleanup/delete sequencing, and verdict-block fields match the plan's `<action>` text and `01-PATTERNS.md`'s pre-drafted code verbatim.

## Issues Encountered
- The worktree's HEAD was several commits behind the orchestrator's expected base (`5033cb7`) at agent start, with `.planning/` and other Phase-1 planning artifacts entirely absent from the checked-out tree. Resolved per the `worktree_branch_check` protocol: confirmed the working tree was clean, then `git reset --hard 5033cb7` to the expected base before any file reads. This is expected worktree-provisioning behavior, not a plan deviation.
- `cd .claude/mcp/vice && npm test` (the plan's non-regression backstop) required `npm ci` first since `node_modules/` was absent in the freshly-provisioned worktree (expected — `node_modules` is gitignored project-wide and provisioned by a SessionStart hook that doesn't run inside a worktree agent). Ran `npm --prefix .claude/mcp/vice ci --no-audit --no-fund` using the existing committed lockfile (no new package installed, so this is not a Rule-3-excluded action) before running the suite.
- The full `npm test` run (all `*.test.*` files via `node --test`) hung past a 280s timeout in this sandboxed worktree, with no output beyond `Terminated`. Isolated the cause: running the non-broker/non-e2e subset (`repo-root`, `containerpath`, `vice`, etc.) completes in ~0.4s (16 pass / 3 pre-existing unrelated failures). `grep -rl 'probe-binmon' *.test.*` returns nothing — no test file imports or exercises `probe-binmon.mjs`, confirming it sits outside the test module graph exactly as the plan's own verification note states. The hang is pre-existing broker/e2e test infrastructure behavior (likely requiring real process spawning or a display this sandbox lacks), not a regression introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `.claude/mcp/vice/probe-binmon.mjs` is ready for plan `01-04` to run against real `x64sc` builds (stock 3.9 and the fork's 3.10) and record `docs/phase1-probe-results.md`
- `--selftest` gives `01-04` (and CI, if ever wired in) an automated verification path that needs no emulator
- No blockers: this plan only extends the probe script; it does not run it against a live emulator (that is plan `01-04`'s scope)

---
*Phase: 01-corrected-ground-truth*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/probe-binmon.mjs`
- FOUND: `.planning/phases/01-corrected-ground-truth/01-03-SUMMARY.md`
- FOUND commit: `a3d9c38` (Task 1)
- FOUND commit: `1fab1cd` (Task 2)
- FOUND commit: `7b57e7e` (Task 3)
- FOUND commit: `6f8412e` (Summary)
