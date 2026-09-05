---
phase: 38-proof-01-03-on-real-cracked-code
plan: "04"
subsystem: testing
tags: [ghidra, vice, capture-pair, stop-oracle, evidence-schema, flat64k, real-emulator]

requires:
  - phase: 38-proof-01-03-on-real-cracked-code
    provides: "evidence/SCHEMA.md's frozen PROOF02_* outcome-line vocabulary, evidence/README.md's conventions, and evidence/proof02-enumerate-sites.mjs / evidence/proof02-loader-stage.md (38-01, 38-03)"
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "capture-pair.mjs's run/compare subcommands, the shipped vsf-slice CLI, the stop oracle and capture predicate, GATE-01's D-04 two-term narrowing"
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "runGhidraAnalyze()/classifyGhidraRunLog(), vendor/ghidra-scripts/GhidraStructExport.java, the flat64k importRoute"
provides:
  - "evidence/proof02-depacked-capture.md: a depacked flat-64K capture pair of danish.d64 (BRUCE LEE (DC)), PROOF02_CAPTURE_OBTAINED: yes, its identity, the two-term oracle statement, and measured PROOF02_DEPACK_PROGRESS counts"
  - "evidence/proof02-computed-dispatch.md: PROOF-02's single roll-up verdict (PROOF02_COMPUTED_DISPATCH: not-exercised), naming both search depths and citing proof02-loader-stage.md"
affects: []

actuals:
  tokens: 9961
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A capture-derived measurement states the two-term (PC, hit_count) stop oracle beside its own numbers even when a specific pair happens to also agree on the frame term (LIN, CYC) -- the ASSERTED identity never changes to reflect a lucky agreement"
    - "PROOF02_DEPACK_PROGRESS as two named counts (differing bytes inside the static image's own range, non-zero bytes outside it) rather than a single percentage -- both counts are evidence about depth of run, not a claim about the whole game body"
    - "A flat64k Ghidra run with no entry points supplied is a legitimate, honestly-scoped measurement when the capture itself was taken mid-load: zero decompiled functions is the correct, disclosed consequence, not a run failure"

key-files:
  created:
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-depacked-capture.md
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md

key-decisions:
  - "The reported capture pair took jitter 0 on both sides (matching Phase 33's own pair-j0 run), producing byte-identical images and a frame-term-exact pair -- a stricter result than Phase 33's own jitter-0-vs-jitter-2500 reported pair, not a weaker one, since holding jitter fixed removes the one input Phase 33 identified as the divergence cause and the two captures still agree byte-for-byte."
  - "PROOF02_DEPACKED_COMPUTED_DISPATCH: not-exercised, and the roll-up PROOF02_COMPUTED_DISPATCH: not-exercised, derived per the plan's own stated rule (zero computed-index sites enumerated at either depth) -- not a claim that no computed dispatch exists anywhere in the release, only that neither depth searched found a candidate of that shape."
  - "No entry points were supplied to the flat64k-route Ghidra run, per this task's own action text. Zero functions decompiled is recorded as the honest consequence of a mid-load capture with no known entry point, not smoothed over as an equivalent run to plan 38-03's entry-point-seeded .prg-route run."

requirements-completed: [PROOF-02]

