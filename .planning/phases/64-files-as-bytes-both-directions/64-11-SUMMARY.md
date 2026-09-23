---
phase: 64-files-as-bytes-both-directions
plan: 11
subsystem: broker
tags: [live-test, gap-closure, G-64-1, systemd, real-emulator]

requires:
  - phase: 64-08
    provides: attach/transfer dispatched ahead of the per-boot control-token gate, authenticated by their broker-minted handle alone
  - phase: 64-09
    provides: the client-side empty-token parameter deleted from every dial option and dependency type
  - phase: 64-10
    provides: the broker and the client resolve broker.json through ONE shared resolver for every documented start route
provides:
  - "G-64-1's own truth measured live: vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load all return isError:false through the real vice-proxy.ts against a real systemd-run broker spawning the absolute /usr/bin/x64sc, with zero broker-side path leaks and the write-loss wording confirmed against a real attach-write-close cycle"
  - "A precisely-traced, reproducible THIRD live defect (out of G-64-1's own two root causes, already closed): a cold-launched instance's first relay attach races the real emulator's own startup and gets killed by the broker's kill-never-recycle release policy, blocking the FIRST stock tool call in a fresh session almost every time"
  - "64-g641-live-driver.mjs: a reusable, machine-path-free stdio driver for vice-proxy.ts, importable for scripted sequences or usable as a CLI"
  - "64-g641-live-check.md: the full measured record -- environment, unit command, path agreement, tool-call table, leak scan, write-loss cycle, both live defects, the petscii_upper finding, the nested Claude Code session, teardown, and the full-suite result"
affects: [phase-66]

actuals:
  tokens: 11032
  tasks: 3
  commits: 3
  plan_head_before: 47a4f266

tech-stack:
  added: []
  patterns:
    - "Retry-bounded first call, then reuse the held session: a session's FIRST stock tool call is retried (bounded) against the cold-launch race this plan discovered; every later call in the SAME session reuses the resulting held connection and needs no further retry -- proven both in the scripted driver and independently through a real nested Claude Code session."

key-files:
  created:
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md
    - .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "The plan's own prohibition on editing production code in this plan was honoured throughout, even after discovering a defect severe enough to block the plan's own central objective (every cold-start first tool call). The workaround used -- a bounded retry on the session's first call only, exercised at the test/driver level, never inside vice-proxy.ts or the broker -- reaches the plan's own required truth without crossing that line. The defect itself is filed as a new pending todo for a future plan or the owner to decide the remedy shape."
  - "Two smaller, unrelated findings (an intermittent vice_disk_attach 0x8f error, and a vice_keyboard_type petscii_upper default that garbles injected BASIC commands) are recorded in WINDOWS.md rather than chased or fixed -- neither is a G-64-1 root cause, and both are outside this plan's own files_modified."

requirements-completed: [XFER-01, XFER-02, XFER-08]

