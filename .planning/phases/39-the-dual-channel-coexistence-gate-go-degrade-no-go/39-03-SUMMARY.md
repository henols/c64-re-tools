---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 03
subsystem: testing
tags: [tracer, live-measurement, chan-01, dual-channel, vice, stock-vice, idle-coexist, binary-monitor, text-monitor]

requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: "39-01's frozen DECISION-RULE.md/SCHEMA.md/README.md and totality walk, which this plan's evidence file and verdict document conform to without modifying"
provides:
  - "The phase's first LIVE measurement: IDLE_COEXIST: clean, the sole no-go trigger (R1/R2), measured rather than assumed"
  - "The shared probe harness (probe-harness.mjs) every later plan in this phase (39-04..39-08) imports for direct-spawn, preflight, port allocation, resume/checkpoint helpers, and the observed test:automated baseline"
  - "The throwaway text-monitor client (textmon-probe-client.mjs), deliberately crude, not promoted to src/"
  - "The first byte-exact text-monitor connect-banner AND post-command-prompt capture in this project's history"
  - "A previously-unmeasured fact about stock x64sc's -console + monitor-flag launch shape: CPU starts halted and stays halted until an explicit EXIT (0xaa) resume; cold boot then masks interrupts for ~2s"
  - "The seeded verdict document (docs/phase39-dual-channel-coexistence-gate-findings.md) with its first of seven inputs transcribed"
affects: ["39-04", "39-05", "39-06", "39-07", "39-08"]

actuals:
  tokens: 18000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Direct-spawn probe harness (D-12): one shared module resolving binaries by absolute path, refusing in code when the broker or another emulator is alive, allocating its own ports, and importing the shipped determinism-flag array and wire encoders rather than retyping them (D-14)"
    - "Passive event-counting over explicit polling for a running-state check: a monitor command that reads state also re-halts the CPU on this build, so 'is it still running' must count the checkpoint's own unsolicited events during an untouched window rather than bracket it with explicit reads"

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/textmon-probe-client.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/idle-coexist-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-idle-coexist.md
    - docs/phase39-dual-channel-coexistence-gate-findings.md
  modified: []

key-decisions:
  - "IDLE_COEXIST: clean -- both a no-text-client control leg and a silent-text-client measured leg read the same 256-byte KERNAL ROM window three times each, all six reads sha256-identical, zero desync bytes, zero duplicate replies, zero unsolicited broadcast frames"
  - "A stock x64sc launched with -console plus either monitor flag starts CPU-halted and stays halted until an explicit EXIT (0xaa) resume -- discovered empirically after the first run's IDLE_TEXT_CLIENT_HALTS: yes turned out to be a probe defect, not a fact about the text client"
  - "REMOTEMONITOR_FLAG_ORDER: default-first-assumed -- the assumed argv order bound both ports instantly on every run; the alternative order was never needed"
  - "TEXT_PROMPT_LITERAL_CONFIRMED: no for the connect banner specifically -- the stock text monitor sends nothing on connect (no greeting), so PROMPT_RE could never be exercised against it; a supplementary post-measurement capture (after the gate window closed) confirmed PROMPT_RE's shape against a real post-command prompt instead"

patterns-established:
  - "Voided-but-not-discarded runs: the first idle-coexist-probe.mjs run is kept in the evidence file with its VOID reason, distinguishing a probe defect from a genuine finding, rather than being silently overwritten by the corrected run"

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "IDLE_COEXIST measured live against genuine stock VICE 3.9 with both monitor channels bound from one directly-spawned process: clean"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^IDLE_COEXIST: (clean|corrupts|not-taken)$' evidence/39-idle-coexist.md; all six ROM-window reads sha256-identical"
        status: pass
    human_judgment: false
  - id: D2
    description: "probe-harness.mjs's --preflight entry point refuses in code when the broker is active or another emulator is alive, and imports the shipped determinism-flag array and wire encoders rather than retyping them"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "node evidence/probe-harness.mjs --preflight (exit 0 on clean host); grep for STOCK_DETERMINISM_FLAGS / memGetBody / checkpointSetBody / cpNumBody in probe-harness.mjs; zero bare-name x64sc invocations, zero hand-rolled writeUInt32LE( wire fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "The verdict document exists with the frozen frontmatter shape, one input (idle_coexist) transcribed mechanically with a line citation, six placeholders, no verdict key yet"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "all seven inputs.* keys present; six read not-yet-transcribed; idle_coexist byte-matches the final column-0 IDLE_COEXIST: occurrence in evidence/39-idle-coexist.md; neither verdict: nor verdict_rule_applied: present"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-09-07
status: complete
---

# Phase 39 Plan 03: Live IDLE_COEXIST measurement Summary

**IDLE_COEXIST: clean, measured live on genuine stock VICE 3.9 with both monitor channels bound from one directly-spawned process -- the phase's sole no-go trigger is now a written fact, not an assumption.**

## Performance

- **Duration:** ~45 min (heavy on live-host debugging: two probe design defects were found and fixed against a real emulator before the final measurement was trustworthy)
- **Started:** ~2026-09-07T20:20:00Z
- **Completed:** 2026-09-07T21:05:00Z
- **Tasks:** 2
- **Files modified:** 5 created, 0 modified

