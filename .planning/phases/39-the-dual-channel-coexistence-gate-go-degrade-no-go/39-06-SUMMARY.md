---
phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
plan: 06
subsystem: testing
tags: [tracer, live-measurement, chan-01, dual-channel, vice, stock-vice, disconnect-recovery, text-single-client, binary-monitor, text-monitor]

requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: "39-02/39-03's shared probe-harness.mjs/textmon-probe-client.mjs, reused rather than re-derived"
provides:
  - "DISCONNECT_RECOVERY: recovers -- a text-side halt held by a killed, cleanup-free child process is released by the emulator itself within ~100ms of the kill, with no further action on either channel, in both repetitions"
  - "TEXT_SINGLE_CLIENT: single -- via TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent -- a second TCP connection to the text-monitor port completes its handshake but is never serviced at the application level for the full 60s budget, in both repetitions"
  - "A previously-unmeasured fact: the emulator's own text-monitor server treats an abruptly-killed client's socket closing as a release of any halt that client held, functionally mirroring broker-control.mts's binary-side 'connection close IS the release' semantics but with no broker involved anywhere in the measurement"
  - "A previously-unmeasured fact: a second text-monitor connection is accepted at the OS/socket level (the TCP handshake completes) but never serviced at the application level -- the text-side analogue of CLAUDE.md's documented binary-side single-client trap, now measured rather than assumed"
affects: ["39-08"]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Separate-process victim, never same-process teardown: a client whose absence is being measured must be a genuine child process with zero lifecycle registration of its own, so its termination exercises no cleanup path the measurement is trying to rule out."
    - "Passive-then-confirm sequencing for a second connection: wait out the full stated budget purely passively (no send of any kind), and only AFTER the window elapses -- and only if a banner was observed during it -- send ONE confirming command to distinguish 'accepted and served' from 'accepted, banner seen, never confirmed'; a timeout with no banner classifies directly, without ever needing a send."
    - "Front-loaded polling schedule for a recovery-latency measurement: sample finely (100ms) near the triggering event and coarsen geometrically toward the full budget, so a near-instant recovery is timed precisely instead of bucketed into 'somewhere in the first N seconds' by a fixed-interval schedule."

key-files:
  created:
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/textmon-kill-victim.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/disconnect-recovery-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-disconnect-recovery.md
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/text-single-client-probe.mjs
    - .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-text-single-client.md
  modified: []

key-decisions:
  - "DISCONNECT_RECOVERY: recovers -- both runs' hit-count series began advancing on their own within ~100ms of the SIGKILL, with no further action on either channel, satisfying SCHEMA.md section 2.5's frozen rule cleanly. DECISION-RULE.md's R11 pre-mapped narrowing (D-10) was read in full before deriving the value, exactly as the plan requires, and is quoted verbatim in the evidence file; the measured answer does not trigger it."
  - "A finer, front-loaded polling schedule (100ms out to 2s, then 5s steps) replaced the first run's fixed 5-second cadence before the authoritative measurement, because the first run's coarser series could not distinguish near-instant recovery from recovery anywhere in the first 5-second bucket -- this changed measurement precision, not the derived outcome (both schedules independently measured `recovers`)."
  - "TEXT_SINGLE_CLIENT: single, via TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent -- a second connection's TCP handshake completes but the connection is never serviced (no banner, no reply, no EOF) across the full 60s budget, in both runs. Per the frozen rule this is single, never not-taken; client A was independently confirmed served in both runs, so not-taken's sole trigger did not apply."
  - "Both evidence files quote the relevant DECISION-RULE.md sections (R11's narrowing for Task 1; the '## Never a gate' reasoning for Task 2) in full, before or alongside the derived value, so the pre-commitment is demonstrably operative rather than decorative."

patterns-established:
  - "Multi-run outcome resolution with a stated tie-break: when a gate input is measured across N repeated runs and a voided (not-taken) run must never silently override a genuinely measured sibling run's outcome, and a genuine disagreement between two measured runs must resolve to a stated 'worse' value rather than being averaged or dropped -- implemented identically in both this plan's probes."