coverage:
  - id: D1
    description: "vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load each return isError:false through the real vice-proxy.ts against a real broker (systemd-run, /usr/bin/x64sc), with zero broker-side path leaks in any result"
    requirement: XFER-01
    verification:
      - kind: manual_procedural
        ref: "64-g641-live-check.md's tool-call table and leak-scan section -- a real, scripted, single-session run against a real systemd-run broker and real /usr/bin/x64sc"
        status: pass
      - kind: manual_procedural
        ref: "64-g641-live-check.md's nested Claude Code session section -- the same four tools (minus the write-loss cycle) independently reproduced through a real, separate claude -p session, read from the stream's own tool_result blocks"
        status: pass
    human_judgment: true
    rationale: "A live run against a real, non-deterministic emulator process is not a repeatable automated test -- the SUMMARY records what was measured on this host, on this run; a human should read the full evidence file, not just this pass/fail line, before treating G-64-1 as durably closed."
  - id: D2
    description: "The disk write-loss wording is judged against a real attach-write-close cycle: a SAVE that demonstrably reached the attached image during the session (screen-RAM directory proof), a session close, and the local image byte-identical to before"
    requirement: XFER-08
    verification:
      - kind: manual_procedural
        ref: "64-g641-live-check.md's Write-loss cycle section -- screen RAM decodes to SAVING/TESTSAVE/READY after the SAVE, the directory poll matches TESTSAVE's own screen codes on the first attempt after LOAD\"$\",8+LIST, and the local blank.d64's sha256 is unchanged after the session closes"
        status: pass
    human_judgment: true
    rationale: "Whether the wording 'survives being read out of context' (D-16) is a judgment call about language, not something a test asserts -- the evidence file states the judgement and the observation it rests on; a human should confirm they agree."
  - id: D3
    description: "The broker and client agree on broker.json's location for the documented start route with nothing configured on either side (plan 64-10's own fix, proven live rather than only under a stub fixture)"
    requirement: XFER-08
    verification:
      - kind: integration
        ref: "64-g641-live-check.md's Broker/client path agreement section -- a child node process's own answer (pid, heartbeat, path) matches the broker's own journal line and broker.json record exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "A precisely-traced, reproducible live defect (cold-launch relay-attach race, killed by kill-never-recycle release) is recorded, not silently worked around or fixed"
    verification: []
    human_judgment: true
    rationale: "Whether the citation-backed root-cause trace in 64-g641-live-check.md and the new pending todo are complete and actionable for a future plan is an editorial judgment a human should make, not an automated check."

duration: 50min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 11: G-64-1's Own Truth, Measured Live Summary

**A real systemd-run broker spawning the absolute `/usr/bin/x64sc` granted an unconfigured `vice-proxy.ts` session all four migrated tools with zero path leaks and a confirmed write-loss cycle — and the run also caught, precisely traced, and worked around (without patching) a third, previously-invisible live defect: a cold-launched instance's first relay attach races the real emulator's own boot time and gets killed by the broker's own kill-never-recycle release policy.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-23T18:45:00Z (approx.)
- **Completed:** 2026-09-23T19:32:00Z
- **Tasks:** 3
- **Files created:** 3 (1 driver script, 1 evidence document, 1 pending todo)
- **Files modified:** 1 (WINDOWS.md, two new deviation entries)

## Accomplishments

