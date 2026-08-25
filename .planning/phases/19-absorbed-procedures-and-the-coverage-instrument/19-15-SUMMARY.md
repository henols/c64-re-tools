---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 15
subsystem: testing
tags: [6502, static-analysis, coverage, dispatch-gate, control-fixtures, node-test]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "the dispatch-context gate, DISPATCH_CONTEXT_SHAPES, GATE_INTERIOR_DECLARATIONS and reachesGateInterior() (19-10, 19-11), and the FP1/FP2 committed control-pair pattern (19-09)"
provides:
  - "hasDispatchContext() takes the DispatchPairing under test; branch A requires a proven push link from the two paired loads to the rts"
  - "SplitOrientation and DispatchPairing as named interfaces, read by the three later plans of this round"
  - "fp3-unlinked-push-idiom / fp3b-immediate-push-idiom — the class-3 push-idiom route's first interior control pair, committed"
  - "assertNoIndirectJumpOpcode() and assertCarriesPushIdiom() generator throws, splitting the two properties assertDispatchesNowhere() cannot express together"
  - "PUSH_IDIOM_LINKED — the liveness positive control proving the tightened branch is not dead"
  - "PUSH_IDIOM_WINDOW_EDGE — the outside half of the class-3 witness pair"
  - "the round-4 planted-violation record in 19-VALIDATION.md"
affects: [19-16, 19-17, 19-18, 19-19, 19-20, phase-20-decomposition]

# Actuals (#2632)
actuals:
  tokens: 14100
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a dispatch predicate takes the pairing it is being asked to rule on, rather than re-deriving it from the window"
    - "an interior control is paired with an outside twin so the witness that places it is provably not a machine that answers true for everything"
    - "a tightening ships in the same commit as a liveness positive control that proves the tightened branch still fires"

key-files:
  created:
    - src/mcp/vice/fixtures/coverage/fp3-unlinked-push-idiom/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp3-unlinked-push-idiom/store.json
    - src/mcp/vice/fixtures/coverage/fp3b-immediate-push-idiom/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp3b-immediate-push-idiom/store.json
  modified:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - src/mcp/vice/fixtures/coverage/README.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md

key-decisions:
  - "hasDispatchContext()'s branch A is decided against the pairing's own two successors — insns[firstIndex + 1] and insns[secondIndex + 1] must each be a pha — rather than by counting pha bytes anywhere in the window"
  - "the falsified class-4-claims-the-window rationale was REPLACED in the doc comment, not preserved beside a correction"
  - "the FP3 pair may not use assertDispatchesNowhere(), which throws on $48; the two properties are split into assertNoIndirectJumpOpcode() and assertCarriesPushIdiom() so the push idiom the fixture exists for is itself a checked fact"
  - "PUSH_IDIOM_WINDOW_EDGE was retained with its job restated: it is now the OUTSIDE half of the class-3 witness pair rather than the boundary discriminator it was authored as"
  - "the census relation for the liveness control is asserted as reachedAsInstruction > prologue length, not as a pinned byte count"

patterns-established:
  - "Pairing-aware predicate: a gate that publishes seeds must consult the specific construction it is ruling on, never a shape that merely co-occurs with it"
  - "Interior/outside witness pair: an interior control is committed alongside a payload just outside the same pre-gate condition, and both are run through the witness in one test"
  - "Split generator invariants: when one blanket throw would contradict a fixture's reason for existing, the properties are separated into two throws rather than downgraded to a comment"

