---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 03
subsystem: testing
tags: [vice, binary-monitor, autostart, determinism, frame-anchor, warp, evidence, stock-vice]

requires:
  - phase: 33-01
    provides: "The frozen GATE-01 decision rules, the outcome-line schema (names, domains, single declared source file per line) and the numbered evidence conventions this plan's transcripts are bound by"
  - phase: 33-02
    provides: "The repaired test:automated baseline (2 failing tests in anno-register.test.ts) that every transcript here records, and the four dated CONTEXT amendments carrying measured counter-values"
provides:
  - "The settled anchor-counted stop sequence for an AUTOSTARTed real cracked release, as an ordered 11-step command list with every checkpoint flag stated, for 33-09's runReproducible() to implement"
  - "AUTOSTART_FRAME_EXACT: not-achieved with the differing terms named (LIN, CYC) and the boundary measured: frame-exact and byte-identical through anchor hit 50, lost from hit 75"
  - "AUTOSTART_SEQUENCE: S3 — arm the anchor while halted, AUTOSTART, count hits; no RESET anywhere"
  - "Observed settlement of Q2's survival question: a checkpoint armed before AUTOSTART SURVIVES its power cycle (CHECKPOINT_LIST total=1, hits=0), so research's failure was caused by its RESET 1, not by the arming order"
  - "WALLCLOCK_CONTROL: red — CAP-04's required signature reproduced on a real autostarted release (same PC, same hit_count, differing LIN/CYC, 255 differing addresses in M6's exact structural shape)"
  - "WARP_BRACKET_CONTROL: red — by region overshoot, with the not-red literal instance reported rather than discarded"
  - "Measured, not cited: -warp is behaviour-neutral under a frame-anchored protocol (identical registers, one identical 64K sha256) and invalidating for a wall-clock bracket (1.76x region overshoot)"
  - "Three measured host facts later plans must not re-derive: AUTOSTART owns the warp state during the load; -warp is worth ~1.97x on this host, not an order of magnitude; -initbreak reset never services a late-connecting binary client"
  - "evidence/autostart-probe.mjs — the named repeatable probe with seven modes (s1..s4, controlA, controlB, bracket, warpcheck, diff, jiffy) and D-11 enforced in code"
affects: [33-09, 33-10, 33-12, 33-06, 33-11, 33-07, 33-08]

actuals:
  tokens: 27600
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "D-11 enforced in the probe, not in shell discipline: preflight() refuses to launch when the broker is active or any other x64sc is alive, and every child is reaped from process exit and SIGINT/SIGTERM"
    - "PING (0x81) as the monitor readiness signal — an accepted TCP connection is not a serving monitor"
    - "The jiffy clock ($00A0-$00A2) as an emulated-time coordinate, so a wall-clock bracket can be asserted as an explicit region and made to fail"
    - "Strict .vsf module walk (FIRST_MODULE_OFFSET 58 from named constants, off += size, never off++, terminal off === file length) with no resync fallback"

key-files:
  created:
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/autostart-probe.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-wallclock-control.md
  modified: []

key-decisions:
  - "S3 is the settled sequence: arm the frame anchor while halted, then AUTOSTART, then count CHECKPOINT_INFO hits. No RESET appears anywhere — AUTOSTART's own power cycle is the load-bearing reset, and research's separate RESET 1 is what undid the autostart."
  - "AUTOSTART_FRAME_EXACT recorded not-achieved rather than widening the schema's two-value domain, even though the pre-load result is a genuine four-term identity with 0 differing bytes. The boundary is recorded in prose and as an ACCEPTED LIMIT instead."
  - "-initbreak reset is NOT carried into the sequence and 33-09 must not adopt it: it never services a client that connects late, and a flag that only works when the client wins a race cannot pin anything."
  - "The claim that frame anchoring always fits inside D-22's cap of 64 is WITHDRAWN. The clean sweep reaches 66 differing addresses at jitter 4000 — over the cap. The cap stays at 64."
  - "The whole first measurement pass was voided under D-11 rather than kept, because it ran with five orphaned emulators alive. Keeping it would have recorded AUTOSTART_FRAME_EXACT: achieved on a contaminated pair."
  - "WARP_BRACKET_CONTROL reached red by region overshoot and the timeout form was not observed; the shortfall against the ROADMAP's wording is stated as an ACCEPTED LIMIT rather than glossed."

