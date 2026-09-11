---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 03
subsystem: database
tags: [sqlite, node:sqlite, annotation-store, schema-migration, tdd]

# Dependency graph
requires:
  - phase: 43
    provides: "EVID-02's SCHEMA_VERSION doc-comment structure and DDL-bump precedent, copied verbatim for the version-5 bump"
provides:
  - "SCHEMA_VERSION 5 and the anno_excluded_range table, with the EVID-02-shaped decision record above the constant"
  - "addExcludedRange / listExcludedRanges / removeExcludedRange -- the store's place to record a user-requested exclusion's extent and reason"
  - "Full store-level test coverage for the exclusion verbs, including the touching-vs-overlap adjacency boundary and the empty-store case"
affects: [46-04, 46-05, 46-06]

# Actuals (#2632)
actuals:
  tokens: 11650
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Exclusion record as a NEW table rather than a nullable column on anno_range, mirroring anno_evid_exec's own precedent at SCHEMA_VERSION 4 -- an exclusion's extent is user-chosen and independent of a typed range's boundaries, so a column would force retype()'s carve to split/duplicate/lose a reason"
    - "addExcludedRange reuses addScope()'s exact overlap predicate (start <= ? and end_inclusive >= ?, transposed, order by id limit 1) so adjacency falls out of the >= rather than a second rule"
    - "removeExcludedRange is stricter than removeScope(): a partial/overlapping (non-exact) extent is refused BY NAME rather than treated as a silent no-op, because a near-miss removal must not read as 'nothing happened'"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-derive.test.ts
    - src/mcp/vice/anno-durability.test.ts

key-decisions:
  - "Exclusion mechanism is a new SQLite table (anno_excluded_range), not a column on anno_range -- the structural argument (retype()'s carve would fragment a user-chosen span) outweighs the weaker precedent argument (anno_evid_exec's own table-over-column choice)"
  - "removeExcludedRange refuses a partial/overlapping extent by name instead of reporting changed:false like removeScope() does for a mismatched span -- an exclusion's reason makes a near-miss removal more dangerous to silently ignore"
  - "reason validation reuses assertCommentText() with no second validator; an additional empty/whitespace-only check is layered on top since assertCommentText() alone accepts an empty string"

requirements-completed: [BUILD-07]

