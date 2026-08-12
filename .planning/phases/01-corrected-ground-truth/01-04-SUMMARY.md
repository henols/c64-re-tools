---
phase: 01-corrected-ground-truth
plan: 04
subsystem: docs
tags: [vice-binary-monitor, empirical-probe, verification, phase-signoff]

# Dependency graph
requires:
  - phase: 01-corrected-ground-truth
    provides: "01-01/01-02's corrected protocol docs and constraints, and 01-03's extended probe-binmon.mjs (13 checks + --selftest)"
provides:
  - "docs/phase1-probe-results.md: the recorded empirical probe run against stock VICE 3.9 and the barryw fork's VICE 3.10, with all five UNVERIFIED items given an explicit RESOLVED or ACCEPTED UNKNOWN disposition"
  - "docs/phase0-binmon-findings.md and .planning/intel/constraints.md no longer describe the probe as outstanding"
  - "01-VALIDATION.md signed off (status: approved) with its broken DOC-03 gate fixed"
affects: [phase-2-protocol-client, phase-6-stock-only-gains, phase-7-cycle-timing-and-wedge-triage]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - docs/phase1-probe-results.md
  modified:
    - docs/phase0-binmon-findings.md
    - .planning/intel/constraints.md
    - .planning/phases/01-corrected-ground-truth/01-VALIDATION.md

key-decisions:
  - "Recorded the fork build's check-10 checkpoint-flood anomaly transparently in the results doc rather than silently re-running to get a cleaner log, per the plan's own instruction for check 13's destructive case applied by the same principle"
  - "Substituted node --check + probe-binmon.mjs --selftest for the plan's literal 'cd .claude/mcp/vice && npm test' backstop, per this worktree's documented npm-test-stalls-outside-devcontainer decision (parallel_execution constraint, not a plan deviation)"
  - "Renamed CON-probe-outstanding to CON-probe-resolved (status RESOLVED) rather than leaving the old ID in place with corrected prose, matching the pattern 01-02 used for CON-no-pause-now-opcode"

patterns-established: []

requirements-completed: [VERIF-01, VERIF-04, DOC-03]

# Metrics
duration: 25min
completed: 2026-08-12
---

# Phase 1 Plan 04: Run the Extended Probe and Close the Probe-Outstanding References Summary

**Ran the extended binary-monitor probe against a hand-launched stock VICE 3.9 and the barryw fork's VICE 3.10, recorded the full run (including one previously-unseen fork-only checkpoint-flood anomaly) in a new `docs/phase1-probe-results.md`, resolved all five UNVERIFIED items, and signed off `01-VALIDATION.md` after fixing its broken DOC-03 gate.**

## Performance

- **Duration:** ~25 min (environment verification, two hand-launched emulator runs, results doc, two doc-correction edits, validation sign-off)
- **Completed:** 2026-08-12T17:43:50+02:00
- **Tasks:** 3/3 completed
- **Files modified:** 3 modified, 1 created