patterns-established:
  - "Void-and-re-take, never repair: a precondition violation discovered mid-plan voids every run it touched, the discarded set is enumerated with its reason, and what changed in the re-take is stated — including any conclusion that reversed."
  - "A guard is planted against before it is trusted: preflight() was tested with a deliberately planted live x64sc and observed refusing."
  - "A control that comes out not-red is reported and explained, not discarded and not retried until red; its not-red result is treated as the finding that locates the real mechanism."

requirements-completed: [CAP-04]

coverage:
  - id: D1
    description: "The anchor-counted stop sequence for an AUTOSTARTed real cracked release is settled by measurement (S3) and written down as the ordered command list 33-09 must implement, with every checkpoint flag stated"
    requirement: CAP-04
    verification:
      - kind: other
        ref: "node evidence/autostart-probe.mjs s1|s2|s3|s4 against /usr/bin/x64sc on danish.d64 — every attempted sequence recorded in evidence/33-autostart-sequencing.md with its outcome"
        status: pass
      - kind: automated_ui
        ref: "grep -Eq '^AUTOSTART_SEQUENCE: (S1|S2|S3|S4|none)$' evidence/33-autostart-sequencing.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "AUTOSTART_FRAME_EXACT is recorded with a value either way, the four-term boundary rule applied term by term, and the differing terms named"
    requirement: CAP-04
    verification:
      - kind: automated_ui
        ref: "grep -Eq '^AUTOSTART_FRAME_EXACT: (achieved|not-achieved)$' evidence/33-autostart-sequencing.md"
        status: pass
      - kind: other
        ref: "four-jitter sweep (0/1200/2500/4000) at anchor hit 400, plus targets 1/10/50/75/100/200 at two jitters, all transcribed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Checkpoint survival across AUTOSTART's power cycle settled by one observed CHECKPOINT_LIST (0x14) reply rather than inferred"
    requirement: CAP-04
    verification:
      - kind: other
        ref: "node evidence/autostart-probe.mjs s1 — verbatim reply 'total=1 items=1 / CP id=1 start=$ea31 ... hits=0' in evidence/33-autostart-sequencing.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "The wall-clock-anchoring negative control observed red on a real autostarted release, with the measured 157-vs-136-shaped signature and a paired positive that makes the red attributable"
    requirement: CAP-04
    verification:
      - kind: other
        ref: "node evidence/autostart-probe.mjs controlA --jitter 0|2500 — PC=$ea31 and hit_count=400 identical, LIN 17 vs 239, CYC 36 vs 58, 255 differing addresses"
        status: pass
      - kind: automated_ui
        ref: "grep -Eq '^WALLCLOCK_CONTROL: (red|not-red)$' evidence/33-wallclock-control.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "The warp-invalidated wall-clock bracket observed red, alongside the recorded fact that warp is behaviour-neutral under a frame-anchored protocol"
    requirement: CAP-04
    verification:
      - kind: other
        ref: "node evidence/autostart-probe.mjs bracket [--warp] --bracket-ms 10000 --expect-lo 360 --expect-hi 490 — unwarped 389 inside, warped 748 OUTSIDE (1.76x)"
        status: pass
      - kind: automated_ui
        ref: "grep -Eq '^WARP_BRACKET_CONTROL: (red|not-red)$' evidence/33-wallclock-control.md"
        status: pass
    human_judgment: true
    rationale: "The value `red` is proven by the transcripts, but it was reached by region overshoot and NOT by the spurious timeout the ROADMAP's success criterion 5 names. Whether the region-overshoot form satisfies that criterion is a judgment call for 33-12 and the human, not something a grep can settle; the shortfall is recorded as an ACCEPTED LIMIT."
  - id: D6
    description: "Every transcript records BROKER_STATE and the observed TEST_AUTOMATED_BASELINE, and every voided run is recorded with its reason"
    verification:
      - kind: automated_ui
        ref: "grep -q 'BROKER_STATE: inactive' and grep -q 'TEST_AUTOMATED_BASELINE:' in both evidence files; 18 voided runs enumerated in evidence/33-autostart-sequencing.md § Voided runs"
        status: pass
      - kind: other
        ref: "npm run test:automated — fail 2, both in anno-register.test.ts, unchanged from the phase-start baseline"
        status: pass
    human_judgment: false

duration: 66min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 03: The AUTOSTART Sequencing Measurement and the Wall-Clock Controls Summary