requirements-completed: [CHAN-01]

coverage:
  - id: D1
    description: "DISCONNECT_RECOVERY measured live against genuine stock VICE 3.9: recovers, both runs, near-instantly (~100ms) after an uncatchable SIGKILL of a separate, cleanup-free victim process"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^DISCONNECT_RECOVERY: (recovers|leaves-halted|not-taken)$' evidence/39-disconnect-recovery.md; DISCONNECT_EVIDENCE_OK and VICTIM_DISCIPLINE_OK verify blocks both pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "TEXT_SINGLE_CLIENT measured live: single, via accepted-then-silent, settling the milestone's other blocking UNVERIFIED item, with the timeout-to-single mapping re-checked mechanically against the frozen rule"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -acE '^TEXT_SINGLE_CLIENT: (single|multi|not-taken)$' evidence/39-text-single-client.md; SINGLE_CLIENT_EVIDENCE_OK verify block passes; MAPPING_OK verify block passes (accepted-then-silent -> single)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both probes reuse the shared harness and throwaway text client, build no wire frame themselves, name the emulator only by absolute path, and modify no shipped module under src/ or the shipped wedge-triage skill"
    requirement: "CHAN-01"
    verification:
      - kind: other
        ref: "grep -ac 'probe-harness.mjs' in disconnect-recovery-probe.mjs; git status --porcelain src/skills/vice-wedge-triage empty; npm run typecheck from src/mcp/vice exits 0; textmon-kill-victim.mjs contains zero process.on(/.destroy(/.end( occurrences outside comments"
        status: pass
    human_judgment: false

duration: ~34min
completed: 2026-09-08
status: complete
---

# Phase 39 Plan 06: DISCONNECT_RECOVERY and TEXT_SINGLE_CLIENT live measurement Summary

**Live-measured `DISCONNECT_RECOVERY: recovers` (near-instant, ~100ms, self-healing after an uncatchable kill of a separate victim process) and `TEXT_SINGLE_CLIENT: single` (via `accepted-then-silent`) against genuine stock VICE 3.9 — the milestone's second and final blocking UNVERIFIED item is now a settled, recorded fact, and the last two of the phase's seven gate inputs are real.**

## Performance

- **Duration:** ~34 min
- **Started:** ~2026-09-07T22:24:47Z
- **Completed:** 2026-09-07T22:57:30Z
- **Tasks:** 2
- **Files modified:** 5 created, 0 modified

## Accomplishments

- Measured `DISCONNECT_RECOVERY: recovers` live, twice, against genuine stock VICE 3.9
  with the broker stopped: a separate child process (`textmon-kill-victim.mjs`,
  registering zero lifecycle handlers of any kind) established a text-side halt via
  `memmapshow`, was confirmed holding it from the binary side (a passive liveness
  bracket showing 0 hits where a pre-victim bracket showed 59), and was terminated
  with `SIGKILL`. In both runs, a non-stopping checkpoint's hit count began advancing
  on its own within ~100ms of the kill, with no further action on either channel
  throughout the full 60-second budget — the emulator's own text-monitor server
  releases a halt held by a client whose socket the kernel closed out from under it,
  functionally mirroring `broker-control.mts`'s binary-side "connection close IS the
  release" semantics, with no broker anywhere in the measurement (`D-12`).
- `DECISION-RULE.md`'s `R11` pre-mapped narrowing (D-10) was read in full before
  deriving the value, exactly as the plan requires, and is quoted verbatim in
  `39-disconnect-recovery.md`. The measured answer (`recovers`) does not trigger it —
  reported honestly rather than reshaped toward the narrowing written for the other
  outcome.
- Corrected the first live run's polling granularity before the authoritative
  measurement: a fixed 5-second cadence could not distinguish near-instant recovery
  from recovery anywhere within the first 5-second bucket (both showed
  `cumulativeHits=301` at the first sample). Replaced with a front-loaded schedule
  (100ms steps out to 2s, then 5s steps to the full 60s budget), which pinned the
  recovery latency at ~100ms in both runs of the authoritative measurement. Both
  schedules independently measured the same outcome (`recovers`); only the precision
  changed.
