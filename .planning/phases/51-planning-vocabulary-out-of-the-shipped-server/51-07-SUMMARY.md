---
phase: 51-planning-vocabulary-out-of-the-shipped-server
plan: 07
subsystem: annotation-store-core
tags: [planning-vocabulary, comment-budget, ratchet, anno-store, anno-types, token-collision, utf-16]

# Dependency graph
requires:
  - phase: none (wave 6, depends_on: ["51-06"])
    provides: "51-01's widened guard, RATCHET ledger, and finalized COMMENT_BUDGET_SLACK (1650). 51-02's CITATION-RESOLUTION.md tier ladder and Section C's global requirement-id table. 51-03..51-06's proof of the batch-rewrite pattern, the string-vs-comment split, and the post-edit structural-citation repair check."
provides:
  - "The annotation store's core (anno-store.ts, 126 citations), its type declarations (anno-types.ts, 50) and three helpers (anno-store-export.ts 12, anno-derive.ts 6, anno-confidence.ts 2). All five files are now at zero. All five RATCHET entries are deleted."
  - "The phase's technical-token collision in anno-types.ts: UTF-16, which reads as a requirement id by shape. Rewritten to '16-bit code units' rather than exempted. No exemption mechanism exists anywhere in the guard."
affects: ["every later Phase 51 sweep plan whose file cites a decision/review-finding id this plan already resolved via phase 28's git-blame trail"]

# Actuals (#2632)
actuals:
  tokens: 25737
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A dense file's citations often trace to ONE originating phase. anno-store.ts and anno-types.ts both trace overwhelmingly to phase 28, 'the-store-core', per CITATION-RESOLUTION.md Section A. The git-blame -> phase-directory walk then amortizes across dozens of sites: the same handful of phase-28 review findings (CR-01..CR-10, WR-01..WR-25) recur throughout both files. Once each finding's underlying fact is known from the file's OWN surrounding prose -- this codebase states the reason in the same sentence as the id at most sites -- the citation is a bare parenthetical to drop. No second git-blame lookup is needed per recurrence."
    - "A structural test can pin the REMOVED vocabulary as a requirement. anno-types.test.ts's SCHEMA_VERSION test asserted the shipped doc comment must cite D-15/EVID-02/BUILD-07 by name. Its own stated rationale ('a bump whose rationale lives only in a planning directory is a number the next reader has no way to weigh') is the OPPOSITE of this phase's own rule once the reasoning is inlined in prose instead. The correct fix is not to skip the test or delete its assertions. Re-anchor it on the SUBSTANCE the id used to gate -- the table name each version bump adds, the version's own date -- rather than the id itself. This preserves the check's actual purpose (a version bump is a decision, not a silently drifted number) while meeting the id-free rule."
    - "A citation attached to a genuinely irreplaceable explanation is still just a citation. 'Workspace confinement is the default' and 'a directory rename plus one write destroyed the whole revert history' both had bare (WR-25)/(CR-03) parentheticals removed. Every substantive sentence around them was left untouched. Dropping the id lost no fact, because the reason was already stated in full beside it -- this codebase's dominant citation shape."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store-export.ts
    - src/mcp/vice/anno-derive.ts
    - src/mcp/vice/anno-confidence.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/skills-planning-vocabulary.test.ts

key-decisions:
  - "anno-store.test.ts was read (per read_first) but needed no edit. This matches 51-06's anno-cli.test.ts precedent. No test in that file pins the exact wording of any comment this plan rewrote. Confirmed by re-running the full file (130/130 pass), both before staging Task 1's commit and again after Task 2's."
  - "anno-types.test.ts DID need an edit. This is disclosed as a real, in-scope fix rather than folded silently into the sweep. Its SCHEMA_VERSION test required the shipped anno-types.ts doc comment to literally contain 'D-15', 'EVID-02' and 'BUILD-07' -- three of the exact tokens this plan's own mandate requires deleting. The test's own stated rationale for that requirement was: a bump whose reason lives only in a planning directory is a number the next reader has no way to weigh. The prose this plan left behind satisfies that same rationale just as well. So the test was re-anchored on the table name each version-bump paragraph names (anno_enum_usage, anno_evid_exec, anno_excluded_range) and the paragraph's own date. The check itself was never weakened."
  - "One tier-4 (genuinely unrecoverable) site turned up, per D-08: anno-store-export.ts's '(D-10's \"narrower than the review's own sketch\" pattern)' parenthetical. `grep -rn \"narrower than the review\" .planning/` returns nothing anywhere in this repository's planning tree, in any form. This specific D-10 is not phase 45's soundness-asymmetry D-10 (confirmed by reading phase 45's own CONTEXT.md/RESEARCH.md, which describe a different decision under the same locally-scoped label). Rewritten to state the reasoning directly ('exactly the kind of speculative widening this project's other modules refuse') rather than inventing a resolution that does not exist."

