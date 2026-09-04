---
phase: 35-dxa-vendored-and-parsed
plan: 05
subsystem: infra
tags: [dxa, listing-parser, disassembler, reproducible-build, evidence]

# Dependency graph
requires:
  - phase: 35-dxa-vendored-and-parsed
    provides: "35-01's vendored dxa binary and build.bash, dxa-run.ts's runDxaDisassemble(); 35-02's hardened dxa-listing.ts (A-04 window contract, DumpRange, unclassified overlap disposition); 35-04's anno-d64.ts corpus-extraction route and evidence/35-dxa03-real-image.md's real-release identity/entry-point precedent"
provides:
  - "evidence/35-dxa02-real-refusal.md -- a real, unplanted refusal from an actual dxa run on real bytes (this project's own Phase 23 evidence parser refusing by name on the top-of-memory boundary case), explicitly distinguished from Phase 23's hand-truncated demonstration, plus the production parser's own non-refusing disposition of the same artefact and a second, independently-discovered real over-read shape on a real cracked release"
  - "evidence/35-dxa01-reproducible-build.md -- the reproducible build recorded as four digests and two stated equalities, the pin-precedes-fetch ordering shown by a pin-removed refusal transcript, the toolchain/host/date the digest is specific to, and the licence position and sole corroboration recorded as observed facts"
  - "evidence/35-baseline.md's closing reading -- the phase's closing npm run test:automated measurement (3371/3361/4, same 2 pre-existing failing files as the opening reading), the D-04 oracle-narrowing none-applied statement for the whole phase, and the phase's own grep-based honesty pass over all four evidence files"
  - "dxa-live.test.ts's new BOUNDARY case -- a real 65536-byte flat image run through the real vendored dxa binary, asserting the production parser reports (never drops, never refuses) the top-of-memory over-read"
  - "DXA-01 and DXA-02 marked Complete in REQUIREMENTS.md (the shared-ID gate's last declaring plan)"
affects: [38-real-release-recovery-measurement]

# Actuals (#2632)
actuals:
  tokens: 8472
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A refusal recorded as evidence must be provoked by feeding a REAL tool's REAL, unedited output to a parser, never by hand-editing a listing after the fact -- the distinguishing test is whether the input text was ever touched by a human between the tool's own stdout and the parser's stdin."
    - "When a production module was deliberately redesigned NOT to reproduce a historical defect (A-04's window contract vs. the Phase 23 running-count parser), the evidence for the historical defect and the evidence for the current module's correct non-reproduction of it are two separate, explicitly cross-referenced records -- neither stands in for the other."
    - "A digest-gated build script's evidence is the digest pairs themselves, not its exit code -- an evidence record transcribes both compared values for every equality the gate makes, plus a transcript proving the gate's own stated ordering (pin read before fetch) as an observed refusal, not an inference from source."
    - "An evidence record whose own verify command greps evidence files for forbidden tokens must describe those tokens' absence without spelling them -- naming the token to say it is absent still matches the grep that exists to catch it."

key-files:
  created:
    - .planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa02-real-refusal.md
    - .planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa01-reproducible-build.md
  modified:
    - src/mcp/vice/dxa-live.test.ts (BOUNDARY case)
    - .planning/phases/35-dxa-vendored-and-parsed/evidence/35-baseline.md (closing reading, D-04 statement, honesty pass)
    - .planning/REQUIREMENTS.md (DXA-01, DXA-02 -> Complete)

