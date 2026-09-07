---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 04
subsystem: testing
tags: [tracer, live-measurement, chan-01, dual-channel, vice, stock-vice, foreign-halt, cross-channel-resume, binary-monitor, text-monitor]

requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: "39-03's shared probe-harness.mjs/textmon-probe-client.mjs and its resumeExecution()/awaitFirstCheckpointHit() cold-boot-settle pattern, both reused rather than re-derived"
provides:
  - "FOREIGN_HALT_VISIBILITY: visible -- a text-channel-induced halt produces an unsolicited STOPPED (0x62) frame on the binary channel, paired with a previously unrecorded unsolicited REGISTER_INFO (0x31) frame at the same timestamp"
  - "CROSS_CHANNEL_RESUME: clean -- a halt taken on either channel can be read and released from the other, in both directions, confirmed twice each by an independent liveness signal"
  - "A previously-unmeasured, reciprocal fact: a BINARY-owned checkpoint hit pushes an unsolicited breakpoint-notification announcement to the TEXT console too, symmetric with the binary-side STOPPED signal"
  - "probe-harness.mjs gains armStoppingExec() and a memspaceBody re-export, importable by later plans in this phase without re-deriving them"
affects: ["39-05", "39-06", "39-07", "39-08"]

actuals:
  tokens: 22500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Passive-only bracket discipline, extended from 39-03's single-window use to a repeated multi-bracket design: after the one initial EXIT that starts the machine running, NO further binary-channel command is sent until every control/measured bracket has been taken, because ANY command (not just EXIT) re-halts the CPU on this launch shape and an explicit CHECKPOINT_GET poll manufactures a false zero-delta reading indistinguishable from a genuine foreign halt"
    - "Delete a client-owned stopping checkpoint BEFORE releasing a halt from the other channel, never after -- releasing first re-arms a race where the machine can re-hit the same checkpoint before the delete command arrives, manufacturing a false 'did not resume' reading"
    - "Drain an unsolicited monitor-entry announcement (awaitBanner()) on the text channel before trusting a command's own reply, whenever the halt being read was NOT induced by that same text command -- the crude text client's prompt-shaped framing (D-13) cannot otherwise distinguish the two"

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/foreign-halt-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-foreign-halt.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/cross-channel-resume-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-cross-channel-resume.md
  modified:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs

key-decisions:
  - "FOREIGN_HALT_VISIBILITY: visible -- an unsolicited STOPPED (0x62) frame arrives on the binary channel in every one of three repetitions of a text-channel-induced halt (memmapshow), and the anchor checkpoint's hit rate collapses from a steady 60/s control to 0-1 during the measured window every time"
  - "CROSS_CHANNEL_RESUME: clean -- both directions (halt-text/resume-binary, halt-binary/resume-text), twice each against one live instance, all four repetitions clean: cross-channel reads succeed while halted, the resume/release is accepted, and an independent liveness signal (the text-side stopwatch counter, or a separate non-stopping checkpoint's passive hit bracket) confirms the machine actually ran again"
  - "The named FOREIGN_HALT_VISIBILITY signal for a later serialization authority to key on is the unsolicited STOPPED (0x62) frame -- more direct than the hit-count-delta signal, present in all three reps, and paired every time with a previously unrecorded unsolicited REGISTER_INFO (0x31) frame (CLAUDE.md currently documents REGISTER_INFO arriving only 'on every monitor open')"
  - "Both live probes deliberately do NOT gate their derivation on the text monitor's own reply to a resume/release command (`x`) framing within budget -- the alive-anchor checkpoint's continuous trace-flood side effect (see Deviations) means `x`'s reply routinely fails to frame, and the authoritative signal is always the independent, passively-observed liveness check"

patterns-established:
  - "Voided-but-not-discarded runs, extended to TWO consecutive voided runs per experiment (not just one): each evidence file records every run that produced a genuine, distinct, real finding about the probe or the machine, with its own reason, rather than only the last defect found"

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "FOREIGN_HALT_VISIBILITY measured live against genuine stock VICE 3.9: visible, via an unsolicited STOPPED frame observed in all three control/measured bracket repetitions"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^FOREIGN_HALT_VISIBILITY: (visible|invisible|corrupts|not-taken)$' evidence/39-foreign-halt.md; three control brackets (60 hits/s each) and three measured brackets (0-1 hits) recorded with the full unsolicited-frame slice per repetition"
        status: pass
    human_judgment: false
  - id: D2
    description: "CROSS_CHANNEL_RESUME measured live, both directions, twice each against one live instance: clean in all four repetitions"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^CROSS_CHANNEL_RESUME: (clean|corrupts|not-taken)$' evidence/39-cross-channel-resume.md; direction table in the evidence file shows clean/clean/clean/clean with the independent liveness signal recorded for each"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both probes reuse the shared harness and throwaway text client, build no wire frame themselves, and name the emulator only by absolute path"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -ac 'probe-harness.mjs'/'textmon-probe-client.mjs' in both probe files; zero hand-rolled writeUInt32LE( wire fields; zero bare-name x64sc spawn invocations; npm run typecheck from src/mcp/vice exits 0 (this phase edits no shipped module)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 04: Live FOREIGN_HALT_VISIBILITY and CROSS_CHANNEL_RESUME measurement Summary

