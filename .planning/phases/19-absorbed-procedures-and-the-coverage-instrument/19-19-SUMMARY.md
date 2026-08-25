---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 19
subsystem: testing
tags: [validation-record, planted-violation, phase-gate, deferred-ledger, wr-03, d-07, d-08]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-15)
    provides: "the tightened push-idiom branch and plant 15 — row 1 of the consolidation"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-16)
    provides: "the tightened zero-page-vector branch, the pairing-consultation pin, and plants 16, 17, 18 — rows 2 and 3"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-17)
    provides: "the composed corpus, the computed oracle, and plants 19, 20 with their falsely-proven populations — row 4"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-18)
    provides: "the (shape × route) coverage assertion, the four route pins, and plants 21–25 plus 25b — rows 5 and 6"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-20)
    provides: "the census decodability predicate closing WR-03, PINs 5–8, plants 26–28, and Decision 6 — row 7"
provides:
  - "19-VALIDATION.md — the round-4 consolidated section: one row per gate for all seven, with the declined payload, the accepted payload, the plant, the test observed red, the counts and exit code, and the green after restoration"
  - "19-VALIDATION.md — D-07's three clauses each mapped to the row that discharges it"
  - "19-VALIDATION.md — the round-4 phase gate: one full workspace suite run and nine gate commands, transcribed verbatim"
  - "deferred-items.md item 4 — WR-03 recorded CLOSED with its before/after measurements, its promoting authority, and its named under-report residual"
  - "deferred-items.md item 5 — D-08 recorded as a one-way contingency, NOT acted on"
  - "deferred-items.md item 6 — the round-4 full-suite running tally, eight runs counted from the five plan SUMMARYs"
affects: [19-verification-round-4, phase-20-decomposition]

# Actuals (#2632)
actuals:
  tokens: 7649
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A consolidation derives its own totals by counting its sources' rows, and says so, so a reader who recounts can falsify it"
    - "A cell with no measurement available says which kind of measurement does not exist for that gate, rather than being filled with a plausible number"
    - "A closed ledger item keeps its entry and gains its closing evidence; the ledger is append-only and a deletion would erase the reason"
    - "A contingency is recorded with its reversibility rating and its confirmation requirement so it is not executed reflexively by whoever reads the verdict next"

key-files:
  created: []
  modified:
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md

key-decisions:
  - "The demonstration total (15) is stated as DERIVED by counting the planted-violation rows the five SUMMARYs record — 1 + 3 + 2 + 6 + 3 — and the section says a recount that disagrees has found a defect in the consolidation, not in the sources"
  - "Three cells carry a source condition instead of report figures, and say so: the pairing-consultation pin, the four route pins, and the declaration half of the (shape × route) assertion have no report values by construction"
  - "The two predictions that failed in this round are carried into the consolidation as failures — plant 25's inert advisory leak and plant 26's 64/0/64 — rather than smoothed into the predicted result"
  - "Gate 1's accepted-payload census is recorded as a RELATION with no number, because 19-15 asserted a relation and no census figure exists to transcribe"
  - "WR-03 is marked CLOSED in place with its evidence rather than deleted, and 19-CONTEXT.md is left byte-unchanged so the superseded deferral stays readable"
  - "No requirement checkbox was ticked and no requirement status changed — COV-01 and COV-02 are the phase verifier's judgment, as every plan in this round has recorded"

patterns-established:
  - "Consolidation-by-derivation: a round's summary record computes its headline count from its sources and invites the recount, instead of restating a number the plan supplied"
  - "Named-absence cells: a table that spans gates of different kinds marks the cells where a class of evidence cannot exist, so an empty cell cannot be read as an omission"
  - "Green-as-observation: a phase gate that reports zero failures records that the known intermittent items did not fire, explicitly refusing to treat the absence as a clearing event"