- `64-g641-live-driver.mjs`: a machine-path-free stdio driver for the real `vice-proxy.ts`, exporting `spawnLiveDriverSession()`/`callTool()`/`pollTool()` for programmatic use and a CLI mode for a declarative JSON sequence. No broker-location env var is ever injected, so the spawned proxy resolves `broker.json` exactly as an ordinary Claude Code session would.
- A real broker, started as a systemd user unit (`vice-broker-g641`, `--collect`, `VICE_BIN=/usr/bin/x64sc`, no `--repo-root`, no `VICE_BROKER_HOME`, no `VICE_POOL_DIR`) via this checkout's own `vice-cli.mjs broker` subcommand — the same code path `npx -y @henols/vice-mcp broker` and both committed service definitions run. The client's own `brokerJsonPath()`/`readBrokerLiveness()` answer matched the broker's own journal and `broker.json` record exactly (plan 64-10's fix, proven live).
- `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and `vice_snapshot_load` each returned `isError: false` in a real, scripted session, with a leak scan over every raw result finding zero occurrences of the broker's machine root (D-15/D-17). The sentinel load evidence is a memory read against a negative control (never a screenshot); the write-loss wording was read against a real attach-write-close cycle (a screen-RAM directory listing proving the write reached the attached image during the session, and an unchanged local `sha256` proving it never came back).
- The same four tools (plus `vice_ping`) were independently driven through a real, separate, nested `claude -p` session, read from the stream's own `tool_result` blocks — not the model's retelling — confirming the finding and the workaround generalize outside this plan's own scripted driver.
- **Discovered, precisely traced, and NOT fixed (production edits are prohibited in this plan):** a cold-launched instance's very first relay attach races the real emulator's own startup — `handleAcquire()`'s cold arm grants immediately on spawn with no readiness wait, `handleMonitorClaim()`/`handleRelayAttach()` add no readiness check, and `spliceRelay()` dials the freshly-spawned port immediately with no retry. On failure, the client's own release triggers `handleRelease()`'s kill-never-recycle policy, killing a process an isolated probe proved was otherwise healthy and would have become reachable within another second or two. `vice-proxy.ts`'s own `brokerWarmingMessage()` comment names the INTENDED behaviour ("retry the same call, it should succeed once the instance finishes booting") but no code path implements the wait that would make that converge. Filed as a new pending todo; recorded fully in the evidence file with exact line citations.
- Two smaller, unrelated findings recorded in `WINDOWS.md`: an intermittent `vice_disk_attach` 0x8f "condition syntax error" (functionally the attach seemed to still take effect once), and `vice_keyboard_type`'s default `petscii_upper:true` garbling injected BASIC commands on real VICE (`petscii_upper:false` worked correctly). Neither is a G-64-1 root cause; neither was investigated further.
- Teardown verified clean on all four checks (unit inactive, no matching process, no listener on 19510 or any 66xx port) after every run, including after the two intermediate diagnostic sessions this plan's own investigation required. Full-glob suite green: 4416 tests, 4332 pass, 0 fail, 84 skipped.

## Task Commits

1. **Task 1: Tracer — a clean host, the live subjects, and a systemd-unit broker the unconfigured client finds** — `79a6526e` (feat) — the driver script; the tracer's own live run is what first surfaced the cold-launch race (see Deviations)
2. **Task 2: The four tools, the text channel and the write-loss cycle — scripted, then through a real Claude Code session** — folded into Task 3's commit (no further driver changes were needed; see Deviations)
3. **Task 3: Teardown, the clean suite, and the live record** — `96ae2a24` (docs) — the evidence file, the new pending todo, and the two `WINDOWS.md` entries

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs` — the reusable stdio driver
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md` — the full measured record
- `.planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md` — the new live defect, precisely traced
- `.planning/WINDOWS.md` — two new `deviation` entries (the intermittent disk-attach error, the petscii_upper finding)

## Decisions Made

See `key-decisions` in the frontmatter: the production-code prohibition was honoured throughout by using a test-level retry rather than any change to `vice-proxy.ts`/`vice-broker.mts`/`broker-relay.mts`; the two smaller findings were recorded, not chased, matching this plan's own scope boundary.

## Deviations from Plan

### Discovered, out-of-scope live defects (not Rule 1-4 auto-fixes — production edits are prohibited in this plan)

**1. [Live defect] A cold-launched instance's first relay attach races the real emulator's own startup, killed by kill-never-recycle on failure**
- **Found during:** Task 1's own tracer run (the plan's own smallest sequence, `vice_ping` alone)
- **Issue:** 11 consecutive stock tool calls against a freshly cold-started broker failed identically with `"stock handshake failed (binary monitor connection closed/errored with 1 request(s) abandoned)"`, each within ~15-40ms of the broker's own launch line, each leaving the emulator's own log file at 0 bytes. An isolated probe (acquire, no attach) proved the emulator process itself stays healthy for 3+ seconds when nothing races it. The dial (`spliceRelay()`) has no retry; the resulting failure's own release path (`handleRelease()`) kills the still-booting process. Full trace with line citations in `64-g641-live-check.md`.
- **Fix:** NOT fixed — explicitly prohibited by this plan's own frontmatter. Worked around at the test level: the driver's `pollTool()` retried the session's first call (bounded, 500ms interval, 60s ceiling) until one attempt won the race; every later call in the same session reused the resulting held connection.
- **Files modified:** None (production code untouched).
- **Verification:** Reproduced 11/11 times in isolation; reproduced independently through a real nested `claude -p` session (first `vice_ping` attempt failed identically, second succeeded).
- **Committed in:** `96ae2a24` (evidence + new pending todo)

**2. [Live defect, minor] Intermittent `vice_disk_attach` 0x8f "condition syntax error"**
- **Found during:** Task 2's own scripted session
- **Issue:** Roughly one attempt in three, after a prior `vice_snapshot_load`/`vice_run_until` sequence in the same session, `vice_disk_attach` returned `isError: true` with a monitor-level condition-syntax error; in one such case the underlying attach appeared to have taken effect anyway (a subsequent SAVE and directory listing succeeded). Plausibly a stale checkpoint-condition collision, not investigated further.
- **Fix:** NOT fixed — outside this plan's own scope. Worked around with a bounded (3-attempt) retry in the driver's own orchestration.
- **Files modified:** None.
- **Verification:** Recorded in `64-g641-live-check.md`; a `WINDOWS.md` `deviation` entry filed.
- **Committed in:** `96ae2a24`

**3. [Finding, unrelated tool] `vice_keyboard_type`'s default `petscii_upper:true` garbles injected BASIC commands on real VICE**
- **Found during:** Task 2's own write-loss cycle (the SAVE command typed with the default setting produced a `SYNTAX ERROR` on screen; `petscii_upper:false` worked correctly)
- **Fix:** NOT fixed — `vice_keyboard_type` is an existing tool, untouched by Phase 64's own migration work, out of this plan's scope.
- **Files modified:** None.
- **Verification:** Recorded in `64-g641-live-check.md`; a `WINDOWS.md` `deviation` entry filed.
- **Committed in:** `96ae2a24`

### Procedural deviations

**4. Task 2's own `<files>` entry (the driver script) required no changes.** The driver's exported `spawnLiveDriverSession()`/`callTool()`/`pollTool()` from Task 1 already covered everything Task 2's own action needed; the actual Task 2 orchestration (retry-until-success on the first call, the write-loss cycle, the screen-RAM directory poll) lives in a scratch script that imports the committed driver, per the plan's own "everything goes under a fresh scratch directory" prohibition. Task 2's own commit is therefore folded into Task 3's, disclosed here rather than presented as a clean per-task history.

**5. A subject-construction mistake, found and fixed within this plan, not a project defect.** The first BASIC sentinel subject used `10 POKE 49152,201` (uppercase); `petcat -w2`'s tokenizer is case-sensitive on the keyword and silently failed to recognise uppercase `POKE`, writing raw character bytes instead of the real token (confirmed by listing the result back: `10 goval 49152,201`, clearly wrong). Rebuilt with lowercase `10 poke 49152,201`, confirmed round-tripping correctly, and the disk image was rebuilt before the load-evidence run. Recorded in the evidence file so a reader of an early transcript understands why the very first diagnostic pass showed no load.

---

**Total deviations:** 3 discovered live defects/findings (none fixed, per this plan's own explicit prohibition — all recorded with full evidence and citations), 1 procedural commit-folding disclosure, 1 self-corrected test-fixture mistake.
**Impact on plan:** The plan's own central objective — G-64-1's truth measured live — was reached for all four migrated tools. The newly-discovered cold-launch race is a genuine, severe finding (it blocks the first tool call of almost every fresh session on this host) but is squarely out of this plan's own scope to fix; it is now on record, precisely traced, with a suggested remedy shape left for the owner or a future plan to decide.

## Issues Encountered

None beyond the live defects and the self-corrected subject-construction mistake, both documented above and in the evidence file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 64 is now 11 of 11 plans executed. G-64-1 (UAT test 1) is closed for its own two root causes (plans 64-08/64-09/64-10) and its own truth is now measured live (this plan) — the phase is ready for verification, not yet marked complete (verification decides that).
- A new, severe, precisely-traced live defect (the cold-launch relay-attach race) is now on record for a future plan or the owner to decide the remedy shape for — see the new pending todo. It is NOT a G-64-1 root cause and does not block this phase's own completion, but it affects the reliability of literally every fresh broker session on a real host and should be weighed at the next planning point.
- Two smaller findings (`vice_disk_attach`'s intermittent 0x8f, `vice_keyboard_type`'s `petscii_upper` default) are recorded in `WINDOWS.md` for the same reason.

## Self-Check: PASSED

- `FOUND: .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs`
- `FOUND: .planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md`
- `FOUND: .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md`
- Commits `79a6526e`, `96ae2a24` both present in `git log --oneline -5`
- Host confirmed clean post-teardown: `systemctl --user is-active vice-broker-g641.service` → `inactive`; no matching process; no listener on 19510 or any 66xx port; `systemctl --user list-units --all 'vice-broker-g641*'` → 0 units

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*
