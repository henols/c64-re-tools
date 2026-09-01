---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 06
subsystem: testing
tags: [the external analyser, coverage, anti-gaming, regexp, anchoring, node-test, typescript]

requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "the coverage instrument (anno-coverage.ts), its six committed controls, and the NC4 multi-caller negative control this plan makes adversarial"
provides:
  - "An ANCHORED multi-caller cross-reference rule: a caller's hex must be a delimited token (bare or canonical-4 width, non-hex-digit right boundary), and a caller's label name must stand on an identifier boundary both sides"
  - "escapeRegExp() — store-sourced label names reach a RegExp constructor as literals, never as patterns (T-19G-06-02)"
  - "Two ANCHORING controls, both OBSERVED FAILING pre-fix, one of them report-level on the real committed NC4 fixture"
  - "Dedup-derived counts: every number in the report equals the length of the deduped list printed beside it (WR-02)"
affects: [19-07, 19-08, 19-09, phase-20-decomposition-to-closure]

actuals:
  tokens: 26421
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Anchored-token matching for any rule an operator could game by writing prose"
    - "escapeRegExp() before interpolating store data into a RegExp"
    - "A count reported beside a list is derived from that same deduped list, never from the pre-dedup array"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts

key-decisions:
  - "The pre-fix failure was demonstrated by authoring both controls BEFORE the fix and running them, not by `git stash` as the plan's acceptance criterion suggested — `git stash` is prohibited in this execution environment because the stash stack is shared across worktrees. The evidence produced is strictly stronger: the controls were observed red in the committed test file, then green after the fix, with the exact reported values captured both times."
  - "Task 1's well-documented-control assertion was authored INSIDE the report-level test rather than as its own test, so Task 1 adds exactly 2 tests (42 -> 44) and Task 2 adds exactly 2 more (44 -> 46)."
  - "The module header's `WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR` bullet for computeReproducibility was extended to name the anchored rule, so the header's description of the rule cannot drift from the code."
  - "The two full-suite failures are pre-existing, out of scope, and provably untouched by this plan; they are recorded in deferred-items.md and .planning/WINDOWS.md rather than fixed here."

patterns-established:
  - "Both-directions-in-one-commit: a tightening control and its non-vacuity counterpart are asserted in the same test, so an over-tightened rule cannot pass review"
  - "Adversarial inputs are constructed FROM the real committed fixture (via reportFor's overrides seam), never hand-typed, so a control cannot drift away from the fixture it claims to be about"

requirements-completed: [COV-02]

coverage:
  - id: D1
    description: "A colliding longer hex no longer satisfies the multi-caller rule: NC4 as committed, plus a mention of the unrelated ordinary address $8106 appended to its $0820 comment, reports multiCallerUndocumented as {count: 1, addresses: [2080]} and a non-clean verdict naming reproducibility"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "A caller's label name satisfies the rule only on an identifier boundary — my_entry_pointer does not name entry_point, while entry_point standing alone does"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#ANCHORING: a caller's label name satisfies the rule only on an identifier boundary"
        status: pass
    human_judgment: false
  - id: D3
    description: "The genuinely well-documented control nc5-well-documented stays clean with an empty findings array under the anchored rule, so the anchoring is not a machine that now fails everything"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every count reported beside a deduped address list is derived from that same deduped list (WR-02) — two symbols at one address now produce 1, not 2"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every reported count is a count of the deduped list printed beside it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#two symbols at one address produce a count of one, not two"
        status: pass
    human_judgment: false
  - id: D5
    description: "Store-sourced label names are escaped before reaching a RegExp constructor (T-19G-06-02), so a name carrying regex metacharacters becomes a literal rather than a pattern"
    requirement: COV-02
    verification:
      - kind: other
        ref: "cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json (exit 0); escapeRegExp() applied at both RegExp construction sites in namesACaller()"
        status: pass
    human_judgment: true
    rationale: "No committed fixture carries a label name with regex metacharacters, so the escape is verified by construction and by inspection rather than by an assertion. A dedicated adversarial-name control was not in this plan's scope and is a candidate for 19-09."