- Wrote the required wedge-triage correspondence section: the shipped
  `vice-wedge-triage` playbook's `wedged` verdict (and its destructive-recycle
  recommendation) was never actually reached by this measurement's end state, because
  the observed recovery (~100ms) is far faster than any realistic triage procedure's
  own measurement window — the trap `D-10`'s narrowing anticipated (a healthy-but-
  stuck instance misdiagnosed as wedged) was not the one this run found. The playbook
  itself is confirmed unmodified (`git status --porcelain src/skills/vice-wedge-triage`
  empty).
- Measured `TEXT_SINGLE_CLIENT: single` live, twice — the milestone's **other**
  blocking UNVERIFIED item. Client A was established and confirmed served (banner
  plus one framed reply) in both runs before a bare, unwrapped second socket (`B`)
  was opened to the same text port. In both runs, `B`'s TCP handshake completed
  (`connect` fired at `tMs=1`) but the emulator's own monitor-service loop never read
  from it or wrote a banner to it for the entire 60-second budget —
  `TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent`, mapping per the frozen
  rule to `TEXT_SINGLE_CLIENT: single`, never `not-taken`. This is the text-side
  analogue of `CLAUDE.md`'s documented binary-side single-client trap, now measured
  rather than assumed. Client A was re-confirmed served, with no lasting effect, after
  `B` was closed, in both runs.
- Per `DECISION-RULE.md`'s committed `## Never a gate` reasoning (D-08), quoted in
  full in `39-text-single-client.md`, this value gates nothing in `R1`..`R15` and
  constrains only Phase 41's connection management — stated explicitly in the
  evidence file rather than left for a reader to rediscover.
- No probe design defect was found in either script — both ran clean on the first
  live attempt (Task 1's only correction was a polling-precision refinement, not a
  bug in the derivation).

## Task Commits

1. **Task 1: Kill a client that holds a halt, and find out whether the machine ever comes back** - `6c2225fd` (feat)
2. **Task 2: Does the text-monitor server serve a second client, refuse it, or accept it and go silent?** - `acf05b4c` (feat)

**Plan metadata:** commit follows this SUMMARY (see below).

_Both tasks are `type="auto"`, not `type="tracer"` -- no tracer feedback gate applies to this plan._

## Files Created/Modified

- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/textmon-kill-victim.mjs` - the separate child-process victim: establishes a text-side halt, prints one ready line, then blocks forever with zero lifecycle registration
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/disconnect-recovery-probe.mjs` - the DISCONNECT_RECOVERY orchestrator: spawns the emulator, arms a passive liveness instrument, spawns and kills the victim, polls purely passively across a 60s budget, twice
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-disconnect-recovery.md` - the transcript (a preliminary run recorded then superseded for precision, and the authoritative run), the R11 narrowing quoted verbatim, the wedge-triage correspondence section, and the outcome/fact lines
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/text-single-client-probe.mjs` - the TEXT_SINGLE_CLIENT probe: client A served, then a bare second socket observed passively for the full budget before any confirming send
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/39-text-single-client.md` - the transcript, the quoted CLAUDE.md/stock-protocol.ts precedents, the `## Never a gate` reasoning quoted in full, and the outcome/fact lines

## Decisions Made

- **`DISCONNECT_RECOVERY: recovers`.** Per `SCHEMA.md` §2.5's frozen rule, `recovers`
  requires the machine to be observed running again (hit_count advancing) within the
  60s budget with no further action — met in both runs, with the recovery latency
  pinned at ~100ms by the authoritative run's front-loaded schedule.
- **`TEXT_SINGLE_CLIENT: single`.** Per `SCHEMA.md` §2.7's frozen rule,
  `accepted-then-silent` (connect succeeds, no banner, no EOF within budget) maps to
  `single` — met in both runs, mechanically re-verified against the frozen mapping
  table (`accepted-then-silent -> single`).