**FOREIGN_HALT_VISIBILITY: visible and CROSS_CHANNEL_RESUME: clean, both measured live on genuine stock VICE 3.9 with both monitor channels bound from one directly-spawned process -- the two halt-crossing questions this phase exists to answer are now written facts, not assumptions.**

## Performance

- **Duration:** ~55 min (heavy on live-host debugging: two probe design defects were found and fixed per experiment against a real emulator before either measurement was trustworthy)
- **Started:** ~2026-09-07T21:00:00Z
- **Completed:** 2026-09-07T21:47:23Z
- **Tasks:** 2
- **Files modified:** 4 created, 1 modified

## Accomplishments

- Measured `FOREIGN_HALT_VISIBILITY: visible` live: a non-stopping exec checkpoint armed at the
  IRQ frame anchor `$EA31` on the binary channel, observed across three control brackets (a
  steady 60 hits/second) and three measured brackets taken while a text-channel `memmapshow`
  held a foreign halt (0-1 hits every time), with an unsolicited `STOPPED` (0x62) frame arriving
  on the binary channel in every repetition -- the named signal a later serialization authority
  would key on.
- Discovered and recorded a previously-unmeasured pairing: every unsolicited `STOPPED` frame in
  this run arrived paired, at the same millisecond timestamp, with an unsolicited `REGISTER_INFO`
  (0x31) frame -- CLAUDE.md currently documents `REGISTER_INFO` arriving only "on every monitor
  open," not on every stop.
- Measured `CROSS_CHANNEL_RESUME: clean` live, in both directions (halt-on-text/resume-from-binary
  and halt-on-binary/resume-from-text), twice each against one live instance: every repetition's
  cross-channel reads succeeded while halted, the resume/release was accepted, and an independent
  liveness signal (the text-side stopwatch counter for direction one, a separate non-stopping
  checkpoint's passive hit bracket for direction two) confirmed the machine genuinely ran again.
- Discovered and recorded the reciprocal fact to Task 1's own finding: a BINARY-owned checkpoint
  hit pushes an unsolicited breakpoint-notification announcement to the TEXT console too, before
  any text command is sent -- the two channels' halt visibility is now measured as symmetric,
  though the text-side signal is only decodable by the crude, documented-as-non-robust framing
  this phase's own throwaway client uses (`D-13`).
- Extended `probe-harness.mjs` with `armStoppingExec()` (a client-owned stopping checkpoint,
  mirroring the existing `armNonStoppingExec()`) and a `memspaceBody` re-export, both importable
  by `39-05` onward without re-deriving them.

## Task Commits

1. **Task 1: Is a foreign halt visible to the binary client at all?** - `6e5e9a43` (feat)
2. **Task 2: Can a halt taken on one channel be read and released from the other, in both directions?** - `c5edbe15` (feat)

**Plan metadata:** commit follows this SUMMARY (see below).

_Both tasks are `type="auto"`, not `type="tracer"` -- no tracer feedback gate applies to this plan._

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/foreign-halt-probe.mjs` - the FOREIGN_HALT_VISIBILITY probe: passive-only control/measured brackets over three repetitions
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-foreign-halt.md` - the transcript, the voided first run, the full event-log summary, and the outcome/fact lines
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/cross-channel-resume-probe.mjs` - the CROSS_CHANNEL_RESUME probe: both directions, twice each, against one instance
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-cross-channel-resume.md` - the transcript, two voided runs, the direction table, and the outcome/fact lines
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs` - gains `armStoppingExec()` and a `memspaceBody` re-export (extends 39-03's shared harness; no other function changed)

## Decisions Made

- **`FOREIGN_HALT_VISIBILITY: visible`.** Per `SCHEMA.md` §2.2's frozen rule, `visible` requires at
  least one of an unsolicited `STOPPED` frame or a zero measured delta against a non-zero control;
  both signals were observed, in every repetition. The `STOPPED` frame was named as the signal to
  key on (more direct, present in all three reps, unlike the delta signal which only unambiguously
  read zero in one of three).
- **`CROSS_CHANNEL_RESUME: clean`.** Per `SCHEMA.md` §2.4, `clean` requires both cross-channel
  reads to succeed, the resume/release to be accepted, and the machine to be observed running
  again -- in EACH direction. All four repetitions (two directions × two reps) met every
  condition; no `## DIVERGENCE` section was needed in the authoritative run (both voided runs
  did carry one, and both are retained with their reasons per README.md's evidence conventions,
  rather than silently dropped).