## Accomplishments

- Built the shared direct-spawn probe harness (`probe-harness.mjs`) every remaining plan in this
  phase (`39-04` through `39-08`) will import: absolute-path binary resolution, `preflight()`
  refusal in code, port allocation, argv construction importing the shipped
  `STOCK_DETERMINISM_FLAGS`, spawn/reap, connect-with-retry, checkpoint arm/read/delete, and the
  observed `test:automated` baseline.
- Built the throwaway text-monitor client (`textmon-probe-client.mjs`) and captured the first
  byte-exact text-monitor connect-banner (empty -- the stock text monitor sends nothing until it
  receives input) and post-command prompt (`(C:$e5cf) `, confirming `PROMPT_RE`'s shape against
  real bytes) in this project's history.
- Measured `IDLE_COEXIST: clean` live: a non-halting `MemoryGet` read of the invariant KERNAL ROM
  window `$E000-$E0FF` returns byte-identical data (all six reads sha256
  `c5fccb8583eefe727f816ca4a8034cbba9a54b2a240d7919de9169e49a85f45e`) whether or not a
  text-monitor client is connected and silent, with zero desync bytes, zero duplicate replies,
  and zero unsolicited broadcast frames.
- Discovered and recorded a previously-unmeasured fact about this exact launch shape: stock
  `x64sc` launched with `-console` plus either monitor flag starts with the CPU halted and stays
  halted until an explicit `EXIT` (0xaa) resume is sent; a cold boot then masks interrupts for
  ~2000ms during its KERNAL RAM test before the first `$EA31` jiffy IRQ fires.
- Seeded the verdict document (`docs/phase39-dual-channel-coexistence-gate-findings.md`) with the
  frozen frontmatter shape and `idle_coexist`'s real transcribed value, six placeholders, and no
  verdict key.

## Task Commits

1. **Task 1: One idle-coexistence measurement, end to end** - `99ec2cb9` (feat)
2. **Task 2: Seed the verdict document and prove the transcription rule** - `1ddd4a5a` (docs)

**Plan metadata:** commit follows this SUMMARY (see below).

_Tracer feedback gate (auto mode active): re-ran Task 1's full `<verify>` block (evidence-file
shape, `--preflight` entry point, import discipline) against the post-commit state before
starting Task 2 -- all three passed. ⚡ Tracer verified end-to-end — expanding._

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs` - the shared direct-spawn seam: preflight, ports, argv, spawn/reap, checkpoint helpers, resume, baseline
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/textmon-probe-client.mjs` - the throwaway text-monitor client: connect, banner, crude prompt framing
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/idle-coexist-probe.mjs` - the IDLE_COEXIST measurement script
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-idle-coexist.md` - the transcript, the voided first run, the raw banner/prompt captures, and the outcome/fact lines
- `docs/phase39-dual-channel-coexistence-gate-findings.md` - the seeded verdict document

## Decisions Made

- **`IDLE_COEXIST: clean`.** Both legs (no text client / silent text client attached) produced
  byte-identical KERNAL ROM reads with clean binary-client counters and no unsolicited frames.
  Per `DECISION-RULE.md`'s `R1`/`R2`, this is the value that keeps the gate open for the
  remaining six inputs rather than pre-determining `no-go`.
- **`REMOTEMONITOR_FLAG_ORDER: default-first-assumed`.** The assumed argv order (binary-monitor
  pair, then remote-monitor pair, both after the determinism block) bound both ports instantly
  (`TEXT_TIME_TO_BIND_MS 0`) on every run; the alternative order was built into
  `buildProbeArgs({ swapMonitorOrder })` but never needed.
- **`TEXT_PROMPT_LITERAL_CONFIRMED: no`, scoped honestly.** The connect banner is empty on this
  build -- there is nothing for `PROMPT_RE` to match, and recording `no` here answers exactly
  that question. A supplementary, post-gate-window capture (sending a bare newline, no monitor
  command) confirmed the regex's shape against a real prompt (`(C:$e5cf) `) without touching the
  gate measurement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `IDLE_TEXT_CLIENT_HALTS` measured wrong in the first run -- CPU never resumed**
- **Found during:** Task 1, reviewing the first live run's output (`ANCHOR_HITCOUNT_BEFORE 0`,
  `ANCHOR_HITCOUNT_AFTER_1S 0`)
- **Issue:** `idle-coexist-probe.mjs` as first written never sent an `EXIT` (0xaa) resume command
  anywhere. Empirical investigation (four throwaway scratch scripts against a real spawned
  `x64sc`) established that a stock `x64sc` launched with `-console` plus either monitor flag
  starts with the CPU halted and stays halted until this exact command is sent -- reading state
  (`MemoryGet`, `RegistersGet`, `CheckpointGet`) does not itself start it running. The recorded
  `IDLE_TEXT_CLIENT_HALTS: yes` in the first run was therefore an artifact of the probe never
  asking the machine to run, not a fact about the text client.
