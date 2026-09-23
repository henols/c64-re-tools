---
phase: 64-files-as-bytes-both-directions
plan: 14
subsystem: broker
tags: [live-check, g-64-3, g-64-4, systemd, x64sc, 0x8f, cold-launch]

# Dependency graph
requires:
  - phase: 64 (plans 64-12, 64-13)
    provides: the gated relay attach (G-64-4) and the completion-reply-gated upload (G-64-3)
provides:
  - "the reproducible live orchestration script (evidence/64-g643-g644-live-run.mjs), reusing 64-g641-live-driver.mjs's spawnLiveDriverSession()/parsedContentOf()"
  - "the measured live record (evidence/64-g643-g644-live-check.md) proving both gaps closed against genuine stock /usr/bin/x64sc (VICE 3.9) and a systemd-unit broker"
  - "correction of 64-g641-live-check.md's mistraced 'Live defect 1' to the real mechanism in .planning/debug/cold-launch-relay-attach-race.md"
affects: []

# Actuals (#2632)
actuals:
  tokens: 5828
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live phase orchestration built on a shared spawn/transcript module: 64-g643-g644-live-run.mjs adds named phases (cold, cold-text, recycle, loop, autostart) as functions importing 64-g641-live-driver.mjs's spawnLiveDriverSession()/parsedContentOf(), never re-implementing stdio JSON-RPC framing."
    - "Pacing cold sessions by polling for process absence (ps -eo pid,cmd matching x64sc) rather than parsing the broker's journal in real time -- the journal's own launching-line count is read AFTER the run, as the actual proof each session cold-launched."

key-files:
  created:
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g643-g644-live-run.mjs
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-g643-g644-live-check.md
  modified: []

key-decisions:
  - "The autostart burst's sentinel-load poll timed out (90s, 46 attempts, never reached the sentinel) but this is disclosed, not treated as a plan failure: the plan's own pass rule for that phase is the burst's isError/0x8f result (both clean, 5/5), and the action's own wording is 'record which' outcome the poll reaches, not 'the sentinel must load'. No production code was touched to investigate further, per this plan's own prohibition."
  - "The recycle's post-respawn vice_ping returned isError:true with an epoch-mismatch identity refusal, not G-64-4's signature text -- exactly the 'by-design identity refusal after the respawn' the plan's own action explicitly anticipated as an acceptable outcome to record verbatim, followed by one further vice_ping (which succeeded)."
  - "Task 2 required no additional code change to evidence/64-g643-g644-live-run.mjs beyond what Task 1 already committed: all five phases (cold, cold-text, recycle, loop, autostart) were authored in the one script Task 1 delivers, since the file is a single cohesive CLI/module and splitting it across two commits with no intervening functional difference would not reflect an actual code change. Task 2's own commit therefore carries only the evidence-file update (which subsumes Task 2's own results) plus Task 3's teardown/suite work; no separate no-op commit was created for Task 2 alone."

requirements-completed: [XFER-02, XFER-08]

coverage:
  - id: D1
    description: "G-64-4 holds live: every cold session's first call (vice_ping x5, vice_warp_set x2) succeeds on the first attempt, no retry, one launch per session, zero relay_error deaths"
    requirement: "XFER-08"
    verification:
      - kind: manual_procedural
        ref: "evidence/64-g643-g644-live-check.md#task-1-cold-sessions-on-both-channels (live run against genuine /usr/bin/x64sc, journal-verified: 7 launching lines, 0 relay_error deaths)"
        status: pass
    human_judgment: false
  - id: D2
    description: "G-64-3 holds live: 135 calls (3x memory_read+execution_run, snapshot_save, snapshot_load, disk_attach across 15 iterations) all isError false with zero 0x8f, against a diagnosis baseline of 20/30 failures"
    requirement: "XFER-02"
    verification:
      - kind: manual_procedural
        ref: "evidence/64-g643-g644-live-check.md#loop----15-iterations-zero-0x8f (live run, 135/135 clean)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The recycle's first post-respawn attach does not carry G-64-4's signature; the autostart burst is clean on isError/0x8f"
    verification:
      - kind: manual_procedural
        ref: "evidence/64-g643-g644-live-check.md#recycle and #autostart-burst"
        status: pass
    human_judgment: false
  - id: D4
    description: "The host is left clean (broker stopped, no process, no listeners) and the full-glob suite passes with no broker running"
    verification:
      - kind: manual_procedural
        ref: "evidence/64-g643-g644-live-check.md#task-3----teardown-and-the-full-suite (4441/4357/0/84, exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The owner's own in-session re-run of the fixed code, as a fresh Claude Code session"
    verification: []
    human_judgment: true
    rationale: "This plan's own <human-check> explicitly queues the owner's own reconnect/re-verify as a separate, un-automatable confirmation -- it was not performed by this executor and is recorded as pending."

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 64 Plan 14: G-64-3 and G-64-4 Measured Live, Both Closed Against Genuine Stock x64sc Summary

**Against a systemd-unit broker and the absolute `/usr/bin/x64sc` (VICE 3.9), every cold session's first call succeeded with no retry (0/9 in the diagnosis vs. 7/7 here) and the upload-then-command race behind `0x8f` measured 0 failures across 135 calls (vs. 20/30 in the diagnosis) -- both gaps close live, and the host is left exactly as clean as it was found.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-23T23:05:00Z
- **Completed:** 2026-09-23T23:26:31Z
- **Tasks:** 3
- **Files modified:** 2 (both created)