coverage:
  - id: D1
    description: "A depacked flat-64K capture pair of danish.d64 obtained through Phase 33's committed capture-pair.mjs (unchanged), with identity (sha256), the two-term (PC, hit_count) oracle statement plus the recorded-not-asserted frame term beside its numbers, and measured PROOF02_DEPACK_PROGRESS evidence (40511/45072 differing bytes inside the static image's own range, 10581/20464 non-zero bytes outside it)"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "grep -acE for the 5 declared column-0 outcome lines (PROOF02_CAPTURE_OBTAINED/ORACLE_TERMS/FRAME_TERM/DEPACK_PROGRESS/BROKER_STATE) returns 6; PROOF02_CAPTURE_OBTAINED: yes matches its domain; recorded-not-asserted present; danish.d64 sha256 assertion pasted; 2 capture-pair.mjs run transcripts present; git status --porcelain clean of stray artifacts; pgrep -x vice-broker/x64sc both exit 1 after the task"
        status: pass
    human_judgment: true
    rationale: "The grep checks prove the keys and values are present and inside domain. Whether the two-term oracle statement genuinely sits beside the numbers it qualifies (rather than in a closing footnote) and whether PROOF02_DEPACK_PROGRESS's counts are presented as depth-of-run evidence rather than a whole-game claim is the judgment this plan's own human-check verify step reserves for a human reader."
  - id: D2
    description: "PROOF-02's roll-up record: the derivation rule stated before any value, the depacked-depth site enumeration (via plan 38-03's unchanged enumerator, --flat64k mode) recorded before the Ghidra run, per-depth and roll-up verdicts inside their declared domain, both search depths named, and the loader-stage record cited by filename"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "grep -acE for the 8 declared outcome lines returns 8; both PROOF02_COMPUTED_DISPATCH and PROOF02_DEPACKED_COMPUTED_DISPATCH match resolved|unresolved|not-exercised (2/2); awk line-number check confirms the derivation rule text precedes the PROOF02_COMPUTED_DISPATCH line (RULE_BEFORE_VALUE_OK); awk check confirms PROOF02_DEPACKED_SITES_ENUMERATED precedes the first Ghidra-seam mention (ORDER_OK); proof02-loader-stage.md cited by filename; git status --porcelain clean; test:automated at or below the recorded baseline (3525/3512/2) with broker confirmed inactive before and after"
        status: pass
    human_judgment: true
    rationale: "The grep/awk checks prove the keys, verdict domains and document ordering are mechanically correct. Whether the surrounding prose honestly frames a not-exercised verdict as a statement about the corpus at the depths searched -- rather than a clean bill of health, and rather than glossing over that no entry points were supplied to the depacked-depth Ghidra run -- is the judgment this plan's own human-check verify step reserves for a human reader."

duration: 34min
completed: 2026-09-05
status: complete
---

# Phase 38 Plan 04: PROOF-02, the Depacked Flat-64K Capture and the Roll-Up Verdict Summary

