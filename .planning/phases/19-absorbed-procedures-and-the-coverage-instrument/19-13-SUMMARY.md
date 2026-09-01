---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 13
subsystem: testing
tags: [audit-01, disposition-ledger, deferred-items, validation-record, docs-guards, release-hold]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-14's wave-1 CR-02 disposition record, the guard's source 3, which took docs-review-disposition.test.ts from red to green"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-10's CR-04 fix, 19-11's WR-14/WR-15 fixes and 19-12's WR-13/IN-05 fixes — the commits and controls this ledger cites"
provides:
  - "`19-REVIEW-FIX.md` — the phase's durable disposition ledger, covering all 24 finding ids `19-REVIEW.md` declares, in the guard's source 5. Measured to cover all 24 ALONE, with every other disposition source excluded"
  - "Both stale `deferred-items.md` entries corrected in place: the failed prediction kept as the record of what was believed, plus a dated correction with the measured current condition and a clearing condition this run satisfies. Both CLEARED"
  - "Deferred item 3 (the anno-session flake) re-measured rather than restated: 2 red in 6 full-suite runs, 0 red in 4 standalone, with the 200 ms wall-clock budget cited at source"
  - "`19-VALIDATION.md` extended with ten executed-evidence rows for the second gap-closure run, a measured-this-run block, and a nine-row phase gate — 93 insertions, 0 deletions"
  - "The release hold named rather than left as an unowned default: 19-07's checkpoint option and the verbatim lifting condition, with the statement that this run does not satisfy it"
affects: [phase-19 re-verification, phase-20 decomposition sweep, milestone audit]

actuals:
  tokens: 10500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Durable disposition ledger: a review's findings are dispositioned in a file that exists because someone decided to write it, never in a report a later run will rewrite — measured by replaying the guard's predicate with each source excluded in turn"
    - "Mechanical set equality over a derived id set: the ids come from replaying the guard's own regex, not from a typed list, and equality against the ledger is checked in both directions with the non-dispositioned residue named rather than folded in"
    - "Correction-in-place for a failed prediction: the original text stays byte-unchanged as the record of what was believed, and a dated block states what actually happened, measured, plus a clearing condition the current run can satisfy"

key-files:
  created:
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW-FIX.md
  modified:
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md

key-decisions:
  - "CR-04 recorded FIXED, not accepted — it is the defect SC4 / COV-02 turns on, and an accepted disposition would be a scope reduction wearing a ledger entry's clothes"
  - "The plan-time premise was re-measured and found superseded: the five ids no longer ride solely on 19-VERIFICATION.md's prose, because the four SUMMARYs of this run now name them. Recorded as measured rather than repeating the plan's claim — the ledger's justification was restated as 'no single owner for the review's accounting', which is still true"
  - "The IN-06 phantom is named in the ledger but dispositioned by no table row, so mechanical set equality is asserted over the DISPOSITION ROWS (24 = 24, both directions) with IN-06 reported separately rather than silently folded into either set"
  - "REQUIREMENTS.md left unwritten: the workflow's own requirements.mark-complete step for [COV-02, COV-01] was deliberately not run. Third consecutive plan to decline it"
  - "Deferred item 3's clearing condition was NOT changed. The fence covers only .planning/ files, so widening the timeout is unavailable, and making a red gate green by rewriting a ledger is a prohibition. Evidence was strengthened; the condition stands"
  - "A green gate does not close an intermittent failure — item 3 stays open after this plan's own suite ran clean"

patterns-established:
  - "Source-exclusion probe: to prove a guard's green is durable, replay its predicate with each disposition source excluded in turn and record which sets still cover the full id set"
  - "Rate over anecdote: an intermittent test failure is recorded as reds-over-runs across both schedules with the source-level mechanism cited, not as a single observation with a guess"

requirements-completed: []

