---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 16
subsystem: text-monitor-parsers
tags: [text-capability-probe, io-registers, cr-02, live-verification, parse-04, gap-closure]

requires:
  - phase: 42 (plan 42-15)
    provides: "textCapabilityVerdictFor(), NEVER_CACHED_COMMANDS, and handleIoRegisters
      rewired onto them -- the behavioural fix this plan proves live"
provides:
  - "A live, discriminating two-address io control inside the existing five-format session,
    proving the second verdict is judged on its own reply against genuine stock VICE 3.9"
  - "The phase's round-2 gap-closure evidence record (CR-02 block, live block, gate block,
    restated-open closing block) in docs/phase42-text-format-drift-citations.md"
  - "PARSE-04 returned to Complete in REQUIREMENTS.md on measured grounds"
  - "The CR-02 disposition record closed with its Resolution section, and STATE.md's
    Deferred Items ledger row/count moved with it in the same commit"
affects: []

actuals:
  tokens: 5700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A live discriminating control (asserting two replies differ, failing loudly naming
      both if they do not) rather than a control that could pass vacuously on a host
      where both addresses happen to answer identically"
    - "A gap-closure evidence record's closing block restates every deliberately-excluded
      item as open, in the same document that records the closure"

key-files:
  created: []
  modified:
    - src/mcp/vice/text-monitor-live.test.ts
    - docs/phase42-text-format-drift-citations.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md

key-decisions:
  - "PARSE-04 was flipped to Complete because every item the demotion cause named came back
    green under this plan's and 42-15's own measured evidence: io occupies no cache entry
    through write, read or in-flight memo; both reachable wrong directions are covered by
    controls observed red before the fix and green after; and the live two-address session
    shows the second answer derived from the second reply, not the first. PARSE-01/02/03
    were not demoted this round and were left byte-identical (2-line diff, both PARSE-04's
    own checkbox and table cells)."
  - "The disposition record was closed (moved to completed/), not merely annotated -- the
    defect it deferred no longer exists, and leaving the file in pending/ after fixing it
    would assert a debt that is gone."

requirements-completed: [PARSE-04]

coverage:
  - id: D1
    description: "The CR-02 fix is proven discriminating and live: io dialed at two different
      addresses in one session against genuine stock VICE 3.9, the second verdict judged on
      the second reply, not the first"
    requirement: "PARSE-04"
    verification:
      - kind: e2e
        ref: "text-monitor-live.test.ts (live, VICE_LIVE_STOCK_BIN=/usr/bin/x64sc): the
          two-address io control inside the existing five-format case -- fromCache=false,
          response strictly equals the second reply, both replies proven to differ"
        status: pass
    human_judgment: false
  - id: D2
    description: "The round's evidence is recorded in the phase's own citation record with
      the finding id, both wrong answers, the remedy chosen and rejected, every introduced
      symbol, and the proving commands"
    verification:
      - kind: other
        ref: "docs/phase42-text-format-drift-citations.md, Round 2 Gap-Closure section,
          Blocks 22-24 -- CR-02=7, textCapabilityVerdictFor=3, NEVER_CACHED_COMMANDS=5,
          MEASURED=18 occurrences (all non-zero)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PARSE-04 restored to Complete on measured grounds, scoped to exactly one
      requirement id"
    requirement: "PARSE-04"
    verification:
      - kind: other
        ref: "git diff --stat -- .planning/REQUIREMENTS.md: 2 changed lines only,
          PARSE-01/02/03 byte-identical"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CR-02 disposition record closed on disk and in STATE.md's ledger
      together, both guard directions green"
    verification:
      - kind: unit
        ref: "docs-deferred-ledger.test.ts (AUDIT-04, both directions) and
          docs-review-disposition.test.ts -- fail 0"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 16: CR-02's Fix Proven Live, PARSE-04 Restored, Disposition Closed Summary

