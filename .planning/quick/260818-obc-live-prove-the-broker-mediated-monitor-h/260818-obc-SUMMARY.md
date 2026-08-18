---
phase: quick-260818-obc
plan: 01
subsystem: testing
tags: [vice-mcp, stock-vice, vice-broker, node-test, monitor-held-elsewhere, live-proof, time-04]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "vice_diagnose's five-verdict/non-verdict diagnosis surface, the broker control plane's claimMonitor()/monitor_owned refusal wire, and stock-dispatch.ts's ensureStockSession() lease-to-session seam"
provides:
  - "A real, opt-in live proof (stock-live-broker-monitor.test.ts) that a genuine host broker daemon refuses a second real claimMonitor() with the monitor_held_elsewhere verdict, naming the other real grant's id, on both genuine stock VICE 3.9 and 3.10"
  - "The same run also proves the broker-supervised (not test-performed) restarted respawn -- TIME-04's other named residual"
  - "A fix to a live-discovered, pre-existing bug in defaultBinmonProbe() (broker-launch.mts) that could never observe a crash-respawned instance as ready on the stock backend"
  - "An automated unit shape-oracle for the monitor_held_elsewhere evidence key set (stock-diagnose.test.ts), mirroring the standing rule test-gate.mjs's header already documents"
  - "TIME-04 closed to Complete; 07-VALIDATION.md's nyquist_compliant flipped to true; 07-VERIFICATION.md's human_verification item closed"
affects: [07-cycle-timing-and-wedge-triage, vice-wedge-triage-skill, any-future-broker-warm-floor-or-crash-supervision-change]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "clearHeldStockSession() as a deliberate module-singleton detach: stock-dispatch.ts's ensureStockSession() holds exactly one live session per process, and switching targetId tears down the previous one via stockDisconnect() BEFORE the new claim -- calling clearHeldStockSession() between two real sessions detaches the module's pointer without touching the broker, letting a genuinely fresh claimMonitor() attempt race against the OTHER session's still-live claim instead of silently releasing it first"
    - "Raw wire-level status polling alongside the typed BrokerControlSession: the typed client's status() narrows StatusInstanceEntry down to {port,url,state,reason,epoch}, dropping hasMonitorClient even though the wire carries it -- a small test-local rawControlRequest()/rawStatus() helper reads it directly, mirroring broker-e2e.test.ts's own rawAcquire()/makeRawSession() precedent"
    - "Binmon readiness probes must demux by request-id, never by arrival order: a fresh binmon connection always emits an unsolicited REGISTER_INFO (0x31) event at request-id 0xffffffff before any command reply, so a probe that assumes the first N bytes on the wire are its own reply is structurally wrong"

key-files:
  created:
    - ".claude/mcp/vice/stock-live-broker-monitor.test.ts"
  modified:
    - ".claude/mcp/vice/broker-launch.mts"
    - ".claude/mcp/vice/resources/broker-launch.mjs"
    - ".claude/mcp/vice/test-gate.mjs"
    - ".claude/mcp/vice/test-gate.test.ts"
    - ".claude/mcp/vice/stock-diagnose.test.ts"
    - ".claude/skills/vice-wedge-triage/SKILL.md"
    - ".planning/REQUIREMENTS.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-UAT.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-HUMAN-UAT.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md"
    - ".planning/STATE.md"

key-decisions:
  - "Rule 1 auto-fix applied to defaultBinmonProbe() (broker-launch.mts): live-discovered that it never handled the unsolicited REGISTER_INFO event every fresh binmon connection emits, so a real crash-respawned stock instance could never be observed as 'ready' -- this is a genuine, pre-existing product bug with zero prior test coverage (broker-launch.test.ts only ever stubs binmonProbe), not a harness mistake. Fixed to walk frame boundaries and demux by request-id."
  - "Harness iteration (permitted by the plan's own Task 2 instruction): added a bounded waitForPortOpen() before the FIRST claim, because handleAcquire()'s cold-launch arm marks a fresh record 'granted' the instant the process is spawned, without ever waiting for a readiness probe -- dialling the binmon port immediately races ECONNREFUSED against x64sc's own boot time. No assertion was weakened; this closes a genuine harness-vs-reality timing gap."
  - "07-REVIEW.md's status correction (unconditional, per the plan) is independent of this quick task's own live proof: 07-REVIEW-FIX.md had already fixed all 20 findings before this task started, but 07-REVIEW.md itself was never updated to say so. Corrected as a record-hygiene fix."

requirements-completed: [TIME-04]

# Metrics
duration: ~2h30m
completed: 2026-08-18
---

# Phase quick-260818-obc: Live-Prove the Broker-Mediated monitor_held_elsewhere Verdict Summary

**Stood up a real host broker daemon against genuine stock VICE (3.9 and 3.10), externally killed a granted instance, and proved that the broker's OWN crash respawn produces a second real grant whose second `claimMonitor()` is genuinely refused `monitor_held_elsewhere` -- closing TIME-04's last two residuals in one transcript, and fixing a real bug in `defaultBinmonProbe()` discovered along the way.**

