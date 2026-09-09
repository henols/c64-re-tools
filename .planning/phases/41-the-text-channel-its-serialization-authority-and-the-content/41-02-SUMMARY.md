---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 02
subsystem: protocol
tags: [vice, channel-lock, mutex, serialization, text-monitor, binary-monitor, stock-backend, chan-04]

requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: "plan 41-01's text-protocol.ts (TextMonitorClient, command()), text-connect.ts (textConnect()/textDisconnect()) and the remoteMonitorPort plumbing this plan's live tests dial through"
provides:
  - "channel-lock.ts: acquireChannelLock()/tryAcquireChannelLock(), the FIFO queue, the {channel, operation, grantId, heldSince} holder record and channelLockRefusalMessage() -- the ONE cross-channel serialization authority Phase 39's go verdict (rule R15) selected"
  - "stock-dispatch.ts: withChannelLockHeld() wraps withStockSession() and withDerivedTool()'s needsSession:true branch, spanning resume -> wait -> observe for vice_run_until and the reproducible-run path without re-cutting either wait"
  - "text-protocol.ts: withTextChannelLock(), the text channel's own acquire seam; TextMonitorClient.command() now refuses unless it is held"
  - "Live-measured (criterion 3): identical checkpoint id/address/enabled-state visibility from both channels, and a text command attempted during a held binary wait is refused with the holder-naming refusal while the wait completes normally"
affects: [41-03, 41-04, 41-05, 41-06]

actuals:
  tokens: 19800
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Hand-built async mutex with a holder record (channel, operation, grantId, heldSince) rather than a generic library mutex -- the record is what makes contention readable to a future diagnostic (vice_diagnose, plan 41-04)"
    - "Single admission path (admit()) reached by both the immediate-grant branch and the FIFO-enqueue branch, with synchronous release-to-next-waiter handoff (no setTimeout) so timer scheduling cannot perturb arrival order"
    - "Lock acquired around the whole delegated HANDLER call, never around individual wire commands or around session-acquisition -- the critical section spans resume -> wait -> observe"
    - "Test-only StockDispatchDeps.channelLockTimeoutMs / WithTextChannelLockOptions.timeoutMs overrides let tests observe a ChannelLockTimeoutError without waiting out the real ~630s default"

key-files:
  created:
    - src/mcp/vice/channel-lock.ts
    - src/mcp/vice/channel-lock.test.ts
  modified:
    - src/mcp/vice/package.json
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/text-monitor-live.test.ts

key-decisions:
  - "CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS = 630000ms (RUN_UNTIL_MAX_TIMEOUT_MS + 30000ms margin), derived in a prose comment rather than imported -- channel-lock.ts never imports stock-run-until.ts (that would invert the dependency); channel-lock.test.ts cross-imports both to assert the two-directional inequality."
  - "withDerivedTool's needsSession:false branch never acquires the lock at all -- a pure client-side derived tool that never touches the wire must not block a real halting operation for no reason. vice_diagnose (also needsSession:false) will take the lock with tryAcquireChannelLock() in plan 41-04 instead, deliberately, so diagnosing contention never queues behind the holder it is diagnosing."
  - "Rule 3 fix: text-protocol.test.ts's and text-monitor-live.test.ts's existing real command() calls (11 + 2 sites) needed wrapping in withTextChannelLock() -- the plan's own required refusal (command() refuses unless the text channel holds the lock) would otherwise break every pre-existing passing test that called command() directly. Not in the plan's files_modified list, but required by the plan's own <verify> line demanding these files stay green."
  - "criterion 3's live test reads the checkpoint-hit announcement from a COLLECTED array of every passively-arriving text-channel banner, not just the first -- MEASURED live that intermediate binary-channel commands (vice_checkpoint_add, vice_checkpoint_list) each push their OWN bare-prompt halt announcement to the text console before the checkpoint's own richer \"#N (Stop on exec ADDR)\" announcement arrives."

requirements-completed: [CHAN-04]

