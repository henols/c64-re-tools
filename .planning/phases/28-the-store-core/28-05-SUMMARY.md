---
phase: 28-the-store-core
plan: 05
subsystem: database
tags: [annotation-store, overlap-semantics, split-and-preserve, confidence-grades, planted-violation, node-sqlite]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "plan 28-01's split-and-preserve retype(), the anno_range/anno_comment DDL, applyWrite's BEGIN IMMEDIATE write sequence, and the paint index — the overlap behaviour was IMPLEMENTED there and flagged unproven on coverage entry D11"
  - phase: 28-the-store-core
    provides: "plan 28-04's AnnoWriteResult { revision, changed } shape, the AnnoCommentError precedent for a non-identifier refusal class, and runWriteSequence's rollback-on-throwing-mutation"
  - phase: 18-anno-annotation-surface
    provides: "anno-confidence.ts's CONFIDENCE_GRADES five-grade vocabulary, parseConfidencePrefix()'s throw-on-near-miss path, and AnnoConfidenceGradeError"
provides:
  - "contradictedCommentsFor() — the ONE definition of 'a retype makes this comment false', derived from CONFIDENCE_GRADES by token suffix, with the rejected broad alternative recorded beside it"
  - "SetDataTypeResult — setDataType's widened result carrying an always-present contradictedComments array; the contradiction is data on a SUCCESSFUL write, never an error and never a refusal"
  - "ContradictedComment and AnnoCommentGradeError — the report row shape, and the ViceError subclass that wraps the confidence parser's non-ViceError refusal so everything the store throws is a ViceError"
  - "anno-overlap.test.ts — the five overlap cases with both invariants, case 3's three-row shape field by field, both plantings observed, STORE-02's non-merge proven behaviourally AND structurally, and the deterministic post-split row order"
  - "the MEASURED correction to the phase's planted-violation model: filter-and-insert reddens THREE overlap cases, not one, and the naive total-unchanged metric is satisfied by a 128-byte loss in case 4"
affects: [28-06, "the MCP annotation surface", "ACME export", "coverage census", CUT-04]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate:
# chars/4 over the ADDED lines of the realized diff (47,670 chars over 4 files).
# Whole-file chars would be dishonest here: three of the four files were
# MODIFIED, so most of their bytes predate this plan.
actuals:
  tokens: 11918
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a rule derived from an existing vocabulary by projection (token suffix), never a second literal copy of that vocabulary's members"
    - "an error that WRAPS a foreign base class at the module boundary, with the original message preserved verbatim and the cost of the wrap stated in the doc comment"
    - "a loss REPORTED as data on a successful result rather than raised as a refusal, because a refusal creates pressure to delete the evidence"
    - "a planting driven through the SAME harness as the production path, so the two measurements are comparable by construction"
    - "the naive form of an invariant pinned as its own FAILING-BY-DESIGN measurement, converting a rejected metric into positive evidence for the metric that replaced it"

key-files:
  created:
    - src/mcp/vice/anno-overlap.test.ts
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "Invariant A is asserted in its UNION form (total_after == |covered_before ∪ [c,d]|), not the plan's literal 'total unchanged' — the literal form is unsatisfiable by the CORRECT implementation in case 2, and is satisfied by a broken one in case 4"
  - "The measured planting-A pattern (cases 3, 4, 5 red; 1 and 2 green) is asserted instead of the plan's predicted 'case 3 only' — case 4 drops its tail and case 5 its head, so the plan's four-green prediction was arithmetically impossible"
  - "Case 3 stays uniquely load-bearing on a defensible basis: it is the only case losing BOTH a head and a tail, and the only case whose correct answer is three rows"
  - "The naive total-unchanged metric's false negative in case 4 (128 dropped tail bytes balanced by 128 newly typed low bytes) is pinned as its own test, so invariant B's necessity is measured rather than argued"
  - "Task 1's behaviour tests live in anno-store.test.ts, the file Task 1's own verify gate names — the plan gave Task 1 TDD behaviours but no test file in its <files> list"
  - "The post-split row order is head, then tail, then the new range in ascending id — which is NOT ascending start address; the rule is stated in the test and pinned across a close and a reopen"
  - "parseConfidencePrefix's refusal is wrapped, not swallowed and not rethrown unchanged: a malformed bracket token read as 'ungraded' would exempt that comment from the report forever"