coverage:
  - id: D1
    description: "Every finding id 19-REVIEW.md declares has a durable disposition in 19-REVIEW-FIX.md, the guard's source 5 — and the ledger alone covers all 24 with every other source excluded"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts#every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)"
        status: pass
      - kind: other
        ref: "set-equality probe replaying parseFindingIds() — 24 declared, 24 dispositioned, [] both directions; output pasted below"
        status: pass
      - kind: other
        ref: "source-exclusion probe — 19-REVIEW-FIX.md ALONE covers all 24 ids; output pasted below"
        status: pass
    human_judgment: false
  - id: D2
    description: "19-REVIEW.md is byte-unchanged across this plan's whole commit range — not regenerated, not renumbered, not annotated"
    requirement: "COV-02"
    verification:
      - kind: other
        ref: "git diff --name-only f7f840a..HEAD -- .../19-REVIEW.md — empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "CR-04 is recorded FIXED with plan 19-10 and commit 7f0499a, and the word accepted does not describe it; CR-02 cites 19-14's wave-1 record without contradicting it"
    requirement: "COV-02"
    verification:
      - kind: other
        ref: "git cat-file -t over all 12 ledger-cited hashes — all return commit; fact-by-fact comparison against 19-14's record recorded below"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full workspace suite is green on npm test, never on the test:automated subset"
    requirement: "COV-01"
    verification:
      - kind: other
        ref: "cd src/mcp/vice && npm test — exit 0, # tests 2580 / # pass 2535 / # fail 0 / # duration_ms 102561.052051"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs-review-disposition.test.ts and audit-integrity.test.ts each pass STANDALONE, so the D-12-02 cascade is demonstrated resolved rather than assumed; all seven cascaded guards measured"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts#no milestone audit declares a gated status while any docs guard is red (D-12-02)"
        status: pass
      - kind: other
        ref: "seven separate standalone runs, all exit 0 — table below"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both deferred-items.md entries state the current condition with a clearing condition this run can satisfy, and the measured condition is a real measurement taken during this task"
    requirement: "COV-02"
    verification:
      - kind: other
        ref: "git show 5c68473:.../19-VERIFICATION.md | grep -c CR-02 = 1 vs 0 today; git merge-base --is-ancestor chronology; seven guard exit codes"
        status: pass
    human_judgment: false
  - id: D7
    description: "19-VALIDATION.md is extended, not replaced — insertions only, and every new row's command appears verbatim in one of this run's four SUMMARYs"
    requirement: "COV-01"
    verification:
      - kind: other
        ref: "git diff --numstat f7f840a..HEAD -- .../19-VALIDATION.md — 93 insertions, 0 deletions"
        status: pass
    human_judgment: false
  - id: D8
    description: "REQUIREMENTS.md is unmoved: COV-01 and COV-02 unchecked, both status rows Gaps Found, porcelain empty"
    requirement: "COV-01"
    verification:
      - kind: other
        ref: "git status --porcelain .planning/REQUIREMENTS.md — empty; lines 57, 59, 134, 135 read below"
        status: pass
    human_judgment: false
  - id: D9
    description: "Deferred item 3 (the anno-session load-sensitive stub test) remains genuinely open and is reported rather than absorbed — its fix is outside this plan's file fence"
    verification: []
    human_judgment: true
    rationale: "The item is unclosed by design. Whether the honest choice was to report it rather than widen a 200 ms timeout in a file outside the fence is a judgment about scope discipline, and no test can assert it. A human should confirm the reporting is adequate and route the fix to a plan that owns anno-session.ts."

# Metrics
duration: 23 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 13: The Durable Disposition Ledger and the Green Gate Summary

**All 24 `19-REVIEW.md` finding ids now carry a durable, quality-bearing disposition in `19-REVIEW-FIX.md` — measured to cover the full set ALONE, with every other disposition source excluded — while `19-REVIEW.md` itself is byte-unchanged; both stale deferred entries are corrected against measurement rather than prediction; and the full suite is observed green at `# tests 2580 / # pass 2535 / # fail 0` with both named guards passing standalone.**

## Performance

