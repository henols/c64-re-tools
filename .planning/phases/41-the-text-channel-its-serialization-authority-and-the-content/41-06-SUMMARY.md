---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 06
subsystem: protocol
tags: [vice, text-channel, device-console, warp, channel-lock, default-memspace, drive-checkpoint, stock-backend, chan-03, chan-05]

requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: "plan 41-02's channel-lock.ts (withTextChannelLock(), acquireChannelLock()) and plan 41-04's evidence.channelContention on vice_diagnose -- this plan's two handlers take text authority through the former, and this plan's own live suite re-exercises the latter unmodified"
provides:
  - "text-tools.ts: handleDeviceConsole()/handleWarpSet(), the two allowlisted text-channel remedy tools, each registered needsSession:false through withDerivedTool() -- a measured deviation from the plan's own suggested withStockSession()/needsSession:true, which would self-deadlock against channel-lock.ts's single cross-channel mutex"
  - "tools-manifest.stock.json: vice_device_console and vice_warp_set (38 -> 40 tools), both stock-only-gain in capability-registry.ts; vice_machine_config_set's reason corrected to no longer claim the text channel is undialed"
  - "docs/phase41-text-channel-live-evidence.md: this phase's own live evidence -- a real drive-checkpoint contamination-and-remedy run (MEASURED, not skipped) and a warp on/off re-probe with the channel open"
  - "CLAUDE.md: all three narrowed constraints (default_memspace/device c:, WarpMode, CPUHISTORY_GET) re-cited to this phase's evidence beside the 2026-08-27 probe citation"
affects: []

actuals:
  tokens: 22900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "needsSession:false + a handler-internal deps.ensureLease() + textConnect()/textDisconnect() per call, for a tool whose only wire dependency is the TEXT channel -- the binary-locking adapters (withStockSession, withDerivedTool needsSession:true) both wrap the whole handler call in channel-lock.ts's binary-channel acquire, so a handler that also needs the text channel's own acquire (withTextChannelLock) would nest a second acquireChannelLock() call inside the first and self-deadlock until CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS expires. vice_diagnose's own needsSession:false precedent generalizes to any tool that must take a DIFFERENT channel's authority than the one the standard adapters assume."
    - "Detecting an unsolicited wire event (client.on(\"event\", ...) for type === \"checkpoint_info\") rather than polling CHECKPOINT_LIST, for any checkpoint whose memspace differs from the CURRENT default_memspace -- CHECKPOINT_LIST is itself scoped to default_memspace (MEASURED this plan, previously unrecorded), so it cannot see a checkpoint on another memspace until AFTER that checkpoint has already fired once."

key-files:
  created:
    - src/mcp/vice/text-tools.ts
    - src/mcp/vice/text-tools.test.ts
    - docs/phase41-text-channel-live-evidence.md
  modified:
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/stock-derived.ts
    - src/mcp/vice/stock-derived.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/capability-registry.ts
    - src/mcp/vice/capability-registry.test.ts
    - src/mcp/vice/package.json
    - docs/tool-support.md
    - src/mcp/vice/text-monitor-live.test.ts
    - CLAUDE.md

key-decisions:
  - "Registered both new tools needsSession:false (withDerivedTool), not the plan's own suggested withStockSession/needsSession:true -- MEASURED that both binary-locking adapters wrap the delegated handler call in channel-lock.ts's single cross-channel mutex for 'channel: binary', so a handler that internally also calls withTextChannelLock() would be a second, nested acquireChannelLock() call on the SAME non-reentrant mutex, resolving only by expiring the 630s default timeout. Neither handler needs a binary session at all -- each resolves its own lease via deps.ensureLease() and dials only the text channel -- so needsSession:false is the structurally correct choice, not merely the deadlock-avoiding one, and matches vice_diagnose's own established precedent."
  - "No held text session exists in production code to reuse (MEASURED, contradicting the plan's own assumed default): StockConnectSession carries no text session field, and ensureStockSession()/withStockSession() never call textConnect() -- only test code does. Each handler call is therefore its own textConnect()/textDisconnect() pair, the ONLY acquisition path for these two tools, not a second one competing with a first."
  - "The default_memspace contamination test arms a checkpoint over the ENTIRE 1541 ROM range ($C000-$FFFF) rather than one named routine address, since this project's memmap.json documents only C64 addresses. Detection uses the unsolicited CHECKPOINT_INFO (0x11) event, not CHECKPOINT_LIST polling, after MEASURING that CHECKPOINT_LIST is itself scoped to default_memspace and cannot see a drive checkpoint before it has already fired once."
  - "The drive checkpoint is deleted before invoking the remedy (device c:), not merely left armed -- MEASURED that leaving it live let the drive's own extremely tight polling loop re-contaminate default_memspace faster than the remedy-confirmation step could observe the fix, producing a false remedy-failure in an earlier design of this same test."

