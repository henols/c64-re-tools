---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 14
subsystem: testing
tags: [text-monitor, gap-closure, evidence-record, requirements-restoration]

requires:
  - phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
    provides: 42-10 (CR-01), 42-11 (WR-02/IN-01), 42-12 (G5), 42-13 (G2/G3) -- all four gap-closure plans' own landed code, tests and SUMMARYs
provides:
  - "The round's own evidence record: five gap-closure blocks (Blocks 15-19) in docs/phase42-text-format-drift-citations.md, transcribing 42-10..42-13's verbatim refusal messages and symbols rather than re-deriving them"
  - "The final automated-gate figure (Block 20), measured in a confirmed-clean environment, with its failing file names beside the count, stated as a floor rather than a target"
  - "A live re-run of all five text formats against genuine stock /usr/bin/x64sc (VICE 3.9), on the tree as this round's four plans leave it, with teardown verified by 42-12's corrected three-part method (Block 21)"
  - "A closing block restating five deliberately-excluded items as still open, and stating that the undispositioned-findings gap was self-resolved before this round began"
  - "PARSE-03 and PARSE-04 returned to Complete in .planning/REQUIREMENTS.md's checkbox list and traceability table, conditional on this plan's own re-measurement of the two demotion causes coming back green"
affects: []

actuals:
  tokens: 3200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Round-closing evidence block: one gap block per closed finding, each naming the finding id, the defect in one sentence, the symbol/refusal code introduced, and the exact command whose output proves it -- transcribed from the four SUMMARYs' own verbatim quotes rather than paraphrased"
    - "Conditional requirement restoration: state the two demotion causes explicitly, re-measure them in this plan's own verification, and flip only if both come back green -- a status flip on the strength of a plan having run is exactly what the round's own prohibition (T-42-49) forbids"

key-files:
  created: []
  modified:
    - docs/phase42-text-format-drift-citations.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The evidence lives in the phase's existing citation record (docs/phase42-text-format-drift-citations.md), appended as a new 'Gap-Closure Round' section -- not a new document, per this plan's own <plan_decisions>."
  - "Both PARSE-03 and PARSE-04's demotion causes were re-measured green in this plan's own verification (see Evidence below), so both were flipped to Complete. Neither was left Pending -- this is reported plainly rather than assumed, since the plan required stating the specific measured result that justified each flip."
  - "The requirements restoration is a scoped four-line diff (2 checkbox markers, 2 traceability rows) -- confirmed by git diff --stat (4 insertions, 4 deletions, matching a four-line replacement), never a whole-file rewrite."

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04]

coverage:
  - id: D1
    description: "Task 1: five gap-closure evidence blocks appended to docs/phase42-text-format-drift-citations.md, the final automated-gate figure recorded with its failing file names and clean-environment claim, all five formats re-proven live on the final tree with teardown verified by the corrected method, and a closing block restating five deliberately-excluded items as open"
    verification:
      - kind: other
        ref: "grep -ac over docs/phase42-text-format-drift-citations.md for the four new symbols (incomplete-decoded-state, unsupported-chip, profiling-not-started, textCapabilityIdentityWarning) and for source-traced (>=4 survive) -- all present"
        status: pass
      - kind: integration
        ref: "node --test [nine phase-42 files] -- 274/274 pass, exceeding the 246 floor"
        status: pass
      - kind: e2e
        ref: "VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts -- 9/9 pass, 0 skipped, on the final post-round tree"
        status: pass
      - kind: integration
        ref: "node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts -- fail 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Task 2: PARSE-03 and PARSE-04 flipped Complete in REQUIREMENTS.md's checkbox list and traceability table, conditional on Task 1's own re-measurement, scoped to a four-line diff, with PARSE-01/PARSE-02 and ROADMAP.md/STATE.md untouched"
    requirement: "PARSE-03"
    verification:
      - kind: other
        ref: "grep over .planning/REQUIREMENTS.md's checkbox list and traceability table -- all four PARSE ids read checked/Complete"
        status: pass
      - kind: other
        ref: "git diff --stat -- .planning/REQUIREMENTS.md -- 4 insertions, 4 deletions (a four-line flip); git status --porcelain shows no modification to ROADMAP.md or STATE.md"
        status: pass
      - kind: integration
        ref: "node --test docs-review-disposition.test.ts -- 7/7 pass"
        status: pass
      - kind: integration
        ref: "npm run test:automated, re-measured clean -- 3 failures (anno-import.test.ts, anno-register.test.ts), the documented floor"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 14: The Round's Own Evidence Record, and PARSE-03/PARSE-04 Restored on Measured Grounds Summary