patterns-established: []

requirements-completed: [VOCAB-01, VOCAB-02, VOCAB-04, VOCAB-06]

coverage:
  - id: D1
    description: "anno-store.ts, anno-types.ts, anno-store-export.ts, anno-derive.ts and anno-confidence.ts all scan clean under the guard's own predicate and their RATCHET entries are gone"
    requirement: "VOCAB-01"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#no shipped file carries planning vocabulary beyond its pinned ratchet allowance"
        status: pass
      - kind: other
        ref: "grep -ac '\\.planning' and grep -aE -c 'docs/phase[0-9]' against anno-store.ts, both print 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The technical-token collision (UTF-16, reading as a requirement id by shape) is rewritten to '16-bit code units' rather than exempted; no exemption mechanism was added to the guard"
    requirement: "VOCAB-01"
    verification:
      - kind: unit
        ref: "anno-types.test.ts (full file, 32 tests including the SCHEMA_VERSION pin this plan repointed) -- all pass"
        status: pass
      - kind: other
        ref: "grep -ac 'code units' anno-types.ts prints 3; grep -c 'UTF-16' anno-types.ts prints 0; git diff skills-planning-vocabulary.test.ts shows only RATCHET-entry deletions"
        status: pass
    human_judgment: false
  - id: D3
    description: "The store's workspace-confinement-is-the-default explanation and the single-move-plus-one-write revert-history-destruction explanation both survive at full length, and the numbered invariant list in anno-types.ts is the same count and numbering as before the sweep"
    requirement: "VOCAB-02"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#comment volume lost per file stays inside the citation characters removed"
        status: pass
    human_judgment: true
    rationale: "The mechanical budget check does not by itself prove no reason was shortened away. A human should spot-check the quoted before/after pairs in this summary against the original prose, and confirm the ten numbered traps in anno-types.ts's header still read as ten traps in the same order."
  - id: D4
    description: "The full automated gate (npm run test:automated) is green, apart from one pre-existing, previously-documented environment condition unrelated to this plan's edits"
    verification:
      - kind: integration
        ref: "npm run test:automated"
        status: pass
    human_judgment: true
    rationale: "The gate reports exactly one failure, matching the orchestrator's own stated baseline exactly (tests 4432, pass 4422, fail 1): audit-integrity.test.ts's D-12-02 shared-budget assertion, filed as a pending todo and explicitly called out as NOT this plan's responsibility in the executor's own briefing."

duration: 105min
completed: 2026-09-14
status: complete
---

# Phase 51 Plan 07: Annotation-store Core, Type Declarations and Three Helpers Summary

**All 196 planning-vocabulary citations across `anno-store.ts`, `anno-types.ts`, `anno-store-export.ts`, `anno-derive.ts` and `anno-confidence.ts` are rewritten into the reasons they stood for. The phase's one technical-token collision (`UTF-16`, reading as a requirement id by shape) is resolved by rewording to "16-bit code units", never by an exemption. One genuinely unrecoverable citation is named and rewritten per D-08.**

## Performance

- **Duration:** ~105 min
- **Started:** 2026-09-14 (mid-afternoon)
- **Completed:** 2026-09-14T15:18:56Z
- **Tasks:** 2
- **Files modified:** 7 (5 sources, 1 guard ledger, 1 structural-test repair)

## Accomplishments