requirements-completed: [CHAN-03, CHAN-05]

coverage:
  - id: D1
    description: "vice_device_console and vice_warp_set ship as the two typed text-channel tools; the five Phase-42 parse-target commands stay behind the internal allowlist with a structural test proving it (CHAN-03)"
    requirement: "CHAN-03"
    verification:
      - kind: unit
        ref: "text-tools.test.ts (12 cases): exact verb issuance, boolean-branch selection, non-boolean refusal with no byte written, lock held-for-duration and released on both success and throw, ChannelLockTimeoutError passed through verbatim"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts (D-01 structural, D-02 structural, two new conformance cases, STOCK_ONLY_TOOLS): 191/191 pass"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts (D-04): vice_warp_set(true/false) issued through the real dispatchStock() path with the channel open, genuine stock /usr/bin/x64sc"
        status: pass
    human_judgment: false
  - id: D2
    description: "The default_memspace remedy is exercised live, not merely made available: a real drive checkpoint contaminates default_memspace, main-CPU stepping is confirmed broken, and device c: restores it (criterion 5, D-03)"
    requirement: "CHAN-03"
    verification:
      - kind: e2e
        ref: "text-monitor-live.test.ts (criterion 5, D-03/D-04): MEASURED against genuine stock /usr/bin/x64sc VICE 3.9, 2026-09-09 -- contamination and remedy both confirmed, no skip taken"
        status: pass
    human_judgment: false
  - id: D3
    description: "capability-registry.ts's now-false claim about the undialed text channel is corrected, and both new tools are registered stock-only-gain, providedBy: stock"
    requirement: "CHAN-03"
    verification:
      - kind: unit
        ref: "capability-registry.test.ts (2 new cases + mechanical-completeness): 17/17 pass"
        status: pass
      - kind: other
        ref: "grep -aq 'a channel this project does not dial' src/mcp/vice/capability-registry.ts -- absent (asserted via ! grep -aq)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/tool-support.md is regenerated (never hand-edited) and byte-identical to the generator's output, reflecting 38 -> 40 tools"
    requirement: "CHAN-03"
    verification:
      - kind: unit
        ref: "tool-support-table.test.mjs (11/11 pass), including the byte-identity and MCP-03 length checks"
        status: pass
    human_judgment: false
  - id: D5
    description: "Contention is reported as evidence for a contended instance during this phase's own re-run of the CHAN-05 live suite (unmodified, re-verified alongside this plan's own two new live tests)"
    requirement: "CHAN-05"
    verification:
      - kind: e2e
        ref: "text-monitor-live.test.ts (CHAN-05, plan 41-04's own case, re-run unmodified in this plan's full-suite live invocation): verdict=live, bracketsRun=0, channelContention.held=true/false as expected"
        status: pass
    human_judgment: false
  - id: D6
    description: "All three narrowed CLAUDE.md constraints (default_memspace/device c:, WarpMode, CPUHISTORY_GET) gain this phase's own evidence citation beside the 2026-08-27 probe citation -- none deleted, none weakened (D-04)"
    requirement: "CHAN-03"
    verification:
      - kind: other
        ref: "grep -c 'phase41-text-channel-live-evidence' CLAUDE.md == 3; grep -c 'binary monitor only' CLAUDE.md == 3; grep -c 'MEASURED 2026-08-27' CLAUDE.md == 3"
        status: pass
      - kind: unit
        ref: "docs-linerefs.test.ts, docs-dangling-refs.test.ts, docs-absorbed-decisions.test.ts: 26/26 pass"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-09-09
status: complete
---

# Phase 41 Plan 06: The Text Channel's Remedy Tools, Exercised Live Summary

**Shipped `vice_device_console` and `vice_warp_set` (registered `needsSession:false` after measuring that the plan's own suggested binary-locking adapter would self-deadlock against `channel-lock.ts`'s single cross-channel mutex), then MEASURED — not merely made available — the `default_memspace` remedy live: a real drive checkpoint froze main-CPU stepping and `device c:` restored it, against genuine stock `/usr/bin/x64sc` VICE 3.9.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-09T09:19:13Z
- **Completed:** 2026-09-09T10:05:26Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 12

## Accomplishments