**S3 settled as the anchor-counted sequence for an AUTOSTARTed cracked release — frame-exact and byte-identical through anchor hit 50, lost from hit 75 because AUTOSTART's power cycle does not reset the absolute emulated clock — with both wall-clock controls observed red and the whole first measurement pass voided under D-11 rather than kept.**

## Performance

- **Duration:** 66 min
- **Started:** 2026-09-02T18:12:00Z
- **Completed:** 2026-09-02T18:56:05Z (last task commit; SUMMARY follows)
- **Tasks:** 2
- **Files created:** 3 (no existing file modified)
- **Live emulator runs:** 40 (22 reported, 18 voided and enumerated)

## Accomplishments

- **Q2 is closed by measurement.** `S3` — arm the `$EA31` frame anchor while halted, then
  `AUTOSTART` (0xdd), then count `CHECKPOINT_INFO` hits — produces a usable, repeatable
  stop, and the ordered 11-step command list with every checkpoint flag is written down for
  `33-09`. No `RESET` appears anywhere in it: research's separate `RESET 1` is what undid
  the autostart, not its arming order.
- **The survival question is settled by one observed reply, not inferred.** A checkpoint
  armed *before* `AUTOSTART` survives its power cycle intact — `CHECKPOINT_LIST` returns
  `total=1`, same id, same address, same flags, `hits=0`.
- **`AUTOSTART_FRAME_EXACT: not-achieved`, with the differing terms named** (`LIN` 154
  against 159, `CYC` 11 against 47) and the boundary measured: **frame-exact and
  byte-identical through anchor hit 50** (three targets, both jitters, one identical 64K
  sha256), **lost from hit 75**. The cause is identified: the power cycle resets the CPU,
  VIC-II and CIAs but not the absolute emulated clock, and the 1541's rotational phase is a
  function of that clock, so the pre-protocol interval leaks into the disk load's byte
  timing.
- **Both `D-07` controls observed red.** `WALLCLOCK_CONTROL: red` reproduces `CAP-04`'s
  required signature on a real autostarted release — same instruction, same `hit_count`,
  differing `LIN` — with 255 differing addresses in M6's exact structural shape.
  `WARP_BRACKET_CONTROL: red` by region overshoot, 1.76× on an identical 10 s bracket
  differing in one argv element.
- **Warp's two faces measured rather than cited.** `-warp` is behaviour-neutral under a
  frame-anchored protocol (identical registers, one identical 64K sha256
  `c97a08b6…` across warped j0, warped j2500 and the unwarped run) and invalidating for a
  wall-clock bracket. That is the distinction `33-06` needs before `profile.warp` ships.

## Task Commits

1. **Task 1 (tracer): One autostarted release, driven end to end to a counted anchor stop, twice at two jitters** — `16f73bc` (docs)
2. **Deviation fix spanning both tasks: void the D-11-violating pass, guard the cause, re-take clean** — `67ae081` (fix)
3. **Task 2: The wall-clock-anchoring negative control and the warp-invalidated bracket, both observed red** — `3ec8543` (docs)

**Plan metadata:** the commit carrying this SUMMARY. Its hash is deliberately not pinned
here — a file cannot carry the hash of the commit that introduces it, and a stale hash is
worse than none. Find it with
`git log --oneline -1 -- .planning/phases/33-.../33-03-SUMMARY.md`.

## Files Created/Modified

- `evidence/autostart-probe.mjs` — the named repeatable probe. `node:` builtins only, spawns
  `/usr/bin/x64sc` directly (`D-10`/`D-11`), `-default` at argv index 0 and `-console` at
  index 1. Modes: `s1` (survival), `s2`/`s3`/`s4` (the candidate sequences), `controlA`,
  `controlB`, `bracket`, `warpcheck`, `diff` (strict `.vsf` walk + `C64MEM` RAM compare),
  `jiffy` (emulated-time read). `hit_count` at `CHECKPOINT_INFO` body offset 13; `PC`/`LIN`/
  `CYC` resolved from `REGISTERS_AVAILABLE` (0x83) by name with no id literal; `memspace
  0x00` through the wire-byte mapping; every checkpoint `stop: true`.