key-decisions:
  - "DXA-02's amended 'real refusal' requirement is satisfied by feeding a REAL, unedited dxa listing (the top-of-memory boundary reproduction) to the Phase 23 evidence parser (dxa-listing-parse.mjs) -- this project's own pre-existing script, not the CURRENT production parser (dxa-listing.ts). The plan's own text states this explicitly ('exactly what DXA-02 criterion 2 asks for') and the production parser was deliberately redesigned (A-04) NOT to refuse on this exact artefact -- confirmed by direct measurement (covered.size === imageSize, no throw) rather than assumed from the module's own doc comments. Both facts are recorded in the same evidence file so a later reader cannot conflate the two parsers' different, both-correct behaviors."
  - "The real-cracked-code run (BRUCE LEE via danish.d64, the same release/entry-point plan 35-04 already established) does NOT provoke a refusal in the production parser -- recorded honestly per the task's own instruction to record that absence rather than assume a refusal would occur. Its single outOfWindow line is a SECOND, independently-discovered real over-read shape (an end-of-image lookahead, not a top-of-memory wraparound), recorded as an incidental finding distinct from plan 35-04's own $0819-$081f exclusion range."
  - "The boundary image's exact byte content (byte[0]=0x48, byte[1]=0x7d, byte[65535]=0xeb layered over an i&0xff filler) was chosen to reproduce the PLAN's own already-recorded transcript ('ffff eb 48 7d ... .byt $eb') byte-for-byte, since the task's own <verify> greps the evidence file for that exact literal. The same construction is used in both the evidence capture and the new dxa-live.test.ts BOUNDARY case so the two records describe the identical reproduction, not two that merely agree on shape."
  - "35-baseline.md's honesty-pass section was rewritten mid-task after its first draft accidentally spelled 'PROOF-01' while describing the token's absence, which tripped the task's own forbidden-token grep against itself -- corrected to describe the three searched patterns by their role (a recovery-rate claim, the milestone proof requirement, the retired tool's name) without ever writing the literal strings, per the task's own explicit instruction and self-check."

requirements-completed: [DXA-01, DXA-02]

coverage:
  - id: D1
    description: "A real, unplanted refusal is recorded from an actual dxa run on real bytes -- this project's own Phase 23 evidence parser refusing by name on the top-of-memory boundary case, explicitly distinguished from Phase 23's earlier hand-truncated demonstration."
    requirement: "DXA-02"
    verification:
      - kind: other
        ref: "evidence/35-dxa02-real-refusal.md Parts 1-2 (transcript: exit 0, empty stderr, 699116 bytes, 21848 lines; Phase 23 parser throws 'accounted byte total 65538 does not equal expected image size 65536')"
        status: pass
      - kind: integration
        ref: "VICE_LIVE_DXA=1 node --test dxa-live.test.ts (dxa-live BOUNDARY case, real vendored binary)"
        status: pass
    human_judgment: true
    rationale: "The plan's own Task 3 human-check names this file specifically: whether the recorded refusal was genuinely provoked by a real run and not by a planted line is a distinction no automated check can make on its own -- the executor's own read confirms it, but the plan explicitly reserves final judgment for a human reader of the record."
  - id: D2
    description: "The production parser's (dxa-listing.ts) own disposition of the same top-of-memory artefact is recorded and asserted: it does NOT refuse, and reports the over-read line in outOfWindow[] rather than silently dropping it -- both halves asserted, not merely 'no throw'."
    requirement: "DXA-02"
    verification:
      - kind: integration
        ref: "dxa-live.test.ts#dxa-live BOUNDARY: covered.size === 65536 AND outOfWindow names the $ffff line"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reproducible build is recorded as four digests and two stated equalities, never as an exit code -- tarball-vs-pin, built-binary-vs-pinned-digest, plus the pin-precedes-fetch ordering shown by a pin-removed refusal transcript."
    requirement: "DXA-01"
    verification:
      - kind: other
        ref: "bash vendor/dxa/build.bash verify && bash vendor/dxa/build.bash build (both digest pairs equal, transcribed in evidence/35-dxa01-reproducible-build.md)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The phase's closing test-suite reading is measured and recorded alongside the opening reading, with the difference stated in FILES (identical failing-file set) not only counts, and neither number pinned in any assertion."
    requirement: "DXA-01"
    verification:
      - kind: other
        ref: "npm run test:automated (3371 tests, 3361 pass, 4 fail across anno-register.test.ts + audit-root-args.test.ts -- same 2 files as the opening reading); grep -a -rn for either count across dxa-*.test.ts returns nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phase's own honesty pass -- a grep-based scan of every evidence file for a real-cracked-code recovery rate, the milestone proof requirement, and the retired third-party tool's name -- is run and its zero-occurrence result recorded, without reciting the searched-for tokens."
    verification:
      - kind: other
        ref: "grep -aiEl 'PROOF-01|data.recovery.(pct|rate)' evidence/*.md | wc -l -> 0, over all 4 evidence files"
        status: pass
    human_judgment: false