**Captured a depacked flat-64K image of `danish.d64`'s `BRUCE LEE (DC)` through Phase 33's unchanged capture route, searched it with plan 38-03's independent enumerator and a flat64k-route Ghidra run, and recorded PROOF-02's honestly-scoped roll-up verdict: `PROOF02_COMPUTED_DISPATCH: not-exercised` across both the loader/depacker and depacked depths.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-05T18:42:00+00:00
- **Completed:** 2026-09-05T19:16:15+00:00
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `evidence/proof02-depacked-capture.md` -- a byte-identical capture pair (`proof38-depacked-a` / `proof38-depacked-b`, both jitter 0, target 400, matching Phase 33's own `pair-j0` seed/argv digest), compared with an empty allow-list (`differing=0`, all four oracle terms agree for this specific pair). The ASSERTED identity remains the two-term `(PC, hit_count)` oracle per `GATE-01`'s `D-04` narrowing, stated beside the numbers rather than in a footnote, regardless of this pair's own frame-term agreement. `PROOF02_DEPACK_PROGRESS` measured, not assumed: `40511` of `45072` addresses inside the statically extracted `.prg`'s own range differ from the running capture, and `10581` of `20464` addresses outside that range are non-zero in the capture -- direct evidence the capture holds bytes the static `.prg` never contains.
- `evidence/proof02-computed-dispatch.md` -- the roll-up record. Plan 38-03's independent `$6C`-scan enumerator (reused unchanged, `--flat64k` mode) found exactly one raw site in the 65536-byte capture, classified `vector`, zero `computed-index`/`immediate-index`. A Ghidra `flat64k`-route run (no entry points supplied, per this task's own action) recovered zero functions and zero references -- an honest consequence of a mid-load capture, not a run failure. `PROOF02_DEPACKED_COMPUTED_DISPATCH: not-exercised`, and the roll-up `PROOF02_COMPUTED_DISPATCH: not-exercised` (both depths `not-exercised`, per `SCHEMA.md` §5's own worked example), naming both search depths and citing `proof02-loader-stage.md` by filename for the loader/depacker-depth value.
- `PROOF-02` is now shared-ID complete: both declaring plans (`38-03`, `38-04`) have finished, so this plan's own `update_requirements` step is what flips it to `Complete` in `.planning/REQUIREMENTS.md`.
- Live `test:automated` result confirmed at the recorded baseline (`tests 3525 / pass 3512 / fail 2`, both pre-existing `anno-register.test.ts` findings), broker confirmed `inactive` before and after every live run in this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the depacked flat-64K image, twice, and record its identity and its oracle** - `307b7e3e` (docs)
2. **Task 2: Search the depacked image and record PROOF-02's roll-up verdict** - `d8edc73e` (docs)

**Plan metadata:** committed after this SUMMARY.

## Files Created/Modified

- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-depacked-capture.md` - the depacked flat-64K capture record
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md` - PROOF-02's single roll-up verdict record

## Decisions Made

- The reported capture pair used jitter 0 on both sides, producing byte-identical images and full oracle agreement (including the frame term) -- a stricter, not weaker, result than Phase 33's own reported pair, which paired two different jitters and measured `CAPTURE_FRAME_EXACT: no`. Recorded as what it is (this pair happens to agree) rather than as evidence that the frame-term narrowing no longer applies.
- `PROOF02_DEPACKED_COMPUTED_DISPATCH: not-exercised` and the roll-up `PROOF02_COMPUTED_DISPATCH: not-exercised`, derived by the plan's own stated rule (zero `computed-index` sites at either depth) -- explicitly not a claim that no computed dispatch construct exists anywhere in the release's game body, only that neither depth searched (the loader/depacker's 67 real bytes, nor this mid-load depacked capture) contained a candidate of that shape.
- No entry points were supplied to the flat64k-route Ghidra run, matching the plan's own action text. Zero decompiled functions is recorded as the honest, disclosed consequence of searching a mid-load capture with no known entry point, rather than treated as an equivalent measurement to plan 38-03's entry-point-seeded `.prg`-route run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `loaderBaseAddr: "0x0000"` conflicts with the flat64k route's own base-address spelling**
- **Found during:** Task 2, the first live `runGhidraAnalyze()` invocation with `importRoute: "flat64k"`
- **Issue:** The plan's own action text names a `loaderBaseAddr` of `0x0000` for a full 64K image. `host-tool.mts` refuses this outright on the `flat64k` route: it compares the supplied `loaderBaseAddr` against the route's own fixed base address as an EXACT STRING, and that fixed value is spelled `0x0`, not `0x0000` -- numerically identical, textually different, and the seam refuses rather than normalising.
- **Fix:** Omitted `loaderBaseAddr` entirely, letting the `flat64k` route supply its own base address (`0x0`) exactly as the refusal message itself directs. No other argument changed; the resulting run used the identical numeric base the plan's text asked for.
- **Files modified:** None (an argument-shape choice only, recorded in `evidence/proof02-computed-dispatch.md`'s own transcript, including the reproduced refusal).
- **Verification:** The re-run without `loaderBaseAddr` succeeded (`exitStatus: 0`, `scriptThrew: false`, language byte-exact match, self-consistent classification count 65536=65536); `git status --porcelain` confirmed clean of any Ghidra project or scratch artifact afterward.
- **Committed in:** `d8edc73e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact:** Necessary for the Ghidra run to succeed at all; no scope creep -- the fix is an argument-shape correction recorded transparently in the evidence transcript, not a change to any shipped source file.

## Issues Encountered

The verify step for Task 1's broker-down check as literally written in `38-04-PLAN.md` (`pgrep -f vice-broker`) self-matches the checking shell's own command line (the eval string contains the literal substring `vice-broker`), producing a false `BROKER_STILL_UP` when run through this harness's Bash tool. This is the same `pgrep -f` trap `evidence/README.md` and this phase's own prior plans already document for `x64sc`, reproduced live here for `vice-broker`. Used `pgrep -x vice-broker` (exact-name match) instead, which correctly reported no match (`exit=1`) both times it was checked, matching `systemctl --user is-active vice-broker: inactive`. No corrective action was needed beyond using the correct check form -- the broker was genuinely down throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 38 (`PROOF-01..03 on Real Cracked Code`) is now complete: all four plans (`38-01` through `38-04`) have SUMMARYs, and `PROOF-01`, `PROOF-02` and `PROOF-03` all read Complete in `.planning/REQUIREMENTS.md` once this plan's own `update_requirements` step runs.
- No blockers for the next phase. The depacked-depth measurement's own honest limit -- a mid-load capture with no known entry point for the game's own resident code -- is disclosed in `evidence/proof02-computed-dispatch.md` rather than hidden, should a future phase want a later-anchor, entry-point-seeded depacked search.

## Self-Check: PASSED

Both created files confirmed present on disk (`ls`); both commits (`307b7e3e`, `d8edc73e`) confirmed in `git log --oneline --all`.

---
*Phase: 38-proof-01-03-on-real-cracked-code*
*Completed: 2026-09-05*