requirements-completed: [COV-01, COV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The round-3 blocker payload is committed as the fp3 / fp3b fixture pair and reports zero proven dispatch targets, an empty table-entry set, $0840 unreached, and a census equal to its declared 15 code bytes"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it"
        status: pass
    human_judgment: false
  - id: D2
    description: "hasDispatchContext() branch A returns true only on a proven push link: a pha at each paired load's own successor and an rts after both"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tightened class-3 route is LIVE — a payload whose two paired loads each immediately push what they loaded is still PROVEN, and both pre-existing positive controls still prove"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the tightened class-3 push-idiom branch is LIVE: a payload whose two paired loads each push what they loaded is still PROVEN"
        status: pass
    human_judgment: false
  - id: D4
    description: "The gate demonstrably examined and DECLINED the pairing rather than never seeing it — exactly one advisory candidate for fp3, zero for its twin"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it"
        status: pass
    human_judgment: false
  - id: D5
    description: "fp3 is mechanically witnessed INSIDE the class-3 push-idiom route while its window-edge twin is outside it, and both fixtures are declared in GATE_INTERIOR_DECLARATIONS"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the window-edge twin is OUTSIDE the class-3 push-idiom route while FP3 is INSIDE it, so the interior predicate is not satisfied by everything"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#every gate-interior declaration is mechanically TRUE, not a claim in a table"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fixture pair's two defining properties are generator-enforced throws, and the generator stays deterministic across twelve fixtures"
    requirement: COV-02
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs (twice) && git status --porcelain fixtures/coverage"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs"
        status: pass
    human_judgment: false
  - id: D7
    description: "The branch-A gate has been WATCHED FAIL under a planted violation and green after restoration, recorded in 19-VALIDATION.md as additions only"
    requirement: COV-01
    verification:
      - kind: manual_procedural
        ref: "branch A reverted in the working tree; cd src/mcp/vice && node --test r2000-coverage.test.ts observed exit 1, 75 pass / 1 fail; restored via git checkout, 76 pass / 0 fail"
        status: pass
    human_judgment: true
    rationale: >-
      The planted-violation demonstration is a procedure run by hand in the working tree, not a
      committed test. Its evidence is the transcript recorded in 19-VALIDATION.md; whether that
      record is a faithful account of what was run is a judgment the phase verifier must make, not
      something the suite can assert about itself.

# Metrics
duration: 58 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 15: Branch-A Proven Push Link Summary

**`hasDispatchContext()`'s stack-return branch now demands a `pha` at each paired load's own successor and an `rts` after both, so the round-3 blocker payload — 15 code bytes that manufactured eight "proven" entry points and 47 of 64 bytes of code-or-table — reports nothing.**

## Performance

- **Duration:** 58 min
- **Started:** 2026-08-25T10:34:00Z
- **Completed:** 2026-08-25T11:32:00Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified in `src/`, plus 2 planning records)

## Accomplishments

- **The defect class is closed at its root for this branch.** Branch A previously accepted any two
  `$48` bytes and any `$60` byte inside the pairing window, without ever consulting the pairing it
  was being asked to rule on. It now requires the two paired loads' own next instructions to be the
  pushes carrying the bytes they just read, with the `rts` following both — the RTS trick stated as
  a data-flow link (19-CONTEXT.md D-02, D-03).
- **The blocker payload is a committed fixture pair, measured rather than remembered.** `fp3` was
  generated from `lda $0830,x / sta $fb / lda $0838,x / sta $fc / pha / txa / pha / tya / rts`
  verbatim and then measured: pre-fix `reached=31`, `tableEntry=16`, `splitTables=1`, eight proven
  targets at `$0840`…`$0847`, `classAt($0840)="reached-as-instruction"` — matching the round-3
  verification's own numbers exactly, with no fixture adjusted to reproduce a remembered figure.
  Post-fix all five converge: `[]`, `[]`, `[]`, `unreached`, and `15` against its own declared
  `code_size: 15`.
- **The class-3 route into `stack-return-push-idiom` has an interior control for the first time.**
  All three prior push-idiom controls satisfy only the class-4 disjunct of
  `reachesGateInterior()` — that is the hole the round-3 verification named. `fp3` takes the
  class-3 route: class 4 declines its window outright, so the class-3 pass is unambiguously what
  ruled on it.
- **The tightening is proven LIVE in the same commit.** `PUSH_IDIOM_LINKED` — FP3's layout with the
  two pushes moved to each load's own successor — is still PROVEN, with `splitTables.length === 1`,
  `provenDispatchTargets()` deep-equal to `[$0840…$0847]`, and a census exceeding its own derived
  prologue length. `SPLIT_TABLE` and `STACK_RETURN` are re-asserted in the same test. A branch that
  declined everything would be dead code wearing a sufficient-shape label.
- **The gate was watched fail.** With branch A reverted in the working tree, exactly one test reds
  by name and the pre-fix numbers reproduce; restored, the suite is green and the source diff is
  clean. Recorded in `19-VALIDATION.md` as 58 insertions and zero deletions.
- **`COVERAGE_SCHEMA_VERSION` is still 2 and `COVERAGE_REPORT_KEYS` is unchanged** — this was a
  predicate and control change, not a report-shape change.

## Task Commits

Each task was committed atomically. Task 1 is a `tdd="true"` tracer and therefore carries the
RED and GREEN commits separately.

1. **Task 1 (RED): the FP3 interior control, observed failing** — `84dee9b` (test)
2. **Task 1 (GREEN): branch A requires a proven push link** — `59587ca` (feat)
3. **Task 2: the window-edge twin and the two declaration rows** — `6ef793b` (test)
4. **Task 3: the round-4 planted-violation record** — `119144b` (docs)
5. **Out-of-scope discovery logged, not fixed** — `521d180` (docs)

**Plan metadata:** see the `docs(19-15): complete` commit at the end of this plan.

### TDD Gate Compliance