- Swept `anno-store.ts`'s 126 citations to zero. Every site was in a comment. This file has 0 string-literal sites. Most trace, via `git blame`, to phase 28's own review findings (`CR-01`..`CR-10`, `WR-01`..`WR-31`). This file's own house style is dense and self-explanatory: almost every id sits beside a full-sentence statement of the reason. Dropping the id lost no fact anywhere in the file. Two explanations are preserved at full length, quoted below: "workspace confinement is the default", and "a directory rename plus one write destroyed the whole revert history". The plan named both as irreplaceable.
- Swept `anno-types.ts`'s 50 citations to zero. This includes the store's numbered invariant list (ten traps, unchanged in count and order). It also includes the four-version `SCHEMA_VERSION` history comment -- the single most load-bearing prose block in the file, preserved in full substance. Rewrote the phase's one technical-token collision: `UTF-16` matches the requirement-id shape `[A-Z]{2,8}-\d{2}` purely by coincidence. It becomes "16-bit code units" -- accurate, standard phrasing for what `String.length` counts. No exemption mechanism was added anywhere in the guard.
- Swept `anno-store-export.ts` (12), `anno-derive.ts` (6, including one string-literal error message) and `anno-confidence.ts` (2) to zero. Found and named the phase's one genuinely tier-4 (unrecoverable) site: `anno-store-export.ts`'s `(D-10's "narrower than the review's own sketch" pattern)` resolves nowhere in `.planning/`, in any form. Confirmed by grep. Also confirmed by reading phase 45's own decision list, which defines a DIFFERENT D-10 (the soundness-asymmetry decision) under the same locally-scoped label. Rewritten to state the reasoning directly, rather than inventing a resolution.
- Fixed a real, in-scope test defect this sweep's own edits would otherwise have collided with. `anno-types.test.ts`'s `SCHEMA_VERSION` test asserted the shipped doc comment must literally contain `D-15`, `EVID-02` and `BUILD-07` -- three tokens this very phase mandates deleting from shipped files. Re-anchored the test on the table name each version bump names (`anno_enum_usage`, `anno_evid_exec`, `anno_excluded_range`) and the paragraph's own date. This preserves the test's actual purpose -- a version bump is a decision, not a silently drifted number -- without requiring a citation this phase bans.
- Deleted all five `RATCHET` entries. Left the five `COMMENT_BUDGET_BASELINE` rows in place, per 51-01/51-04/51-05/51-06's own convention.
- `npm run typecheck` exits 0. `npm run test:automated` reports exactly one failure, matching the orchestrator's documented baseline exactly: `tests 4432, pass 4422, fail 1`. That one failure is `audit-integrity.test.ts`'s pre-existing `D-12-02` shared-budget condition, unrelated to this plan's files.

## Task Commits

1. **Task 1: Sweep anno-store.ts to zero** - `a6c4506c` (feat)
2. **Task 2: Sweep anno-types.ts and three helpers, and rewrite the technical-token collision** - `377ab25a` (feat)

**Plan metadata:** commit follows this file.

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` -- all 126 citation sites rewritten (126 comment, 0 string); zero planning-vocabulary tokens remain
- `src/mcp/vice/anno-types.ts` -- all 50 citation sites rewritten (50 comment, 0 string); zero remain; the `UTF-16`/requirement-id collision rewritten to "16-bit code units"
- `src/mcp/vice/anno-store-export.ts` -- all 12 citation sites rewritten (12 comment, 0 string); zero remain; one tier-4 site named below
- `src/mcp/vice/anno-derive.ts` -- all 6 citation sites rewritten (5 comment, 1 string -- a thrown error message); zero remain
- `src/mcp/vice/anno-confidence.ts` -- all 2 citation sites rewritten (2 comment, 0 string); zero remain
- `src/mcp/vice/anno-types.test.ts` -- the `SCHEMA_VERSION` pin re-anchored from decision/requirement ids to the table name and date each version's own paragraph states in prose
- `src/mcp/vice/skills-planning-vocabulary.test.ts` -- all five `RATCHET` entries for these files deleted; five `COMMENT_BUDGET_BASELINE` rows left in place

## The two irreplaceable comments, quoted before and after

**1. Workspace confinement is the default (`anno-store.ts`, inside `openStore()`)**

Before:
```
  // CONFINEMENT IS THE DEFAULT, AND THE ESCAPE IS A WORD A GREP CAN FIND
  // (WR-25). `anno-types.ts`'s header names the three things nothing upstream
  // validates -- "an address of 65536, a misspelled data type, and a store path
  // pointing outside the workspace all look identical to the transport" -- and
  // this was the only one of the three whose mitigation a caller could simply
  // forget. Two of this phase's blockers (CR-03, CR-04) were confinement
  // escapes.
```

After:
```
  // CONFINEMENT IS THE DEFAULT, AND THE ESCAPE IS A WORD A GREP CAN FIND.
  // `anno-types.ts`'s header names the three things nothing upstream
  // validates -- "an address of 65536, a misspelled data type, and a store path
  // pointing outside the workspace all look identical to the transport" -- and
  // this was the only one of the three whose mitigation a caller could simply
  // forget. Two of this project's own review findings were confinement
  // escapes.