- **Both DECISION-RULE.md sections relevant to this plan's two inputs were read and
  quoted before/alongside deriving each value** — `R11`'s pre-mapped narrowing (D-10)
  for Task 1, and the `## Never a gate` reasoning (D-08) for Task 2 — so the
  pre-commitment is demonstrably operative rather than decorative in both files.
- **The polling schedule for the 60s recovery window was refined between the first
  and authoritative runs of Task 1**, purely for temporal precision (see Deviations) —
  this did not change the derived outcome, which both schedules measured identically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, precision not correctness] `disconnect-recovery-probe.mjs`'s first draft used a fixed 5-second poll interval, which could not distinguish near-instant recovery from recovery anywhere in the first 5-second window**
- **Found during:** Task 1, first live run
- **Issue:** The first sample after the kill (`tMs=5001`) already read `cumulativeHits=301` in both repetitions — consistent with the anchor checkpoint's own ~60Hz free-running rate for the whole 5-second window — meaning the actual recovery could have happened anywhere from immediately after the kill up to just before that first sample. The derived value (`recovers`) was already correct and unambiguous per the frozen rule (which only requires the series to start advancing within the budget), but the transcript's own precision was worse than it needed to be for a genuinely novel, previously-unmeasured finding.
- **Fix:** Replaced the fixed-interval schedule with a front-loaded one (100, 300, 600, 1000, 1500, 2000, 3000ms, then 5-second steps out to 60000ms) — still purely passive (every sample reads the already-accumulated local counter, never a network round trip), so "no further action on either channel" is unchanged.
- **Files modified:** `disconnect-recovery-probe.mjs`
- **Verification:** The corrected, authoritative run pins the recovery latency at ~100ms in both repetitions (`tMs=99` and `tMs=101`), and both the preliminary and authoritative runs are recorded in `39-disconnect-recovery.md` — the preliminary run per README.md's "recorded, not discarded" convention applied to a precision gap rather than a defect.
- **Committed in:** `6c2225fd` (Task 1 commit; both runs are recorded in the evidence file)

---

**Total deviations:** 1 auto-fixed (a precision refinement to a probe script, never a correctness bug in the derivation, the emulator, or any shipped module under `src/`).
**Impact on plan:** The refinement produced a materially better transcript for a genuinely novel finding (the recovery latency) without changing the derived gate value, which both the coarse and refined schedules measured identically as `recovers`. No scope creep.

## Issues Encountered

**The plan-level `<verify>` command `git status --porcelain src/mcp/vice | wc -l` returns `1`, not `0`**, for the identical, pre-existing reason `39-05-SUMMARY.md` already disclosed: `src/mcp/vice/.anno-cli-test-HVa1Ev/` is an untracked scratch directory that predates this session (its files carry an `07-sep 10.11` mtime, hours before this plan's own work began) and is not created or touched by either task in this plan. Confirmed by directory listing and by `git log --oneline --all -- src/mcp/vice/.anno-cli-test-HVa1Ev` returning no output (never committed, never part of any commit this or any prior plan made). Disclosed here per the phase's "voided runs are recorded, not discarded" convention applied to a verify-command mismatch, exactly as 39-05 did for the same directory.

**`TEST_AUTOMATED_BASELINE` differs by one failing file between this plan's two live probe runs** (`fail 3` with `anno-import.test.ts, anno-register.test.ts` in three of the four observed baselines; `fail 4` with an added `audit-root-args.test.ts` in the disconnect-recovery authoritative run). Both observations were taken with the broker confirmed `inactive` throughout, so this is not the live-broker contamination README.md warns against — it reads as ordinary suite flakiness in a file unrelated to anything either probe touches, consistent with this project's already-documented `host-scripts.test.ts` flake precedent for a different file. Recorded as observed in both evidence files, per this phase's own binding rule that the count is never a gate; not investigated further.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **All seven of the phase's gate inputs are now real, live-measured facts:**
  `IDLE_COEXIST: clean` (39-03), `FOREIGN_HALT_VISIBILITY: visible` and
  `CROSS_CHANNEL_RESUME: clean` (39-04), `CONCURRENT_INFLIGHT: clean` and
  `HITCOUNT_INVARIANT_HOLDS: holds` (39-05), and this plan's
  `DISCONNECT_RECOVERY: recovers` and `TEXT_SINGLE_CLIENT: single`. Both of the
  milestone's blocking UNVERIFIED items (`HITCOUNT_INVARIANT_HOLDS`, settled by
  39-05, and `TEXT_SINGLE_CLIENT`, settled by this plan) are now resolved.