- `evidence/33-autostart-sequencing.md` — every attempted sequence with its outcome, the
  verbatim `CHECKPOINT_LIST` survival reply, a four-jitter sweep, the full voided-run record,
  `AUTOSTART_FRAME_EXACT:` and `AUTOSTART_SEQUENCE:` at column 0, the ordered sequence for
  `33-09`, and three `## ACCEPTED LIMIT` entries.
- `evidence/33-wallclock-control.md` — both controls with their transcripts and paired
  positives, the `not-red` Control B instance reported rather than discarded, warp's measured
  factor on this host, `WALLCLOCK_CONTROL:` and `WARP_BRACKET_CONTROL:` at column 0, and two
  `## ACCEPTED LIMIT` entries.

The three frozen files (`evidence/DECISION-RULE.md`, `evidence/SCHEMA.md`,
`evidence/README.md`) are **unmodified** — each still shows exactly one commit, `2a8ef95`,
and `git rev-list --count 2a8ef95 -- evidence/` still returns `1`, so `33-01`'s
pre-commitment ordering proof is intact.

## Decisions Made

1. **`S3` is the sequence, and `-initbreak reset` is not part of it.** The obvious remedy
   for an unpinned absolute clock is to halt at reset. Stock 3.9 has `-initbreak reset`, it
   works when the client connects immediately, and it **never services a client that
   connects late** — an accepted socket that answers nothing, reproduced twice. A flag that
   only works when the client wins a race cannot pin anything, because winning the race is
   itself wall-clock-dependent.
2. **`AUTOSTART_FRAME_EXACT` recorded `not-achieved`, not a new value.** The pre-load result
   is a genuine four-term identity with 0 differing bytes, and the schema has no value for
   "achieved before the load, not after". The declared domain was **not** widened and no
   name was minted; the real shape is recorded in prose and as an `## ACCEPTED LIMIT` in
   this plan's own file, exactly as `SCHEMA.md`'s preamble directs.
3. **The whole first measurement pass was voided, not repaired.** See Deviations. Keeping it
   would have recorded `achieved` on a contaminated pair.
4. **The "frame anchoring always fits inside the cap" claim is withdrawn.** The clean sweep
   reaches **66** differing addresses at jitter 4000, over `D-22`'s cap of 64, while the
   reported pair reaches 48. The cap stays at 64 and is now measured to sit exactly where a
   real derivation falls on either side of it.
5. **`WARP_BRACKET_CONTROL: red` by region overshoot, with the shortfall stated.** The
   spurious-timeout form the ROADMAP names was not observed, and the measured reason is
   recorded (`AUTOSTART` owns warp during the load; `-warp` is worth ~1.97× on this host).
   The literal control instance that came out `not-red` is reported, not discarded, and was
   not retried until it went red.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The probe orphaned emulators on throw, which violated D-11 and
contaminated 18 runs**

- **Found during:** Task 2, at the pre-run `pgrep` check
- **Issue:** The `-initbreak reset` failures throw before `closeRun()`, so each left an
  `x64sc` alive, halted in the monitor. Five accumulated over four minutes and then sat
  alive for sixteen while later measurements were taken — so `pgrep -x x64sc` was non-empty,
  which `D-11` and evidence convention 3 forbid for any live run in this phase.
- **Fix:** `preflight()` in the probe now refuses to launch when the broker is active or any
  other `x64sc` is alive, and every launched child is registered in a module-level set reaped
  from `process.on("exit")` and on `SIGINT`/`SIGTERM`. The guard was **planted against** with
  a deliberately started `x64sc` and observed refusing (`D-11 REFUSAL: 1 other x64sc
  process(es) alive`). Sixteen contaminated runs plus the two `-initbreak` runs that caused
  them were discarded, enumerated with their reason, and re-taken; thirteen runs predating
  the first orphan were retained and marked *(clean pass)*.
- **Files modified:** `evidence/autostart-probe.mjs`, `evidence/33-autostart-sequencing.md`
- **Verification:** every re-taken run prints `PREFLIGHT_BROKER inactive` and
  `PREFLIGHT_X64SC (none)`; the negative control observed refusing; `pgrep -x x64sc` silent
  at plan end
- **Committed in:** `67ae081`

  **Two numbers moved and one conclusion reversed, which is why the rule exists.** The voided
  reported pair *agreed* (`LIN=154 CYC=11` both, 0 differing bytes) and would have recorded
  `AUTOSTART_FRAME_EXACT: achieved`; the clean re-take *disagrees*. The voided sweep peaked at
  28 differing addresses, under the cap of 64; the clean sweep reaches 66, over it.