requirements-completed: [COV-01, COV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The round-4 consolidated section of 19-VALIDATION.md: one row per gate for all seven this round added, each naming the plan, the payload or condition it must decline with its measured values, the payload it must still accept with its measured values, the planted violation, the exact test observed red, the observed counts and exit code, and the green after restoration"
    requirement: COV-01
    verification:
      - kind: integration
        ref: "git diff --numstat -- 19-VALIDATION.md deferred-items.md | awk '{ if ($2 != 0) exit 1 }' (append-only, zero deletions)"
        status: pass
      - kind: integration
        ref: "grep -c '^| \\*\\*[1-7]\\.' 19-VALIDATION.md → 7"
        status: pass
    human_judgment: true
    rationale: >-
      Whether each transcribed figure is a faithful copy of the SUMMARY that recorded it, and whether
      the three named-absence cells are honest rather than convenient, is a judgment a reader has to
      make by comparing the consolidation against its five sources. No test can assert that a
      transcription is faithful.
  - id: D2
    description: "D-07's three numbered acceptance clauses each mapped to the consolidated row that discharges it: clause 1 to row 5 (plant 21's deleted negative controls) with its source-derivation in row 6, clause 2 to row 4 (plants 19 and 20 against both pre-fix branches), clause 3 to row 1 (the FP3 fixture's measured post-fix report)"
    requirement: COV-01
    verification: []
    human_judgment: true
    rationale: >-
      The mapping is an argument that a recorded demonstration satisfies a stated clause. Its
      correctness is exactly the judgment D-07 reserves for the verifier, and asserting it in a test
      would be the mechanism marking its own homework.
  - id: D3
    description: "WR-03 recorded CLOSED in deferred-items.md with the measurement it was promoted on (64/0/4, a sixteen-fold self-contradiction), the measured after state (4/60/4 with the $ea twin unchanged at 64/0/64), the note that it is the census's own classification rather than provenDispatchTargets(), the orchestrator authority that superseded 19-CONTEXT.md's deferral, the record that 19-CONTEXT.md was deliberately left byte-unchanged, the pointer to Decision 6, and the 93-opcode under-report residual"
    requirement: COV-01
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test docs-deferred-ledger.test.ts docs-r2000-decisions.test.ts docs-dangling-refs.test.ts audit-integrity.test.ts (within the 96/96 seven-guard run)"
        status: pass
    human_judgment: true
    rationale: >-
      The guards prove the ledger is well-formed and consistent with the phase's other documents.
      Whether closing WR-03 on a tightening that trades a self-contradiction for a two-sided
      under-report is the right disposition for this instrument is a domain judgment no test asserts.
  - id: D4
    description: "D-08 recorded as a contingency and NOT acted on: the rescoping verdict to take if this round's verification returns SC4 partial again, its one-way reversibility rating, the fact that it edits a ROADMAP success criterion and a REQUIREMENTS entry Phase 20's entry conditions read, and the requirement for explicit user confirmation before anyone acts on it"
    requirement: COV-01
    verification:
      - kind: integration
        ref: "git diff --name-only lists neither .planning/ROADMAP.md nor .planning/REQUIREMENTS.md nor 19-REVIEW.md; grep -c 'Gaps Found' .planning/REQUIREMENTS.md unchanged at 7"
        status: pass
    human_judgment: false
  - id: D5
    description: "The round-4 phase gate: the FULL workspace suite run ONCE (never test:automated) at 2638 tests / 2593 pass / 0 fail / 40 skipped / 5 todo, exit 0, duration_ms 116872.403001, plus eight further gate commands each exiting 0, all transcribed verbatim into a nine-row spot-check table"
    requirement: COV-02
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm test → # tests 2638 / # pass 2593 / # fail 0, exit 0"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && npx tsc --noEmit → exit 0"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test r2000-coverage.test.ts → 107 pass / 0 fail (baseline 71 at the round-3 verification)"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts → 22 pass / 0 fail"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test docs-review-disposition.test.ts audit-integrity.test.ts ci-suite-coverage.test.ts comment-phase-pointers.test.ts docs-dangling-refs.test.ts docs-r2000-decisions.test.ts docs-deferred-ledger.test.ts → 96 pass / 0 fail"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs && node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-description-overlap.mjs → all exit 0"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs && git status --porcelain src/mcp/vice/fixtures/coverage → empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "The round-4 full-suite running tally: eight runs counted from the five plan SUMMARYs, three red, every red one of the two known contention files, neither ever red standalone — recorded as an observation that explicitly does not clear either deferred item"
    requirement: COV-02
    verification: []
    human_judgment: true
    rationale: >-
      The tally is a count over five documents, and its value is that a green gate is NOT written up
      as a fix. Whether the refusal to close on a green run is being honoured in substance is a
      reading judgment, not an assertion.

# Metrics
duration: ~20 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 19: The Round-4 Consolidation and the Phase Gate Summary

**All seven gates this round added consolidated into one traceable table — the payload each must decline with its measured values, the payload it must still accept, the plant, the test observed red and its counts — with D-07's three clauses each mapped to the row that discharges it, WR-03 marked CLOSED with its evidence and its residual, D-08 recorded as a one-way contingency nobody acted on, and the full workspace suite run once, green.**

## Performance

- **Duration:** ~20 min (reconstructed; bounded below by the full-suite launch at 13:53:55Z and above by the Task 2 commit at 14:01:11Z)
- **Started:** ~2026-08-25T13:45:00Z
- **Completed:** ~2026-08-25T14:05:00Z
- **Tasks:** 2
- **Files modified:** 2 (both `.planning/` documents; zero source files)

## Accomplishments

- **Every gate this round added now has one row a reader can retrace to a command somebody ran.**
  Seven gates across five plans: the tightened push-idiom branch (19-15), the tightened
  zero-page-vector branch and the pairing-consultation pin (19-16), the corpus-wide proven-set
  equality (19-17), the (shape × route) coverage assertion with its reachability matrix and the four
  source-derived route pins (19-18), and the census decodability predicate closing WR-03 (19-20).
  Each row carries both directions — the payload the gate must decline with its measured report
  values, and the payload it must still accept with its measured values — plus the plant, the exact
  `not ok` line, the pass/fail counts, the exit code and the green after restoration.

- **The demonstration total is derived, not typed.** Counting the planted-violation rows the five
  SUMMARY files record — 19-15 one, 19-16 three, 19-17 two, 19-18 six, 19-20 three — the round
  performed **15 demonstrations**, numbered 15 through 28 with one lettered variant (25b). The
  section says so and invites a recount: a reader who counts again and gets a different number has
  found a defect in the consolidation, not in the sources.

- **Three cells say "no measurement of this kind exists" rather than being filled in.** The
  pairing-consultation pin, the four route pins and the declaration half of the (shape × route)
  assertion are source-text gates with no report figures. Gate 1's accepted payload
  `PUSH_IDIOM_LINKED` has its census recorded as a **relation** (`reachedAsInstruction >` its derived
  13-byte prologue), not a number, because that is what 19-15 asserted — so no census figure is
  transcribed for it.

- **The two failed predictions are carried forward as failures.** Plant 25's advisory-source edit did
  NOT red the composed corpus (an advisory record carries `targets: []`, so it leaks nothing), and
  the stronger 25b variant measured 972 falsely-proven of 2000. Plant 26 measured `64 / 0 / 64`, not
  the predicted `64 / 0 / 4`, because loosening the shared predicate loosens the sweep too — plant 27
  was run to reproduce the pre-fix `64 / 0 / 4` exactly. Both are in the consolidation as observed,
  because a record that reports only the predictions that held is the failure mode this plan exists
  to prevent.

- **D-07's three clauses are each mapped to a row.** Clause 1 to row 5 (plant 21 deleted *both*
  negative rows for `(stack-return-push-idiom, class-3-pass)`; `not ok 68` named which half was
  missing at 92/90/2), with its source-derivation requirement discharged by row 6. Clause 2 to row 4
  (plants 19 and 20, falsely-proven populations 3 and 6, `expectedNotProven` 0 in both). Clause 3 to
  row 1 (the `fp3-unlinked-push-idiom` fixture, `splitTables=[]`, `provenDispatchTargets()=[]`,
  `classAt($0840)="unreached"`, `reachedAsInstruction=15` against its declared `code_size: 15`).