- **Duration:** 23 min (bounded by 19-12's last commit `f7f840a` at `2026-08-25T08:56:00Z`; `PLAN_START_TIME` was not captured, the same convention 19-11 recorded)
- **Started:** 2026-08-25T08:56:00Z (lower bound)
- **Completed:** 2026-08-25T09:18:56Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

`actuals.tokens` is `chars/4` over the realized diff (41,979 chars → 10,495), the diff-only scale
rather than whole-file, because two of the three files are pre-existing documents this plan only
appended to and their untouched bulk is not work this plan did. The whole-file figure is
71,081 chars → 17,770 — recorded here so neither number is hidden.

## Findings dispositioned

**`CR-02`** — `fixed-narrowed-then-superseded`. Narrowed by **plan 19-08**, commit **`1706d8b`**
(with `9c9166d` carrying its negative controls); the residual re-filed as `CR-04` at review time.
Its disposition was filed in wave 1 by **plan 19-14**, commit **`c201da4`**, at
`.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` — the guard's source 3,
and the change that took `docs-review-disposition.test.ts` from red to green. This plan **cites** that
record; it does not re-decide it.

The five ids this plan owns the durable half of:

| Id | Disposition | Fixed by | Commit |
|---|---|---|---|
| **CR-04** | **fixed** — *not* accepted | plan **19-10** | **`7f0499a`** |
| **WR-13** | fixed | plan **19-12** | **`8c7a75c`** |
| **WR-14** | fixed | plan **19-11** | **`c95bdaf`** |
| **WR-15** | fixed | plan **19-11** | **`084f17a`** |
| **IN-05** | fixed | plan **19-12** | **`c213093`** |

`CR-04` is recorded **FIXED**, and the word `accepted` does not describe it anywhere in the ledger.
It is the defect SC4 / COV-02 turns on — *a vacuous pass is detectable* — and an accepted disposition
would have been a scope reduction wearing a ledger entry's clothes.

## Accomplishments

- **The phase has a durable disposition ledger.** `19-REVIEW-FIX.md` dispositions all 24 declared
  ids from a fixed vocabulary (`fixed`, `fixed-narrowed-then-superseded`, `rejected-with-reason`,
  `deferred-with-owner`): **10 fixed, 1 rejected with its reason, 13 deferred with a named owner**.
  The thirteen are real, unclosed work and are stated as such.
- **Its green is durable, and that is measured rather than asserted.** Replaying the guard's own
  predicate with each source excluded in turn: the ledger **alone** covers all 24 ids. The guard
  would stay green if `19-VERIFICATION.md` were replaced tomorrow.
- **`19-REVIEW.md` is byte-unchanged.** No regeneration, no renumbering, no annotation, across the
  plan's whole commit range.
- **Both stale deferred entries state what is true right now**, with the failed prediction kept
  intact above the correction and the *reason* it failed measured — including the accident's own
  fingerprint: `CR-02`'s only disposition was an incidental mention in `19-VERIFICATION.md`, and the
  commit that regenerated the review erased it.
- **The seven-guard cascade census is zero red**, established by running each guard standalone
  rather than by repeating the claim.
- **The gate is green and recorded with its numbers**, on `npm test` — never the subset.
- **The release hold is named, not defaulted.**

## Task Commits

1. **Task 1: write the phase's durable disposition ledger** — `1494ade` (docs)
2. **Task 2: correct the stale deferred entries and extend the validation record** — `88d7de4` (docs)
3. **Task 3: record the second gap-closure phase gate, observed green** — `2a50e3f` (docs)

**Plan metadata:** see the `docs(19-13)` commit that carries this file.

Every commit subject carries `[skip release]` — verified mechanically over `f7f840a..HEAD`, three of
three.

## Files Created/Modified

- `.planning/phases/19-.../19-REVIEW-FIX.md` — **created.** Frontmatter naming the review, the
  derivation method and the derived count; the 24-row disposition table; a paragraph each for the six
  ids this run is accountable for; the `IN-06` phantom named as declaring nothing; and a closing
  section stating the two properties the ledger holds.
- `.planning/phases/19-.../deferred-items.md` — a dated correction block on entries 1 and 2 (both now
  **CLEARED**), and a dated re-measurement block plus a sixth-observation addendum on entry 3 (still
  **open**). 116 insertions, **0 deletions**.
- `.planning/phases/19-.../19-VALIDATION.md` — a new second-gap-closure evidence section (ten rows), a
  measured-in-this-run block, and a nine-row phase gate with the requirement-status and release-hold
  records. 93 insertions, **0 deletions**.

## The derived id count and the mechanical set equality

The id set was **derived, never typed**: `parseFindingIds()`'s own regex from
`docs-review-disposition.test.ts` (`^#{2,6} +(WR|IN|CR)-(\d+)(?![0-9])`), replayed over
`19-REVIEW.md`. **Derived count: 24** (4 Critical + 15 Warning + 5 Info).

Set equality, both directions, over the ledger's disposition rows:

```
$ node scratchpad/set-equality.mjs
declared in 19-REVIEW.md headings : 24
dispositioned by a ledger row     : 24
declared but NOT dispositioned    : []
dispositioned but NOT declared    : []
SET EQUALITY (both directions)    : YES
other id tokens in the ledger     : [IN-06]  (named, not dispositioned)
exit 0
```

`IN-06` is reported separately rather than folded into either set, because it is the honest residue:
`19-REVIEW.md:477` cross-references it inside `WR-10`'s prose but declares no such heading, so the
guard sees no `IN-06` finding. The ledger names it, states that it does not exist, and dispositions
nothing against it. Naming it and then hiding it from the comparison would have been the dishonest
option; deleting the paragraph to make a script print `YES` would have been worse.

## The ledger's independence from the accidental source

Replaying `isDispositioned()` over phase 19 under four source sets:

```
$ node scratchpad/independence.mjs
COVERS ALL 24  all five sources (what the guard sees)
COVERS ALL 24  with 19-VERIFICATION.md EXCLUDED
COVERS ALL 24  19-REVIEW-FIX.md ALONE (source 5 only)
COVERS ALL 24  everything EXCEPT 19-REVIEW-FIX.md
```

The third line is the property that matters: **the ledger alone carries the full set.** The guard's
green no longer depends on any other document continuing to mention any id.

**The plan's premise was re-measured and found superseded — reported rather than repeated.** The plan
was written on the measurement that five ids (`CR-04`, `WR-13`, `WR-14`, `WR-15`, `IN-05`) rode
*solely* on `19-VERIFICATION.md`'s prose. That was true at plan time. It is no longer: line 2 above
shows zero undispositioned ids with the verification excluded, because the four SUMMARYs of this run
now each name the ids their plan fixed (the guard's source 1). Restating the plan-time claim as
current would have been a false record.

The ledger is still the thing that was missing, for a reason the measurement does not weaken: a
per-plan SUMMARY records what *that plan* did and does not claim to be an accounting of the review.
Before this file, "what became of every finding this review raised" had no single owner and the
green was distributed across nine documents. That justification is written into the ledger itself in
place of the superseded one.

## Every ledger-cited hash resolves

`git cat-file -t` over all twelve, each returning `commit`:

| Hash | Type | Cited for |
|---|---|---|
| `0bca490` | commit | CR-01 fixed, plan 19-06 |
| `1706d8b` | commit | CR-02 narrowed, WR-01 and IN-04 fixed, plan 19-08 |
| `9c9166d` | commit | CR-02's negative controls, plan 19-08 |
| `48e02f4` | commit | CR-03 fixed, plan 19-07 |
| `f941eef` | commit | CR-03's guard, plan 19-07 |
| `cbdbf97` | commit | WR-02 fixed, plan 19-06 |
| `7f0499a` | commit | **CR-04 fixed, plan 19-10** |
| `c95bdaf` | commit | WR-14 fixed, plan 19-11 |
| `084f17a` | commit | WR-15 fixed, plan 19-11 |
| `8c7a75c` | commit | WR-13 fixed, plan 19-12 |
| `c213093` | commit | IN-05 fixed, plan 19-12 |
| `c201da4` | commit | CR-02's wave-1 disposition record, plan 19-14 |

The nine hashes cited in the correction blocks and the gate resolve too: `81d46d1`, `5c68473`,
`6b6a34c`, `80c544b`, `cdf60bc`, `f7f840a`, `1494ade`, `88d7de4`, `2a50e3f` — all `commit`.

## CR-02: the two records compared fact by fact

Checked before writing, so "they agree" is a comparison rather than a hope. 19-14's record and this
ledger were read side by side on every fact each states:

| Fact | 19-14's record | This ledger | Verdict |
|---|---|---|---|
| CR-02's outcome | RESOLVED (NARROWED) by 19-08 | `fixed-narrowed-then-superseded`, 19-08 | agree |
| The commit | `1706d8b`, plus `9c9166d` for the controls | same two | agree |
| Where the residual went | re-filed as `CR-04` at review time, not by reopening CR-02 | same | agree |
| CR-04's state | **OUTSTANDING as of 2026-08-25 (wave 1)**, with an explicit statement that nothing there claims it is fixed | **fixed** by 19-10 at `7f0499a` | **agree across time** — each names its own date; 19-14 was written before 19-10 ran and said so |
| `19-REVIEW.md` | byte-unchanged | byte-unchanged | agree |
| Who owns the rest | *"the remaining Phase 19 findings … are the subject of the phase's own `19-REVIEW-FIX.md` ledger and are deliberately left to it"* | this file is that ledger | agree — 19-14 delegated it explicitly |

**No fact on which the two disagree.** The only difference is the date each was written, and each
names its own. 19-14's own closing scope note *asked* for this file rather than pre-empting it, so
the two are one ledger in two parts, not two competing records.

## The seven-guard cascade, measured standalone

`audit-integrity.test.ts`'s D-12-02 message names seven red docs guards. Each was run individually
rather than the claim repeated:

| Guard | Exit | Observed |
|---|---|---|
| `docs-review-disposition.test.ts` | **0** | `# tests 7 # pass 7 # fail 0` |
| `docs-core-value-decision.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-dangling-refs.test.ts` | **0** | `# tests 8 # pass 8 # fail 0` |
| `docs-deferred-ledger.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-fork-decision.test.ts` | **0** | `# tests 6 # pass 6 # fail 0` |
| `docs-linerefs.test.ts` | **0** | `# tests 3 # pass 3 # fail 0` |
| `docs-absorbed-decisions.test.ts` | **0** | `# tests 5 # pass 5 # fail 0` |

**Zero of seven genuinely red.** The six-of-seven cascade claim is confirmed by measurement, and the
seventh is green for a real reason. `audit-integrity.test.ts` standalone: **exit 0**,
`# tests 44 # pass 44 # fail 0` — so D-12-02 is demonstrated resolved rather than inferred from the
aggregate run.

## The phase gate

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | vice suite (FULL) | `cd src/mcp/vice && npm test` | **exit 0** — `# tests 2580`, `# suites 24`, `# pass 2535`, **`# fail 0`**, `# skipped 40`, `# todo 5`, `# duration_ms 102561.052051` |
| 2 | AUDIT-01 guard standalone | `cd src/mcp/vice && node --test docs-review-disposition.test.ts` | **exit 0** |
| 3 | D-12-02 standalone | `cd src/mcp/vice && node --test audit-integrity.test.ts` | **exit 0** |
| 4 | Typecheck | `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | **exit 0** |
| 5 | Package contents | `node scripts/check-npm-packages.mjs` | **exit 0** |
| 6 | Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | **exit 0** |
| 7 | Description overlap | `node scripts/check-skill-description-overlap.mjs` | **exit 0** |
| 8 | Fixture determinism | `node fixtures/coverage/make-coverage-fixtures.mjs` ×2 | `wrote 10 control fixtures` **both** runs; `git status --porcelain fixtures/coverage` **empty**; **10** directories against the pinned **`COMMITTED_CONTROL_FIXTURES = 10`** |
| 9 | `19-VALIDATION.md` numstat | `git diff --numstat f7f840a..HEAD -- .../19-VALIDATION.md` | **`93	0`** — insertions only |

**Why `npm test` and not the subset.** `test` is `node --test '*.test.*'`; `test:automated` is
`node test-gate.mjs`, which runs every `*.test.*` on disk **minus** the nine frozen
`MANUAL_ONLY_TESTS` entries (`vice-broker-launch`, `vice-proxy`, `broker-e2e`, `stock-live`,
`stock-live-triage`, `stock-live-broker-monitor`, `stock-broker-live`, `fork-live`,
`stock-a4-checkpoint-flood`). A CI failure in any of those nine would be invisible to the subset.
The subset was not used as evidence anywhere in this plan.

## The `anno-session.test.ts` flake — re-measured, not absorbed

The orchestrator's wave-3 gate reported `# fail 1` on `not ok 858 - stub: a child that answers
nothing within the call timeout rejects with AnnoTimeoutError, is killed, and the crash counter
increases by 1`. Re-measured here rather than accepted:

- **Standalone, three consecutive runs at `1494ade`:** exit 0, `# tests 25 / # pass 25 / # fail 0`,
  every time. With 19-11's run, **0 red in 4 standalone runs.**
- **Full suite, this plan's own gate:** **green** — `# tests 2580 / # pass 2535 / # fail 0`. Across
  2026-08-25 the full-suite rate is now **2 red in 6**.
- **The mechanism is now source-level, not inferred.** The test drives a real spawned child against a
  **200 ms** wall-clock budget (`anno-session.test.ts:622`, test declared at `:616`) while
  `node --test` runs test *files* concurrently across 12 cores. That explains the exact split
  observed: red only ever under the full suite, never standalone.
- **Nothing in this run touched it, confirmed:**
  `git log a756b17..HEAD -- src/mcp/vice/anno-session.ts src/mcp/vice/anno-session.test.ts` is
  empty, and neither file imports from `anno-coverage.*`.

**The tension in this plan's own instructions, resolved by reporting rather than by force.** This
plan's `files_modified` fence covers only `.planning/` files, so widening that timeout was never
available to it — and its own prohibitions forbid making a red gate green by rewriting a ledger.
Deferred item 3's clearing condition is therefore **unchanged**: a plan that owns
`anno-session.ts` either widens the timeout or replaces the wall-clock wait with an injected clock.
The evidence was strengthened; the condition was not moved to fit the run. **A green gate does not
close an intermittent failure**, and the item is left open after this plan's own suite ran clean.

## `REQUIREMENTS.md` — read, not written

| Observation | Line | State |
|---|---|---|
| COV-01 checkbox | `.planning/REQUIREMENTS.md:57` | `- [ ] **COV-01**: …` — **still unchecked** |
| COV-02 checkbox | `.planning/REQUIREMENTS.md:59` | `- [ ] **COV-02**: …` — **still unchecked** |
| COV-01 status row | `.planning/REQUIREMENTS.md:134` | `| COV-01 | Phase 19 | Gaps Found |` |
| COV-02 status row | `.planning/REQUIREMENTS.md:135` | `| COV-02 | Phase 19 | Gaps Found |` |
| Working tree | — | `git status --porcelain .planning/REQUIREMENTS.md` **empty** |

`git status --porcelain .planning/todos/` and `git status --porcelain src/` are both empty too — this
plan filed no pending todo, so `STATE.md`'s Deferred Items table needs no row, and
`docs-deferred-ledger.test.ts` exits **0**.

## The release hold

**Option selected at 19-07's `checkpoint:decision`, verbatim:**

```
approve-wording-release-on-reverification
```

**The named condition that lifts `[skip release]`, verbatim from `19-07-SUMMARY.md`:**

```
Phase 19 re-verification returns no gaps.
```

**This run does not satisfy it.** No re-verification has been performed by this plan, and a green
suite is not a re-verification — the condition names an artifact (a re-verification returning no
gaps), not a test result. The hold therefore stands, every commit in this plan carries
`[skip release]`, and nothing may be published on the strength of this report. Written down rather
than left implicit, because an unnamed hold becomes the permanent state by default.

## Decisions Made

- **`CR-04` recorded FIXED, never accepted.** It is the defect SC4 / COV-02 turns on.
- **The plan-time premise was re-measured and reported as superseded** rather than restated. The
  ledger's stated justification was rewritten to the one that survives measurement: no single owner
  for the review's accounting.
- **Set equality asserted over the ledger's disposition rows**, with the `IN-06` phantom reported
  separately. The alternative — deleting a true paragraph so a script prints `YES` — would have been
  exactly the "phrasing that satisfies a parser" this plan prohibits.
- **`REQUIREMENTS.md` left unwritten**, declining the workflow's own automatic
  `requirements.mark-complete [COV-02, COV-01]` step. Third consecutive plan to decline it.
- **Deferred item 3's clearing condition left unchanged.**

## Deviations from Plan

### 1. [Rule 2 — transparency] The plan's central premise no longer held, and the ledger's justification was rewritten rather than the claim repeated

- **Found during:** Task 1, before writing anything — the source-exclusion probe was run first.
- **Issue:** The plan states that five ids (`CR-04`, `WR-13`, `WR-14`, `WR-15`, `IN-05`) are
  dispositioned only by `19-VERIFICATION.md`'s incidental prose. Measured at `f7f840a`, that is
  false: excluding the verification leaves **zero** undispositioned ids, because 19-10/19-11/19-12's
  SUMMARYs now name them. Writing the plan's sentence into the ledger would have been a false record
  in the document whose whole purpose is being a true one.
- **Fix:** The measurement is recorded in the ledger in place of the claim, with the accident
  described as *superseded* rather than *tolerated*, and the ledger's justification restated to the
  one that survives: a per-plan SUMMARY is not an accounting of the review, and nothing before this
  file answered "what became of every finding" in one place. The must_have is still met, and more
  strongly than the plan asked — the ledger alone covers all 24.
- **Files modified:** `19-REVIEW-FIX.md`
- **Verification:** `node scratchpad/independence.mjs`, output pasted above.
- **Committed in:** `1494ade`

### 2. [Rule 2 — transparency] Set equality asserted over disposition rows, with the residue named

- **Found during:** Task 1's acceptance-criteria verification.
- **Issue:** The criterion asks for identical id sets in both directions. A naive comparison of
  *every* id token reported `IN-06` as an extra, because the ledger names it — carried from 19-08 —
  to state that it does not exist. Two bad options: delete a true paragraph, or claim equality that
  the naive script disproved.
- **Fix:** The comparison keys on the ledger's **disposition table rows** — what actually
  dispositions an id — giving 24 = 24 with `[]` both directions, and prints the non-dispositioning
  residue on its own line. Both outputs are in this SUMMARY.
- **Files modified:** none (measurement method)
- **Verification:** `node scratchpad/set-equality.mjs`, exit 0, output pasted above.
- **Committed in:** `1494ade`

### 3. [Rule 2 — values] The workflow's automatic `requirements.mark-complete` step was not run

- **Found during:** the state-update phase.
- **Issue:** `execute-plan.md`'s `update_requirements` step marks the plan frontmatter's
  `requirements:` complete — here `[COV-02, COV-01]`. This plan's `<execution_notes>` make
  `REQUIREMENTS.md` read-only and threat `T-19G-13-03` names "a requirement marked complete by the
  run that fixed it" as a `high` spoofing risk.
- **Fix:** The step was deliberately skipped. The plan's explicit instruction takes precedence over
  the workflow's default, and `requirements-completed` in this SUMMARY's frontmatter is `[]`.
- **Files modified:** none — that is the point.
- **Verification:** `git status --porcelain .planning/REQUIREMENTS.md` empty; lines 57, 59, 134, 135
  read and recorded above.
- **Committed in:** n/a (an omission, recorded here)

### 4. [Rule 2 — transparency] Deferred item 3 corrected, and a sixth observation added after Task 3's gate

- **Found during:** Task 2, then again at Task 3.
- **Issue:** Item 3 was written by 19-11 on a single observation. Task 2 re-measured it (2 red in 5).
  Task 3's own green gate then made that count stale within the same plan.
- **Fix:** A dated re-measurement block in Task 2 and a one-paragraph addendum in Task 3 bringing it
  to **2 red in 6**, with the explicit statement that a green gate does not close an intermittent
  failure. `deferred-items.md` is in the plan's `files_modified`, so this is inside the fence.
- **Files modified:** `deferred-items.md`
- **Verification:** `git diff --numstat` — 116 insertions, **0 deletions**.
- **Committed in:** `88d7de4`, `2a50e3f`

---

**Total deviations:** 4 auto-fixed (3 transparency, 1 values).
**Impact on plan:** No scope creep and no scope reduction. Three of the four exist because a fact on
the ground contradicted a sentence in the plan, and in each case the fact was recorded and the plan's
must_have met by a stronger route. The fourth is an omission the plan itself mandated.

## Issues Encountered

**The plan's premise had gone stale between planning and execution.** Handled as deviation 1: the
measurement replaced the claim rather than the claim being copied forward. This is the second time in
this phase a document's prediction outlived its truth — the first being `deferred-items.md`'s own
clearing condition, which is what this plan was sent to correct. Worth noting as a pattern rather
than a coincidence: a condition phrased as *"when plan N lands"* cannot survive new findings arriving
after plan N, and a claim about which document dispositions an id cannot survive another document
being written. Both classes are fixed the same way — phrase the condition over a property that can be
re-measured, and re-measure it.

**The `anno-session.test.ts` flake could not be fixed here and was not made to look fixed.** See
its section above. It remains open with its owner named.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Gap 2 is closed.** The workspace suite is green on the full run, both named guards pass
  standalone, and every `19-REVIEW.md` finding id has a durable disposition in a source the guard
  reads. All five plans of the second gap-closure run have landed.
- **What re-verification must decide, not inherit:**
  - `COV-01` and `COV-02` are still `Gaps Found` and both boxes unchecked. Three consecutive plans
    declined to tick them. Re-verification is the first thing entitled to.
  - `ABS-02`'s `Complete` status, flagged by 19-09 as marked by the run that fixed it, is recorded in
    `19-VALIDATION.md`'s known-gaps table as unearned and awaiting re-decision.
  - The **13 deferred findings** in `19-REVIEW-FIX.md` carry named owners — mostly Phase 20 and the
    CLI cluster, plus `WR-11` at the next milestone close. They are open work, not closed items.
  - **`WR-06`** (the coverage CLI surface is untested) is the honest limit on `19-VALIDATION.md`'s one
    green-run-only COV-01 row, and both documents now say so.
- **Deferred item 3** is the one live blocker on a reliably-green CI gate and needs a plan that owns
  `anno-session.ts`.
- **The release hold stands** with its verbatim condition recorded. `[skip release]` remains on every
  commit until a Phase 19 re-verification returns no gaps.

## Self-Check: PASSED

- `.planning/phases/19-.../19-REVIEW-FIX.md` — **FOUND** on disk.
- `.planning/phases/19-.../deferred-items.md` — **FOUND**, 116 insertions / 0 deletions.
- `.planning/phases/19-.../19-VALIDATION.md` — **FOUND**, 93 insertions / 0 deletions.
- Commits `1494ade`, `88d7de4`, `2a50e3f` — all **FOUND** in `git log`, all carrying `[skip release]`.
- All 12 ledger-cited hashes and all 9 correction-block hashes — `git cat-file -t` returns `commit`
  for each.
- Plan-level verification items 1–11 all re-run and passing: full suite `# fail 0` exit 0; both named
  guards exit 0 standalone; `docs-deferred-ledger` exit 0; `tsc --noEmit` exit 0; all three check
  scripts exit 0; `19-REVIEW.md` diff empty across `f7f840a..HEAD`; `19-VALIDATION.md` deletions 0;
  `REQUIREMENTS.md` and `.planning/todos/` porcelain both empty; set equality demonstrated
  mechanically both directions; every commit subject carries `[skip release]`.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