# Metrics
duration: ~17min
completed: 2026-09-04
status: complete
---

# Phase 35 Plan 5: dxa Vendored and Parsed -- Phase Verification Summary

**The two claims this phase could not yet prove from a unit test are now on record from real runs: a genuine, unplanted refusal from this project's own listing parser fed a real dxa boundary artefact, and a reproducible build recorded as four digests rather than an exit code -- closing DXA-01 and DXA-02.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-09-04T11:44:00Z (base commit `cd518afb`)
- **Completed:** 2026-09-04T12:00:23Z
- **Tasks:** 3 (all completed)
- **Files modified:** 4 (2 evidence files created, `dxa-live.test.ts` extended, `35-baseline.md` closed; `REQUIREMENTS.md` updated in the plan-metadata commit)

## Accomplishments

- Reproduced the top-of-memory boundary case against the real, pinned vendored `dxa` binary: a
  65,536-byte flat image, byte-for-byte matching the plan's own already-recorded transcript
  (`byte[0]=0x48, byte[1]=0x7d, byte[65535]=0xeb` over an `i & 0xff` filler), producing the
  exact `ffff eb 48 7d	.byt $eb` last line, exit 0, empty stderr, 699,116 bytes, 21,848 lines.
- Fed that SAME unmodified listing to this project's own Phase 23 evidence parser
  (`dxa-listing-parse.mjs`), which throws `accounted byte total 65538 does not equal expected
  image size 65536` -- a real, unplanted refusal from an actual run, explicitly distinguished
  in `evidence/35-dxa02-real-refusal.md` from Phase 23's own earlier hand-truncated
  demonstration (247 vs. 279, a manually-edited listing).
- Recorded the CURRENT production parser's (`dxa-listing.ts`) own, deliberately different
  disposition of the identical artefact: it does NOT refuse (`covered.size === 65536`), and
  reports the over-read line in `outOfWindow[]` instead of dropping it -- proving A-04's window
  contract does exactly what it was designed to do, on the real case that motivated it.
- Ran the same fixed flag set against a real cracked release (`BRUCE LEE` via `danish.d64`, the
  same extraction plan 35-04 already established): the parser does NOT refuse here either
  (`covered.size === 45072 === imageSize`), and this absence is recorded with the numbers that
  show why -- including a SECOND, independently-discovered real over-read shape (an
  end-of-image lookahead at `$b80f`, distinct from the top-of-memory wraparound case).
- Added `dxa-live.test.ts`'s `dxa-live BOUNDARY` case: a real 65536-byte flat image run through
  the real seam, asserting BOTH that `outOfWindow[]` names the `$ffff` line AND that in-window
  coverage equals 65536 -- not merely that no throw occurred.
- Recorded the reproducible build as four digests (tarball-as-fetched, its pin; built binary,
  its pin) and two stated digest equalities, never an exit code, plus a transcript proving the
  pin-precedes-fetch ordering: `verify` re-run against a copy of the tree with the pin file
  removed refused immediately with no `curl` line in the transcript at all.
- Recorded the toolchain (`gcc 14.2.0`, `GNU Make 4.4.1`, this host, this date) the pinned
  binary digest is specific to, and the licence position (no `LICENSE`/`COPYING`, per-file
  copyright variance by filename) and sole corroboration (FreeBSD ports `devel/dxa65` distinfo)
  as observed facts, cross-referencing `THIRD-PARTY-NOTICES.md` rather than restating it.
- Closed `evidence/35-baseline.md`'s measurement record: the closing `npm run test:automated`
  reading (3371 tests, 3361 pass, 4 fail) has the SAME 2 failing files as the opening reading
  (`anno-register.test.ts`, `audit-root-args.test.ts`); the difference is stated in files, not
  only counts, and `audit-root-args.test.ts`'s cwd-sensitivity (1 failing sub-test at opening,
  2 at closing, 0/58 in isolation) is confirmed and explained rather than assumed away.
- Recorded the `D-04` oracle-narrowing statement for the WHOLE phase: no plan in phase 35
  produced or consumed a capture pair, checked explicitly against each of the five plans'
  evidence.