- `text-tools.ts` ships `handleDeviceConsole()` and `handleWarpSet()` — the two allowlisted text-channel tools, both `needsSession:false` (a measured deviation from the plan's own literal suggestion, documented at length in the file's own header and in Key Decisions below). Each resolves its own broker lease, dials a fresh `textConnect()` session, holds `channel-lock.ts`'s text-channel authority for exactly one command via `withTextChannelLock()`, and tears the session down again whether the call succeeded or threw.
- `stock-dispatch.ts`/`stock-derived.ts` register both tools in `STOCK_DISPATCH_TABLE` and `STOCK_DERIVED_TOOLS`; `tools-manifest.stock.json` gains both entries (38 → 40 tools); `capability-registry.ts` gains two `stock-only-gain` entries and corrects `vice_machine_config_set`'s reason, which no longer claims the text channel is undialed.
- The five Phase-42 parse-target verbs (`memmapshow`, `prof flat`, `chis`, `bt`, `io`) stay behind `TEXT_COMMAND_ALLOWLIST`, proven absent from every stock manifest tool name by a new structural test; a second structural test walks every stock manifest entry proving no string-typed input property looks like a free-text monitor command (D-01), and that `vice_warp_set`'s only property is a boolean.
- `docs/tool-support.md` regenerated (never hand-edited) and `docs-*` guard suites all stay green.
- **Criterion 5, exercised live, not merely made available:** a real drive checkpoint armed over the whole 1541 ROM range (raw wire encoder — no shipped tool reaches a drive memspace) froze main-CPU `ADVANCE_INSTRUCTIONS` stepping at a fixed PC (`0xfd83`, unchanged across a step), and `device c:` — issued through the same path `vice_device_console` itself uses — restored forward stepping (`0xfd83` → `0xfd80`). MEASURED twice, in two independent full-suite live invocations, both green with zero skips.
- Along the way, MEASURED a previously unrecorded protocol fact: `CHECKPOINT_LIST` (0x14) is itself scoped to `default_memspace`, so it cannot see a checkpoint armed on a different memspace until that checkpoint has already fired once — a chicken-and-egg that broke an initial poll-based hit-detection design; the shipped test detects the drive checkpoint's own unsolicited `CHECKPOINT_INFO` (0x11) event instead.
- `vice_warp_set(true)`/`vice_warp_set(false)` re-probed live through the real dispatch path with the channel open; recorded (honestly, in the evidence document) that on this build the response carries no textual "on"/"off" confirmation beyond the framed prompt — a nuance worth naming rather than assuming, and consistent with `text-tools.ts`'s own doc comment ("the answer carries the observed state" — the framed round trip, not a guaranteed confirmation string).
- All three narrowed `CLAUDE.md` constraints (`default_memspace`/`device c:`, the absent runtime `WarpMode` resource, `CPUHISTORY_GET`'s version floor) gain this phase's own citation beside the existing `MEASURED 2026-08-27` exploration-probe citation — none deleted, none weakened, verified by four grep gates and the full `docs-linerefs`/`docs-dangling-refs`/`docs-absorbed-decisions` suite.

## Task Commits

1. **Task 1: Ship the two remedy tools, and keep the other five behind the allowlist** - `7eccae24` (feat)
2. **Task 2: Exercise the remedy live, and re-cite the three narrowed constraints (D-04)** - `b28e41e6` (docs)

**Plan metadata:** committed separately (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md), see the `docs(41-06)` commit following this file.

_Note: this plan's second task carries a `docs(...)` type despite adding real test code and evidence, because its primary deliverable is documentation-and-evidence (the live tests plus the CLAUDE.md re-citations); the plan's own two-task decomposition names it that way._

## Files Created/Modified

- `src/mcp/vice/text-tools.ts` - the two allowlisted text-channel tool handlers (`handleDeviceConsole`, `handleWarpSet`)
- `src/mcp/vice/text-tools.test.ts` - 12 unit cases against a real TCP stub text-monitor server
- `docs/phase41-text-channel-live-evidence.md` - this phase's own live evidence record
- `src/mcp/vice/stock-dispatch.ts` - registers both tools via `withDerivedTool(..., { needsSession: false }, ...)`, with the deadlock-avoidance rationale documented at the call site
- `src/mcp/vice/stock-dispatch.test.ts` - `STOCK_ONLY_TOOLS` grows by two; two new D-01/D-02 structural cases; two new conformance cases against a text-protocol stub server
- `src/mcp/vice/stock-derived.ts` / `stock-derived.test.ts` - `STOCK_DERIVED_TOOLS` grows to fifteen entries
- `src/mcp/vice/hostpath-consumers.test.ts` - `DERIVED_TOOL_MODULES` gains both new tools mapped to `text-tools.ts`
- `src/mcp/vice/tools-manifest.stock.json` - two new stock-only entries (38 → 40 tools)
- `src/mcp/vice/capability-registry.ts` / `capability-registry.test.ts` - two new `stock-only-gain` entries; `vice_machine_config_set`'s reason corrected
- `src/mcp/vice/package.json` - `text-tools.ts` added to `files[]`
- `docs/tool-support.md` - regenerated
- `src/mcp/vice/text-monitor-live.test.ts` - two new live tests (criterion 5's contamination-and-remedy, D-04's warp re-probe)
- `CLAUDE.md` - three narrowed constraints re-cited to this phase's evidence

## Decisions Made

- **`needsSession:false`, not the plan's own suggested `withStockSession`/`needsSession:true`** — MEASURED that both binary-locking adapters wrap the delegated handler call in `channel-lock.ts`'s single, non-reentrant, cross-channel mutex for `channel: "binary"`, so a handler that also calls `withTextChannelLock()` internally would nest a second acquire on the SAME mutex and self-deadlock until the 630-second default timeout expires. Neither tool needs a binary session at all, so this is the structurally correct choice, matching `vice_diagnose`'s own precedent, not merely the deadlock-avoiding one.
- **No held text session exists to reuse** — contradicting the plan's own assumed default, `StockConnectSession` carries no text session field and `ensureStockSession()` never calls `textConnect()` in production code. Each handler call is its own `textConnect()`/`textDisconnect()` pair.
- **Drive checkpoint armed over the whole ROM range, detected via the unsolicited event, deleted before the remedy** — three measured facts drove this shape: no shipped tool reaches a drive memspace (raw wire encoder needed); `CHECKPOINT_LIST` is scoped to `default_memspace` (unsolicited `CHECKPOINT_INFO` needed instead); and the still-armed checkpoint re-contaminates faster than the remedy step can observe the fix (delete needed before the remedy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Following the plan's literal adapter suggestion would self-deadlock**
- **Found during:** Task 1, reasoning through `withStockSession()`/`withDerivedTool({needsSession:true})`'s own code before wiring the dispatch table entries
- **Issue:** The plan's action text suggested `withStockSession` for both new tools, "so each ... also takes the binary-side lock for its session preamble before its own text hold." Reading the real code showed `withChannelLockHeld()` wraps the ENTIRE delegated handler call, not merely a "session preamble" — so a handler that internally also acquires the text channel's own lock via `withTextChannelLock()` would be nesting a second `acquireChannelLock()` call on the same single, non-reentrant mutex while the first (binary) is still held by the same call stack, resolving only by expiring the 630-second default timeout.
- **Fix:** Registered both tools with `withDerivedTool(toolName, { needsSession: false }, handler)` instead — an EXISTING adapter configuration (not a third adapter), already used by `vice_diagnose`/`vice_symbols_load`. Each handler resolves its own lease via `deps.ensureLease()` and takes only the text channel's own lock.
- **Files modified:** `src/mcp/vice/text-tools.ts`, `src/mcp/vice/stock-dispatch.ts`, `src/mcp/vice/stock-derived.ts`
- **Verification:** `text-tools.test.ts` (12/12 pass, including two tests that directly observe the lock is held only for the text-channel duration and released on both paths); `stock-dispatch.test.ts` (191/191 pass)
- **Committed in:** `7eccae24` (Task 1 commit)

**2. [Rule 1 - Bug] CHECKPOINT_LIST could not see the drive checkpoint before it fired**
- **Found during:** Task 2's own live `<verify>` run
- **Issue:** The initial design polled `CHECKPOINT_LIST` after arming a checkpoint on the drive memspace, expecting `hitCount > 0` once it fired. MEASURED: `CHECKPOINT_LIST` returned `total: 0` on every poll for the full 15-second window, live — the drive checkpoint was genuinely armed (`CHECKPOINT_SET`'s own reply confirmed it), but `CHECKPOINT_LIST`'s own listing is scoped to `default_memspace`, which stays `main` until the checkpoint has already contaminated it once — a chicken-and-egg the polling design could never observe.
- **Fix:** Replaced the poll with a listener for the checkpoint's own unsolicited `CHECKPOINT_INFO` (0x11) event, which VICE pushes on every hit regardless of `CHECKPOINT_LIST`'s own scoping.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** Re-ran `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test --test-name-pattern="criterion 5" text-monitor-live.test.ts` — the checkpoint hit was detected and the contamination assertions passed.
- **Committed in:** `b28e41e6` (Task 2 commit)

**3. [Rule 1 - Bug] The still-armed drive checkpoint re-contaminated default_memspace during the remedy-confirmation step**
- **Found during:** Task 2's own live `<verify>` run, after fixing deviation #2
- **Issue:** With contamination confirmed, an early design issued `device c:` while the drive checkpoint was still armed. The remedy-confirmation assertion (`pcAfterRemedy !== pcBefore`) FAILED — MEASURED that the drive's own extremely tight three-instruction polling loop kept re-firing the still-live checkpoint on essentially every subsequent resume, re-contaminating `default_memspace` back to drive before the following `vice_execution_step` could observe the fix.
- **Fix:** Added a `CHECKPOINT_DELETE` for the drive checkpoint immediately after the contamination assertions and before invoking `device c:` — its job (producing the contamination) was already done.
- **Files modified:** `src/mcp/vice/text-monitor-live.test.ts`
- **Verification:** Re-ran the same live command twice, in two independent full-suite invocations — both green, remedy confirmed (`0xfd83` → `0xfd80`).
- **Committed in:** `b28e41e6` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 architectural-adapter bug caught before any live run, 2 bugs in this plan's own new live-test design, found and fixed against the real emulator before either was trustworthy). **Impact on plan:** All three were necessary for this plan's own stated verification to pass; none expanded scope beyond `CHAN-03`/`CHAN-05`. None required Rule 4 escalation — each was a bug in either this plan's own new code or its own new test design, not an architectural change.

## Issues Encountered

- **`npm run test:automated`'s measured floor is 3 failures, not always exactly 3.** Multiple full-suite runs during this plan's own verification showed 3, 4, and 5 failures across different invocations, with the extra failure(s) beyond the documented 3 (`check-skill-fork-honesty`, `check-skill-tool-coverage`) always passing cleanly when re-run in isolation (confirmed: `node --test audit-root-args.test.ts` alone — 58/58 pass). This matches this project's own documented "test suite races on repo-tree scratch files" characterization and 41-02's own prior measurement of the identical extra-failure set. The final full-suite run in this plan's own verification landed exactly on the documented 3-failure floor, confined to `anno-register.test.ts`.
- **`device c:`'s remedy response, when the drive checkpoint has not been given time to fully quiesce, can carry a very large batch of already-queued hit banners** (2,270,500 bytes in one measured run) — a genuine race between `CHECKPOINT_DELETE` taking effect and already-in-flight banner bytes on the wire, not a bug in the test. Recorded honestly in `docs/phase41-text-channel-live-evidence.md` rather than hidden; the console log is truncated for readability, but the test's own assertion checks the full untruncated string.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CHAN-03` and `CHAN-05` are closed. This was the last plan of Phase 41.
- Phase 42 (the five parse-target commands' owning parsers) can proceed: `memmapshow`, `prof flat`, `chis`, `bt`, `io` all remain in `TEXT_COMMAND_ALLOWLIST`, reachable in-process, structurally proven absent from the stock manifest's tool names.
- A newly-measured fact worth carrying forward: `CHECKPOINT_LIST` is scoped to `default_memspace`. Any future drive-checkpoint-aware code (Phase 42+ or beyond) must not assume `CHECKPOINT_LIST` enumerates checkpoints across all memspaces.
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All created files confirmed present via `[ -f ]`: `text-tools.ts`, `text-tools.test.ts`, `docs/phase41-text-channel-live-evidence.md`.
- Both task commits (`7eccae24`, `b28e41e6`) confirmed present via `git log --oneline --all`.
- `npm run typecheck` clean (checked after every file edit in this plan).
- `node --test text-tools.test.ts stock-dispatch.test.ts capability-registry.test.ts manifest-arg-compat.test.ts stock-schema-check.test.ts` — 191/191 pass.
- `node scripts/generate-tool-support-table.mjs && node --test src/mcp/vice/tool-support-table.test.mjs` — 11/11 pass, byte-identical.
- `! grep -aq 'a channel this project does not dial' src/mcp/vice/capability-registry.ts` — succeeds (absent).
- `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` — 7/7 pass, 0 skipped, run twice, broker/x64sc confirmed stopped before and after each run.
- `grep -c 'phase41-text-channel-live-evidence' CLAUDE.md` == 3; `grep -c 'binary monitor only' CLAUDE.md` == 3; `grep -c 'MEASURED 2026-08-27' CLAUDE.md` == 3.
- `node --test docs-linerefs.test.ts docs-dangling-refs.test.ts docs-absorbed-decisions.test.ts` — 26/26 pass.
- `npm run test:automated` — final run landed at exactly 3 failures, confined to `anno-register.test.ts`'s documented pre-existing baseline.
- No unexpected deletions in either task commit (`git diff --diff-filter=D --name-only` empty for both).