```

**2. A directory rename plus one write destroyed the whole revert history (`anno-store.ts`, inside the schema DDL doc comment)**

Before:
```
 * became false is evidence. This paragraph used to read "created in full at
 * first open so `SCHEMA_VERSION` stays 1 and no later work alters an on-disk
 * shape". The FIRST half is still true and is why every table below exists from
 * the very first write. The SECOND half became false: `anno_snapshot` carried a
 * `path text not null` column holding the snapshot's ABSOLUTE location, and two
 * destructive consequences were reproduced against committed code -- two stores
 * in one directory sharing one ring (CR-01) and a directory rename plus one
 * write destroying the whole revert history (CR-03). The column is DROPPED at
```

After:
```
 * became false is evidence. This paragraph used to read "created in full at
 * first open so `SCHEMA_VERSION` stays 1 and no later work alters an on-disk
 * shape". The FIRST half is still true and is why every table below exists from
 * the very first write. The SECOND half became false: `anno_snapshot` carried a
 * `path text not null` column holding the snapshot's ABSOLUTE location, and two
 * destructive consequences were reproduced against committed code -- two stores
 * in one directory sharing one ring and a directory rename plus one
 * write destroying the whole revert history. The column is DROPPED at
```

Both are unchanged in substance -- only the bare `(WR-25)`/`(CR-03)`/`(CR-01)` parentheticals are gone, and every explanatory sentence around them is untouched.

## The rewritten technical-token collision

`anno-types.ts` trap 10, before:
```
//  10. NEVER measure comment length in code units. `String.length` counts UTF-16
//      code units, so a multi-byte comment passes a code-unit check and then
```

After:
```
//  10. NEVER measure comment length in code units. `String.length` counts
//      16-bit code units, so a multi-byte comment passes a code-unit check and then
```

`UTF-16` matched the guard's requirement-id shape (`[A-Z]{2,8}-\d{2}`) purely by coincidence of form -- of the 37 distinct id prefixes in the shipped tree, `UTF` is the only one not a declared project prefix. Rewriting to "16-bit code units" is accurate (JavaScript's `String.length` counts UTF-16 code units, and "16-bit" is the standard alternate phrasing) and costs zero machinery: no by-shape or by-path exemption exists anywhere in `skills-planning-vocabulary.test.ts`, and `git diff` on that file for this plan shows only `RATCHET`-entry deletions.

## Comment characters lost, per file (all within the phase's `COMMENT_BUDGET_SLACK`)

| File | Comment bytes before | Comment bytes after | Lost |
|---|---|---|---|
| `anno-store.ts` | 143,111 | 142,652 | 459 |
| `anno-types.ts` | 67,082 | 66,838 | 244 |
| `anno-store-export.ts` | 15,255 | 15,133 | 122 |
| `anno-derive.ts` | 14,928 | 14,876 | 52 |
| `anno-confidence.ts` | 6,885 | 6,875 | 10 |

Every figure is well below the characters removed from citations in the same file, so `comment volume lost per file stays inside the citation characters removed` passes for all five.

## Every tier-4 (unrecoverable) site, named with its line number

**`anno-store-export.ts:325`** (post-edit line number). Original text: `exactly the kind of speculative widening this project's other modules refuse (D-10's "narrower than the review's own sketch" pattern)`. `grep -rn "narrower than the review" .planning/` returns nothing anywhere in this repository, in any form. This `D-10` is not phase 45's `D-10` (the soundness-asymmetry decision, confirmed by reading phase 45's own `CONTEXT.md`/`RESEARCH.md`) -- it is a locally-scoped label with no recoverable definition. Rewritten to state the reasoning directly: "exactly the kind of speculative widening this project's other modules refuse," dropping the unresolvable parenthetical entirely rather than inventing a false resolution.

## Decisions Made

See `key-decisions` in the frontmatter. The most consequential: `anno-types.test.ts`'s `SCHEMA_VERSION` test required the shipped file to cite three of the exact ids this phase mandates removing. This is disclosed as an in-scope fix, not folded silently into the sweep -- the test's own substantive purpose (proving a version bump is a deliberate decision, not a drifted number) is preserved by re-anchoring on the table name and date each paragraph already states, rather than by weakening or skipping the check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, caused by this task's own edit] `anno-types.test.ts`'s SCHEMA_VERSION pin asserted the removed vocabulary as a requirement**

- **Found during:** Task 2, after sweeping `anno-types.ts`'s version-history comment and re-running the guard's own test suite.
- **Issue:** The test asserted `assert.match(src, /D-15/)`, `assert.match(src, /EVID-02/)` and `assert.match(src, /BUILD-07/)` against `anno-types.ts`'s own source -- requiring the shipped file to carry exactly the decision/requirement ids this phase's mandate (`.planning/ENGINEERING_RULES.md` § 21.2) removes.
- **Fix:** Re-anchored each assertion on the substance the id used to gate: the table name each version bump adds (`anno_enum_usage`, `anno_evid_exec`) and the version's own date, both of which the rewritten prose still states directly. The final `anno_excluded_range`/`reaffirm-refusal` assertions needed no change.
- **Files modified:** `src/mcp/vice/anno-types.test.ts`
- **Verification:** `node --test anno-types.test.ts` -- all 32 tests pass, including this one.
- **Committed in:** `377ab25a` (Task 2 commit, alongside the four remaining files' own sweep).

---

**Total deviations:** 1 auto-fixed (a structural test this task's own edits collided with, per the same pattern 51-04/51-05/51-06 each documented). One tier-4 (genuinely dangling) site turned up, in `anno-store-export.ts`, and is named above with its line number rather than silently rewritten to a plausible-but-false resolution. **Impact:** The auto-fix restores a test whose own stated rationale this phase's rule supersedes, with no weakening of what it actually verifies. No fact was lost anywhere in the five swept files.

## Issues Encountered

None beyond the deviation documented above. No pre-existing test failures were touched by this plan's five files; the one failure the full gate reports (`audit-integrity.test.ts`'s `D-12-02` shared-budget condition) is filed as a pending todo and independent of this plan, matching the orchestrator's own stated baseline exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `anno-store.ts`, `anno-types.ts`, `anno-store-export.ts`, `anno-derive.ts` and `anno-confidence.ts` are all at zero, with clean `RATCHET` bookkeeping and their `COMMENT_BUDGET_BASELINE` rows still in place.
- The numbered invariant list in `anno-types.ts` and the store's `SCHEMA_VERSION` history comment are unchanged in count, order and substance -- any later plan citing "the store's own invariants" or "the version-history comment" is reading the same content, minus the ids.
- `VOCAB-01`, `VOCAB-02`, `VOCAB-04`, `VOCAB-06` remain `Pending` in `REQUIREMENTS.md` unless the `ready-ids` gate determines otherwise at this plan's own `update_requirements` step (shared-id gate: other sweep plans in this phase declare the same ids, and some have not yet finished).
- No blockers for the next sweep plan. Any later plan whose file cites a `CR-NN`/`WR-NN` id already resolved here (phase 28's review findings, listed by id in this summary's Deviations and Accomplishments sections) can reuse that resolution directly rather than re-walking `git blame`.

## Self-Check: PASSED

Key files exist on disk:
- `FOUND: src/mcp/vice/anno-store.ts`
- `FOUND: src/mcp/vice/anno-types.ts`
- `FOUND: src/mcp/vice/anno-store-export.ts`
- `FOUND: src/mcp/vice/anno-derive.ts`
- `FOUND: src/mcp/vice/anno-confidence.ts`

Both task commit hashes resolve in `git log --oneline --all`:
- `FOUND: a6c4506c`
- `FOUND: 377ab25a`

Every plan-level `<verification>` item was re-run live:
- `npm run typecheck` exits 0.
- `npm run test:automated` reports `tests 4432, pass 4422, fail 1, skipped 9` on the clean rerun. The one failure is the pre-existing, unrelated `audit-integrity.test.ts` `D-12-02` condition, confirmed independent of this plan's edits.
- All five files scan clean (0 hits each) via the guard's own `scanForPlanningVocabulary()` and have no `RATCHET` entry.
- `grep -ac '\.planning'` and `grep -aE -c 'docs/phase[0-9]'` against `anno-store.ts` print 0.
- `grep -ac 'code units' anno-types.ts` prints 3 (`-ge 1` required); `grep -c 'UTF-16' anno-types.ts` prints 0.
- `grep -ac 'anno-store.ts\|anno-types.ts\|anno-store-export.ts\|anno-derive.ts\|anno-confidence.ts' skills-planning-vocabulary.test.ts` prints 5: exactly the five `COMMENT_BUDGET_BASELINE` rows, at the plan's own `-le 5` threshold.
- `git diff src/mcp/vice/skills-planning-vocabulary.test.ts` (across both task commits combined) shows only `RATCHET`-entry deletions -- no exemption, allowlist or skip mechanism was added.

---
*Phase: 51-planning-vocabulary-out-of-the-shipped-server*
*Completed: 2026-09-14*