**2. [Rule 2 - Missing Critical] S1 as written cannot answer its own question**

- **Found during:** Task 1
- **Issue:** The plan's `S1` is `connect → AUTOSTART → CHECKPOINT_LIST`. With nothing armed
  the list is empty either way, so the reply cannot settle whether a checkpoint armed before
  `AUTOSTART` survives its power cycle.
- **Fix:** The anchor is armed **first** (`connect → arm → AUTOSTART → CHECKPOINT_LIST`),
  which is what makes the reply load-bearing. Recorded as a deviation in the evidence file
  rather than silently applied.
- **Files modified:** `evidence/autostart-probe.mjs`, `evidence/33-autostart-sequencing.md`
- **Verification:** `CHECKPOINT_LIST_BEFORE_ARM total=0`, `AFTER_ARM total=1`,
  `AFTER_AUTOSTART total=1` — the before/after pair is what makes the answer readable
- **Committed in:** `16f73bc`

**3. [Rule 3 - Blocking] An accepted TCP connection is not a serving monitor**

- **Found during:** Task 1, while probing `-initbreak reset`
- **Issue:** The listen backlog accepts before the monitor services, so the probe's first
  command after `connect()` could hang for its full 20 s budget with no diagnosis.
- **Fix:** A `PING` (0x81) readiness retry after connect, reported as
  `MONITOR_READY_AFTER_PINGS`. Kept for every mode, not only the `-initbreak` one.
- **Files modified:** `evidence/autostart-probe.mjs`
- **Verification:** every run reports `MONITOR_READY_AFTER_PINGS 1` on the normal argv, and
  the `-initbreak` late-connect case reports eight unanswered pings instead of one opaque
  timeout
- **Committed in:** `67ae081`

**4. [Rule 2 - Missing Critical] Control B's literal instance cannot fail, so a failable
instance was added**

- **Found during:** Task 2
- **Issue:** Bracketing an autostarted run under `-warp` came out `not-red` — the anchor
  kept firing — because `AUTOSTART` manages warp itself during the load and `-warp` is worth
  only ~1.97× on this host. A control that cannot fail proves nothing, which is the plan's
  own stated standard.
- **Fix:** Added `warpcheck` (isolate warp's factor with no autostart in the loop) and
  `bracket` (assert the wall-clock bracket as an explicit emulated-time region, using the
  jiffy clock as the coordinate). Calibrated unwarped first, then tested: unwarped 389
  jiffies **inside** the 360..490 window, warped 748 **outside**, 1.76× overshoot, one argv
  element different, wall clocks within 7 ms.
- **Files modified:** `evidence/autostart-probe.mjs`, `evidence/33-wallclock-control.md`
- **Verification:** `BRACKET_REGION inside` / `BRACKET_REGION OUTSIDE` on the pair; the
  `not-red` instance retained and explained rather than discarded
- **Committed in:** `3ec8543`

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical, 1 blocking)
**Impact on plan:** All four were necessary for the measurements to mean anything. Deviation
1 is the significant one: without it this plan would have recorded a favourable outcome line
on a contaminated pair. No scope creep — every change is inside the probe or the two evidence
files this plan owns, and no shipped source file was touched.

## Issues Encountered

- **`pgrep -af x64sc` self-matches.** The `-af` form the conventions suggest matches the
  checking shell's own command line and always reports a false positive. The exact-match form
  `pgrep -x x64sc` is used instead, in the transcripts and in the probe's guard, and the
  substitution is disclosed in the evidence file rather than left as a silent difference.
- **`33-RESEARCH.md` M5's prose says 27 `.vsf` modules; the strict walk visits 26.** M5's own
  table lists 26 rows, so the prose count is off by one. Every walk here ends at
  `off === 193261 === file length`, the integrity assertion that matters. Recorded as an
  `## ACCEPTED LIMIT` so a later plan does not chase a phantom.
- **A two-run comparison can pass on a sequence that is not frame-exact.** `j0` and `j1200`
  agree exactly while `j2500` and `j4000` do not. `SCHEMA.md` § 3's derivation names two
  runs; it is applied as written, and the extra two jitters are recorded beside it as the
  reason a two-run pass would have been wrong. Recorded as an `## ACCEPTED LIMIT`.