- **WR-03 is recorded CLOSED with its evidence, its authority and its price.** Promoted on a measured
  sixteen-fold self-contradiction (`64 / 0 / 4` on a 94%-garbage image), closed by 19-20 at
  `4 / 60 / 4` with the `$ea` twin unchanged at `64 / 0 / 64`. Recorded as a **different route** from
  the dispatch gate — the census's own classification, not `provenDispatchTargets()`. The promoting
  authority was the orchestrator's decision, superseding `19-CONTEXT.md`'s `<deferred>` paragraph,
  and that document was **deliberately left byte-unchanged**. The residual is named with its size:
  105 of 256 opcode-table entries are flagged illegal, only 12 of them `jam`, so 93 stable
  undocumented instructions now stop a census — a program executing one is **under-reported by BOTH
  figures instead of contradicted by them**, which is the safe direction and is no longer silent.

- **D-08 is written down and not executed.** Its verdict (rescope SC4 to advisory-not-gate rather
  than run a round 5), its one-way rating, the fact that it edits a ROADMAP success criterion and a
  REQUIREMENTS entry Phase 20's entry conditions read, and the requirement for explicit user
  confirmation, are all in the ledger. No roadmap criterion, no requirements entry and no checkbox
  was touched.

- **The phase gate was run once, in full, and it is green.** `cd src/mcp/vice && npm test` — the FULL
  suite, never the `test:automated` subset — reported `# tests 2638`, `# suites 24`, `# pass 2593`,
  **`# fail 0`**, 40 skipped, 5 todo, `# duration_ms 116872.403001`, exit 0, with zero `not ok` lines
  in the transcript. Eight further gate commands each exit 0. Neither documented contention flake
  fired, and that is recorded as an observation, explicitly not as a clearing event.