coverage:
  - id: D1
    description: "One in-process async mutex (channel-lock.ts) serializes every halt-taking operation on both channels, with a FIFO queue, holder record, and refusal text (CHAN-04)"
    requirement: "CHAN-04"
    verification:
      - kind: unit
        ref: "channel-lock.test.ts (16 cases: FIFO-vs-LIFO ordering, same-channel non-reentrancy, timeout+holder-naming, release-on-throw, idempotent/stale-handle release, refusal vocabulary, the two-directional RUN_UNTIL_MAX_TIMEOUT_MS bound guard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both channels' halting operations are routed through the mutex at their existing adapter seams (withStockSession/withDerivedTool on binary, withTextChannelLock on text), with the needsSession:false branch exempted"
    requirement: "CHAN-04"
    verification:
      - kind: unit
        ref: "stock-dispatch.test.ts#CHAN-04: withStockSession and withDerivedTool's needsSession:true branch both reach acquireChannelLock; the needsSession:false branch does not"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#CHAN-04: dispatching vice_symbols_lookup (needsSession:false) through the REAL dispatch table leaves currentChannelLockHolder() null throughout"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#CHAN-04: a handler that throws leaves currentChannelLockHolder() null after dispatch returns"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#CHAN-04: a second concurrent dispatch of a session-taking tool with a 1ms channelLockTimeoutMs override is refused with channelLockRefusalMessage()'s own wording"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two existing binary-side wait-path invariants (exactly one resume per wait, poll on hit_count) hold unchanged -- proven by stock-run-until.ts/stock-reproducible-run.ts staying byte-identical"
    requirement: "CHAN-04"
    verification:
      - kind: other
        ref: "git diff --name-only 50d3b6d3 b4b6a758 -- src/mcp/vice/stock-run-until.ts src/mcp/vice/stock-reproducible-run.ts -- empty (untouched)"
        status: pass
      - kind: unit
        ref: "node --test stock-run-until.test.ts stock-reproducible-run.test.ts -- 57/57 pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Identical checkpoint id/address/enabled-state visibility from both channels, and interleaving refusal during a held binary wait, both measured live against genuine stock VICE 3.9"
    requirement: "CHAN-04"
    verification:
      - kind: e2e
        ref: "text-monitor-live.test.ts#text-monitor-live (criterion 3): the same checkpoint's id, address and enabled state agree across the binary and text channels"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts#text-monitor-live (criterion 3, interleaving): a text command attempted during a held binary wait is refused with the holder-naming refusal, and the wait still completes"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-09-09
status: complete
---

# Phase 41 Plan 02: The Text Channel, Its Serialization Authority, and the Contention Verdict Summary

**Built `channel-lock.ts` -- a hand-rolled FIFO async mutex with a readable holder record -- and routed both the binary-side `withStockSession()`/`withDerivedTool()` adapters and the text-side `TextMonitorClient.command()` through it, then MEASURED live against genuine stock VICE 3.9 that the same checkpoint's id/address/enabled state agree across both channels and that a text command attempted during a held binary `vice_run_until` wait is refused rather than landing mid-wait.**

## Performance

- **Duration:** ~95 min
- **Started:** ~2026-09-09T08:05:00+02:00
- **Completed:** 2026-09-09T08:40:00+02:00
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 6

## Accomplishments

- `channel-lock.ts` ships `MONITOR_CHANNELS`, `acquireChannelLock()`, `tryAcquireChannelLock()`, `currentChannelLockHolder()`, `channelLockRefusalMessage()`, `ChannelLockTimeoutError` and `resetChannelLockForTests()` -- the ONE place the cross-channel mutex, its FIFO queue, its holder record and its refusal text live, with zero imports of its own (including no import of `stock-run-until.ts`, per the plan's own forbidden-inversion rule) and 16 unit cases (11 required, 5 extra) covering FIFO-vs-LIFO discrimination, same-channel non-reentrancy, timeout+holder-naming, release-on-throw, and idempotent/stale-handle release.
- `stock-dispatch.ts` gains `withChannelLockHeld()`, the ONE binary-side acquire site: `withStockSession()` and `withDerivedTool()`'s `needsSession:true` branch both wrap their delegated handler call in it (never the session-acquisition preamble), so the lock spans `vice_run_until`'s and the reproducible-run path's full resume-wait-observe cycle without either wait path being re-cut. `needsSession:false` never acquires at all.
- `text-protocol.ts` gains `withTextChannelLock()`, the text side's own acquire seam, and `TextMonitorClient.command()` now refuses by name whenever the lock is not held by the text channel -- closing the "silently bypassable" gap D-07 named.
- Two new live proofs in `text-monitor-live.test.ts`, both measured against genuine stock `/usr/bin/x64sc` with the broker stopped: (1) a stopping checkpoint armed on the binary channel is read back identically from the text channel's own passively-drained hit announcement (`#1 (Stop on exec ea31)` matched against the binary channel's own `{id:1, start:59953, enabled:true}`); (2) a text command attempted while the binary channel holds a `vice_run_until` wait is refused with the holder-naming wording, and the wait still completes normally.

## Task Commits

1. **Task 1: Build channel-lock.ts -- the primitive, fully unit-tested** - `8458db47` (feat)
2. **Task 2: Route both channels' halting operations through it** - `b4b6a758` (feat)

**Plan metadata:** committed separately (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md), see the `docs(41-02)` commit following this file.

## Files Created/Modified