## Performance

- **Duration:** ~2h30m (most of it live debugging a genuine, previously-undiscovered probe bug)
- **Tasks:** 3 of 3 completed
- **Files created:** 1
- **Files modified:** 12 (2 production/compiled, 4 test infra, 6 phase-07 records + SKILL.md, 1 STATE.md left uncommitted per orchestrator instruction)

## Accomplishments

- Live-proved the broker-mediated `monitor_held_elsewhere` verdict end to end: a genuine host broker daemon (`resources/vice-broker.mjs`) granted two real, independently-opened `openBrokerControl()` sessions the SAME crash-respawned instance; the session whose real `claimMonitor()` arrived second was refused, naming the OTHER grant's real id, on both genuine `/usr/bin/x64sc` (VICE 3.9) and `/usr/local/bin/x64sc` (VICE 3.10), settling in **1ms** against the 10000ms bound on both binaries.
- The same run's own `vice_diagnose` call, made against the broker-supervised respawn before the second grant ever claimed anything, independently answered `restarted` with `baselineEpoch:1`/`currentEpoch:2` at zero-to-minimal emulator cost on both binaries -- closing TIME-04's *other* named residual (a broker-supervised, not test-performed, respawn) in the same transcript.
- Found and fixed a genuine, previously-uncovered bug in `defaultBinmonProbe()` (`broker-launch.mts`): it assumed the first bytes on a fresh binmon socket are its own PING reply, but a fresh connection ALWAYS emits an unsolicited `REGISTER_INFO` (0x31) event at request-id `0xffffffff` first (CLAUDE.md's own documented protocol fact). The probe read that event's response-type byte as a malformed reply and answered `false` forever -- meaning a real crash-respawned stock instance could NEVER be promoted to `"ready"`, silently blocking the entire crash-supervision mechanism on the stock backend. Fixed to walk frame boundaries via each frame's own body-length field and demux by request-id, matching the discipline every other binmon consumer in this tree already follows.
- Registered the new live suite as `MANUAL_ONLY_TESTS`' sixth entry and added the standing-rule automated shape oracle for `monitor_held_elsewhere`'s evidence in `stock-diagnose.test.ts`.
- Closed TIME-04 to `Complete` in `REQUIREMENTS.md`, flipped `07-VALIDATION.md`'s `nyquist_compliant` to `true`, closed `07-VERIFICATION.md`'s `human_verification` item, updated `07-UAT.md` test 9 and `07-HUMAN-UAT.md`, and upgraded `SKILL.md`'s Provenance grading for both previously-MEDIUM paths to HIGH.
- Unconditionally corrected `07-REVIEW.md`'s stale `issues_found` status to `issues_resolved` (it had already been fixed by `07-REVIEW-FIX.md`, `all_fixed` 20/20, before this task started, but the review document itself was never updated).

## Task Commits

1. **Task 1: Write the opt-in broker-mediated live proof, register it in the gate, mirror its payload shape** - `662dfd4` (test)
2. **Task 2a: Fix `defaultBinmonProbe()`'s request-id demux bug** (Rule 1 auto-fix, live-discovered) - `0b236f1` (fix)
3. **Task 2b: Harness fix for the cold-launch binmon-port race** - `b3965eb` (test)
4. **Task 3: Close TIME-04's record trail** - `d2a9235` (docs)

`STATE.md` was edited but left uncommitted by design (the orchestrator's own instructions for this run route `STATE.md`/`SUMMARY.md` commits through Step 8, not through this executor).

## Files Created/Modified

- `.claude/mcp/vice/stock-live-broker-monitor.test.ts` - the new opt-in live proof (MANUAL_ONLY_TESTS' sixth entry)
- `.claude/mcp/vice/broker-launch.mts` + `resources/broker-launch.mjs` - `defaultBinmonProbe()`'s request-id demux fix
- `.claude/mcp/vice/test-gate.mjs` / `test-gate.test.ts` - gate registration + drift-guard update
- `.claude/mcp/vice/stock-diagnose.test.ts` - the standing-rule shape oracle for `monitor_held_elsewhere`'s evidence
- `.claude/skills/vice-wedge-triage/SKILL.md` - Provenance table upgraded
- `.planning/REQUIREMENTS.md` - TIME-04 flipped to Complete, open counts corrected
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md` - `nyquist_compliant: true`, Manual-Only rows updated (history appended, never overwritten)
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md` - `human_verification` closed, `status: verified`
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-UAT.md` - test 9 updated
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-HUMAN-UAT.md` - the one pending item resolved
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-REVIEW.md` - `status: issues_resolved` (unconditional record-hygiene fix)
- `.planning/STATE.md` - `last_activity` + Quick Tasks Completed row (edited, left for the orchestrator to commit)

## Decisions Made

- **Auto-fixed the `defaultBinmonProbe()` bug (Rule 1).** This is squarely a broken-behavior bug in existing production code with zero prior test coverage (the only existing consumer test, `broker-launch.test.ts`, always injects a stub `binmonProbe`, never exercising the real implementation against a real socket). It directly blocked this task (Rule 3) and would have silently blocked every real stock-backend crash-respawn-then-warm-promotion in production, independent of this quick task.
- **Iterated on the harness, not the assertions (permitted explicitly by the plan's own Task 2 text).** Added a bounded `waitForPortOpen()` wait before the first claim once live testing revealed `handleAcquire()`'s cold-launch arm hands back a grant before the process finishes booting -- a real timing race, not a flaw in the proof's own logic.
- **Used `clearHeldStockSession()` between session B's successful claim and session A's re-attempt**, documented at length in the test file's own header and inline comments: `stock-dispatch.ts`'s `ensureStockSession()` holds exactly one live session per process, and naively re-dispatching with a different `targetId` would tear down (and release) the CURRENTLY held session before the new claim is even attempted -- defeating the entire two-simultaneous-claims scenario. `clearHeldStockSession()` detaches the module's own pointer without touching the broker, letting the next claim attempt race against the broker's real, still-live state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `defaultBinmonProbe()` never demuxed the wire by request-id**
- **Found during:** Task 2 (running the live proof against `/usr/bin/x64sc`)
- **Issue:** A fresh binmon connection always emits an unsolicited `REGISTER_INFO` (0x31) event at request-id `0xffffffff` before any command reply arrives. `defaultBinmonProbe()` (`broker-launch.mts`) assumed the first `BINMON_RESPONSE_HEADER_LEN` bytes on the wire were its own PING reply, read that event's own response-type byte, found it did not match `BINMON_CMD_PING`, and answered `false` -- forever. Since `maintainWarmFloor()`'s promotion pass (`"launching" -> "ready"`) is the ONLY thing that can ever mark a crash-respawned record grantable to a second session, and it relies entirely on this probe for the stock backend, a real crash-respawned instance could never be observed as ready, though the emulator was genuinely up and answering fine underneath.
- **Fix:** Rewrote the probe's `data` handler to walk complete frames off the buffer using each frame's own body-length field, discarding any frame whose request-id is not this probe's own (`BINMON_PROBE_REQUEST_ID`) rather than assuming the first frame on the wire is the reply.
- **Files modified:** `.claude/mcp/vice/broker-launch.mts`, `.claude/mcp/vice/resources/broker-launch.mjs` (rebuilt via `build.ts`)
- **Verification:** `broker-launch.test.ts` 63/63 unchanged; `stock-live-broker-monitor.test.ts` then passed reproducibly (three consecutive clean runs) against both genuine stock binaries.
- **Committed in:** `0b236f1`

### Harness Iterations (not deviations from the plan's own instructions -- explicitly permitted)

**2. Cold-launch binmon-port race** -- `handleAcquire()`'s cold-launch arm hands back a grant the instant the process is spawned, never waiting for a readiness probe (unlike the warm arm). Dialling the binmon port immediately after acquiring genuinely raced `ECONNREFUSED`. Fixed by adding a bounded `waitForPortOpen()` wait before the first real claim -- committed in `b3965eb`.

## Stub Tracking

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan's own threat register (T-obc-01..05, T-obc-SC) was followed as written: loopback-only binds, no pattern-matched process kills (only self-recorded pids), a dedicated mkdtemp state/config dir never touching the real `.vice-supervisor/`, the honesty gate itself, and the try/finally teardown discipline (verified with `pgrep` after every run). No new dependencies were installed.

## Self-Check: PASSED

- `FOUND: .claude/mcp/vice/stock-live-broker-monitor.test.ts`
- `FOUND: .claude/mcp/vice/broker-launch.mts` (modified)
- `FOUND: .claude/mcp/vice/resources/broker-launch.mjs` (modified, rebuilt)
- `FOUND: 662dfd4` in `git log --oneline`
- `FOUND: 0b236f1` in `git log --oneline`
- `FOUND: b3965eb` in `git log --oneline`
- `FOUND: d2a9235` in `git log --oneline`
- `node test-gate.mjs`: 1625 pass / 1 fail (pre-existing, unrelated -- see below) / 5 todo, unchanged from before this task's own changes
- `pgrep -af '[x]64sc'` and `pgrep -af 'vice-broker\.mjs'`: both empty after every live run, including the two that failed before the bug fix

## Deferred / Out-of-Scope Items

- `node test-gate.mjs` carries one pre-existing failure (`repo-root.test.ts`'s worktree-path artifact) already documented by prior quick tasks (`ff87d94`, `5499f10`) as a known, out-of-scope defect of running inside this specific worktree layout. Not caused by, and not fixed by, this task -- confirmed identical before and after this task's own changes.

## TDD Gate Compliance

Not applicable -- this plan's frontmatter does not declare `type: tdd`, and no task carries `tdd="true"`.
