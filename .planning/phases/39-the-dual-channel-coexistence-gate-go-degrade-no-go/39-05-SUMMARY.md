---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 05
subsystem: testing
tags: [tracer, live-measurement, chan-01, dual-channel, vice, stock-vice, concurrent-inflight, hitcount-invariant, binary-monitor, text-monitor]

requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: "39-03/39-04's shared probe-harness.mjs/textmon-probe-client.mjs, including armStoppingExec()/memspaceBody from 39-04, reused rather than re-derived"
provides:
  - "CONCURRENT_INFLIGHT: clean -- both writes (binary AdvanceInstructions, text prof flat 5) issued before either reply is awaited, three repetitions, all six replies matched and within budget, zero desync/duplicate deltas"
  - "CONCURRENT_WRITE_GAP_MS: 0 -- the largest observed wall-clock gap between the two socket writes, recorded as a caveat, never a threshold"
  - "HITCOUNT_INVARIANT_HOLDS: holds -- the milestone's FIRST blocking UNVERIFIED item is now settled: a foreign halt injected via the text channel, at three timings including a genuine outstanding-wait collision, never satisfied a binary-side wait keyed on its own checkpoint's checkpoint_info event"
  - "probe-harness.mjs gains an advanceInstructionsBody re-export"
  - "A previously-unmeasured fact: releasing a foreign halt after our own wait already resolved triggers one further, unobserved checkpoint hit before the next wait's own listener attaches -- fully accounted for in the hit-count progression, not a data-quality gap"
  - "A previously-unmeasured fact: resuming a stopping checkpoint immediately after a multi-hundred-millisecond monitor halt re-hits in ~5-6ms, an order of magnitude faster than the ~16.7ms (~60Hz) steady-state rate 39-04 measured for continuous free-running execution"
affects: ["39-06", "39-07", "39-08"]

