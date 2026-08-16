---
phase: 03-direct-tools
plan: 16
subsystem: vice-mcp-stock-backend
tags: [vice, binary-monitor, registers, stock-vice, live-verification, gap-closure]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-14's sizeBits fix to stock-registers.ts's width check, and the stock-dispatch.test.ts conformance-session shape this plan's real client substitutes into"
provides:
  - "stock-live.test.ts: an opt-in, default-skip, repeatable live gate that spawns a real stock VICE binary monitor and dispatches through the real dispatchStock() seam"
  - "Live evidence, run against genuine stock VICE 3.9 (/usr/bin/x64sc), that vice_registers_set writes a real register and echoes back the value the emulator confirmed (DIRECT-02)"
  - "Live evidence that the individual-flag-bit refusal path (N/V/B/D/I/Z/C) fires for all seven flags, each naming the connected build's real status register (\"FL\") and its own bit position -- the path 03-UAT.md test 5 never reached"
affects: [03-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in live test files compute SKIP_REASON once and pass it through node:test's own `{ skip }` option on every test -- never a hand-rolled early return, which would report a false PASS rather than a SKIP"
    - "A live harness builds the SAME StockConnectSession/StockDispatchDeps shape the offline conformance harness (stock-dispatch.test.ts's buildConformanceSession()/buildConformanceDeps()) uses, substituting a REAL ViceMonitorClient/socket for the stub -- so the exact same dispatch path (dispatchStock()) is exercised both offline and live, never a parallel dispatch mechanism"
    - "Ephemeral-port + bounded-retry connect (not a single long-timeout attempt) for a spawned emulator that needs a moment to bind its listening socket"

key-files:
  created:
    - .claude/mcp/vice/stock-live.test.ts
  modified:
    - .claude/mcp/vice/test-gate.mjs
    - .claude/mcp/vice/test-gate.test.ts

key-decisions:
  - "stock-live.test.ts owns its own spawned emulator process (never a broker-managed instance) -- ensureLease/connect are stubbed to hand back the live coordinates directly, exactly as stock-dispatch.test.ts's conformance harness stubs them, but with a real client substituted for the stub client"
  - "Registered as the fourth entry in test-gate.mjs's MANUAL_ONLY_TESTS (the one list), not a parallel list, per that file's own WHAT NOT TO DO"
  - "Duplicated FLAG_BIT_POSITIONS/STATUS_REGISTER_CANDIDATES locally in the test rather than importing stock-registers.ts's own tables, so the live assertions prove the SHIPPED behaviour against an independent expectation, not merely that the module agrees with itself"

requirements-completed: [DIRECT-02, DIRECT-09]

# Metrics
duration: ~35min
completed: 2026-08-16
---

# Phase 03 Plan 16: Live re-verification of vice_registers_set and the flag-bit refusal Summary

**A committed, repeatable, default-skip live gate (`stock-live.test.ts`) proves against genuine stock VICE 3.9 that `vice_registers_set` now writes a real register and echoes back the emulator-confirmed value, and that the flag-bit refusal fires live for all seven status flags -- the exact evidence 03-UAT.md test 5 could not produce because every call there died on the bits-vs-bytes width bug before reaching either path.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-16T19:55 (approx)
- **Completed:** 2026-08-16T20:30 (approx)
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built `stock-live.test.ts`: spawns `/usr/bin/x64sc -binarymonitor` on an ephemeral 127.0.0.1 port with a scratch `XDG_CONFIG_HOME`, connects a real `ViceMonitorClient` with a bounded retry loop, and dispatches every assertion through the real `dispatchStock()` seam via a stubbed `ensureLease`/`connect` pair that hands back the live coordinates -- never a handler called directly.
- Default-skip verified: `node --test stock-live.test.ts` with `VICE_LIVE_STOCK_BIN` unset reports 2/2 SKIP, zero fail, immediate exit (~300ms), naming the env var and the fork-shadow risk in the skip reason.
- **Ran the live check for real** against the genuine, unpatched stock binary at `/usr/bin/x64sc` (VICE 3.9, confirmed distinct from the fork at `/usr/local/bin/x64sc`): `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc timeout 180 node --test stock-live.test.ts` -> **exit 0, 2 pass, 0 fail, 0 skipped**.
- Live catalog observed (10 registers, matching 03-UAT.md test 5 exactly): `PC(id3,16) A(id0,8) X(id1,8) Y(id2,8) SP(id4,8) 00(id55,8) 01(id56,8) FL(id5,8) LIN(id53,16) CYC(id54,16)`.
- **DIRECT-02, live:** `vice_registers_set({register:"A", value:42})` -> `{"register":"A","id":0,"requestedValue":42,"observedValue":42,"memspace":"main","runState":"stopped"}` (pre-write value was 85), independently confirmed via a follow-up `vice_registers_get` showing `A === 42`.
- 16-bit path: `vice_registers_set({register:"PC", value:0xC000})` -> `observedValue:49152`.
- Range refusal: `value:256` for `A` refused with `"...valid range 0..0xff"`, and `A` still read 42 afterward (no wire write reached the emulator).
- **The never-reached path, live:** the flag-bit refusal fired for all seven flags (N, V, B, D, I, Z, C), each naming the live status register `"FL"` and its own bit position (7, 6, 4, 3, 2, 1, 0 respectively) -- verified as a loop over all seven, not two sampled cases, per the plan's gap-closure directive.
- Every live answer's `runState` was `"stopped"`.
- `pgrep -af x64sc` after the run showed no orphaned process from this test (the pre-existing fork-backend instance at PID 119885 was the only survivor, unrelated to this test).
- Registered `stock-live.test.ts` as the fourth `MANUAL_ONLY_TESTS` entry in `test-gate.mjs` and updated `test-gate.test.ts`'s exact-membership assertion from three files to four; confirmed `npm run test:automated` never runs this file.

## Task Commits

Each task was committed atomically:

1. **Task 1: An opt-in live harness that spawns a real stock VICE and dispatches through the real seam** - `ed80769` (feat)
2. **Task 2: Live re-verification of the register write and the flag-bit refusal** - `7286da9` (test)

**Plan metadata:** (this commit, made by the orchestrator after wave completion)

## Files Created/Modified

- `.claude/mcp/vice/stock-live.test.ts` (created) - opt-in, default-skip live harness: lifecycle (spawn, ephemeral port, retry-connect, teardown), two tests (Task 1's width-catalog smoke test, Task 2's full round-trip/range-refusal/flag-bit-refusal/runstate assertions)
- `.claude/mcp/vice/test-gate.mjs` - `MANUAL_ONLY_TESTS` extended to four entries (`stock-live.test.ts` added), header comment updated
- `.claude/mcp/vice/test-gate.test.ts` - drift guard's exact-membership assertion and test name updated from three files to four

## Decisions Made

- The live session's `versionQuad` field is set to the literal `"unknown"` rather than parsed from a handshake (this harness never runs `stockConnect()`'s own handshake -- it builds the session directly from a raw connected `ViceMonitorClient`, matching the plan's own "build the session exactly as buildConformanceSession() does but with the real client" instruction). Nothing in this plan's assertions reads `versionQuad`, so this is inert; documented here rather than left unexplained in the code.
- `waitForStoppedRunState()` polls the run-state tracker with a bounded 5s deadline rather than asserting `runState` is `"stopped"` from a single snapshot immediately after connect, because the binary monitor's STOPPED event is asynchronous relative to connect. In practice the live run showed `runState: "stopped"` on every answer from the very first call, so the poll resolved immediately every time it was exercised.

## Deviations from Plan

None affecting scope or correctness - plan executed as written.

## Issues Encountered

- `npm run test:automated` (955 tests, run as part of this plan's own regression check, not required by the plan's own `<verification>` list) reports one pre-existing failure unrelated to this plan: `repo-root.test.ts`'s "path agreement... is not under .claude" check fails because this worktree lives at `.claude/worktrees/agent-ab884c3f6eed6482e`, which is itself under `.claude` -- the same environmental artifact of the parallel-worktree execution setup already documented in `03-14-SUMMARY.md`'s "Issues Encountered", not a regression from any file this plan touches (`stock-live.test.ts`, `test-gate.mjs`, `test-gate.test.ts`). Left unfixed per the scope boundary rule.
- `node_modules` was absent at the start of this worktree (gitignored); ran `npm ci --prefer-offline` to enable `tsc`/`node --test`. Does not affect the committed source tree.
- A side effect of importing `vice-broker-client.ts` (transitively, via `install-resources.ts`'s fire-once `ensureResourcesInstalled()` wired from `repo-root.ts`'s module body) printed host-launcher-instructions banner lines to stdout the first time any test in this file's process imported that chain. This is pre-existing, process-wide behavior shared by every test file that imports the same chain (confirmed unrelated to this plan's own changes) and writes only to the worktree's own gitignored `tools/` directory.

## User Setup Required

None - no external service configuration required. The live check requires a real stock VICE binary at the path named by `VICE_LIVE_STOCK_BIN` (defaulting to `/usr/bin/x64sc`), which this environment already had.

## Next Phase Readiness

- DIRECT-02 and DIRECT-09 are now backed by live evidence against genuine stock VICE 3.9, closing the gap 03-UAT.md test 5 identified and 03-14 could only close synthetically.
- `stock-live.test.ts` is a standing, repeatable gate: any future regression to the width-derived range check or the flag-bit refusal table can be caught live with one env var (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc`), without re-deriving a probe script.
- No known stubs, threat-surface additions beyond the plan's own `<threat_model>` (all four T-03-16-* items were addressed exactly as planned: 127.0.0.1-only bind, guaranteed teardown via SIGKILL + disconnect + scratch-dir removal, absolute-path binary naming, and per-run `XDG_CONFIG_HOME` isolation), or open follow-ups from this plan.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-16*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-live.test.ts`
- FOUND commit: `ed80769` (feat - Task 1)
- FOUND commit: `7286da9` (test - Task 2)
- FOUND: `.planning/phases/03-direct-tools/03-16-SUMMARY.md`