**Appended five gap-closure evidence blocks plus a final gate reading and a live re-run to `docs/phase42-text-format-drift-citations.md`, then returned `PARSE-03` and `PARSE-04` to Complete in `REQUIREMENTS.md` only after re-measuring both demotion causes green on the tree the round ships.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-09T19:39:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Appended a "Gap-Closure Round (Plans 42-10 through 42-14)" section to `docs/phase42-text-format-drift-citations.md`: five gap blocks (Blocks 15-19), each naming the finding id, the defect in one sentence, what changed, the symbol/refusal code introduced, and the exact command whose output proves it — transcribing the four predecessor SUMMARYs' own verbatim refusal messages and manifest-check outputs rather than paraphrasing them.
- Recorded the final automated-gate reading (Block 20): `tests 3941 | pass 3927 | fail 3`, failing files `anno-import.test.ts`/`anno-register.test.ts` — the documented pre-existing floor, measured in an environment confirmed clean of broker/emulator processes both before the run and via the un-confounded `ps` form (the bare `pgrep -af '[v]ice-broker|[x]64sc'` pattern self-matches a shell command line that merely quotes the substring `x64sc`, the same false-positive plan 42-12 already documented).
- Re-proved all five text formats live against genuine stock `/usr/bin/x64sc` (VICE 3.9) on the tree as this round's four plans leave it — after 42-10/42-11 changed the `io` parser's section handling, 42-13 changed the profile parser's recognition order and all five handlers' answer shape (Block 21): `tests 9 | pass 9 | fail 0 | skipped 0`. Per-format shapes recorded (1565 access-map entries; 20 CPU-history entries, cycle range 39245-39309; 3 profile rows; backtrace depth 2; `io $d020` decoding chip `VIC-II`), all five capability verdicts `capable`, all five keyed `"stock:/usr/bin/x64sc"`. Teardown verified by 42-12's corrected three-part method: broker pid observed exited, scratch-scoped sweep empty, scratch directory removal asserted — independently cross-checked afterward with `ps`/`ls`, both clean.
- Closed the record with a block restating five deliberately-excluded items as still open (the profiler-start capability, the two manual-only verifications, the RAM-execute hardware evidence, the decimal-separator behavioural half, and the phase validation artifact's own draft status), and one sentence stating the undispositioned-findings gap was self-resolved before this round began and was not chased by any plan in it.
- Re-measured both `PARSE-03`'s and `PARSE-04`'s demotion causes against the evidence Task 1 gathered — both came back green (see Evidence below) — and flipped both requirement ids from `[ ]`/`Pending` to `[x]`/`Complete` in `REQUIREMENTS.md`, as a scoped four-line diff (2 checkbox markers, 2 traceability rows), prose byte-identical, `PARSE-01`/`PARSE-02` untouched, neither `ROADMAP.md` nor `STATE.md` touched by this task.

## Task Commits

1. **Task 1: The round's evidence, measured on the final tree and recorded with what it does not cover** - `28cd591b` (docs) — five gap blocks, the final gate reading, the live re-run, the closing "still open" block.
2. **Task 2: PARSE-03 and PARSE-04 returned to Complete, on the evidence Task 1 measured** - `87a9b566` (docs) — the conditional, scoped requirements-ledger flip.

**Plan metadata:** committed separately below (this SUMMARY + STATE/ROADMAP).

## Files Created/Modified

- `docs/phase42-text-format-drift-citations.md` - appended the round's own evidence section (Blocks 15-21 plus a closing "still open" block); no existing content altered.
- `.planning/REQUIREMENTS.md` - `PARSE-03`/`PARSE-04` checkbox markers and traceability-table rows flipped to Complete; prose and all other rows byte-identical.

## Decisions Made

- **Both demoted requirement ids came back green, so both were flipped.** `PARSE-03`'s demotion cause (a drifted `io` reply not failing loudly) is closed: the drifted/renamed/empty decoded-prose cases each refuse by name (`incomplete-decoded-state`, `unsupported-chip`), and the phase's nine-file sweep — including the other four formats' own drift controls — is 274/274 green. `PARSE-04`'s demotion cause (the same evidence plus the cold-profiler message reading as a defect) is closed: the cold state is now a named `profiling-not-started` state, and the computed identity disagreement (`textCapabilityIdentityWarning()`) reaches the caller on both the success and refusal paths of all five tools — neither reads as a project defect. No ID was left `Pending`.
- **The record is appended, not given a new document** — matching plan 42-06/42-09's precedent, per this plan's own `<plan_decisions>`.
- **The requirements restoration touches nothing beyond the declared four lines** — verified by `git diff --stat` (4 insertions, 4 deletions) and by confirming `PARSE-01`/`PARSE-02` and `ROADMAP.md`/`STATE.md` are untouched.

## Deviations from Plan

None - plan executed exactly as written. Both verification loops (Task 1's nine-command gate, Task 2's five-command gate) passed on their first content-bearing attempt; the automated-gate figure required two extra re-runs purely to classify pre-existing documented flakes (`audit-root-args.test.ts`'s `zz-scratch` ENOENT race, `text-protocol.test.ts`'s banner-drain timing flake) as flakes rather than regressions, exactly as the project's own evidence-protocol constraint requires — disclosed below, not silently discarded.

## Issues Encountered

`npm run test:automated` was measured four times across this plan's own gate verification, in an environment confirmed clean of any `vice-broker`/`x64sc` process before each run (`ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep` empty each time):

1. First reading (Task 1's own verify block): `tests 3941 | pass 3927 | fail 3` — `anno-import.test.ts`, `anno-register.test.ts` — the documented floor, clean on the first attempt.
2. Second reading (Task 2's own verify block, first invocation): `fail 4` — the floor plus `audit-root-args.test.ts`. Re-run alone: `node --test audit-root-args.test.ts` passed cleanly (58/58), confirming the documented `zz-scratch` ENOENT race rather than a regression.
3. Third reading: `fail 5` — the floor plus `audit-root-args.test.ts` AND `text-protocol.test.ts`. Both re-run alone: `audit-root-args.test.ts` 58/58 pass, `text-protocol.test.ts` 34/34 pass — both confirming documented pre-existing flakes (the same banner-drain timing flake `42-VERIFICATION.md`'s own orchestrator addendum and `42-03-SUMMARY.md` already recorded for `text-protocol.test.ts`), neither caused by this plan (a docs/requirements-only diff touching no test file).
4. Fourth reading (recorded as this plan's own measurement, matching Task 1's Block 20 and Task 2's SUMMARY figure): `tests 3941 | pass 3927 | fail 3 | cancelled 0 | skipped 6` — `anno-import.test.ts`, `anno-register.test.ts` — exactly the documented pre-existing 3-failure floor, no new failing file introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Evidence (per plan's `<output>` instructions)

**The final `npm run test:automated` figure with failing file names and the clean-environment check that preceded it:**

```
$ ps -eo pid,args --no-headers | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep
(empty, exit 1)
$ npm run test:automated
tests 3941 | suites 24 | pass 3927 | fail 3 | cancelled 0 | skipped 6
```
Failing files: `anno-import.test.ts`, `anno-register.test.ts` — the documented pre-existing floor. This is a floor, not a target; a run reporting zero would mean the gate was not exercising the gate this project actually has.

**The live re-run's per-format measured values, binary, version and date:**

- **Binary:** `stock:/usr/bin/x64sc`. **Version reported:** `x64sc (VICE 3.9)`. **Date:** 2026-09-09.
- `memmapshow`: 1565 entries; RAM-execute count 0/1565 (still no hardware evidence for that half).
- `chis 20`: 20 entries; cycle range 39245-39309.
- `prof on` → `prof flat 20` → `prof off`: 3 rows; leading row `{"totalCycles":550366,"totalPercent":100,"selfCycles":550366,"selfPercent":100,"address":64848}`.
- `bt`: chain depth 2; current PC `$fd7c`.
- `io $d020`: chip `VIC-II`; raster line 0; border colour `$00`.
- All five capability-probe verdicts: `capable`, cache key `"stock:/usr/bin/x64sc"`.
- Command: `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` → `tests 9 | pass 9 | fail 0 | skipped 0`, exit 0.

**The teardown observation, corrected three-part form:**

- Broker pid: tracked via `HarnessReport.brokerPid`; confirmed exited in every one of the 9 cases' `pidsAliveAfterTeardown` (empty array each time).
- Scratch-scoped sweep: `strayPidsMatchingScratch` empty in every case.
- Scratch directory removal: `scratchDirRemoved` asserted `true` in every case.
- Independently cross-checked after the run: `ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep` printed nothing; `ls -d /tmp/text-monitor-live-*` found no surviving directory (exit 2, no match).

**For `PARSE-03`: the specific measured result that justified the flip.**
Demotion cause: a drifted `io` reply did not fail loudly (CR-01). Re-measured: `textmon-registers.test.ts`'s planted controls for dropped (`incomplete-decoded-state`), renamed (`unsupported-chip`), and empty decoded-prose/section cases all refuse by name (part of the 274/274 nine-file sweep); the other four formats' own pre-existing drift controls (`memmapshow`, `chis`, `bt`, `prof flat`) still pass in the same sweep. **Criterion met — flipped to Complete.**

**For `PARSE-04`: the specific measured result that justified the flip.**
Demotion cause: the same evidence, plus `prof flat`'s cold-profiler reply reading as "could not be parsed" and the computed identity disagreement never reaching the caller. Re-measured: the cold state is now the named `profiling-not-started` refusal code (`textmon-profile.test.ts`, `text-tools.test.ts`), and `textCapabilityIdentityWarning()` surfaces a computed disagreement on both the success path and every post-lease error path of all five text-tool handlers (`text-capability-probe.test.ts`, `text-tools.test.ts`) — neither reads as a project defect. **Criterion met — flipped to Complete.**

**Verbatim list of items restated as still open** (the closing block in `docs/phase42-text-format-drift-citations.md`):

1. The inability of any tool in this tree to start VICE's profiler (`.planning/WINDOWS.md` #55, still open).
2. The two manual-only verifications from `42-VALIDATION.md` (a genuinely `--disable-cpuhistory` build; `io`'s two degradation strings) — neither closed, still source-traced.
3. The RAM-execute hardware evidence — still 0/1565 over the searched denominator, covered only by the declared-synthetic fixture case.
4. The behavioural half of the decimal-separator finding (IN-02) — only the documentation half landed; the per-row separator-consistency check remains unbuilt.
5. The phase validation artifact's (`42-VALIDATION.md`) own draft status — `status: draft`, `nyquist_compliant: false`, **Approval: pending** — unaffected by this round, belongs to its own `/gsd-validate-phase 42` command.

**No broker and no `x64sc` left running at the end of this plan** (verified with the un-confounded `ps` form, immediately before writing this SUMMARY):

```
$ ps -eo pid,args --no-headers | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep
(empty, exit 1)
```

## Next Phase Readiness

- This gap-closure round is complete: 42-10 (CR-01), 42-11 (WR-02/IN-01), 42-12 (G5), 42-13 (G2/G3), and this plan's evidence record and requirements restoration all landed. `PARSE-01` through `PARSE-04` are all `Complete` in `REQUIREMENTS.md`, each on measured grounds this round's own citation record now carries.
- Five items remain deliberately open, restated above and in the document itself, so a green round is not misread as a clean bill of health: the profiler-start capability, the two manual-only verifications, the RAM-execute hardware evidence, the decimal-separator behavioural half, and `42-VALIDATION.md`'s own draft status.
- This is the last plan of the phase. `ROADMAP.md` is updated to 14/14 by the state-update step below.
- No blockers.

## Self-Check: PASSED

Both key files confirmed present on disk with the expected new content (`docs/phase42-text-format-drift-citations.md`'s "Gap-Closure Round" section grep-confirmed; `.planning/REQUIREMENTS.md`'s four PARSE ids grep-confirmed `[x]`/`Complete`). Both commit hashes (`28cd591b`, `87a9b566`) confirmed present in `git log --oneline --all`. Environment confirmed clean of broker/emulator processes and scratch directories at the time this SUMMARY was written.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