- **Fix:** Added `resumeExecution()` and `awaitFirstCheckpointHit()` to `probe-harness.mjs`.
  `idle-coexist-probe.mjs`'s halt-check now: arms the checkpoint, registers a passive event
  counter, sends `Exit` exactly once, waits (generous 30s budget) for the checkpoint's own first
  unsolicited hit to confirm the ~2s cold-boot RAM test has completed, then samples a clean
  1-second window counting only unsolicited events (never an explicit `CheckpointGet` poll, which
  would itself re-halt the CPU and manufacture a false "yes" on every run regardless of the text
  channel). The checkpoint is deleted before the measured leg begins, so its own hits cannot
  contaminate that leg's "no unsolicited broadcast frame" check.
- **Files modified:** `probe-harness.mjs`, `idle-coexist-probe.mjs`
- **Verification:** Corrected run shows `ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2034}`,
  `ANCHOR_HITS_DURING_1S_SAMPLE_WINDOW: 59` (~60Hz, as expected once running),
  `IDLE_TEXT_CLIENT_HALTS: no`. `IDLE_COEXIST` itself was already `clean` in the first (voided)
  run and is unchanged -- the ROM-window comparison does not depend on CPU running state.
- **Committed in:** `99ec2cb9` (Task 1 commit; the voided first run is recorded in
  `39-idle-coexist.md` with its reason, not discarded, per README.md's evidence conventions)

**2. [Rule 2 - Missing recorded fact] `pgrep -af x64sc` false-positive not visibly guarded against in the committed transcript**
- **Found during:** Task 1, capturing the D-16 precondition transcript for the evidence file
- **Issue:** README.md § *Evidence conventions* 3 documents that `pgrep -af x64sc` matches its own
  invoking shell command line. Running it live reproduced exactly that (one line, the invoking
  `bash -c ... eval 'systemctl ... pgrep -af x64sc ...'`), which a careless reader could
  mistake for a genuine alive emulator.
- **Fix:** Recorded both the raw `pgrep -af x64sc` output (with the false-positive line visible)
  and the exact-name `pgrep -x x64sc` check (empty, matching what `probe-harness.mjs`'s own
  `aliveX64sc()` uses) side by side in `39-idle-coexist.md`, with the false-positive explained
  inline rather than silently filtered out of the transcript.
- **Files modified:** `39-idle-coexist.md` (documentation only)
- **Verification:** Both commands' real output pasted verbatim; `preflight()` in
  `probe-harness.mjs` uses the exact-name form in code, independent of this transcript note.
- **Committed in:** `99ec2cb9` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-recorded-fact/documentation).
**Impact on plan:** Deviation 1 was necessary for correctness -- an unfixed probe would have
recorded a false `IDLE_TEXT_CLIENT_HALTS` value that this phase's own `SCHEMA.md` says matters
("a `clean` read on a machine that a silent text client has silently halted is a materially
different world from a `clean` read on a running one"). Deviation 2 is transparency only, no
functional change. `IDLE_COEXIST`, the plan's sole required gate input, was correct from the
first run onward and required no fix.

## Issues Encountered

None beyond the two deviations above, both resolved before the evidence file was written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `39-04` (`FOREIGN_HALT_VISIBILITY`) can now import `probe-harness.mjs` directly for its own
  direct-spawn, preflight, port allocation, and checkpoint helpers rather than re-deriving them,
  and can reuse `resumeExecution()` / `awaitFirstCheckpointHit()` for the same cold-boot-settle
  pattern this plan discovered is necessary before any "is the machine running" check on this
  launch shape.
- `textmon-probe-client.mjs`'s `PROMPT_RE` is now empirically confirmed against a real
  post-command prompt (`(C:$e5cf) `), so later plans needing the text channel's actual command
  output (not just a silent connection) can rely on it rather than re-deriving it.
- No blockers. `IDLE_COEXIST: clean` means the gate is NOT pre-determined `no-go` by `R1`/`R2` --
  the remaining six measurements (`39-04` through `39-08`) are live expansion, not moot.

## Self-Check: PASSED

- All five created files verified present on disk (`[ -f ]`): `probe-harness.mjs`,
  `textmon-probe-client.mjs`, `idle-coexist-probe.mjs`, `39-idle-coexist.md`,
  `docs/phase39-dual-channel-coexistence-gate-findings.md`.
- Commits `99ec2cb9` and `1ddd4a5a` verified present in `git log --oneline --all`.
- Task 1's three `<verify>` blocks re-run post-commit: `IDLE_EVIDENCE_OK`, `PREFLIGHT_OK`,
  `IMPORT_DISCIPLINE_OK` -- all passed (tracer feedback gate).
- Task 2's `<verify>` block re-run: `FINDINGS_SEED_OK` -- passed.
- Ordering: `git rev-list --count HEAD -- evidence/` is `2` (the `39-01` rules commit plus this
  plan's measurement commit); `05c2c069` remains the sole prior commit, never amended.
- Host left clean: `systemctl --user is-active vice-broker` reads `inactive`,
  `pgrep -x x64sc` returns no match.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-07*