| Gate | Commit | Observed |
|---|---|---|
| RED | `84dee9b` `test(19-15)` | `not ok 60 - a push idiom that pushes bytes the two paired loads never supplied …`, 74 pass / 1 fail of 75 |
| GREEN | `59587ca` `feat(19-15)` | 75 pass / 0 fail, `npx tsc --noEmit` exit 0 |
| REFACTOR | — | none needed; the branch is five lines and the interface extraction happened inside GREEN |

Gate sequence is present and in order.

## Files Created/Modified

- `src/mcp/vice/r2000-coverage.ts` — `interface SplitOrientation` (the named return type of
  `resolveSplitOrientation()`); `interface DispatchPairing`; `hasDispatchContext()` gains a fourth
  `pairing` parameter and a rewritten branch A; the class-3 call site passes
  `{ firstIndex: i, secondIndex: j, oriented }`; the falsified doc-comment rationale replaced;
  `sawPha` deleted.
- `src/mcp/vice/r2000-coverage.test.ts` — `FP3_INTERIOR`, `FP3_IMMEDIATE`, `PUSH_IDIOM_LINKED`,
  `PUSH_IDIOM_LINKED_CODE_BYTES`, `PUSH_IDIOM_TARGETS`, `PUSH_IDIOM_WINDOW_EDGE`,
  `PUSH_IDIOM_WINDOW_EDGE_CODE_BYTES`; three new tests; two new
  `GATE_INTERIOR_DECLARATIONS` rows; `COMMITTED_CONTROL_FIXTURES` 10 → 12.
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` — `FP3_INDEXED_PROLOGUE`,
  `FP3_IMMEDIATE_PROLOGUE`, `FP3_CODE_SIZE`, `UNLINKED_PUSH_IDIOM`, `IMMEDIATE_PUSH_IDIOM`,
  `assertNoIndirectJumpOpcode()`, `assertCarriesPushIdiom()`, two `FIXTURES` registrations, and a
  header rewritten from three groups of ten to four groups of twelve.
- `src/mcp/vice/fixtures/coverage/fp3-unlinked-push-idiom/` — the class-3 route's interior control.
- `src/mcp/vice/fixtures/coverage/fp3b-immediate-push-idiom/` — its immediate twin, the measured
  census baseline.
- `src/mcp/vice/fixtures/coverage/README.md` — twelve fixtures in four groups, two new table rows,
  and a new section describing the pair's byte layout and its three enforced invariants.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — the
  round-4 section: executed evidence, the planted-violation row (#15), and the liveness evidence.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — the
  `vice-proxy.test.ts` full-suite flake, recorded rather than fixed.

## Decisions Made

- **The pairing crosses the call boundary.** Rather than teaching the predicate to re-find the two
  loads, `hasDispatchContext()` takes a `DispatchPairing`. A predicate that re-guesses which loads
  it is ruling on cannot rule on them, and the interface is read by three later plans of this round.
- **The false rationale was deleted, not annotated.** The old comment claimed that class 4 runs
  first and claims its windows, so a pairing inside one is never promoted here. Class 4 claims only
  its exact five-instruction shape; every time it declines, this pass rules on the pairing. Leaving
  a falsified justification beside its correction preserves the reasoning that produced the defect.
- **Two throws, not one weakened throw.** `assertDispatchesNowhere()` rejects `$48`, which is the
  FP3 pair's whole reason for existing. Relaxing it would have removed the FP2 pair's protection;
  the properties were split instead, and `assertCarriesPushIdiom()` was added so a future edit that
  deletes the idiom cannot leave an outside-bracketing payload wearing an interior label.
- **`PUSH_IDIOM_WINDOW_EDGE`'s job was restated in its own comment.** With FP3 declining too, it no
  longer discriminates the report; it is now the outside half of the witness pair, which is a
  different claim and is documented as such rather than left to read as a stale control.
- **A relation, not a count.** The liveness control asserts `reachedAsInstruction >` its derived
  prologue length, per this project's standing "assert relations, not counts" rule.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule was invoked; no auto-fix was required.

## Issues Encountered

**One out-of-scope failure, logged and not fixed.** Two full-suite runs
(`cd src/mcp/vice && npm test`) came back `# tests 2585 / # pass 2539 / # fail 1` with
`vice-proxy.test.ts:1594` and `vice-proxy.test.ts:2260` red, both
`timed out waiting for a proxy stdout message`. **Standalone the same file is green** —
`node --test vice-proxy.test.ts` → 123 tests, 119 pass, 0 fail, 4 skipped. This is the documented
concurrency-flake mechanism already carried as item 3 of this phase's `deferred-items.md`
(a spawned child on a wall-clock budget while `node --test` runs 24 files concurrently), on a second
file. It cannot be caused by this plan: 19-15 touched only `r2000-coverage.*` and
`fixtures/coverage/`, `vice-proxy.test.ts` imports nothing from that family, and the coverage module
is read-only by construction. Recorded in `deferred-items.md` with its owner named
(a plan that owns `vice-proxy.ts`), per the scope boundary.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && node --test r2000-coverage.test.ts` | **76 pass, 0 fail** (baseline 71 — above the recorded round-3 count) |
| `cd src/mcp/vice && npx tsc --noEmit` | exit 0 |
| generator run twice, `git status --porcelain fixtures/coverage` | `wrote 12 control fixtures` both runs, porcelain **empty** |
| `node scripts/check-npm-packages.mjs` | exit 0 — 75 / 34 files, neither fixture directory leaks |
| `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | 24 pass, 0 fail |
| `cd src/mcp/vice && node --test docs-linerefs.test.ts` | pass (the two `rewriteArguments()` citations still exact) |
| `ls -d src/mcp/vice/fixtures/coverage/*/ \| wc -l` | 12, and `COMMITTED_CONTROL_FIXTURES` is 12 |
| `grep -c 'sawPha' src/mcp/vice/r2000-coverage.ts` | 0 |
| `grep -c 'skipped outright' src/mcp/vice/r2000-coverage.ts` | 0 |
| `grep -c 'COVERAGE_SCHEMA_VERSION = 2' src/mcp/vice/r2000-coverage.ts` | 1 |
| `git diff --numstat` on `19-VALIDATION.md` | 58 insertions, **0 deletions** |
| Edge predicates (empty / single-instruction / shorter-than-window payloads) | empty lists, no throw |
| Full suite `cd src/mcp/vice && npm test` | 2585 tests, 2539 pass, **1 fail** — the out-of-scope `vice-proxy.test.ts` flake above; green standalone |