## Task Commits

1. **Task 1: the consolidated round-4 validation record, WR-03's closure and D-08's contingency** — `89af69a` (docs)
2. **Task 2: the round-4 phase gate, one full workspace suite run recorded verbatim** — `e476452` (docs)

**Plan metadata:** see the `docs(19-19): complete` commit that carries this file.

## Files Created/Modified

- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — two
  appends totalling **98 insertions, 0 deletions**: the round-4 consolidation section (the seven-gate
  table, the D-07 clause mapping, and a "what this round did not close" list carrying 19-18's
  reachability-dodge residual, 19-17's inert oracle rule R3 and 19-20's under-report), and the
  round-4 phase-gate spot-check table with its test-count movement note (71 → 76 → 80 → 96 → 107 on
  the per-case suite; 2564 → 2638 on the workspace total).
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — three new
  items appended, **0 deletions**: item 4 (WR-03, CLOSED), item 5 (D-08, recorded and not acted on),
  item 6 (the round-4 full-suite running tally).

## Decisions Made

- **The total is derived and the derivation is shown.** The plan explicitly forbade typing a
  demonstration count, so the section states the per-plan row counts it added together and says what
  a disagreeing recount would mean. A consolidation that disagrees with its sources is worse than
  none; one that cannot be checked against them is the same thing with the check removed.
- **Named-absence over plausible numbers.** Three of the seven gates are source-text pins with no
  report values. Rather than leaving those cells blank — which reads as an omission — each states
  which class of evidence does not exist for that gate and why.
- **WR-03 closed in place, `19-CONTEXT.md` untouched.** Marking the item CLOSED with its evidence
  keeps the ledger append-only and keeps the superseded deferral readable. Editing the context
  document to agree with what happened would have erased the fact that a decision was taken against
  it.
- **The green gate is recorded as an observation.** Both contention items stay open with their
  clearing conditions unchanged. An intermittent failure that happens not to fire is not a fixed one,
  and this phase's ledger exists because that class of failure gets re-explained once per run.
- **No requirement checkbox was ticked.** `requirements.mark-complete` was deliberately NOT run.
  `requirements-completed` above is the verbatim copy of this plan's `requirements` field that the
  summary template mandates, and is a statement of scope, not of closure: COV-01 and COV-02 remain
  the phase verifier's judgment. Commit `0315d9c` already reverted one premature set, and every plan
  in this round has declined on the same prohibition.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule was invoked and no auto-fix was required.

Two of the plan's own statements were read against the sources rather than taken at face value, and
both held: the plan's `<done>` clause for Task 1 says "the round's **five** gates", while its
`<action>` and `<acceptance_criteria>` both say **seven** and enumerate them. Seven is what the
sources support and seven is what was written. The plan's Task 1 `<read_first>` names "the four
round-4 SUMMARY files"; there are five (19-15, 19-16, 19-17, 19-18, 19-20) and all five were read.
Neither is a deviation from the plan's instructions — both are internal inconsistencies in its prose
resolved in favour of the enumerated list, and neither changed what was produced.

## Issues Encountered