patterns-established:
  - "Derived-rule projection: contradictedCommentsFor filters CONFIDENCE_GRADES by token suffix, so the four contradicting brackets have no second home in the store"
  - "Rejected-alternative-in-code: the broad 'any comment at the address' rule is named and refused in the predicate's own doc comment, with the reason (a report that fires every time is a report nobody reads)"
  - "Same-harness planting: runCase() drives the production path and retypeByFilterAndInsert identically, so the selectivity claim is a measurement, not two hand-written numbers"
  - "Non-vacuity on an absence assertion: the structural no-splitter scan pins the stripped source's length AND that it still contains real code before asserting the absence"

requirements-completed: [STORE-02, STORE-03]

coverage:
  - id: D1
    description: "A partial overwrite splits and preserves: across all five overlap cases the range table claims exactly the addresses typed before plus the ones just typed (invariant A, union form), AND every address that carried a type before the retype still carries one afterwards (invariant B)"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#overlap case 1 (identical, c === a && d === b): both invariants hold"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#overlap case 2 (new fully CONTAINS existing, c <= a && d >= b): both invariants hold"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#overlap case 3 (new fully INSIDE existing (LOAD-BEARING), a < c && d < b): both invariants hold"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#overlap case 4 (overlap at the LOW end, c <= a && a <= d && d < b): both invariants hold"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#overlap case 5 (overlap at the HIGH end, a < c && c <= b && d >= b): both invariants hold"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#the five case definitions really do satisfy their own predicates -- case 3 with BOTH inequalities strict"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fully-contained case produces exactly THREE rows — [a, c-1] old type, [c, d] new type, [d+1, b] old type — asserted field by field, and named in the test as the load-bearing case"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field"
        status: pass
    human_judgment: false
  - id: D3
    description: "Planting A observed and its selectivity measured: filter-and-insert in place of split-and-preserve reddens overlap cases 3, 4 and 5 (five of fourteen tests) while cases 1 and 2 stay byte-identical to the production path"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#planting A, OBSERVED and SELECTIVE: filter-and-insert loses bytes in exactly the three cases that have a head or a tail, and is indistinguishable from the real path in the other two"
        status: pass
      - kind: other
        ref: "planted violation OBSERVED against the real anno-store.ts: split-and-preserve replaced by filter-and-insert -> `node --test anno-overlap.test.ts` 9 pass / 5 fail (cases 3, 4, 5 plus the case-3 row shape and the post-split ordering); reverted from a `cp` copy before commit b67880a"
        status: pass
    human_judgment: false
  - id: D4
    description: "Invariant B is not optional, measured: in case 4 filter-and-insert satisfies the naive total-unchanged metric exactly while silently losing 128 previously typed addresses"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#why invariant B is not optional, MEASURED: in case 4 the planting satisfies the naive total-unchanged metric while losing 128 addresses"
        status: pass
    human_judgment: false
  - id: D5
    description: "A retype that makes an existing graded comment false returns that comment on the SUCCESSFUL result as structured data (address, commentType, text, grade, contradictedBy), never as an error and never as a refusal; the list is always present and empty rather than absent"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a confirmed-code graded comment inside a range retyped to byte is REPORTED on the successful result, and the retype still happens"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a probable-code graded comment is reported by the same rule"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the contradicted-comment list is EMPTY rather than absent when no comment is in range, so a caller reads the field unconditionally"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a comment OUTSIDE the retyped range is never reported, even when its grade would contradict"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contradiction rule is derived from CONFIDENCE_GRADES rather than invented: a code-graded comment is contradicted by any non-code member, a data-graded comment only by code, and [unknown] or ungraded never"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#contradictedCommentsFor is the ONE definition of the rule, and it is derived from the five-grade vocabulary"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a data-graded comment is contradicted by a retype to code and NOT by a retype to another data member"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#an unknown-graded comment and an ungraded comment are never reported, under any retype"
        status: pass
      - kind: other
        ref: "grep gate: `grep -c 'from \"./anno-confidence.ts\"' anno-store.ts` = 1, `grep -c CONFIDENCE_GRADES` = 3, and no confidence bracket string appears on a non-comment line (`grep -vE '^\\s*(//|\\*|/\\*)' | grep -c confirmed-code` = 0)"
        status: pass
    human_judgment: false
  - id: D7
    description: "An unparseable bracket token is refused as a named ViceError subclass rather than swallowed into 'ungraded', with the original AnnoConfidenceGradeError message preserved verbatim inside the wrapper and the original error on `cause`"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a comment whose bracket token is not one of the five makes the retype throw AnnoCommentGradeError carrying the original message verbatim"
        status: pass
    human_judgment: false
  - id: D8
    description: "Planting B observed: with the contradiction query removed from the retype path the identical scenario returns clean success with an empty list, while the production path reports one entry"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#planting B, OBSERVED: with the contradiction query removed the identical scenario returns CLEAN SUCCESS with an empty list, while the production path reports one entry"
        status: pass
      - kind: other
        ref: "planted violation OBSERVED against the real anno-store.ts: collectContradictedComments() call replaced by an empty array -> `node --test anno-overlap.test.ts` 13 pass / 1 fail (test 10) and `node --test anno-store.test.ts` 26 pass / 5 fail; reverted from a `cp` copy before commit b67880a"
        status: pass
    human_judgment: false
  - id: D9
    description: "STORE-02's non-merge proven BOTH ways: two adjacent same-type ranges stay two rows with distinct ids and distinct boundary resolutions (behavioural), and no coalescing, merging or splitter identifier appears in anno-store.ts's stripped source, with the absence assertion proven non-vacuous"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#adjacency, BEHAVIOURAL: two adjacent same-type ranges stay TWO rows with distinct ids, and the boundary addresses resolve to different rows"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code"
        status: pass
    human_judgment: false
  - id: D10
    description: "The empty and non-overlapping paths, and the deterministic post-split row order: head, then tail, then the new range in ascending id, unchanged across a close and a reopen"
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#empty and non-overlapping: the first range inserts exactly one row, and a second, non-overlapping range leaves both rows and both types intact"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#post-split row order is DETERMINISTIC and survives a close and a reopen: head, then tail, then the new range, in ascending id"
        status: pass
    human_judgment: false
  - id: D11
    description: "The two judgment prohibitions: no previously annotated region is silently un-documented, and a contradicted comment is never reported as a failure"
    verification: []
    human_judgment: true
    rationale: "Both prohibitions are stated as judgment in the plan (`verification: judgment`). The mechanical halves are covered by D1-D9; what remains is the judgment that the REPORT SHAPE is the right one — that returning the contradiction as data on a successful result, with no option to make it a refusal, genuinely removes the pressure to delete a comment to get a retype through. That is a design judgment about caller incentives, and no test asserts it."