**A second, discriminating `io` dial (CIA1 `$dc00`, distinct from the existing session's VIC-II
`$d020`) proves the plan 42-15 fix live against genuine stock VICE 3.9 -- `fromCache=false`,
judged on its own reply -- and on that measured ground `PARSE-04` returns to Complete and the
CR-02 disposition record closes with its ledger row moving in the same commit.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-09T21:39:25Z (approx, from 42-15's own recorded completion timestamp)
- **Completed:** 2026-09-09T21:57:45Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended the existing live five-format `text-monitor-live.test.ts` case with a second `io`
  dial at a different chip's address (`$dc00`, CIA1) inside the SAME session, with no new
  `withBrokerHarness` invocation. The control asserts the second verdict's `fromCache` is
  `false`, its `response` strictly equals the second reply, the two replies differ from each
  other (failing loudly naming both if they did not), and `textCapabilityVerdictFor` agrees
  live with `probeTextCapability` on the outcome.
- Ran the live suite against genuine `/usr/bin/x64sc` (VICE 3.9): `tests 9 | pass 9 | fail 0 |
  skipped 0`, exit 0. The second dial parsed to the `unsupported-chip` refusal (CIA1 is outside
  `io`'s VIC-II-only decode range) -- a distinguishable, non-vacuous outcome from the first
  dial's VIC-II decode.
- Appended the round-2 gap-closure evidence section to `docs/phase42-text-format-drift-citations.md`:
  Block 22 (CR-02's defect, both wrong-answer directions transcribed verbatim from
  42-15-SUMMARY.md, the remedy chosen and the remedy NOT chosen with its cost, every introduced
  symbol), Block 23 (the live two-address measurement), Block 24 (the final automated-gate
  reading), and a closing block restating all five items round 1 deliberately left open,
  unchanged by this round.
- Returned `PARSE-04` to Complete in `.planning/REQUIREMENTS.md` (checkbox + traceability row),
  a scoped 2-line diff; `PARSE-01`/`PARSE-02`/`PARSE-03` untouched.
- Closed the CR-02 disposition record: moved
  `.planning/todos/pending/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md`
  to `completed/` with a `## Resolution` section, and in the same commit removed its
  `.planning/STATE.md` Deferred Items row and corrected the ledger's open-count prose
  (8 -> 7 pending).

## Task Commits

Each task was committed atomically:

1. **Task 1: The fix proven live against two addresses in one session, and the round's
   evidence recorded** - `c8b83078` (fix)
2. **Task 2: PARSE-04 returned to Complete, on the evidence Task 1 measured** - `908a76a4`
   (docs)
3. **Task 3: The CR-02 disposition closed, with its ledger row and open count moving in the
   same commit** - `3563364c` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/mcp/vice/text-monitor-live.test.ts` - added the two-address `io` control (CIA1 `$dc00`
  second dial) inside the existing five-format live case, plus the `textCapabilityVerdictFor`
  import
- `docs/phase42-text-format-drift-citations.md` - appended the "Round 2 Gap-Closure (Plans
  42-15, 42-16)" section: Blocks 22-24 and the restated-open closing block
- `.planning/REQUIREMENTS.md` - `PARSE-04` checkbox and traceability row flipped to
  Complete/checked; `PARSE-01`..`PARSE-03` byte-identical
- `.planning/todos/completed/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md`
  - moved from `pending/`, with a new `## Resolution` section appended
- `.planning/STATE.md` - removed the closed stem's Deferred Items row; corrected the
  open-count prose from 8 to 7

## Decisions Made

- **CIA1 `$dc00` chosen as the second address** because 42-11's chip gate gives it a known,
  distinguishable `unsupported-chip` outcome from the first dial's VIC-II `$d020` decode --
  the control cannot pass vacuously, and this was confirmed live (both replies differ,
  asserted explicitly).
- **`PARSE-04` flip gated on re-measurement, not on "a plan ran."** Every item the demotion
  cause named was individually confirmed green (cache exclusion in all three places, both
  wrong-answer directions covered by before/after controls, empty-reply indeterminate state
  from 42-15, and this plan's own live two-address proof) before the requirements edit was
  made.
- **The todo was closed (moved), not annotated**, per the plan's own instruction -- the
  disposition's "open, deferred" state no longer describes reality once the fix and its live
  proof both land.

## Deviations from Plan

None - plan executed exactly as written. One self-corrected slip during drafting: an early
attempt to edit `docs/phase42-text-format-drift-citations.md`'s closing paragraph accidentally
duplicated three lines via a copy-paste error in the edit tool call; caught immediately by
`git diff --stat` reporting an unexpected change before any commit, reverted in the same
turn (confirmed by a subsequent empty `git diff` against the file), and the intended append
was then made correctly as a separate edit. No commit was ever made with the duplicated text,
so this is recorded here for transparency rather than as a Rule 1-3 auto-fix (nothing shipped
was ever wrong).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-02 is closed end to end: fixed (42-15), proven live (this plan), and its disposition
  record closed with the ledger row moving in the same commit.
- `PARSE-04` is Complete on measured grounds; all four Phase 42 `PARSE-*` requirements now
  read Complete.
- Every item this round deliberately did not close remains recorded as open in
  `docs/phase42-text-format-drift-citations.md`'s round-2 closing block: the profiler-start
  capability, the two manual-only verifications, the RAM-execute hardware evidence, the
  decimal-separator behavioural half, and `42-VALIDATION.md`'s own draft status.
- No broker, no emulator, and no scratch directory were left behind (verified via the
  un-confounded `ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' | grep -v grep` form both
  before and after the live run, and `ls -d /tmp/text-monitor-live-*` finding no survivor).

## Live-Run Evidence (as required by this plan's `<output>`)

- **Both `io` commands as built:** first `"io $d020"` (VIC-II), second `"io $dc00"` (CIA1).
- **Second verdict:** `fromCache=false`.
- **Second parse outcome:** `unsupported-chip` (CIA1 refused by 42-11's chip gate, distinct
  from the first dial's VIC-II decode).
- **Binary:** `/usr/bin/x64sc`. **Reported version:** `x64sc (VICE 3.9)`. **Date:** 2026-09-09.
- **Teardown (three-part method):** `pidsAliveAfterTeardown` empty; `strayPidsMatchingScratch`
  empty; `scratchDirRemoved=true`. Independently cross-checked: `ps -eo pid,args | grep -E
  'vice-broker\.mjs|/x64sc' | grep -v grep` printed nothing before AND after the run;
  `ls -d /tmp/text-monitor-live-*` found no surviving directory after.
- **`pgrep -af '[v]ice-broker|[x]64sc'` output, verbatim, before the run:** returned exit 0
  with one self-matching line (the shell's own quoted invocation of the pattern containing the
  literal substring `x64sc` -- the documented false positive from plan 42-12's own citation
  Block 20). The un-confounded form (`ps -eo pid,args | grep -E 'vice-broker\.mjs|/x64sc' |
  grep -v grep`) printed nothing (exit 1) both before and after, confirming no real broker or
  emulator process was alive.
- **`npm run test:automated` final figure:** `tests 3954 | pass 3940 | fail 3 | skipped 6`.
  Failing files: `anno-import.test.ts`, `anno-register.test.ts` -- exactly the documented
  pre-existing floor, no new failing file.
- **`PARSE-04` flip justification, item by item:** (1) `io` provably occupies no cache entry
  through write, read or in-flight memo -- `NEVER_CACHED_COMMANDS` confirmed wired into all
  three sites in `text-capability-probe.ts`, re-confirmed by this plan's own read. (2) Both
  reachable wrong-answer directions are covered by controls observed red before the fix,
  green after (transcribed verbatim in the citations record, Block 22). (3) An empty reply
  still produces its own named indeterminate state (unchanged 42-15 behaviour, verified by
  the existing `text-capability-probe.test.ts` suite passing). (4) The live two-address
  session (this plan) shows the second answer derived from the second reply. All four
  confirmed green -- the flip was made.
- **Pending-todo count:** before the move, 8 files under `.planning/todos/pending/`; after,
  7. `.planning/STATE.md`'s prose figure was corrected from 8 to 7 in the same commit as the
  row removal.
- **Items restated as still open (verbatim list, from the citations record's closing
  block):** (1) the inability of any tool in this tree to start VICE's profiler; (2) the two
  manual-only verifications from `42-VALIDATION.md` (no `--disable-cpuhistory` build on this
  host; `io`'s two degradation strings remain source-traced, not live-observed); (3) the
  RAM-execute hardware evidence (still 0/1565); (4) the behavioural half of the
  decimal-separator finding (IN-02); (5) `42-VALIDATION.md`'s own draft/pending-approval
  status. Round 1's five closures are explicitly stated as NOT re-claimed by this round.

## Self-Check: PASSED

- `[ -f src/mcp/vice/text-monitor-live.test.ts ]` -- FOUND
- `[ -f docs/phase42-text-format-drift-citations.md ]` -- FOUND
- `[ -f .planning/REQUIREMENTS.md ]` -- FOUND
- `[ -f .planning/todos/completed/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md ]` -- FOUND
- `[ -f .planning/todos/pending/2026-09-09-io-degradation-probe-cached-under-a-binary-wide-key.md ]` -- NOT FOUND (correctly moved)
- `git log --oneline --all | grep -q c8b83078` -- FOUND
- `git log --oneline --all | grep -q 908a76a4` -- FOUND
- `git log --oneline --all | grep -q 3563364c` -- FOUND
- `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` -- fail 0, skipped 0 (9 pass)
- `npm run typecheck` -- exit 0, no `error TS`
- `node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts docs-review-disposition.test.ts docs-deferred-ledger.test.ts` -- fail 0 (63 pass)
- `npm run test:automated` -- 3954/3940/3 fail (documented floor), 6 skipped
- `git status --porcelain -- .planning/ROADMAP.md` -- empty (unmodified)

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*