- Ran the phase's own honesty pass: grepped all four evidence files this phase wrote for a
  real-cracked-code recovery rate, the milestone proof requirement, and the retired
  third-party tool's name -- zero occurrences of all three, recorded without reciting the
  searched-for tokens (a first draft accidentally did, tripping its own gate; corrected).
- Marked `DXA-01` and `DXA-02` `Complete` in `REQUIREMENTS.md` (the shared-ID gate's last
  declaring plan for both).

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the real refusal, on real bytes, and record it verbatim** - `875b4950` (test)
2. **Task 2: Record the reproducible build as four digests, not as an exit code** - `be1770c3` (docs)
3. **Task 3: The closing baseline, the D-04 record line, and the phase's own honesty pass** - `fef58782` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa02-real-refusal.md` -- the real refusal record, four parts (boundary reproduction, the refusal itself, the production parser's non-refusal, the real-cracked-code outcome).
- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa01-reproducible-build.md` -- the four-digest reproducible-build record.
- `src/mcp/vice/dxa-live.test.ts` -- new `dxa-live BOUNDARY` case (opt-in, `VICE_LIVE_DXA=1`).
- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-baseline.md` -- closing reading, D-04 statement, honesty-pass result appended to the pre-existing opening reading.
- `.planning/REQUIREMENTS.md` -- `DXA-01`, `DXA-02` checkboxes and traceability rows moved to `Complete`.

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written. (The honesty-pass self-correction documented in
`key-decisions` was caught and fixed by this task's own `<verify>` command during execution,
before any commit was made -- not a deviation from the plan's own instructions, but the plan's
own self-check gate doing exactly what it was designed to do.)

## Issues Encountered

None beyond the self-caught honesty-pass draft described above. Every task's `<precondition>`
was already satisfied per the orchestrator's pre-verification (vendored binary present, build
toolchain present with cached tarball, no VICE broker running), so no HALT was needed at any
task.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `DXA-01` and `DXA-02` are `Complete`. All four of this phase's requirements (`DXA-01` through
  `DXA-04`) are now `Complete`.
- `evidence/35-baseline.md` is closed with both an opening and a closing reading; a future phase
  measuring this suite again should treat the closing reading (3371/3361/4) as its own new
  starting point, not re-derive from the opening one.
- The two real over-read shapes this task discovered (top-of-memory wraparound at `$ffff`, and
  an independently-found end-of-image lookahead at a real release's own final data line) are
  both correctly handled by the CURRENT production parser without any code change -- no
  follow-up work is implied by either discovery; they are recorded as evidence, not as defects.
- No rate about `dxa` on real cracked code and no milestone proof-requirement claim appears
  anywhere in this phase's evidence, confirmed by this task's own grep-based honesty pass.
  Real-release recovery-rate measurement belongs to Phase 38, which inherits `DXA-04`'s
  partition script and the denominator/positive-class discipline this phase's own evidence
  already follows.
- No blockers.

## Self-Check: PASSED

Both created evidence files confirmed present on disk (`evidence/35-dxa02-real-refusal.md`,
`evidence/35-dxa01-reproducible-build.md`); `dxa-live.test.ts` and `evidence/35-baseline.md`
confirmed modified. All 3 claimed commit hashes (`875b4950`, `be1770c3`, `fef58782`) confirmed
in `git log`. All task-level `<acceptance_criteria>` and the plan-level `<verification>` block
were re-run immediately before this SUMMARY was written: `VICE_LIVE_DXA=1 VICE_LIVE_DXA_CORPUS=1
node --test dxa-live.test.ts` -- 5/5 pass, 0 skipped; `bash vendor/dxa/build.bash verify && bash
vendor/dxa/build.bash build` -- both digest pairs equal; `grep -aiEl 'PROOF-01|data.recovery.
(pct|rate)' evidence/*.md | wc -l` -- `0`; `npm run typecheck` -- clean; `node --test
test-gate.test.ts ci-suite-coverage.test.ts hostpath-consumers.test.ts host-scripts.test.ts
resources-sync.test.ts` -- 41/41 pass; `node scripts/check-npm-packages.mjs` -- OK, no leaked
files; `git status --porcelain | grep -aE '\.d64$' | wc -l` -- `0`.

---
*Phase: 35-dxa-vendored-and-parsed*
*Completed: 2026-09-04*