## Accomplishments
- `evidence/64-g643-g644-live-run.mjs` (a reproducible orchestration script reusing `64-g641-live-driver.mjs`'s one spawn/transcript implementation) drove 5 cold `vice_ping` sessions and 2 cold `vice_warp_set` sessions against a real, transient systemd-unit broker spawning genuine stock `/usr/bin/x64sc` -- every one of the 7 succeeded on its FIRST attempt with no retry, a direct reversal of `.planning/debug/cold-launch-relay-attach-race.md`'s own measured baseline (0/9 first-attempt success). The journal confirms exactly 7 `launching` lines and zero `relay_error` relay deaths.
- The recycle path's first post-respawn attach was measured: the post-recycle `vice_ping` returned a by-design epoch-mismatch identity refusal, not G-64-4's "stock handshake failed ... abandoned" signature -- recorded verbatim, followed by a further `vice_ping` that succeeded, exactly as the plan's own action anticipated as an acceptable outcome.
- The exact loop `.planning/debug/vice-0x8f-disk-attach-snapshot-load.md` measured (3x memory_read+execution_run, snapshot_save, snapshot_load, disk_attach, 15 iterations = 135 calls) ran with **zero** `isError:true` and **zero** `0x8f` occurrences -- against a diagnosis baseline of 20/30 failures on the unmodified production proxy, closing G-64-3 live.
- A 5-call `vice_autostart` burst was clean on `isError`/`0x8f` (the plan's own pass rule for that phase); the sentinel-load poll afterward timed out at 90s, disclosed honestly in the evidence rather than investigated or silently retried, since it is out of this plan's own scope (no production-code edits permitted) and not one of the plan's own must-have truths.
- The broker was stopped and all four teardown checks (`systemctl --user is-active`, live process grep, port 19510, ports 66xx) read clean; the full-glob suite then ran with the broker confirmed down and stayed at the post-64-13 baseline: `4441/4357/0/84`, exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer -- cold sessions on both channels** - `ed670985` (feat) -- the orchestration script (all five phases authored in one file) plus the cold/cold-text live measurement, verified via the task's own `<verify>` journal checks before committing.
2. **Task 2 + Task 3: recycle/loop/autostart measurement, teardown, evidence, suite** - `2f094adb` (docs) -- Task 2 required no further code change to the already-committed script (see Decisions below); this commit carries the evidence file, which documents both Task 2's and Task 3's measured results.

**Plan metadata:** (this commit)

_Note: Task 2 produced no independent code diff -- see "Decisions Made" for why its results are folded into the Task 3 evidence commit rather than a separate no-op commit._

## Files Created/Modified
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g643-g644-live-run.mjs` - the reproducible orchestration script: `cold`, `cold-text`, `recycle`, `loop`, `autostart` phases, built on `64-g641-live-driver.mjs`'s `spawnLiveDriverSession()`/`parsedContentOf()`
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g643-g644-live-check.md` - the measured live record for both gaps, the teardown record, the full-suite result, and the correction to `64-g641-live-check.md`'s "Live defect 1"

## Decisions Made
See `key-decisions` in the frontmatter above.

## Deviations from Plan

None - plan executed exactly as written. The autostart sentinel-poll timeout and the recycle's epoch-mismatch outcome are both explicitly anticipated, recordable outcomes per the plan's own action text, not deviations from it.

## Issues Encountered

- The autostart burst's sentinel-load poll (90s, 46 attempts) never observed the sentinel byte, staying at `hex:"ff"`/`runState:"stopped"` throughout, despite all 5 `vice_autostart` calls reporting `isError:false`/`runState:"running"`. Disclosed in the evidence file with an explicitly UNVERIFIED, speculative explanation (five rapid-fire AUTOSTART commands each possibly interrupting the previous one's own load/keystroke sequence before completion) -- not chased further, since production-code edits are prohibited in this plan and this observation is not one of the plan's own must-have truths (the pass rule for this phase is the burst's own `isError`/`0x8f` cleanliness, which held).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G-64-3 and G-64-4 both hold live against the real broker and genuine stock `/usr/bin/x64sc`. This closes the gap-closure work plans 64-12/64-13/64-14 were dispatched for.
- The owner's own in-session re-run (this plan's `<human-check>`) is queued and PENDING -- not performed by this executor. See "Human-check queued for the owner" in `evidence/64-g643-g644-live-check.md` for the exact steps.
- Full-suite baseline unchanged: `4441/4357/0/84`, exit 0 -- identical to plan 64-13's own post-dispatch baseline. No regressions.
- No live broker was left running by this plan; `systemctl --user is-active vice-broker-g6434.service` reads `inactive`, no `x64sc`/`vice-broker` process, no listener on 19510 or any 66xx port. `systemctl --user list-units --all 'vice-broker-g6434*'` shows 0 loaded units (the `--collect` unit unloaded itself on stop).
- The disclosed autostart sentinel-timeout observation (see "Issues Encountered") is left as an open, unchased question for whoever next touches `vice_autostart`'s keystroke-injection path -- not filed as a WINDOWS.md entry, since it does not fit the ledger's stub/skipped-test/unrun-verify/deviation vocabulary and did not fail this plan's own pass rule.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-24*