- `src/mcp/vice/channel-lock.ts` - the mutex, FIFO queue, holder record, refusal text (`MonitorChannel`, `ChannelLockHolder`, `ChannelLockHandle`, `acquireChannelLock`, `tryAcquireChannelLock`, `currentChannelLockHolder`, `channelLockRefusalMessage`, `ChannelLockTimeoutError`, `CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS`, `resetChannelLockForTests`)
- `src/mcp/vice/channel-lock.test.ts` - 16 unit cases, no emulator
- `src/mcp/vice/package.json` - `channel-lock.ts` added to `files[]`
- `src/mcp/vice/stock-dispatch.ts` - `withChannelLockHeld()`, wired into `withStockSession()` and `withDerivedTool()`'s `needsSession:true` branch; `StockDispatchDeps.channelLockTimeoutMs` (test-only override)
- `src/mcp/vice/stock-dispatch.test.ts` - four new `CHAN-04` cases proving acquire/non-acquire, release-on-throw, and the byte-identical refusal wording
- `src/mcp/vice/text-protocol.ts` - `withTextChannelLock()`, `WithTextChannelLockOptions`; `command()` refuses when the text channel does not hold the lock
- `src/mcp/vice/text-protocol.test.ts` - every real `command()` call wrapped in `withTextChannelLock()` (Rule 3 fix)
- `src/mcp/vice/text-monitor-live.test.ts` - two new live criterion-3 proofs; the two existing live tests' `command()` calls wrapped in `withTextChannelLock()`

## Decisions Made

- **`CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS = 630000ms`**, derived in prose (never imported) from `RUN_UNTIL_MAX_TIMEOUT_MS + 30000ms` -- keeps the primitive from depending on a consumer module, with `channel-lock.test.ts` cross-importing both to assert the inequality holds in both directions.
- **`needsSession:false` never acquires the lock** -- a pure client-side derived tool must not block a real halting operation for nothing; `vice_diagnose` (also `needsSession:false`) will take the lock non-blockingly via `tryAcquireChannelLock()` in plan 41-04 instead.
- **Test-only `channelLockTimeoutMs`/`timeoutMs` overrides** on `StockDispatchDeps` and `WithTextChannelLockOptions` -- production call sites never set them; they exist purely so a test can observe a `ChannelLockTimeoutError` without waiting out the real ~630-second default.
- **Live banner-matching collects every banner, not just the first** -- measured live that intermediate binary-channel commands each push their own bare-prompt halt announcement to the text console ahead of the checkpoint's own richer announcement; matching against the full collected set (rather than assuming the first arrival is the checkpoint hit) is what made the live proof reliable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `command()`'s new required refusal broke every pre-existing test that called it directly**
- **Found during:** Task 2, first run of `node --test text-protocol.test.ts` after adding the refusal
- **Issue:** The plan requires `TextMonitorClient.command()` to refuse unless the text channel holds `channel-lock.ts`'s mutex. `text-protocol.test.ts` (11 call sites) and `text-monitor-live.test.ts`'s two existing live tests (2 call sites) all called `command()` directly, with no lock held -- all 13 sites failed with the new refusal the instant it was added. Neither test file is in this plan's `files_modified` list, but both are named in this plan's own `<verify>` lines, which require them to stay green.
- **Fix:** Wrapped every real (non-refusal-testing) `command()` call in `withTextChannelLock()` in both files. Added a `resetChannelLockForTests()` `beforeEach` to `text-protocol.test.ts` for hygiene (a test that throws before its own `withTextChannelLock()` release completes could otherwise leak a held lock into the next test).
- **Files modified:** `src/mcp/vice/text-protocol.test.ts`, `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** `node --test text-protocol.test.ts` -- 17/17 pass (was 13 failing). Live suite -- 4/4 pass, 0 skipped.
- **Committed in:** `b4b6a758` (Task 2 commit)

**2. [Rule 1 - Bug] The criterion-3 live test's first design matched only the FIRST passively-arriving text banner, and the first one measured was not the checkpoint's own announcement**
- **Found during:** Task 2's own live `<verify>` run
- **Issue:** The initial design used `client.once("banner", ...)`, assuming the first banner received after arming the checkpoint would be its own hit announcement. MEASURED live: the first banner received was a bare `"(C:$fd83) "` with no `#N (...)` prefix at all -- an earlier binary-channel command (`vice_checkpoint_add` or the first `vice_checkpoint_list` poll) had already halted the machine once and pushed its own plain announcement, before the checkpoint itself ever fired.
- **Fix:** Collect every banner into an array (`client.on("banner", ...)`, not `.once`), and after confirming the binary-side hit, scan the FULL collected set (with a bounded grace window for one still in flight) for the one matching the `#N (Stop on exec ADDR)` shape, rather than assuming positional order.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** Re-ran `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` -- 4/4 pass; MEASURED banner `"#1 (Stop on exec ea31)"` correctly matched against binary `{id:1, start:59953, enabled:true}`.
- **Committed in:** `b4b6a758` (Task 2 commit)