- **Pre-existing out-of-phase red confirmed unchanged.** `npm run test:automated` reports
  `fail 2`, both in `anno-register.test.ts` (`:385`, `:479`), identical to the phase-start
  baseline. Not caused by this plan, not fixed by it, and stated in every transcript per
  convention 4.
- **Three untracked files predate this plan** (`docs/dissambler-workflow.md`,
  `docs/vice-mcp-ideas.md`, `skills-lock.json`). Out of this plan's scope boundary; left
  untouched.

## User Setup Required

None — no external service configuration required. The measurements need only stock
`/usr/bin/x64sc` (VICE 3.9), Node ≥ 24, the gitignored `danish.d64` already on disk, and the
broker stopped.

## Next Phase Readiness

**Ready, with three things the downstream plans must read rather than assume:**

- **`33-09`** has its ordered command list and must **not** adopt `-initbreak reset`, must
  keep the `PING` readiness retry, and must **report** the stop identity it achieved rather
  than assert frame-exactness. A pre-load frame-anchored stop is reproducible today; a
  post-load one is not, on stock, with the flags this phase has.
- **`33-10`** must record the jitters it uses for the capture pair and must **not** retry
  until the allow-list fits. `C0_CAPTURE_PAIR` is not foreordained either way: a pre-load
  frame-anchored pair compares equivalent with an empty allow-list, and a post-load pair
  measured 48 addresses at one jitter pair and **66 — over `D-22`'s cap of 64** — at another.
- **`33-06` and `33-11`** must account for two measured host facts before `profile.warp` and
  `profile.headless` ship: `AUTOSTART` turns warp on by itself for the duration of the load
  regardless of the argv, so any budget measured across an autostart is measured across a
  warped interval; and `-warp` is worth only ~1.97× on this host, with unwarped `x64sc`
  running at roughly half real time.

**`33-12`** should carry forward, verbatim, that `WARP_BRACKET_CONTROL: red` was reached by
region overshoot and **not** by the spurious timeout the ROADMAP's success criterion 5 names.

No blockers.

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*

## Self-Check: PASSED

All three created artifacts exist on disk and all four commits are reachable:

- `evidence/autostart-probe.mjs` — FOUND
- `evidence/33-autostart-sequencing.md` — FOUND
- `evidence/33-wallclock-control.md` — FOUND
- `33-03-SUMMARY.md` — FOUND
- `16f73bc`, `67ae081`, `3ec8543` — all FOUND (the metadata commit is this file's own, so
  its hash is not pinned; see *Task Commits*)

Plan-level verification, all five items re-run at close-out:

1. `node --check evidence/autostart-probe.mjs` passes; imports are `node:child_process`,
   `node:net`, `node:fs`, `node:path`, `node:os`, `node:crypto` and nothing else.
2. `33-autostart-sequencing.md` — `AUTOSTART_FRAME_EXACT: not-achieved` and
   `AUTOSTART_SEQUENCE: S3` at column 0, in-domain; verbatim `CHECKPOINT_LIST` reply present;
   every attempted sequence recorded with its outcome. Task 1 verify prints
   `SEQUENCING_RECORDED`; the wire-discipline verify prints counts `1` and `7` then
   `WIRE_DISCIPLINE_OK`.
3. `33-wallclock-control.md` — `WALLCLOCK_CONTROL: red` and `WARP_BRACKET_CONTROL: red` at
   column 0; all four stop-identity terms for both Control A runs; Task 1's
   `AUTOSTART_FRAME_EXACT:` line cited by name. Task 2 verify prints `CONTROLS_RECORDED`;
   the transcript-line verify counts 13 `$ node` lines.
4. Both files carry `BROKER_STATE: inactive` and a `TEST_AUTOMATED_BASELINE:` line per run,
   plus `$ <command>` transcript lines throughout.
5. `git status --porcelain` shows no change outside `files_modified` (the three untracked
   files that predate this plan are unchanged and untouched).

Frozen-file check: `evidence/DECISION-RULE.md`, `evidence/SCHEMA.md` and
`evidence/README.md` each still show exactly one commit (`2a8ef95`), and
`git rev-list --count 2a8ef95 -- evidence/` still returns `1` — `33-01`'s pre-commitment
ordering proof is intact.

Suite check: `npm run test:automated` reports `fail 2`, both in `anno-register.test.ts`,
identical to the phase-start baseline. No regression introduced.

No stray `x64sc` processes remain (`pgrep -x x64sc` silent).