## Prohibitions Observed

- `19-REVIEW.md` is byte-unchanged; `git diff --name-only` never listed it.
- `.planning/REQUIREMENTS.md` is byte-unchanged and **no requirement checkbox was ticked**.
  `requirements.mark-complete` was deliberately NOT run. `requirements-completed` above is the
  verbatim copy of this plan's `requirements` field that the summary template mandates, and is a
  statement of scope, not of closure: COV-01 remains open, this plan is one of six in the round,
  and re-checking a requirement box is re-verification's entitlement.
- `COVERAGE_SCHEMA_VERSION` not bumped; `COVERAGE_REPORT_KEYS` unchanged.
- No scope-reduction language and no phase-number pointer in any comment, fixture purpose field or
  assertion message this plan wrote — verified by grep over the plan's own additions.
- WR-03 not touched and not absorbed. `r2000-session.ts`'s 200 ms timeout not widened.
- No runtime dependency added to either published package.

## Known Stubs

None. Every branch this plan wrote is reachable and is exercised by a committed test in both
directions: the tightened branch A is asserted to DECLINE `fp3` and to ACCEPT `PUSH_IDIOM_LINKED`,
and both new generator throws guard properties the committed payloads satisfy.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SplitOrientation`, `DispatchPairing` and the fourth `pairing` parameter are in place, which is
  what 19-16 extends across the second true-returning site and pins mechanically.
- `GATE_INTERIOR_DECLARATIONS` now carries a class-3 interior row, so 19-18's re-key of `position`
  to `{shape, route}` has a row that will genuinely claim the `class-3-pass` route rather than
  leaving it uncovered.
- The `fp3` / `fp3b` pair and `PUSH_IDIOM_LINKED` are a two-element instance of the grammar 19-17
  generalises into a generated-payload property.
- **Open:** COV-01 is not closed by this plan alone. The round's remaining shapes (19-16), the
  property assertion (19-17), the route-keyed controls (19-18) and WR-03 (19-20) are still ahead,
  and 19-19 runs the phase gate last.
- **Carried:** the `vice-proxy.test.ts` full-suite flake, recorded in `deferred-items.md`.

## Self-Check: PASSED

- `src/mcp/vice/fixtures/coverage/fp3-unlinked-push-idiom/project.regen2000proj` — FOUND
- `src/mcp/vice/fixtures/coverage/fp3-unlinked-push-idiom/store.json` — FOUND
- `src/mcp/vice/fixtures/coverage/fp3b-immediate-push-idiom/project.regen2000proj` — FOUND
- `src/mcp/vice/fixtures/coverage/fp3b-immediate-push-idiom/store.json` — FOUND
- Commits `84dee9b`, `59587ca`, `6ef793b`, `119144b`, `521d180` — all FOUND in `git log --all`
- All plan `<acceptance_criteria>` re-run and passing; plan `<verification>` re-run with the one
  out-of-scope exception documented above.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