**3. [Rule 1 - Bug] The interleaving live test's 150ms head-start raced the binary side's first-connect handshake and lost**
- **Found during:** Task 2's own live `<verify>` run
- **Issue:** The initial design started `vice_run_until` and, after only a 150ms head start, attempted the concurrent text-side lock acquire -- expecting a refusal. MEASURED: the text acquire instead SUCCEEDED (the "must not run" callback's own thrown message was observed as the caught error), because `ensureStockSession()`'s first-connect handshake (socket connect, capability resolution) had not yet completed within 150ms, so `withChannelLockHeld()` had not yet acquired the binary lock by the time the text side tried.
- **Fix:** Added a cheap `vice_ping` dispatch BEFORE the timed `vice_run_until` call, to pay the handshake cost outside the race window (the subsequent `vice_run_until` reuses the already-connected session and reaches `withChannelLockHeld()` almost immediately); increased the head-start delay to 300ms and `vice_run_until`'s own `timeout_ms` to 5000 for margin.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** Re-ran the same live command -- 4/4 pass; MEASURED refusal text: `"channel-lock: the binary channel currently holds halt authority (operation \"vice_run_until\", grant unknown, held for 601ms) -- this call must wait for that channel to release before it can proceed"`, and the wait completed with `timedOut:true`.
- **Committed in:** `b4b6a758` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking test-suite fix required by the plan's own new refusal, 2 bugs in this plan's own new live-test design, found and fixed against the real emulator before either was trustworthy). **Impact on plan:** All three were necessary for this plan's own stated verification to pass; none expanded scope beyond CHAN-04.

## Issues Encountered

- **`npm run test:automated`'s measured floor is 3 failures, not always exactly 3.** Three separate full-suite runs during this plan's verification showed 3, 4, 5, 3, 3, and 3 failures across different invocations, with the extra failure(s) beyond the documented 3 (`check-skill-fork-honesty`, `check-skill-tool-coverage`, or an occasional third `anno-register.test.ts` case) always passing cleanly when re-run in isolation. This matches this project's own documented "test suite races on repo-tree scratch files" characterization -- none of the extra failures touch a file this plan modified, and the final two consecutive runs both landed exactly on the documented 3-failure floor (confined to `anno-register.test.ts`'s `DIRECTION 5`/`planted violation` and `anno-import.test.ts`'s `annoRegisterEntryFor()` case).
- A stray, pre-existing orphaned `x64sc` process (unrelated to this session, noted in the environment context) held `127.0.0.1:6600`/`:6601` throughout. It never interfered: no broker daemon was running concurrently with any live test in this plan (confirmed via `pgrep -fa vice-broker` before each live run), and the broker's own port allocator picks the lowest FREE port at or above its base, so every cold-launched instance in this plan's live runs used higher, unaffected ports.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CHAN-04` is closed. `channel-lock.ts` is the load-bearing serialization authority plans 41-03 through 41-06 build on.
- Plan 41-04's `vice_diagnose` handler can now import `tryAcquireChannelLock()` and `currentChannelLockHolder()` to make contention readable without queuing behind the holder it is diagnosing.
- Plan 41-03's `channel: "text"` discriminator on `monitor_claim`/`monitor_release` (D-14) is still NOT wired -- this plan's own live tests worked around that gap exactly as 41-01's SUMMARY anticipated (`handleMonitorClaim()`'s same-grant idempotence), by claiming both the binary and text sessions with the SAME grant id, never two different ones. Plan 41-03 must still land the discriminator for one-text-client-per-instance to become its own enforced concern.
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All created files confirmed present via `[ -f ]`: `channel-lock.ts`, `channel-lock.test.ts`.
- All modified files confirmed present via `[ -f ]`: `stock-dispatch.ts`, `text-protocol.ts`.
- Both task commits (`8458db47`, `b4b6a758`) and this SUMMARY's own commit (`2953733d`) confirmed present via `git log --oneline --all`.
- `npm run typecheck` clean.
- `node --test channel-lock.test.ts` -- 16/16 pass (>= 11 required).
- `node --test stock-dispatch.test.ts channel-lock.test.ts text-protocol.test.ts` -- 167/167 pass.
- `node --test stock-run-until.test.ts stock-reproducible-run.test.ts` -- 57/57 pass; `git diff --name-only` confirms both files untouched by this plan.
- `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` -- 4/4 pass, 0 skipped, broker/x64sc confirmed stopped beforehand.
- `npm run test:automated` -- final two consecutive runs both landed at exactly 3 failures, confined to `anno-register.test.ts`/`anno-import.test.ts`'s documented pre-existing baseline.
- No unexpected deletions in either task commit (`git diff --diff-filter=D --name-only` empty for both).