actuals:
  tokens: 22000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Priming resume before a repeated-timing experiment on the SAME stopping checkpoint: the first wait after arming resumes from an arbitrary PC, but every SUBSEQUENT wait on the same stopping checkpoint resumes from a known, identical position (the checkpoint's own trapped address) -- a fixed injection-delay model tuned for one case is wrong for the other, and a one-time, unmeasured priming wait removes the ambiguity for every timing that follows."
    - "Read a wait's hit count from the event that satisfied it, never from a separate follow-up poll -- an extra CheckpointGet after release is itself a binary command and lets the machine advance an unmeasured extra lap before the read, contaminating the very state the next timing starts from."
    - "Drain an unsolicited text-console announcement (awaitBanner()) immediately after ANY binary-channel command that can re-halt the CPU (not only after a foreign/checkpoint halt) -- Task 1 found a text-console announcement race triggered by the binary channel's own AdvanceInstructions single-step, a broader trigger than 39-04's checkpoint-hit-only finding."

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/concurrent-inflight-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-concurrent-inflight.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/hitcount-invariant-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-hitcount-invariant.md
  modified:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs

key-decisions:
  - "CONCURRENT_INFLIGHT: clean -- all six replies (3 reps x 2 channels) arrived within the 15s budget, each matched to its own request, zero desync bytes, zero duplicate replies, in every repetition."
  - "HITCOUNT_INVARIANT_HOLDS: holds -- read DECISION-RULE.md's R13 pre-mapped narrowing (D-11) BEFORE deriving the value, per the plan's own requirement; the wait's own checkpoint_info-typed, checkpoint-id-narrowed listener was never satisfied by a foreign STOPPED broadcast, in any of three injection timings, including one genuine outstanding-wait collision."
  - "The overlap CONCURRENT_INFLIGHT measures is characterised honestly as write-ordering overlap under one single-threaded emulator poll loop, never instruction-level simultaneity -- stated explicitly in the evidence file per the plan's own prohibition against implying a stronger claim."
  - "No substitution of the halting text-side command was needed for Task 1 -- prof on/prof flat 5 produced fully recognisable, correctly-framed replies in every repetition once the drain-step fix landed."

patterns-established:
  - "Both-writes-before-either-await overlap technique (Task 1): mint both async calls back-to-back with no intervening await, bracket with process.hrtime.bigint() immediately before/after each call returns (each call's own socket write already happened synchronously inside it), derive the gap from those timestamps."

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "CONCURRENT_INFLIGHT measured live against genuine stock VICE 3.9: clean, three repetitions, both channels' writes issued before either reply awaited"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^CONCURRENT_INFLIGHT: (clean|degraded|corrupts|not-taken)$' evidence/39-concurrent-inflight.md; CONCURRENT_EVIDENCE_OK and CONCURRENT_DISCIPLINE_OK verify blocks both pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "HITCOUNT_INVARIANT_HOLDS measured live: holds, across three injection timings including a genuine outstanding-wait collision, settling the milestone's first blocking UNVERIFIED item"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^HITCOUNT_INVARIANT_HOLDS: (holds|breaks|not-taken)$' evidence/39-hitcount-invariant.md; HITCOUNT_EVIDENCE_OK verify block passes; node --test vice-sync.test.ts stock-checkpoints.test.ts stock-run-until.test.ts reports fail 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both probes reuse the shared harness and throwaway text client, build no wire frame themselves, name the emulator only by absolute path, and modify no shipped module under src/"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -ac 'probe-harness.mjs'/'textmon-probe-client.mjs' in both probe files; zero hand-rolled writeUInt32LE( wire fields; zero bare-name x64sc spawn invocations; git status --porcelain src/mcp/vice shows only a pre-existing, not-ours scratch dir, discussed and disclosed in the evidence file rather than silently passed"
        status: pass
    human_judgment: false

duration: ~32min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 05: CONCURRENT_INFLIGHT and HITCOUNT_INVARIANT_HOLDS live measurement Summary

**Live-measured `CONCURRENT_INFLIGHT: clean` (0ms max write gap) and `HITCOUNT_INVARIANT_HOLDS: holds` against genuine stock VICE 3.9 — the milestone's first blocking UNVERIFIED item is now a settled, recorded fact rather than an assumption, with the D-11 pre-mapped narrowing read before the answer existed.**

## Performance

- **Duration:** ~32 min
- **Started:** ~2026-09-07T21:53:00Z
- **Completed:** 2026-09-07T22:25:01Z
- **Tasks:** 2
- **Files modified:** 4 created, 1 modified

## Accomplishments

- Measured `CONCURRENT_INFLIGHT: clean` live: three repetitions, each firing the binary
  channel's `AdvanceInstructions` and the text channel's `prof flat 5` with both socket
  writes performed before either reply was awaited, against genuine stock VICE 3.9 with
  the broker stopped. All six replies (3 reps x 2 channels) arrived correctly matched,
  zero desync bytes, zero duplicate replies. The largest observed write-to-write gap
  across all three repetitions was 0ms (`CONCURRENT_WRITE_GAP_MS: 0`), recorded as a
  caveat never a threshold, alongside the honest characterisation that stock VICE
  services both monitor servers from one single-threaded poll loop -- the measured
  overlap is write-ordering, never instruction-level simultaneity.
- Discovered and fixed a genuine probe framing race live: the binary channel's own
  `AdvanceInstructions` single-step re-halts the CPU and pushes an unsolicited
  announcement to the text console too (broader trigger than 39-04's checkpoint-hit-only
  finding of the same behaviour) -- an undrained announcement raced the next text
  command's reply. Fixed with a drain step (`awaitBanner()`) immediately after each
  repetition's overlapped write; the voided first run is recorded in
  `39-concurrent-inflight.md` with its reason, not discarded.
- Measured `HITCOUNT_INVARIANT_HOLDS: holds` live -- the milestone's **first** blocking
  UNVERIFIED item. `DECISION-RULE.md`'s `R13` pre-mapped narrowing (D-11) was read in
  full before deriving the value, exactly as the plan requires. A stopping exec
  checkpoint's own event-driven wait (mirroring `stock-run-until.ts`'s
  `waitForCheckpointHit()` almost verbatim: narrowed on `.type === "checkpoint_info"`
  THEN the specific checkpoint id, never on a generic `stopped`/paused signal) was never
  satisfied by a foreign halt injected via the text channel, at any of three injection
  timings -- including one genuine outstanding-wait collision (`waitSettledBeforeInjection:
  false`, `waitSettledDuringForeignHalt: true`), the exact adjacency case `SCHEMA.md`
  names as what this measurement exists to detect.
- Discovered and fixed a second live probe defect: a fixed-delay timing model (tuned
  against a **non-stopping** checkpoint's ~16.7ms steady-state rate) never actually
  landed a foreign halt while any wait was outstanding, because a **stopping**
  checkpoint's repeated resumes start from a known, identical position after the first
  hit. Fixed with a one-time priming wait before the three measured timings, plus
  removing a self-inflicted extra-poll artifact (reading hit count from the satisfying
  event, never a separate follow-up `CheckpointGet`). Both voided runs are recorded with
  their reasons.
- Wrote a `## What this means for the four native upholders` section assessing
  `stock-checkpoints.ts`, `stock-run-until.ts`, `stock-reproducible-run.ts` and
  `stock-diagnose.ts` against the observed behaviour, without editing any of them.
- Extended `probe-harness.mjs` with an `advanceInstructionsBody` re-export (same
  shared-seam-growth pattern 39-04 used for `armStoppingExec()`/`memspaceBody`).

## Task Commits

1. **Task 1: Two commands in flight at once, three times, with the overlap measured rather than claimed** - `1698f50d` (feat)
2. **Task 2: Does the existing hit-count-polling invariant already tolerate a halt it did not cause?** - `099c5738` (feat)

**Plan metadata:** commit follows this SUMMARY (see below).

_Both tasks are `type="auto"`, not `type="tracer"` -- no tracer feedback gate applies to this plan._

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/concurrent-inflight-probe.mjs` - the CONCURRENT_INFLIGHT probe: both writes before either await, three repetitions
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-concurrent-inflight.md` - the transcript, a voided first run, the profiler reports, and the outcome/fact lines
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/hitcount-invariant-probe.mjs` - the HITCOUNT_INVARIANT_HOLDS probe: a stopping checkpoint, three injection timings, per-frame attribution logging
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-hitcount-invariant.md` - the transcript, two voided runs, the four-native-upholders assessment, and the outcome/fact lines
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs` - gains an `advanceInstructionsBody` re-export (extends 39-03/39-04's shared harness; no other function changed)

## Decisions Made

- **`CONCURRENT_INFLIGHT: clean`.** Per `SCHEMA.md` §2.3's frozen rule, `clean` requires
  all six replies within the 15s budget, each matched to its own request, zero desync
  bytes, zero duplicate replies -- met in every repetition.
- **`HITCOUNT_INVARIANT_HOLDS: holds`.** Per `SCHEMA.md` §2.6's frozen rule, all three
  conjuncts held across all three injection timings: no pending binary request was ever
  resolved by an unsolicited event (guaranteed by `stock-protocol.ts`'s own `#dispatch()`
  demux, confirmed by direct source read and by empirical observation), hit_count was
  monotonically non-decreasing across every read, and the wait was never satisfied by
  anything other than its own checkpoint's `checkpoint_info` event -- including in the
  one timing where it was genuinely still outstanding when the foreign command was sent.
- **`DECISION-RULE.md`'s `R13` narrowing was read before deriving the value**, exactly as
  the plan requires, and is quoted verbatim at the top of `39-hitcount-invariant.md` so
  the pre-commitment is demonstrably operative rather than decorative.
- **The overlap `CONCURRENT_INFLIGHT` measures is characterised honestly**: stock VICE
  services both monitor servers from one single-threaded poll loop; the measured overlap
  is write-ordering ("channel B's write issued before channel A's in-flight command was
  acknowledged"), never instruction-level simultaneity. Stated explicitly in the evidence
  file, per the plan's own prohibition against implying a stronger claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `concurrent-inflight-probe.mjs`'s first draft did not log the profiler report's own reply text, and in fixing that, a text-console framing race surfaced: the binary channel's own `AdvanceInstructions` single-step pushes an unsolicited announcement to the text console, racing the next text command's reply**
- **Found during:** Task 1, first live run
- **Issue:** The first run's `TEXT_PROF_ON_REP2` line read the reply to a `prof off` cleanup command instead of `prof on` -- a stray unsolicited announcement (pushed by the binary channel's own single-step re-halt) consumed the crude text client's next read before the real reply arrived.
- **Fix:** Added a drain step (`awaitBanner()`) immediately after each repetition's overlapped-write section resolves, before any further text command is sent; also added explicit logging of the actual profiler reply text (previously only a boolean).
- **Files modified:** `concurrent-inflight-probe.mjs`
- **Verification:** Corrected run's `TEXT_PROF_ON_REPn` reads "Profiling restarted." correctly in every repetition; rep 2's drain step visibly caught 509 bytes of a late-arriving profiler-table tail.
- **Committed in:** `1698f50d` (Task 1 commit; the first, voided run is recorded in `39-concurrent-inflight.md` with its reason)

**2. [Rule 1 - Bug] `hitcount-invariant-probe.mjs`'s first draft used a fixed-delay timing model that never actually landed a foreign halt while any wait was outstanding**
- **Found during:** Task 2, first live run (`WAIT_ALREADY_SETTLED_BEFORE_INJECTION` true in all three timings)
- **Issue:** The fixed injection delays (3ms/16ms/50ms) were tuned against a **non-stopping** checkpoint's measured ~16.7ms steady-state rate (39-04's own control brackets), but a **stopping** checkpoint halts with PC at its own trapped address, so every wait after the first resumes from a known, identical position -- a different, much shorter (~5-6ms) re-hit latency this run discovered, invalidating the assumed timing.
- **Fix:** Added a one-time priming wait (event-driven resume+observe, no foreign interference) before the three measured timings, giving every measured timing a consistent starting position.
- **Files modified:** `hitcount-invariant-probe.mjs`
- **Verification:** Corrected run's "before" timing shows `waitSettledBeforeInjection=false`, `waitSettledDuringForeignHalt=true` -- a genuine outstanding-wait collision, the case this measurement exists to detect.
- **Committed in:** `099c5738` (Task 2 commit; both voided runs are recorded in `39-hitcount-invariant.md` with their reasons)