None. The full suite was green on its single run, so the documented `r2000-session.ts` call-timeout
flake never engaged and the plan's prepared handling — standalone re-run, `git log` non-causation
check, append to the running tally — was not needed for a red. The tally was appended anyway, as a
green observation that does not clear the item.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && npm test` (FULL suite, run ONCE) | `# tests 2638`, `# suites 24`, `# pass 2593`, **`# fail 0`**, 40 skipped, 5 todo, `# duration_ms 116872.403001`, **exit 0**, 117 s wall, zero `not ok` lines |
| `cd src/mcp/vice && npx tsc --noEmit` | **exit 0** |
| `cd src/mcp/vice && node --test r2000-coverage.test.ts` | **107 pass, 0 fail**, `# duration_ms 239.049193`, exit 0 — strictly greater than the 71 at the round-3 verification |
| `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` | **22 pass, 0 fail**, `# duration_ms 508.78394`, exit 0 |
| The seven documentation and audit guards | **96 pass, 0 fail**, exit 0 — re-run after the final `deferred-items.md` append, still 96/96 |
| `node scripts/check-npm-packages.mjs` | exit 0 — 58-module closure clean, 75 / 34 files, 7 skills |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 — 37 `vice_*` names, 17 `r2000_*` all curated, 8/8 CLI verbs |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 — 21 pairs, max 0.250, threshold 0.35, allowlist 0 |
| generator re-run + `git status --porcelain src/mcp/vice/fixtures/coverage` | `wrote 12 control fixtures`, porcelain **empty** |
| `git diff --numstat` on `19-VALIDATION.md` | 69 + 29 = **98 insertions, 0 deletions** |
| `git diff --numstat` on `deferred-items.md` | insertions only, **0 deletions** |
| Gate rows in the consolidation | **7**, one per gate |
| `grep -c 'Gaps Found' .planning/REQUIREMENTS.md` | **7** before and after — unchanged |

## Prohibitions Observed

- **No requirement checkbox ticked and no requirement status changed.** `.planning/REQUIREMENTS.md`
  is byte-unchanged and `git diff --name-only` never listed it.
- **No ROADMAP success criterion edited and no REQUIREMENTS entry rescoped.** D-08 is recorded as a
  contingency; it was not executed.
- **`19-REVIEW.md` is byte-unchanged** and finding-id continuity is preserved; it appears in no diff.
- **Both `.planning/` files were EXTENDED, never replaced** — zero deletions in either, checked
  mechanically by the plan's own `awk` assertion after every append.
- **No red gate was made green by editing a ledger.** The suite was green on its own; nothing was
  reworded to produce that.
- **`r2000-session.ts`'s 200 ms call timeout was not widened** and the file was not opened. Its
  clearing condition is unchanged.
- **WR-03 was not re-litigated** — 19-20 closed it and this plan records the outcome.
- **No source file under `src/` was touched.** `git diff --name-only` lists only the two `.planning/`
  documents (plus a pre-existing dirty evidence file from Phase 18 that predates this run and was
  left alone).
- **No scope-reduction language** (`v1`, `for now`, `simplified`, `placeholder`, `future phase`)
  appears in anything this plan wrote — verified by grep over the plan's own added lines.

## Known Stubs

None. This plan wrote no code, no component and no hardcoded value; every figure it recorded is a
transcription of an observed command output, and every cell that has no such figure says which class
of evidence does not exist for that gate rather than carrying an invented one.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The round is closed as a record.** A verifier reading `19-VALIDATION.md` can retrace every gate
  this round added to a demonstration with a test name, counts and an exit code, and can check the
  15-demonstration total by recounting the five SUMMARYs.
- **COV-01 and COV-02 are open and untouched**, which is the intended state: the phase verifier
  decides them, and no plan in this round ticked a box.
- **D-08 is armed but not fired.** If the round-4 verification returns SC4 partial again, the
  recorded next action is to rescope SC4 to advisory-not-gate — one-way, and requiring explicit user
  confirmation — not to plan a round 5.
- **Two items remain open in `deferred-items.md` with unchanged clearing conditions:** the
  `r2000-session.test.ts` 200 ms call-timeout flake and the `vice-proxy.test.ts` wall-clock budgets.
  Each needs a plan that owns its file. Eight full-suite runs across round 4 produced three reds, all
  in those two files, none ever reproducible standalone.
- **One residual is carried forward with a checkable trigger:** WR-03's closure brings the census to
  the linear sweep's standard, so a program executing a stable undocumented opcode is under-reported.
  Decision 6's reversal condition names the moment to revisit it, together with Phase 20's own review
  of the `flat-three` shape.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*

## Self-Check: PASSED

- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-19-SUMMARY.md` — FOUND
- Commits `89af69a`, `e476452`, `3ab56f6` — all FOUND in `git log --oneline --all`
- `19-REVIEW.md`'s last commit is still `80c544b` (2026-08-25, the second review pass) — this plan
  did not touch it and finding-id continuity is preserved
- Both tasks' `<acceptance_criteria>` re-run and passing; both `<verify>` blocks and the plan-level
  `<verification>` block re-run in full with no exceptions