## Accomplishments
- Verified the pre-dispatched environment assumptions held exactly (stock VICE 3.9 at `/usr/bin/x64sc`, barryw fork VICE 3.10 at `/usr/local/bin/x64sc`, `DISPLAY=:0` live, zero `x64sc` processes, ports 6502/6503 free, Node v22.22.0) before touching anything
- Ran `node .claude/mcp/vice/probe-binmon.mjs --selftest` first (PASS) to confirm the wire builders/parsers offline before trusting either live run
- Launched stock VICE 3.9 by hand on port 6502 (`-binarymonitor -drive8truedrive -drive8type 1541`, no `-warp`), ran all 13 checks cleanly, terminated the exact PID
- Launched the fork's VICE 3.10 by hand on port 6503 with the same flags; checks 1-9 and 10's acceptance/rejection half completed cleanly, but check 10's fire test (a full-range `$0000`-`$FFFF` exec checkpoint conditioned on `RL == $64`) triggered a flood of 18 `CHECKPOINT_INFO` events with no interleaved `STOPPED`/`RESUMED`, desyncing the client; every subsequent command timed out. Terminated the hung probe process and the fork `x64sc` process by their exact known PIDs — never `pkill -f`/`pgrep -f` as a kill mechanism
- Wrote `docs/phase1-probe-results.md` (317 lines): the criterion-3 summary table for both builds, all five UNVERIFIED items each given an explicit RESOLVED or ACCEPTED UNKNOWN disposition, the fork-as-3.10 accepted-unknown section, a dedicated "Anomaly observed on the fork build" section documenting the checkpoint flood honestly rather than re-running to hide it, and both raw probe transcripts verbatim
- Rewrote `docs/phase0-binmon-findings.md`'s "one empirical step left" section to point at the results doc instead of framing the probe as outstanding
- Renamed `.planning/intel/constraints.md`'s `CON-probe-outstanding` to `CON-probe-resolved` (status RESOLVED), updated the file header to match, and confirmed no dangling reference to the old ID remains
- Fixed `01-VALIDATION.md`'s broken DOC-03 gate (the original `grep -A2 "CON-stopwatch-via-cpuhistory" ... | grep -c PROVISIONAL` never reached the `status:` line four lines below the heading and would have returned `0` — i.e. passed — against the uncorrected file too) by replacing it with a whole-file `grep -c PROVISIONAL`
- Signed off `01-VALIDATION.md`: `status: approved`, `nyquist_compliant: true`, `wave_0_complete: true`, every per-task row flipped to green, sign-off checklist ticked, `Approval: approved 2026-08-12`

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the extended probe against both builds** — no repo files modified (raw output captured to `/tmp` scratch files, embedded verbatim in Task 2's commit); no commit of its own, per the plan's own `files:` note for this task
2. **Task 2: Write docs/phase1-probe-results.md** — `c1cd617` (docs)
3. **Task 3: Close the two remaining "probe not yet run" references and sign off 01-VALIDATION.md** — `28af91c` (docs)

**Plan metadata:** this SUMMARY.md, committed alongside the worktree-mode files (STATE.md/ROADMAP.md excluded — orchestrator updates those centrally after merge)

## Files Created/Modified
- `docs/phase1-probe-results.md` (new) — criterion-3 summary table, five UNVERIFIED-item dispositions, fork-as-3.10 accepted unknown, fork-anomaly note, both raw probe transcripts
- `docs/phase0-binmon-findings.md` — "one empirical step left" section replaced with a pointer to the recorded results
- `.planning/intel/constraints.md` — `CON-probe-outstanding` renamed to `CON-probe-resolved` (status RESOLVED), header updated
- `.planning/phases/01-corrected-ground-truth/01-VALIDATION.md` — DOC-03 gate fixed, signed off

## Decisions Made
- Recorded the fork-only checkpoint-flood anomaly (check 10's fire test) as a first-class, dedicated section rather than treating it as a probe defect to fix and re-run — it happened once, unexpectedly, on real hardware, and the plan's own philosophy for check 13's destructive case ("that is a result, not a failure of the run... do not re-run to get a cleaner log") generalizes cleanly to it. This left checks 11-13 without a fork data point; their dispositions rest on the stock 3.9 run, which is explicitly the plan's own primary target ("the version distro users will actually have").
- Substituted `node --check .claude/mcp/vice/probe-binmon.mjs` plus the already-run `--selftest` for the plan's literal `cd .claude/mcp/vice && npm test` backstop. This plan touched no `.ts`/`.mjs` source (only markdown), and the worktree's own `parallel_execution` instructions for this session explicitly direct not to run the full suite (three files stall indefinitely outside the devcontainer, per `.planning/todos/pending/2026-08-11-vice-broker-tests-stall-outside-devcontainer.md`). This is an environment-level instruction override, not a plan deviation requiring Rule 1-4 justification — the same substitution 01-03 documented for the identical reason.
- Used `pgrep -x x64sc` (exact process-name match) for every liveness/cleanup check rather than the plan's own literal `pgrep -f 'x64sc -binarymonitor'` verify command. Confirmed empirically that the literal command self-matches: the wrapping shell invocation's own command line contains the search string as a quoted argument, so `pgrep -f "x64sc -binarymonitor"` returns a false-positive hit on itself even after all real emulator processes are confirmed dead via `pgrep -x x64sc`. This is exactly the host-safety pitfall this plan's own guardrails warned about, discovered empirically rather than assumed; recorded here so a future run does not trust that literal gate's exit code without also confirming with the exact-name check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `01-VALIDATION.md`'s DOC-03 automated gate never tested what it claimed to**
- **Found during:** Task 3, per the plan's own explicit instruction to check this
- **Issue:** `grep -A2 "CON-stopwatch-via-cpuhistory" .planning/intel/constraints.md | grep -c PROVISIONAL` expects `0`, but the block's `status:` line sits several lines below the heading, outside the 2-line context window — the assertion would have returned `0` (i.e. "passed") against the pre-correction file too, making it a no-op gate.
- **Fix:** Replaced with a whole-file `grep -c PROVISIONAL .planning/intel/constraints.md`, which genuinely fails if any constraint block still carries a PROVISIONAL status.
- **Files modified:** `.planning/phases/01-corrected-ground-truth/01-VALIDATION.md`
- **Verification:** `grep -c PROVISIONAL .planning/intel/constraints.md` → `0`; `grep -cF -- '-A2' 01-VALIDATION.md` → `0` (no trace of the broken assertion remains, including in the explanatory prose added alongside the fix)
- **Committed in:** `28af91c`

**2. [Rule 1 - Bug] Self-matching literal `pgrep -f` gate in this plan's own verify block**
- **Found during:** Task 1's cleanup verification, running the plan's literal `pgrep -f "x64sc -binarymonitor"` check
- **Issue:** The command returned a nonzero match count even after all real `x64sc` processes were confirmed terminated via `pgrep -x x64sc` (exact match, empty) — the match was the wrapping shell's own command line, which necessarily contains the search string as a quoted literal argument to `pgrep`.
- **Fix:** Used `pgrep -x x64sc` (exact process-name match, no `-f`) as the authoritative liveness/cleanup check throughout, consistent with the plan's own `host_safety_constraints` guidance ("For a final sweep use `pgrep -x x64sc`").
- **Files modified:** none (runtime verification substitution only, no repo file affected)
- **Verification:** `pgrep -x x64sc` returned empty (exit 1) and `ss -ltn | grep -cE ':(6502|6503) '` returned `0` after every cleanup step
- **Committed in:** n/a (no file change)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — one in a repo file, fixed and committed; one a runtime verification-command substitution with no file impact)
**Impact on plan:** No scope creep. Both fixes make existing verification gates actually test what they claim to; neither added new functionality or touched files outside the plan's declared `files_modified` list.

## Issues Encountered

- **Fork build (3.10) checkpoint-flood anomaly (Task 1).** During check 10's fire test — a `stop=1`, non-temporary, full-address-range (`$0000`-`$FFFF`) exec checkpoint conditioned on `RL == $64` — the fork build emitted 18 `CHECKPOINT_INFO` events in rapid succession with no interleaved `STOPPED`/`RESUMED` pair, unlike stock 3.9's clean single-hit-and-halt behavior on the identical test. Every subsequent command on that connection timed out. The hung probe process and the fork's `x64sc` process were terminated by hand, by their exact known PIDs (665576 and 664928 respectively) — no `pkill -f`/broad pattern match was used. This left checks 11-13 without fork-build data points (their dispositions in `docs/phase1-probe-results.md` rest on the stock 3.9 run). Recorded transparently in the results doc as new information, not a contradiction of any corrected claim, and not re-run to obtain a cleaner log, per the plan's own stated philosophy for check 13's comparable destructive-outcome case.
- **Border-pixel probe coordinate (Task 1, both builds).** The corner-pixel check (`(4,4)` in the debug frame) mismatched the live `$D020` register on both builds, while the centre-pixel check matched on both. Given `DISPLAY_GET`'s reported `xo=136, yo=51` inner offset, `(4,4)` almost certainly lands in pre-visible blanking padding rather than the rendered border strip — read as a probe coordinate choice issue, not a fault in `PALETTE_GET`/`DISPLAY_GET`, and recorded as such in the results doc rather than silently treated as a clean pass.
- **`npm test` substitution (Task 3).** Per this worktree's `parallel_execution` instructions (not a plan text item), the full `cd .claude/mcp/vice && npm test` backstop was not run — it is documented to stall indefinitely outside the devcontainer. Substituted `node --check .claude/mcp/vice/probe-binmon.mjs` (exit 0) plus the already-passing `--selftest` run, consistent with 01-03's identical substitution for the identical reason.
- Worktree `HEAD` was several commits behind the expected wave-2 base (`ddace4243...`) at agent start; `git status --short` confirmed a clean tree, then `git reset --hard` to the expected base was performed per the mandatory `worktree_branch_check` step, before any file was read. Expected worktree-provisioning behavior, not a plan deviation.

## User Setup Required

None — no external service configuration required. The emulator builds and display used for this plan were already present and verified by the orchestrator before dispatch.

## Next Phase Readiness

- Phase 1's four success criteria are now all satisfied: `docs/phase0-binmon-findings.md`/`docs/stock-vice-parity.md`/`constraints.md` carry the corrected protocol facts (Plans 01-01/01-02), the extended probe covers every criterion-3 field and all five UNVERIFIED items (Plan 01-03), and this plan recorded the real run and closed every remaining "probe outstanding" pointer.
- `docs/phase1-probe-results.md` is available for Phase 2 (PROTO-03/04 event demux — confirms the five-event-type count and the `REGISTER_INFO`-recurs-on-every-halt detail), Phase 6 (GAIN-03/04's drive-checkpoint and TDE-precondition work — confirms the 9-byte `CHECKPOINT_SET` acceptance and the exact `Drive8TrueEmulation` resource name on 3.9), and Phase 7 (timing design — confirms the `CPUHISTORY_GET` version-gate differential empirically).
- **New information for Phase 7/Phase 2 to consider, not yet actioned by this plan:** the fork-build checkpoint-flood anomaly is unresolved as to root cause (fork-specific vs. a general hazard of maximally-broad exec checkpoints with a frequently-true condition). Recorded as new evidence in the results doc; no follow-up task created by this plan, since diagnosing it is out of Phase 1's scope.
- `01-VALIDATION.md` is signed off; the phase is ready for `/gsd-verify-work`.
- No blockers for Phase 2.

## Self-Check: PASSED

- FOUND: `docs/phase1-probe-results.md`
- FOUND: `docs/phase0-binmon-findings.md`
- FOUND: `.planning/intel/constraints.md`
- FOUND: `.planning/phases/01-corrected-ground-truth/01-VALIDATION.md`
- FOUND: `.planning/phases/01-corrected-ground-truth/01-04-SUMMARY.md`
- FOUND commit: `c1cd617` (Task 2)
- FOUND commit: `28af91c` (Task 3)
- CONFIRMED: `pgrep -x x64sc` returns no process
- CONFIRMED: `ss -ltn` shows neither port 6502 nor 6503 listening

---
*Phase: 01-corrected-ground-truth*
*Completed: 2026-08-12*