**3. [Rule 1 - Bug] `hitcount-invariant-probe.mjs`'s post-release `CheckpointGet` poll let the machine advance an unmeasured extra lap before the next timing began**
- **Found during:** Task 2, same first live run, diagnosing the hit-count progression
- **Issue:** An explicit `checkpointHitCount()` read after each timing's release step is itself a binary command; issuing it let the checkpoint fire again, unmeasured, before the read -- contaminating the starting state the next timing began from.
- **Fix:** Removed the separate poll; each timing's hit count is now read directly from the `checkpoint_info` event that satisfied its own wait.
- **Files modified:** `hitcount-invariant-probe.mjs`
- **Verification:** The hit-count progression (`0, 1, 2, 4, 6`) in the corrected run is fully accounted for and explained (a release-after-already-settled mechanism, documented in the evidence file), never a gap.
- **Committed in:** `099c5738` (same commit as Deviation 2 -- both fixes landed together before the authoritative run)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs in the probe scripts themselves, never in the emulator or the shipped source under `src/`).
**Impact on plan:** All three were necessary for correctness -- an unfixed probe in any case would have recorded a false or unexercised gate-input value. No scope creep: `probe-harness.mjs`'s one added export (`advanceInstructionsBody`) is the same kind of shared-seam growth 39-04 performed for `armStoppingExec()`/`memspaceBody`, not new production surface.