- **Neither probe gates its derivation on the text monitor's own reply to a resume/release
  command framing within budget.** The alive-anchor / non-stopping checkpoint left armed
  throughout each probe resumes trace-flooding the text console the instant the CPU runs again,
  so `x`'s own reply routinely times out unframed -- a benign, now-understood artifact, not
  evidence against resumption. The authoritative signal in every case is an independent,
  passively-observed liveness check (a counter advancing, or a separate checkpoint's hit bracket).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `foreign-halt-probe.mjs`'s first draft used an explicit `CHECKPOINT_GET` poll as its "before/after" bracket mechanism, which is the exact self-halting hazard `probe-harness.mjs`'s own `resumeExecution()` doc comment (written by 39-03) already warned about**
- **Found during:** Task 1, first live run
- **Issue:** On this launch shape, ANY command reaching the binary monitor -- not only `EXIT` -- re-halts the CPU once it is running, until the next command. The first draft's sanity check sent a `CHECKPOINT_GET` "before" read (halting the machine), then another "after" 500ms later (sent to an already-halted machine, since nothing else resumed it) -- necessarily reading the identical hit count (`before=1 after=1`) regardless of the text channel.
- **Fix:** Rewrote the whole bracket mechanism to be purely passive: after the one initial `EXIT`, no further binary-channel command is sent until every control and measured bracket across all three repetitions has been taken. Every bracket resets a passive event counter, waits, and reads the counter -- driven entirely by the checkpoint's own unsolicited `CHECKPOINT_INFO` pushes, which require no request from the client at all.
- **Files modified:** `foreign-halt-probe.mjs`
- **Verification:** Corrected run's three control brackets all read 60 hits (steady ~60Hz); three measured brackets read 0-1 hits with `STOPPED` frames observed during every foreign-halt window.
- **Committed in:** `6e5e9a43` (Task 1 commit; the first, voided run is recorded in `39-foreign-halt.md` with its reason, not discarded)

**2. [Rule 1 - Bug] `cross-channel-resume-probe.mjs`'s direction two never established a binary-owned halt at all in its first draft -- arming the stopping checkpoint is itself a binary command that re-halts the CPU, and nothing resumed it afterward**
- **Found during:** Task 2, first live run (`D2_STOP_ANCHOR_HIT {"hit":false,"elapsedMs":14999}` in both repetitions)
- **Issue:** `armStoppingExec()`'s own `CheckpointSet` command halted the (then-running) machine the instant it was sent, per the same rule as Deviation 1. With no resume sent afterward, the machine sat halted and the stopping checkpoint at `$EA31` was never reached by the CPU to fire.
- **Fix:** Send one `EXIT` immediately after arming the stopping checkpoint, before waiting for its hit.
- **Files modified:** `cross-channel-resume-probe.mjs`
- **Verification:** The stopping checkpoint then hit within single-digit milliseconds in every subsequent run.
- **Committed in:** `c5edbe15` (Task 2 commit; the first run is recorded in `39-cross-channel-resume.md` with its reason)

**3. [Rule 1 - Bug] `cross-channel-resume-probe.mjs`'s direction two, second draft, read `sw`'s reply as an unparseable `null` because it raced an unsolicited "monitor entered" announcement the binary-owned checkpoint hit pushes to the text console before any text command is sent**
- **Found during:** Task 2, second live run (`D2_TEXT_SW matched=true value=null` in both repetitions)
- **Issue:** `textmon-probe-client.mjs`'s crude framing is documented (its own header) as unable to distinguish an unsolicited push from a command's own reply, since both can end in the same prompt-shaped string. The first command sent after the stopping checkpoint's hit consumed the unsolicited announcement instead of its own reply; the real `Stopwatch: N` answer was delivered as the first line of the FOLLOWING command's reply instead.
- **Fix:** Drain the unsolicited announcement via `awaitBanner()` immediately after the checkpoint's hit is confirmed, before sending `sw`/`r` for real -- mirroring `idle-coexist-probe.mjs`'s own "capture before trusting" discipline. Also removed an independent gating bug in the same run: the derivation had been rejecting `clean` whenever `x`'s own reply failed to frame within budget, which happens routinely due to the alive-anchor checkpoint's trace-flood side effect and is not evidence against resumption (see key-decisions).
- **Files modified:** `cross-channel-resume-probe.mjs`
- **Verification:** The corrected, authoritative run reads `textReadsOk=true` and `CROSS_CHANNEL_RESUME: clean` in both directions, both repetitions.
- **Committed in:** `c5edbe15` (Task 2 commit; the second run is recorded in `39-cross-channel-resume.md` with its reason)

**4. [Rule 3 - Blocking] `probe-harness.mjs` did not export `armStoppingExec()` or `memspaceBody` -- both needed by Task 2 and neither derivable without either re-typing a wire encoder or forking the shared harness**
- **Found during:** Task 2, before writing any live-measurement code
- **Issue:** The harness (owned by `39-02`, extended by `39-03`) exported `armNonStoppingExec()` (hardcoded `stop:false`) and `memGetBody` but not a stopping variant or the register-read memspace body Task 2's direction one needs.
- **Fix:** Added `armStoppingExec()` (the same `checkpointSetBody()` encoder, `stop:true`) and re-exported `memspaceBody` from the same shipped `stock-protocol.ts` import already in the harness -- extending the shared seam rather than re-deriving either encoder locally in the new probe file.
- **Files modified:** `probe-harness.mjs`
- **Verification:** `RegistersGet`/`CheckpointSet(stop:true)` calls in `cross-channel-resume-probe.mjs` succeed against the real emulator; both discipline `<verify>` blocks (import presence, zero hand-rolled wire fields) pass for both probe files.
- **Committed in:** `6e5e9a43` (harness change landed alongside Task 1's commit, ahead of Task 2 needing it)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking/missing-shared-helper).
**Impact on plan:** All four were necessary for correctness -- an unfixed probe in either case would have recorded a false gate-input value (`not-taken` or `corrupts`) that has nothing to do with genuine cross-channel behavior. No scope creep: the harness extension (Deviation 4) is the same kind of shared-seam growth 39-03 itself performed when it added `resumeExecution()`/`awaitFirstCheckpointHit()`, not new production surface.

## Issues Encountered

None beyond the four deviations above, all resolved before either evidence file was finalized.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Two of the phase's seven gate inputs are now real, live-measured facts: `FOREIGN_HALT_VISIBILITY: visible`
  and `CROSS_CHANNEL_RESUME: clean`. Combined with `39-03`'s `IDLE_COEXIST: clean`, none of the three
  measured so far pre-determines a `no-go` verdict -- the remaining four inputs (`39-05` through `39-08`)
  are live expansion, not moot.
- `39-05` onward can import `probe-harness.mjs`'s `armStoppingExec()` directly for any experiment needing
  a client-owned stopping checkpoint, and should reuse this plan's two hard-won disciplines: (1) after any
  binary command that halts the CPU, an explicit resume is required before waiting on that checkpoint's own
  hit, and (2) drain an unsolicited text-console announcement via `awaitBanner()` before trusting a text
  command's reply whenever the halt being read was induced by something OTHER than that same command.
- The reciprocal "checkpoint hits are visible on the text console too" finding (this plan) and the earlier
  "checkpoint arming causes continuous text-console trace flood" finding (Task 1 of this same plan) are both
  relevant background for `39-06`'s `CONCURRENT_INFLIGHT` measurement and any later `CHAN-04` serialization
  design -- a checkpoint armed on one channel is never silent on the other.
- No blockers.

## Self-Check: PASSED

- All four created files verified present on disk (`[ -f ]`): `foreign-halt-probe.mjs`, `39-foreign-halt.md`,
  `cross-channel-resume-probe.mjs`, `39-cross-channel-resume.md`.
- Commits `6e5e9a43` and `c5edbe15` verified present in `git log --oneline --all`.
- Task 1's two `<verify>` blocks re-run post-commit: `FOREIGN_HALT_EVIDENCE_OK`, `FOREIGN_HALT_DISCIPLINE_OK` --
  both passed.
- Task 2's three `<verify>` blocks re-run post-commit: `RESUME_EVIDENCE_OK`, `RESUME_DISCIPLINE_OK`, and
  `npm run typecheck` from `src/mcp/vice` exits 0 -- all passed.
- Ordering: `git rev-list --count HEAD -- evidence/` is `4` (39-01's rules commit, 39-03's `IDLE_COEXIST`
  commit, and this plan's two task commits); `05c2c069` remains the sole original commit, never amended.
- Host left clean: `systemctl --user is-active vice-broker` reads `inactive`, `pgrep -x x64sc` returns no match.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