# Metrics
duration: 21 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 05: Overlap Semantics and the Contradicted-Comment Report Summary

**Split-and-preserve proven across all five overlap cases with a union-form byte invariant plus a covered-address subset invariant, and a `CONFIDENCE_GRADES`-derived contradicted-comment report returned as data on the successful write — with both plantings observed red and the phase's planted-violation model corrected by measurement.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-27T14:35:50Z
- **Completed:** 2026-08-27T14:57:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **The contradicted-comment rule, with exactly one home.** `contradictedCommentsFor(gradeBracket, dataType)` derives the four contradicting brackets from `CONFIDENCE_GRADES` by their token's suffix — no second copy of the vocabulary in the store — and its doc comment records both the decision ("contradicts" means the retype makes the comment FALSE) and the rejected broad alternative ("any comment at the address"), with the reason: a report that fires every time is a report nobody reads.
- **The report is data on a successful write.** `setDataType()` now returns the named `SetDataTypeResult` whose `contradictedComments` array is always present and often empty. There is no option to make it a refusal, and the reason is written into the module header as trap 9: a refusal would push a caller toward deleting the comment to get the retype through, converting a reported loss into a silent one.
- **The confidence parser's refusal is wrapped, not swallowed.** `parseConfidencePrefix()` throws a class extending `Error` directly, so `AnnoCommentGradeError extends ViceError` wraps it — original message verbatim, original error on `cause`, and the cost (the original class is no longer visible to `instanceof` at the boundary) stated in the doc comment rather than left to be discovered.
- **The comment select runs inside the retype's own transaction**, so a comment written by another connection between the query and the retype cannot be missed — `begin immediate` serialises the pair.
- **All five overlap cases hold both invariants**, each as a separately named subtest, plus a sixth test asserting the five case definitions really satisfy their own predicates — including case 3's with BOTH inequalities strict.
- **Case 3's three-row shape asserted field by field**, separately from either invariant, because a balanced total and a holding coverage set can still be produced by wrong boundaries.
- **Both plantings observed red against the real `anno-store.ts`**, and the measurement corrected the plan's model in two places (see Deviations).
- **`STORE-02`'s non-merge proven both ways** — two adjacent same-type ranges stay two rows with distinct boundary resolutions, and no coalescing/merging/splitter identifier appears in the store's stripped source, with the absence assertion paired against a length AND a still-contains-real-code non-vacuity check.
- **The post-split row order pinned as deterministic:** head, then tail, then the new range in ascending id — which is *not* ascending start address — and unchanged across a close and a reopen.