duration: 22 min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 06: Anchor the Multi-Caller Rule Summary

**The one measure whose whole subject is refusing to be talked into a clean verdict can no longer be talked into one: a hex string that merely touches a caller's short form, or a label name embedded in a longer identifier, buys nothing — proven by two controls that were observed red before the fix and green after.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-24T21:06Z
- **Completed:** 2026-08-24T21:28Z
- **Tasks:** 2 of 2
- **Files modified:** 2 source files (+1 deferred-items ledger, +1 WINDOWS entry)

## Accomplishments

- **`namesACaller()` is anchored.** A caller's hexadecimal reference must now be `$` plus the
  address at either its bare width or the canonical four-digit width — deduped through a `Set`
  so a caller at or above `$1000` is not tested twice — followed by a character that is **not**
  a hexadecimal digit, with end-of-string counting as a boundary. `$8106` is no longer `$0810`.
- **The label-name branch is anchored on both sides.** A caller's `User` label name must stand
  on an identifier boundary (neither adjacent character an ASCII letter, digit or underscore),
  so `my_entry_pointer` no longer names `entry_point`.
- **The gaming attempt was reproduced end to end and then closed.** The report-level control
  runs the real committed NC4 fixture through `buildCoverageReport` → `coverageFindings`, with
  the adversarial mutation constructed *from* the fixture's own comment array via `reportFor`'s
  `comments` override — not hand-typed — so the control cannot drift away from the fixture it
  claims to be about.
- **Both directions asserted in the same commit.** `nc5-well-documented` is asserted still
  clean with an empty findings array inside the same test, so the anchoring cannot be tightened
  into a machine that fails everything without a red test.
- **`escapeRegExp()` added** (module-private) so store-sourced label names reach a `RegExp`
  constructor as literals (T-19G-06-02).
- **WR-02 discharged.** Every count in the report is now derived from the deduped list printed
  beside it, at all three sites (`computeLabelRatio`, and both `computeReproducibility` return
  paths). `coverageFindings()`'s one-sentence "N label name(s) … at $1000" message can no longer
  contradict itself.
- **The module header now names the anchored rule** in its "WHAT THIS IS THE ONE AUTHORITATIVE
  PLACE FOR" list, so the header's description of the rule cannot silently drift from the code —
  which is the class of defect this gap-closure run exists to close.

## Task Commits

1. **Task 1 (TRACER): anchor the multi-caller rule and prove a gaming attempt now fails end to end** — `0bca490` (fix)
2. **Task 2: derive every reported count from its own deduped list (WR-02)** — `cbdbf97` (fix)

**Plan metadata:** see the `docs(19-06)` commit that carries this SUMMARY.

Both commits carry `[skip release]` in the subject, per `<release_discipline>`. The publish
hold is **not** lifted by this plan.

## Files Created/Modified

- `src/mcp/vice/anno-coverage.ts` — anchored `namesACaller()`, new module-private
  `escapeRegExp()`, dedup-derived counts at three sites, rewritten doc comment and one extended
  header bullet. 1446 → **1495** lines (plan floor: 1470).