## Issues Encountered

**A genuine text-channel framing ambiguity in one repetition of Task 2's authoritative run**, disclosed rather than smoothed over: the "before" timing's own `memmapshow` reply (132 bytes, versus a genuine ~1.6MB memory-map dump measured elsewhere in this phase) is almost certainly the checkpoint's own unsolicited stop-announcement, not `memmapshow`'s real output, because the checkpoint's natural hit landed essentially concurrently with the text-channel write. This means it cannot be established with certainty whether `memmapshow`'s own write reached the emulator before or after the checkpoint's hit in that one repetition. It does **not** weaken `HITCOUNT_INVARIANT_HOLDS`'s derivation, which is a claim about the binary-channel wait's own discrimination (unambiguous in every timing, confirmed by the binary-side attribution log regardless of what happened on the text side) -- documented at length in `39-hitcount-invariant.md` rather than silently omitted.

**The plan-level `<verify>` command `git status --porcelain src/mcp/vice | wc -l` returns `1`, not `0`**, because of `src/mcp/vice/.anno-cli-test-HVa1Ev/` -- a pre-existing, untracked scratch directory that already existed at the start of this session (visible in the orchestrator's own dispatch-time `git status` snapshot) and is not this plan's own. No file under `src/mcp/vice` was created or modified by either task in this plan; this is disclosed in `39-hitcount-invariant.md`'s own discipline-check section with the literal `git status --porcelain` output, per the phase's "voided runs are recorded, not discarded" convention applied to a verify-command mismatch rather than a run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Five of the phase's seven gate inputs are now real, live-measured facts: `IDLE_COEXIST: clean`
  (39-03), `FOREIGN_HALT_VISIBILITY: visible` and `CROSS_CHANNEL_RESUME: clean` (39-04), and this
  plan's `CONCURRENT_INFLIGHT: clean` and `HITCOUNT_INVARIANT_HOLDS: holds`. None of the five
  measured so far pre-determines a `no-go` verdict, and the milestone's first blocking UNVERIFIED
  item is now settled in the `holds` direction -- `R13`'s `degrade` narrowing (D-11) is therefore
  **not** triggered by this phase's own measurements, though it remains committed and would still
  apply if a later re-measurement or a different context ever produced `breaks`.
- The remaining two gate inputs (`DISCONNECT_RECOVERY`, `TEXT_SINGLE_CLIENT`) are `39-08`'s scope
  -- the milestone's other blocking UNVERIFIED item (`TEXT_SINGLE_CLIENT`) is still open.
- `39-06`/`39-07` onward can import `probe-harness.mjs`'s new `advanceInstructionsBody` export
  directly, and should reuse this plan's two hard-won disciplines: (1) prime a stopping checkpoint
  with one unmeasured wait before any repeated-timing experiment on the same checkpoint, since
  its own repeated resumes start from a KNOWN position unlike the first; (2) read a wait's hit
  count from the event that satisfied it, never from a separate follow-up poll.
- The reciprocal "binary single-step is visible on the text console too" finding (Task 1) extends
  39-04's own "checkpoint hits are visible on the text console too" finding to a broader trigger,
  relevant to any later `CHAN-04` serialization design.
- No blockers.

## Self-Check: PASSED

- All four created files verified present on disk (`[ -f ]`): `concurrent-inflight-probe.mjs`,
  `39-concurrent-inflight.md`, `hitcount-invariant-probe.mjs`, `39-hitcount-invariant.md`.
- Commits `1698f50d` and `099c5738` verified present in `git log --oneline --all`.
- Task 1's two `<verify>` blocks re-run post-commit: `CONCURRENT_EVIDENCE_OK`, `CONCURRENT_DISCIPLINE_OK`
  -- both passed.
- Task 2's three `<verify>` blocks re-run post-commit: `HITCOUNT_EVIDENCE_OK` passed; the
  `git status --porcelain src/mcp/vice` check returns `1` (a pre-existing, not-ours scratch dir,
  disclosed above and in the evidence file, not a violation by this plan); `node --test
  vice-sync.test.ts stock-checkpoints.test.ts stock-run-until.test.ts` reports `fail 0` -- passed.
- Ordering: `git rev-list --count HEAD -- evidence/` is `6` (39-01's rules commit, 39-03's
  `IDLE_COEXIST` commit, 39-04's two task commits, and this plan's two task commits); `05c2c069`
  remains the sole original commit, never amended.
- Host left clean: `systemctl --user is-active vice-broker` reads `inactive`, `pgrep -x x64sc`
  returns no match.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