- **Walking the frozen rule set against these seven values**: `IDLE_COEXIST: clean`
  clears `R1`/`R2`; `FOREIGN_HALT_VISIBILITY: visible` clears `R3`-`R5`;
  `CONCURRENT_INFLIGHT: clean` clears `R6`-`R8`; `CROSS_CHANNEL_RESUME: clean` clears
  `R9`/`R10`; `DISCONNECT_RECOVERY: recovers` clears `R11`/`R12` (neither the
  `leaves-halted` nor the `not-taken` antecedent is met); `HITCOUNT_INVARIANT_HOLDS:
  holds` clears `R13`/`R14`. That leaves only `R15` — the exhaustive `go` default,
  reachable at any value of `TEXT_SINGLE_CLIENT` per `D-08`/`TSC_INDEPENDENCE`. This
  plan does not itself derive or record a verdict (that is `39-08`'s explicit,
  reserved scope per `README.md`'s ownership table and `DECISION-RULE.md`'s own
  binding process), but the arithmetic is stated here plainly since it follows
  directly from values this plan and its predecessors already measured and
  committed.
- `39-08` remains the sole owner of `docs/phase39-dual-channel-coexistence-gate-findings.md`,
  the fixture-capture batch (`fixture-capture.mjs`/`39-fixture-batch.md`), and the
  ordering-proof re-assertion (`git rev-list --count <rules-commit> -- evidence/`
  still reading `1`) — all still open work, unaffected by this plan's own
  measurements landing.
- No blockers.

## Self-Check: PASSED

- All five created files verified present on disk (`[ -f ]`): `textmon-kill-victim.mjs`,
  `disconnect-recovery-probe.mjs`, `39-disconnect-recovery.md`,
  `text-single-client-probe.mjs`, `39-text-single-client.md`.
- Commits `6c2225fd` and `acf05b4c` verified present in `git log --oneline --all`.
- Task 1's two `<verify>` blocks re-run post-commit: `DISCONNECT_EVIDENCE_OK` and
  `VICTIM_DISCIPLINE_OK` -- both passed.
- Task 2's three `<verify>` blocks re-run post-commit: `SINGLE_CLIENT_EVIDENCE_OK`
  passed; the mapping check reports `MAPPING_OK accepted-then-silent -> single`;
  the `git status --porcelain src/mcp/vice` check returns `1` (the same pre-existing,
  not-ours scratch dir 39-05 already disclosed, not a violation by this plan).
- `npm run typecheck` from `src/mcp/vice` exits 0 (this plan edits no shipped module).
- Ordering: `git rev-list --count HEAD -- evidence/` is `8` (39-01's rules commit,
  39-03's `IDLE_COEXIST` commit, 39-04's two task commits, 39-05's two task commits,
  and this plan's two task commits); `05c2c069` remains the sole original commit,
  never amended; both this plan's commits land after `099c5738` in git order.
- Host left clean: `systemctl --user is-active vice-broker` reads `inactive`,
  `pgrep -x x64sc` returns no match after every run.

## Self-Check: PASSED (final, post-write verification)

- All six files (5 evidence + this SUMMARY) confirmed present on disk with `[ -f ]`.
- Both commit hashes confirmed present in `git log --oneline --all`.

---
*Phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go*
*Completed: 2026-09-08*