- `src/mcp/vice/anno-coverage.test.ts` — four new tests. 755 → **897** lines (plan floor: 780).
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` —
  new; records the two out-of-scope full-suite failures and their owner.
- `.planning/WINDOWS.md` — one `unmet-truth` entry for the same condition.

## Pre-fix and post-fix values (the evidence, with the exact commands)

### Control A — colliding hex, report-level, on the real committed NC4 fixture

Command (both runs): `cd src/mcp/vice && node --test anno-coverage.test.ts`

| | `reproducibility.multiCallerUndocumented` | `coverageFindings().clean` | `findings` |
|---|---|---|---|
| **Pre-fix** | `{count: 0, addresses: []}` | `true` | `[]` |
| **Post-fix** | `{count: 1, addresses: [2080]}` | `false` | one finding, `measure: "reproducibility"` |

Pre-fix this is a **fully clean verdict with zero findings** on a comment that names neither
caller — exactly the falsely-clean verdict (T-19-14) the instrument exists to refuse.

### Control B — identifier boundary

Command (both runs): `cd src/mcp/vice && node --test anno-coverage.test.ts`

| Comment at `$0820` (callers `$0810` = `entry_point`, `$0816`) | Pre-fix `multiCallerUndocumented` | Post-fix |
|---|---|---|
| `… my_entry_pointer holds the vector` | `{count: 0, addresses: []}` (wrongly rescued) | `{count: 1, addresses: [2080]}` |
| `… reached from entry_point on the cold path` | `{count: 0, addresses: []}` (correct) | `{count: 0, addresses: []}` (unchanged) |

### Control C — WR-02, duplicate address

Command (both runs): `cd src/mcp/vice && node --test anno-coverage.test.ts`

| Input | Field | Pre-fix | Post-fix |
|---|---|---|---|
| two `Auto` symbols `s_1000` / `j_1000` at `$1000` → `computeLabelRatio()` | `autoPrefixNamesRemaining` | `2` | `1` |
| same | `autoPrefixNameAddresses.length` | `1` | `1` |
| two `User` symbols at `$1000`, two callers, no comment → `computeReproducibility()` | `multiCallerUndocumented` | `{count: 2, addresses: [4096]}` | `{count: 1, addresses: [4096]}` |

### How the pre-fix state was observed

Both ANCHORING controls were **authored and committed to the working tree before** the
`anno-coverage.ts` change, run, and observed red:

```
not ok 18 - ANCHORING: a colliding longer hex never satisfies the multi-caller rule …
    $8106 is not $0810 -- a hex token must end on a non-hex-digit boundary …
    +   addresses: [],  +   count: 0        (actual)
    -   addresses: [ …  -   count: 1        (expected)
not ok 19 - ANCHORING: a caller's label name satisfies the rule only on an identifier boundary
# tests 44 / # pass 42 / # fail 2
```

## Verification results

| # | Command | Result |
|---|---------|--------|
| 1 | `cd src/mcp/vice && node --test anno-coverage.test.ts` | exit **0**, `# tests 46`, `# pass 46`, `# fail 0` |
| 2 | `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | exit **0** |
| 3 | `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | exit **1** — `# tests 2551`, `# pass 2504`, **`# fail 2`**, `# skipped 40`, `# todo 5`. Both failures pre-existing and out of scope — see *Issues Encountered*. |
| 4 | `node scripts/check-skill-tool-coverage.mjs` | exit **0** |
| 4 | `node scripts/check-skill-description-overlap.mjs` | exit **0** |

### Test-count accounting (no absolute floor asserted, command never widened)

- Measured on this one file before the plan: **42**.
- After Task 1: **44** — exactly **+2**. Shape chosen: the well-documented-control assertion
  lives **inside** the report-level test, not as its own test.
- After Task 2: **46** — exactly **+2** more, as Task 2's acceptance criterion requires.

### Acceptance greps

| Command | Before | After | Required |
|---|---|---|---|
| ``grep -cF 'lower.includes(`$' src/mcp/vice/anno-coverage.ts`` | `2` | **`0`** | `0` |
| `grep -c 'rawComment.includes(name)' src/mcp/vice/anno-coverage.ts` | `1` | **`0`** | `0` |
| `grep -c 'autoPrefixNameAddresses.length' src/mcp/vice/anno-coverage.ts` | `1` | **`0`** | `0` |

The fixture-driven control loop still reports `nc4-multi-caller-unnamed` as non-clean naming
`reproducibility` and `nc5-well-documented` as clean with an empty findings array (the existing
`NON-VACUITY` test) — both green in run 1.

## Review-finding dispositions recorded by this plan

- **CR-01** (`19-REVIEW.md`) — **FIXED.** This plan is the fix. Its suggested shape (anchor the
  hex on a token boundary at a canonical width, anchor the name on a word boundary) was adopted
  as written and is held down by the two ANCHORING controls, both observed failing pre-fix.
  Commit `0bca490`.
- **WR-02** (`19-REVIEW.md`) — **FIXED.** `autoPrefixNamesRemaining` and
  `multiCallerUndocumented.count` were pre-dedup lengths reported beside deduped address lists;
  both are now derived from the deduped list, at all three return sites. Reproduced pre-fix
  (`2` beside a one-element list on both measures) and asserted post-fix. Commit `cbdbf97`.

The other 15 findings in `19-REVIEW.md` (`IN-01`…`IN-04`, `WR-01`, `WR-03`…`WR-12`) are owned by
plans 19-07, 19-08 and 19-09 per this plan's own `<gap_closure_context>`. None is silently
dropped; see *Issues Encountered*.

## Decisions Made

1. **`git stash` was not used to demonstrate the pre-fix failure.** Task 1's acceptance
   criterion suggested stashing the `anno-coverage.ts` change and re-running. `git stash` is
   prohibited in this execution environment — the stash stack is shared across the main checkout
   and every linked worktree, so a `pop` can silently apply a sibling's WIP. The controls were
   instead authored first and observed red in place, which yields the same numbers and a
   stronger artefact (the red output is reproducible from the commit history, not from a
   transient stash).
2. **Task 1's third assertion lives inside the report-level test.** Chosen over a separate test
   so that the tightening claim and its non-vacuity counterpart are *literally* in the same
   assertion block — an over-tightened rule breaks the same test that the tightening is proven
   by. Consequence: Task 1 adds exactly 2 tests, as recorded above.
3. **The module header was extended.** The plan's `<read_first>` flagged that the header names
   the rule being fixed. It did not — it described `computeReproducibility` without mentioning
   the anti-gaming rule at all. One bullet now names the anchored `namesACaller()` and states
   the boundary condition, so a future reader cannot conclude from the header that the match is
   a substring test.
4. **The two full-suite failures were not fixed.** Fixing them would mean 19-06 recording
   dispositions for 15 findings that plans 19-07/19-08/19-09 own — precisely the "claim work you
   did not do" defect this gap-closure run exists to close.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 — Blocker] `git stash` demonstration replaced with author-first demonstration**
- **Found during:** Task 1
- **Issue:** Task 1's acceptance criterion prescribes `git stash` to observe the pre-fix
  failure. The executor's own `<destructive_git_prohibition>` and the dispatch instructions
  forbid every `git stash` subcommand in this environment (shared stash stack across worktrees).
  Following the criterion literally was not possible; ignoring the demonstration entirely would
  have discarded the criterion's actual substance ("a control that has never been seen to fail
  is not evidence", T-19G-06-03).
- **Fix:** Both controls were written and run **before** the source fix, observed red with the
  exact reported values, and only then was `anno-coverage.ts` changed. The pre-fix numbers were
  additionally captured through a direct probe against the unmodified module so the values could
  be recorded field-by-field rather than only as assertion diff output.
- **Files modified:** none beyond the plan's own two files.
- **Verification:** the red run is transcribed verbatim above (`not ok 18` / `not ok 19`,
  `# fail 2`); the post-fix run is `# fail 0`.
- **Committed in:** `0bca490` (the tests and the fix land in one commit, as the plan specifies).

**2. [Rule 2 — Missing critical] Module header extended to name the anchored rule**
- **Found during:** Task 1
- **Issue:** The plan's `<read_first>` asserts "The header names the rule you are fixing". It
  did not. Leaving it silent would let a reader conclude from the authoritative-places list that
  the multi-caller rule is an ordinary textual match.
- **Fix:** the `computeReproducibility` bullet now also names `namesACaller` and states the
  delimited-token condition.
- **Verification:** run 1 and run 2 both green after the edit.
- **Committed in:** `0bca490`.

---

**Total deviations:** 2 (1 × Rule 3 blocker, 1 × Rule 2 missing-critical).
**Impact on plan:** none on scope. Deviation 1 preserves the criterion's substance while
respecting a hard environmental prohibition; deviation 2 is a two-line comment change inside a
file the plan already owns. No threshold changed, no fixture `store.json` edited, no dependency
added, no report key or `COVERAGE_SCHEMA_VERSION` touched.

## Issues Encountered

**The full suite (`cd src/mcp/vice && npm test`) exits 1 with 2 failures. Both pre-date this
plan and are out of scope.**

1. `not ok 443 — every REVIEW.md finding id anywhere in .planning/phases/ has a recorded
   disposition (AUDIT-01, self-applied)` — 17 findings in `19-REVIEW.md` are undispositioned.
   This plan discharges **2 of them** (`CR-01`, `WR-02`, named above; a phase SUMMARY is
   disposition source 1 of the guard's five). The remaining 15 are assigned to 19-07/19-08/19-09
   by 19-06's own plan text. The guard is red **correctly** while the gap-closure run is in
   flight and clears when 19-09 lands.
2. `not ok 11 — no milestone audit declares a gated status while any docs guard is red
   (D-12-02)` — cascades from (1). It names seven red docs guards, but **only one is genuinely
   red**: `docs-review-disposition`. The other six (`docs-core-value-decision`,
   `docs-dangling-refs`, `docs-deferred-ledger`, `docs-fork-decision`, `docs-linerefs`,
   `docs-anno-decisions`) each exit 0 when run standalone — the known cascade in
   `audit-integrity`'s guard runner.

**Proof they are untouched by this plan:** `git diff --name-only 5c68473..HEAD` after both task
commits lists exactly `src/mcp/vice/anno-coverage.ts` and `src/mcp/vice/anno-coverage.test.ts`.
Neither guard reads either file.

Recorded in
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` and as an
`unmet-truth` entry in `.planning/WINDOWS.md`, so neither can scroll out of view before ship.

## Known Stubs

None. `namesACaller()` is a complete implementation with no placeholder branch, no TODO, and no
follow-up required to make it real. The one item verified by construction rather than by
assertion — `escapeRegExp()` against a metacharacter-bearing label name — is recorded as
`human_judgment: true` in the `coverage` block above with its rationale, not as a stub.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change at a trust
boundary. `T-19G-06-02` (a `RegExp` built from store data) was **anticipated by the plan's own
threat model** and mitigated as specified via `escapeRegExp()`; the patterns built are linear (a
literal plus two zero-width lookarounds) with no nested quantifier, so there is no
catastrophic-backtracking shape.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for 19-07** (GAP 1). No dependency in either direction: 19-06 touches only
  `anno-coverage.ts` / `anno-coverage.test.ts`, and 19-07 owns the licence-wording decision.
- **Gap 2 (SC4 / COV-02) is half closed.** This plan discharged `missing` items **1** and **4**
  and the `coincidental_reliance_items[0]` hardening in full — `nc4-multi-caller-unnamed` is no
  longer `fixture-only`; it now has an adversarial control that was seen to fail. Items **2**
  and **3** remain with 19-08; item **5** (a verification) with 19-09.
- **The publish hold stands.** Both commits carry `[skip release]`. This run cannot honestly
  authorise a release: the artefact that would prove the gaps closed is the Phase 19
  re-verification, which has not happened. **19-09 owns recording the named condition that lifts
  the hold.**
- **Blocker for phase close, not for the next plan:** `docs-review-disposition.test.ts` stays
  red until the last gap-closure SUMMARY lands. Phase 19 must not be declared verified while it
  is red.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*

## Self-Check: PASSED

- All four files claimed above exist on disk (`19-06-SUMMARY.md`, `deferred-items.md`,
  `anno-coverage.ts`, `anno-coverage.test.ts`).
- Both task commits exist in git history: `0bca490`, `cbdbf97`.
- No tracked file was deleted by either task commit
  (`git diff --diff-filter=D --name-only 5c68473..HEAD` is empty).
- `COV-02` was NOT marked complete: `requirements.ready-ids` reports `0/1 ready` because a
  sibling plan in this phase also declares it and has no SUMMARY yet. Correct per the shared-ID
  gate — it marks when the last declaring plan lands.