## Task Commits

1. **Task 1: the contradicted-comment rule, derived from CONFIDENCE_GRADES and returned as data** — `0b007b0` (feat)
2. **Task 2: the five overlap cases, both plantings observed, STORE-02 proven two ways** — `b67880a` (test)

RED was observed before each GREEN: Task 1's first run failed at module load (`does not provide an export named 'AnnoCommentGradeError'`), and Task 2's reds are the two plantings themselves, both driven against the real production module.

## Files Created/Modified

- `src/mcp/vice/anno-overlap.test.ts` (created, 588 lines) — the five-case table as a header comment with case 3 marked load-bearing and the equality warning; both invariants computed the same way for every case; case 3's row shape; planting A with its selectivity measured through the same harness as the production path; the naive-metric false negative as its own test; planting B; adjacency behavioural and structural; empty and non-overlapping; post-split ordering across a reopen. 14 tests.
- `src/mcp/vice/anno-store.ts` (+128/-5) — `CODE_GRADE_BRACKETS`/`DATA_GRADE_BRACKETS` derived from `CONFIDENCE_GRADES`; `contradictedCommentsFor()`; `collectContradictedComments()`; `SetDataTypeResult`; `setDataType` widened; header trap 9; the one new import specifier `"./anno-confidence.ts"`.
- `src/mcp/vice/anno-types.ts` (+62) — `ContradictedComment`, `AnnoCommentGradeErrorOptions`, `AnnoCommentGradeError`.
- `src/mcp/vice/anno-store.test.ts` (+174) — eight tests over the contradiction rule, including the boundary-inclusive out-of-range check and the malformed-bracket refusal.

## Decisions Made

See `key-decisions` in the frontmatter. The two that a later reader most needs:

1. **Invariant A is the UNION form, not "total unchanged".** `total_after == |covered_before ∪ [c,d]|`. The literal "unchanged" wording is wrong in both directions: a *correct* implementation legitimately grows the total in case 2 (the new range types addresses nothing had typed), and a *broken* one satisfies it exactly in case 4.
2. **Case 3's load-bearing status rests on a defensible property, not on being the only detector.** It is the only case losing both a head and a tail, and the only case whose correct answer is three rows. A table whose case 3 is written with `c === a` never produces a three-row result at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's asserted fact] Planting A reddens THREE overlap cases, not one**