coverage:
  - id: D1
    description: "SCHEMA_VERSION bumped to 5, adding the anno_excluded_range table (id, start, end_inclusive, reason not null, unique(start, end_inclusive)) plus its start index, with a five-heading EVID-02-shaped decision paragraph (what the bump buys, the option selected, a re-measured factual check, the table-over-column reasoning, and the reversal condition) written directly above SCHEMA_VERSION"
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-types.test.ts#SCHEMA_VERSION is 5, and the constant's own doc comment records BUILD-07's reaffirm-refusal decision by name and by date"
        status: pass
      - kind: unit
        ref: "anno-store.test.ts (full suite, DDL/openStore paths)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three store verbs -- addExcludedRange, listExcludedRanges, removeExcludedRange -- recording a user-requested exclusion's extent and reason, with overlap refused by name, touching accepted as two separate records, a differing reason for a recorded extent refused rather than overwritten, and the reason validated at write time"
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-store.test.ts (exclusion-verb test group, 20 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Store-level coverage for every accept and refusal path from Task 2's behavior list, plus the three phase-named edge cases (two adjacency: tests, one empty: test) and a stale-baseRevision test per write verb"
    requirement: "BUILD-07"
    verification:
      - kind: unit
        ref: "anno-store.test.ts (adjacency:/empty: prefixed tests)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 03: The Exclusion Record Summary

**`anno_excluded_range` at SCHEMA_VERSION 5, giving the annotation store a place to record a user-requested exclusion's extent AND the reason the user gave, with overlap refused by name and touching pairs kept as two separate records.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-11T15:48:25Z
- **Completed:** 2026-09-11T18:10:07+02:00
- **Tasks:** 3
- **Files modified:** 6 (3 declared, 3 deviation fixes)

## Accomplishments
- `SCHEMA_VERSION` bumped to 5: `anno_excluded_range` (extent + `reason text not null`, `unique(start, end_inclusive)`) plus its start index, with a re-measured EVID-02-shaped decision paragraph above the constant (the three factual checks re-run this session, not inherited from VERSION 4's numbers)
- `ExcludedRangeRow` exported from `anno-types.ts`, documented in `ScopeRow`'s voice for what it deliberately does NOT have (no `bank`, no confidence/verdict/grade column)
- Three store verbs -- `addExcludedRange`, `listExcludedRanges`, `removeExcludedRange` -- reusing `addScope()`'s exact overlap predicate so adjacency falls out of the `>=`, with idempotence-first ordering, a differing-reason refusal, and reason validation through `assertCommentText()` plus an empty/whitespace-only refusal
- Full store-level test coverage: all 14 behavior bullets plus the three phase-named edge cases (`adjacency:` touching-pair non-vacuity, `adjacency:` one-byte-overlap refusal, `empty:` `deepEqual([])`), each refusal asserting message content AND unchanged post-state, and the overlap/differing-reason refusals asserting mutually-distinguishing substrings

## Task Commits

Each task was committed atomically (Task 2 followed RED -> GREEN as its `tdd="true"` frontmatter requires):

1. **Task 1: SCHEMA_VERSION 5 -- the exclusion table, and the decision record beside it** - `2be088b4` (feat)
2. **Task 2 (RED): add failing tests for the exclusion verbs** - `8394b25e` (test)
2. **Task 2 (GREEN): the three exclusion verbs** - `2b44e2a9` (feat)
3. **Task 3: store-level coverage, including BUILD-07's adjacency and empty edges** - `26fc0c53` (test)

**Deviation fix:** `34a690c6` (fix) -- three census/pin tests outside the declared `files_modified` that the schema bump structurally reddened

**Plan metadata:** committed as part of this same close-out step.

## Files Created/Modified
- `src/mcp/vice/anno-types.ts` - `ExcludedRangeRow` interface; `SCHEMA_VERSION` bumped 4 -> 5 with the VERSION 5 EVID-02 decision paragraph
- `src/mcp/vice/anno-store.ts` - `anno_excluded_range` DDL + index; `addExcludedRange`/`listExcludedRanges`/`removeExcludedRange`
- `src/mcp/vice/anno-store.test.ts` - full exclusion-verb test group (RED draft superseded by the final 20-test coverage group)
- `src/mcp/vice/anno-types.test.ts` - re-pinned `SCHEMA_VERSION` hand-typed test to 5, added BUILD-07/2026-09-11/`anno_excluded_range` assertions
- `src/mcp/vice/anno-derive.test.ts` - added `addExcludedRange`/`removeExcludedRange` to STORE-06's named expected SQL-write-site set
- `src/mcp/vice/anno-durability.test.ts` - re-pinned two SCHEMA_VERSION-4 tests (constant value, refusal-message match) to 5

## Decisions Made
- Exclusion record is a NEW table (`anno_excluded_range`), not a nullable column pair on `anno_range` -- see `key-decisions` above and the VERSION 5 doc-comment paragraph itself for the full structural argument
- `removeExcludedRange` refuses a partial/overlapping (non-exact) extent by name rather than the plain `changed:false` no-op `removeScope()` reports for a mismatched span -- documented in the function's own doc-comment as a deliberate divergence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three pre-existing tests hardcoded `SCHEMA_VERSION 4` / an expected write-site census, reddened by this plan's own bump**
- **Found during:** Task 1 verification (`node --test anno-types.test.ts anno-store.test.ts`) and the phase-level `npm run test:automated` verify step
- **Issue:** `anno-types.test.ts` pinned `SCHEMA_VERSION === 4` by hand (deliberately, per its own comment, so an edit is a decision); `anno-store.test.ts`'s CR-08 test pinned a live store's byte size at `SCHEMA_VERSION` 4 and its EVID-02 concurrency test pinned the refusal message's `"expected 4"`; `anno-durability.test.ts` had two more `SCHEMA_VERSION 4`-named tests pinning the same constant and refusal string; `anno-derive.test.ts`'s STORE-06 census of `EXPECTED_SQL_WRITE_SITES` did not yet name the two new write sites this plan legitimately adds
- **Fix:** Re-pinned each hand-typed number/string to 5 (re-recording each test's own documented history rather than silently editing it away), and added `addExcludedRange`/`removeExcludedRange` to the named expected write-site set with a doc comment explaining why neither is a cached derivation
- **Files modified:** `src/mcp/vice/anno-types.test.ts`, `src/mcp/vice/anno-store.test.ts`, `src/mcp/vice/anno-durability.test.ts`, `src/mcp/vice/anno-derive.test.ts`
- **Verification:** `npm run test:automated` returns to exactly the phase's documented four-name baseline (`annoRegisterEntryFor`, `DIRECTION 5`, `planted violation`, `check-skill-fork-honesty`) with zero new failures
- **Committed in:** `34a690c6`

---

**Total deviations:** 1 auto-fixed (Rule 1 -- necessary pin/census updates caused directly by this plan's own `SCHEMA_VERSION` bump, no scope creep)
**Impact:** All fixes were mechanical re-pins of numbers/strings these tests themselves document as intentionally hand-typed; no test's actual claim about the codebase changed.

## Issues Encountered
`check-skill-tool-coverage` also failed transiently during one `npm run test:automated` run with an `ENOENT` on a `zz-scratch-*` file -- this matches the project's documented scratch-file race (a different test's temp-file cleanup racing this census) and did not reproduce on the immediately following clean run. Not caused by this plan; not fixed, per the scope boundary.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`anno_excluded_range` and its three verbs are ready for 46-04/46-05's exporter work to read from and emit a marked block rather than a hole. `BUILD-07` stays "Pending" in REQUIREMENTS.md until 46-04/46-05/46-06 (the exporter side and the planted-control test) also land, per the requirement being shared across plans in this phase.

## Self-Check: PASSED

- All 7 key-files (3 declared + 3 deviation-fixed + this SUMMARY) confirmed present on disk with `[ -f ]`
- `git log --oneline --all --grep="46-03"` returns 5 commits
- Plan-level `<verification>` re-run: `npm run typecheck` exit 0; `node --test anno-store.test.ts anno-types.test.ts anno-seam.test.ts anno-index.test.ts` -> 180 pass / 0 fail; `grep -ac 'SCHEMA_VERSION = 5' anno-types.ts` -> 1; `npm run test:automated` -> exactly the phase's documented 4-name baseline, zero new failures
- All Task 1/2/3 `<acceptance_criteria>` re-checked against the final tree: exactly 3 new exported functions, overlap/differing-reason messages carry mutually-exclusive distinguishing substrings, `listExcludedRanges()` on an empty store returns `[]` via `deepEqual`, no hazard table added, `anno_scope` DDL byte-identical to before this plan

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