- **Found during:** Task 2, before writing any assertion — the pattern was measured first.
- **Issue:** The plan's truths and acceptance criteria assert that filter-and-insert "passes cases 1, 2, 4 and 5 and FAILS case 3", and that planting it into `setDataType` "makes `node --test anno-overlap.test.ts` FAIL on the fully-contained case and on no other case". That is arithmetically impossible: filter-and-insert drops every surviving head and tail, case 4 always has a tail (`d < b`) and case 5 always has a head (`a < c`), so both lose bytes too. Measured: case 3 loses 192 addresses, case 4 loses 128, case 5 loses 128; cases 1 and 2 lose none, because neither has a head or a tail to drop.
- **Fix:** Asserted the MEASURED pattern instead of the predicted one, as an exact `deepEqual` over per-case lost-address counts, and re-grounded case 3's load-bearing status on two properties that *are* true and checkable: it is the only case losing both sides, and the only case whose correct answer is three rows. Cases 1 and 2 are additionally asserted byte-identical between the planting and the production path, which is the real selectivity claim.
- **Verification:** `node --test anno-overlap.test.ts` green (14/14). Planting into the real `anno-store.ts` reddened 5 of 14: overlap cases 3, 4 and 5, the case-3 row shape, and the post-split ordering. Cases 1 and 2 stayed green.
- **Committed in:** `b67880a` (named in the commit message)

**2. [Rule 1 - Bug in the plan's asserted fact] The plan's literal invariant A is unsatisfiable by the correct implementation, and is satisfied by a broken one**

- **Found during:** Task 2, same measurement.
- **Issue:** "the sum of `endInclusive - start + 1` over all `anno_range` rows is unchanged across all five overlap cases" cannot hold for case 2, where the new range types 512 addresses nothing had typed (measured: 256 → 768 under the *correct* implementation). Worse, in case 4 the naive form is satisfied *exactly* by filter-and-insert — 128 dropped tail bytes balanced by 128 newly typed low bytes — while 128 previously typed addresses silently lose their type. That is precisely the "hole that happens to balance" the plan predicted for case 3, occurring in case 4 instead.
- **Fix:** Invariant A is asserted in its union form. The naive form's false negative is pinned as its own named test ("why invariant B is not optional, MEASURED"), which converts a rejected metric into positive, measured evidence for invariant B rather than leaving the argument in prose.
- **Verification:** the named test asserts all three facts at once — the naive total is equal, 128 addresses are lost, and the union form catches it.
- **Committed in:** `b67880a`

**3. [Rule 3 - Blocking] Task 1's TDD behaviours had no test file in the plan's `<files>` list**

- **Found during:** Task 1, at the RED step.
- **Issue:** Task 1 is `tdd="true"` with seven behaviours, but its `<files>` names only `anno-types.ts` and `anno-store.ts`, and the plan's own comment forbids naming `anno-overlap.test.ts` in Task 1's gate (Task 2 creates it, and `node --test` on a missing path exits non-zero). So there was nowhere declared for the RED to live.
- **Fix:** The eight tests went into `anno-store.test.ts` — the file Task 1's own `<verify>` gate names, which is the only reading under which including that file in the gate means anything.
- **Verification:** `node --test anno-store.test.ts` 31/31; the RED was observed first as a module-load failure on the absent export.
- **Committed in:** `0b007b0`

**4. [Rule 2 - Missing critical] The post-split row order needed stating, not just asserting**

- **Found during:** Task 2, Test 8.
- **Issue:** The plan allowed for the possibility that the implementation's order is not deterministic, and noted that a required fix to `anno-store.ts` would be out of Task 2's file set. Measured: the order IS deterministic — `retype()` re-inserts head, then tail, then inserts the new range, and `listRanges()` orders by ascending id — so no fix was needed. But the order is *not* ascending start address, which is what a reader would assume.
- **Fix:** The rule is stated in the test's own comment before it is asserted, and asserted again after a close and a reopen so it reads as a property of the store rather than of one connection. No edit to `anno-store.ts` was required.
- **Verification:** `node --test anno-overlap.test.ts` test 14 green; ids 2 (head), 3 (tail), 4 (new range) measured identical before and after reopen.
- **Committed in:** `b67880a`

---

**Total deviations:** 4 auto-fixed (2 corrections to facts the plan asserted, 1 blocking gap in the plan's file allocation, 1 missing-critical clarification)
**Impact on plan:** No scope creep. Deviations 1 and 2 make the proof *stronger* than planned — the planting reddens three cases rather than one, and the metric the plan named as sufficient is now pinned as demonstrably insufficient. Both were measured before any assertion was written, which is why the mis-stated facts did not get baked into a green test.

## Issues Encountered

None. The one live risk — the project warning that plan 28-04 lost a task's uncommitted work by reverting a planting with `git checkout --` — was avoided by copying `anno-store.ts` aside with `cp` before each planting and restoring from that copy. Both plantings were reverted, verified green, and the copy removed before the commit.

## Verification Results

| Gate | Result |
|---|---|
| `node --test anno-overlap.test.ts anno-store.test.ts anno-types.test.ts anno-seam.test.ts` | 74 tests / 74 pass |
| `npm run typecheck` | exit 0 |
| `node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts test-gate.test.ts shipped-modules.test.ts` | 40 tests / 40 pass |
| `npm run test:automated` (broker stopped) | 2610 tests / **5 failures, all inside the named baseline** — the five `plan 18-06:` failures in `anno-session.test.ts` (`the external analyser` absent from `PATH`). The load-sensitive `:615` flake appeared in the Task 1 run (6 failures) and not the Task 2 run (5). No failure in any other file. Exit 1 on that baseline alone; the failure list is the gate. |
| `automatedTestFiles()` membership | 112 files, `anno-overlap.test.ts` present, `MANUAL_ONLY_TESTS` unedited |
| `package.json` `files[]` | `anno-overlap` absent (a test file must not be listed) |
| Planting A observed | 5 of 14 red (cases 3, 4, 5 + row shape + ordering), reverted before commit |
| Planting B observed | `anno-overlap.test.ts` test 10 red + 5 red in `anno-store.test.ts`, reverted before commit |

## Known Stubs

None. Every symbol this plan introduced is exercised by a test that fails when the symbol's behaviour is removed — both removals were performed and observed.

Coverage entry `D11` from plan `28-01` — "the five overlap cases are IMPLEMENTED here but proven in a later plan" — is **now closed** by this plan's `D1`, `D2` and `D3`.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change: no `ALTER TABLE`, no `SCHEMA_VERSION` bump, no new index, no new SQL identifier. The plan's own threat register covers every surface touched (`T-28-undoc`, `T-28-gradeswallow`, `T-28-refusalpressure`, `T-28-overmerge`, `T-28-torncheck`, `T-28-paddedtable`), and `T-28-SC` holds by measurement — zero package-manager installs, and the one new import specifier is a relative path inside `src/mcp/vice/`.

## Carried Forward

- **`CUT-04`'s enumerated task list** gains one entry as the plan required: `anno-store.ts` now imports `"./anno-confidence.ts"`, which becomes an edit when that module is renamed. It is a real dependency on the single-seam vocabulary, deliberately not avoided by copying the five grades.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `STORE-02` and `STORE-03` are both proven, behaviourally and (for the non-merge) structurally. Plan `28-01`'s only `human_judgment: true` coverage gap in this area is closed.
- Ready for `28-06`. `setDataType`'s result widened from `AnnoWriteResult` to `SetDataTypeResult`; the change is additive and every existing caller (tests only) compiles unchanged.
- One judgment item remains open by design (`D11` here): whether the report *shape* — data on a successful result, with no refusal option — genuinely removes the incentive to delete a comment to get a retype through. That is a design judgment for the phase verifier, not a missing test.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*

## Self-Check: PASSED

All four key files verified present on disk; both task commits (`0b007b0`, `b67880a`) verified present in `git log`. All `<acceptance_criteria>` from both tasks re-run and reconciled (see Verification Results), with the two mis-stated criteria recorded as deviations 1 and 2 rather than silently skipped.
