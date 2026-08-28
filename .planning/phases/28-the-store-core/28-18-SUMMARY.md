---
phase: 28-the-store-core
plan: 18
subsystem: testing
tags: [sqlite, node-sqlite, durability, structural-control, planning-records, gap-closure]

requires:
  - phase: 28-the-store-core (28-16)
    provides: CR-08's ordering fix and WR-17's handlers — the byte-length pair and the promoted `retained` definition this gate re-observes
  - phase: 28-the-store-core (28-17)
    provides: WR-13's fsyncs, WR-16's recorded rollbacks, WR-14's real skips — the 167-test recorded actual this plan's expected count is derived from
provides:
  - "The single-commit-site control matches commit STATEMENTS across all three SQLite spellings (`commit`, `end`, `end transaction`), proven by two fixture controls over local strings rather than inferred from a module that happens to contain one spelling"
  - "No user-facing error message in `anno-store.ts` is worded around a structural control in another file — the coupling comment is deleted together with the constraint that created it"
  - "A recorded decision with cited evidence for all six round-4 finding ids (CR-08, WR-13, WR-14, WR-15, WR-16, WR-17), plus an explicit carried-forward row for the one open human-verification item"
  - "STORE-05 returned to `Complete` and STORE-04's recorded reason corrected to CR-08, both transcribed from the round-4 verifier's own verdict"
  - "The round's closing gate as numbers on the final tree: 169/169 at real exit 0, four named controls re-observed individually, four plantings observed red and reverted, and the CR-08 reproduction re-driven as a refusal"
affects: [29-mcp-surface, phase-28-verification, phase-28-code-review]

actuals:
  tokens: 5439
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A structural control over source text matches the STATEMENT it means, not a word that happens to spell it — and proves its own coverage against local fixtures, so an uncovered synonym fails as a coverage assertion rather than as a silently split planting"
    - "A structural invariant may not constrain user-facing prose: when the matcher stopped firing on wording, the comment recording that coupling was deleted with it"
    - "A requirement's status moves only on a verdict already recorded in the phase's `*-VERIFICATION.md`, and the sentence that moves it quotes its source"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/anno-store.ts
    - .planning/phases/28-the-store-core/28-REVIEW.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "`commit` is PROMOTED to its statement reading: the matcher requires an `exec()` call whose single argument is a bare statement literal, which is what SQLite executes and what the durability planting removes"
  - "The `step: \"committing the write transaction\"` VALUE is left unchanged while its coupling comment is deleted — changing the value would be a gratuitous behaviour change in a round whose whole discipline is not to"
  - "Task 3 added no code: both of task 1's fixture controls were already present, so the conditional addition its action text allows was not triggered and its deliverable is measured evidence only"
  - "The step 3b planting reddens ONE test on the final tree, not two, and that is 28-16's own recorded re-observation rather than a shortfall"

patterns-established:
  - "Pattern 1: one matcher helper shared by the assertion and by both fixture controls, so the coverage the fixtures prove is the coverage the assertion gets"
  - "Pattern 2: a disposition cell that cannot quote a number or line reference from its plan's SUMMARY reads `accept`, never `fix`"

requirements-completed: [STORE-04, STORE-05]

coverage:
  - id: D1
    description: "The single-commit-site control counts commit STATEMENTS in all three SQLite spellings, so a second commit site cannot hide behind a synonym"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam contains exactly one commit statement, so the single planted-violation site is unique"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the commit-statement matcher counts all three of SQLite's spellings, so a synonym cannot hide a second commit site"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the commit-statement matcher counts neither commit-ish identifiers nor user-facing prose about a commit"
        status: pass
      - kind: other
        ref: "planted `db.exec(\"end\")` second commit site: pre-task matcher `ok 15` / 17 pass; statement matcher `not ok 15 … found 2`"
        status: pass
    human_judgment: false
  - id: D2
    description: "No user-facing error message is coupled to a structural control in a different file — the `step` spelling's load-bearing comment is deleted with its constraint"
    requirement: "STORE-04"
    verification:
      - kind: other
        ref: "grep -c 'load-bearing' src/mcp/vice/anno-store.ts == 4 (was 5); grep -c 'step: \"committing the write transaction\"' == 1 (unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All six round-4 finding ids carry a recorded decision with cited evidence, and the one open human-verification item is carried forward as open"
    verification:
      - kind: other
        ref: "grep -c '^| CR-08 \\|^| WR-13 \\|^| WR-14 \\|^| WR-15 \\|^| WR-16 \\|^| WR-17 ' .planning/phases/28-the-store-core/28-REVIEW.md == 6; 'Round-4 finding dispositions' == 1; 'Round-3 finding dispositions' == 1; 'anno-store.ts:432' present"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/docs-review-disposition.test.ts (7/7) and src/mcp/vice/audit-integrity.test.ts (44/44), before and after"
        status: pass
    human_judgment: false
  - id: D4
    description: "STORE-05 reads `Complete` and STORE-04's recorded reason names CR-08, both transcribed from 28-VERIFICATION.md with provenance quoted"
    requirement: "STORE-05"
    verification:
      - kind: other
        ref: "grep '| STORE-05 | Phase 28 |' == Complete; '| STORE-04 | Phase 28 |' == Gaps Found; '- [x] **STORE-05**' == 1; '- [ ] **STORE-04**' == 1; 'CR-08' count 0 -> 1; git diff --stat confined to 3 regions"
        status: pass
    human_judgment: false
  - id: D5
    description: "The round's claims re-established as numbers on the final tree: the anno surface green at a real exit code, the four named controls re-observed individually, four plantings red and reverted, the CR-08 reproduction re-driven as a refusal"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "node --test anno-*.test.ts block-class.test.ts -> # tests 169 / # pass 169 / # fail 0 / # skipped 0, REAL_EXIT=0"
        status: pass
      - kind: other
        ref: "CR-08 reproduction through production entry points: byte pair 69632 -> 69632, AnnoStoreError instanceof ViceError true, handle answers currentRevision() 3, later openStore succeeds, retainedRevisions [0,1,2] -> [0,2]"
        status: pass
      - kind: other
        ref: "criterion 4's planted red: `not ok 1`, `not ok 2`, `not ok 3`, `not ok 5` in anno-durability.test.ts with THE commit removed; restored to 5/5 with an empty git diff --stat"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p src/mcp/vice/tsconfig.json exit 0, no output"
        status: pass
    human_judgment: false
  - id: D6
    description: "`openStore`'s `integrity_check could not be run at all` arm (anno-store.ts:432) remains an OPEN human-verification item, carried forward rather than closed"
    verification: []
    human_judgment: true
    rationale: "The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection; presence and wiring are verified in source and no test exercises it. No plan in round 4 constructs that input and none claims to. Recorded as an explicit OPEN row so it cannot be lost by absence."

duration: 30 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 18: WR-15, the round-4 record, and the closing gate Summary

**The single-commit-site control now matches commit STATEMENTS across all three SQLite spellings instead of counting the word `commit` — closing a defect that let a working `db.exec("end")` pass the control unchanged — all six round-4 findings carry a recorded decision with cited evidence, STORE-05 returns to `Complete` on the verifier's own verdict, and the round closes on 169/169 at real exit 0 with the CR-08 reproduction re-driven as `69632 -> 69632`.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-28T16:44Z (approx., first task read)
- **Completed:** 2026-08-28T17:15Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **WR-15 closed, with the defect observed rather than argued.** With a second, fully working commit site spelled `db.exec("end")` planted in `anno-store.ts`, the pre-task word-count matcher reported `ok 15 - the seam contains exactly one commit statement…` and the file passed **17/17**. The statement matcher reports `not ok 15 … found 2`. Half a durability planting could have survived a green run.
- **The mirror cost removed with the defect.** `anno-store.ts`'s comment recording the `step` value's spelling as load-bearing is deleted together with the constraint. `grep -c "load-bearing"` went `5 -> 4`; the value itself is untouched (`grep -c 'step: "committing the write transaction"'` = `1`).
- **Six dispositions on the record**, each naming its plan and quoting a number or line reference from that plan's SUMMARY, plus an explicit carried-forward row for `anno-store.ts:432`.
- **Two record corrections**, both transcribed from 28-VERIFICATION.md with the verifier's own sentence quoted, and nothing else in REQUIREMENTS.md moved.
- **The closing gate**, in 28-15's style: individually re-observed controls, four plantings red and reverted, and the CR-08 reproduction turned from a destruction into a refusal.

## Task Commits

1. **Task 1 (TDD RED): failing fixture controls for the commit-statement matcher** — `ccd80bd` (test)
2. **Task 1 (TDD GREEN): count commit STATEMENTS, not the word, and uncouple error prose** — `3dde942` (feat). No REFACTOR commit: the GREEN shape is one regex in one shared helper, and there was nothing to clean up that would not have been churn.
3. **Task 2: disposition all six round-4 findings and correct two records** — `430fe41` (docs)
4. **Task 3: the closing gate** — no code commit. Both of task 1's fixture controls were already present, so the conditional addition its action text allows was not triggered; its deliverable is the measured evidence below, carried in this SUMMARY's commit.

**Plan metadata:** see the `docs(28-18)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/anno-seam.test.ts` — one shared `commitStatements()` helper matching `exec()` calls with a bare statement literal in any of the three spellings; the seam assertion's comment rewritten to the new mechanism and naming the synonym fact as the defect closed; two new fixture controls over local string constants. +88/-8 lines.
- `src/mcp/vice/anno-store.ts` — the coupling comment recording the `step` spelling as load-bearing deleted, replaced by one sentence recording that the constraint was removed and that the wording is now free. No logic change. +8/-6 lines.
- `.planning/phases/28-the-store-core/28-REVIEW.md` — a `### Round-4 finding dispositions` table beside the round-3 one: six id rows plus one carried-forward row.
- `.planning/REQUIREMENTS.md` — STORE-05 `Gaps Found -> Complete` in the status table and `- [ ] -> - [x]` in the checklist; the round-3 record note replaced by a three-paragraph round-4 note naming CR-08 as STORE-04's real blocker.

---

# The closing gate — numbers re-observed on the final tree

## The whole anno surface, as uid 1000

```
$ cd src/mcp/vice && node --test anno-*.test.ts block-class.test.ts
1..169
# tests 169
# suites 0
# pass 169
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12575.874405
REAL_EXIT=0
```

**The count, derived and not asserted flat.** The authority is the recorded actual, not the plan's arithmetic: 28-17-SUMMARY.md records **167** for `anno-*.test.ts block-class.test.ts`, and this plan adds 2 tests, so the derived expectation is **169**. The observed count is **169**. Derived and observed agree, and both agree with the planned sum (159 + 6 + 2 + 2 = 169), so there is no discrepancy to explain and no test-name list to reconcile. The unconditional clause — strictly greater than the round-4 baseline of 159 — holds by 10.

`anno-seam.test.ts` alone went **17 -> 19** (exactly task 1's two new tests). `anno-store.test.ts` alone is **73**, unchanged from 28-17.

## Typecheck

```
$ cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json
TSC_EXIT=0
```

No output.

## 28-15's four named non-vacuity controls, re-run individually and quoted verbatim

**1. The split-orientation control and its collapse planting** (`anno-types.test.ts`):

```
ok 4 - criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets
ok 5 - the collapse planting, observed: a single-orientation implementation makes the control's OWN comparison report the two readings as identical
```

**2. The exhaustive index cross-validation with its `comparisons` non-vacuity assertion** (`anno-index.test.ts`; the `comparisons` assertion is folded into `ok 1` at `:216-235`, `expected 65536 comparisons, performed ${comparisons}`):

```
ok 1 - the paint index and an independently written linear scan agree at every one of the 65,536 addresses
ok 2 - the fixture is non-degenerate on the narrowest-wins axis: some address is covered by ranges of DIFFERENT lengths
ok 3 - the fixture is non-degenerate on the tie-break axis: some address is covered by two ranges of EQUAL length
```

**3. The fully-contained overlap case and its `filter()`-and-insert planting** (`anno-overlap.test.ts`):

```
ok 3 - overlap case 2 (new fully CONTAINS existing, c <= a && d >= b): both invariants hold
ok 7 - case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field
ok 8 - planting A, OBSERVED and SELECTIVE: filter-and-insert loses bytes in exactly the three cases that have a head or a tail, and is indistinguishable from the real path in the other two
```

**4. The no-splitter structural scan and its non-vacuity companion** (`anno-overlap.test.ts:487` and `anno-store.test.ts:1749`):

```
ok 12 - adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code
ok 42 - STORE-02 non-vacuity: the code this gap closure adds is inside the source the no-splitter structural scan reads
```

## This round's three plantings, re-observed red on the final tree and reverted

### 28-16's step 3b planted red

Deleting step 3b's staged-image validation `try`/`catch` by hand (611 characters):

```
not ok 68 - CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still answers, and a later openStore succeeds
# tests 73
# pass 72
# fail 1
```

The foreign-bytes sibling stayed `ok 69`. **That is 28-16's own recorded re-observation on its own final tree, not a shortfall of this gate**: 28-16-SUMMARY.md §"The step 3b planted-violation red" records that after its task 2 the step-2 gate refuses the same inputs one step earlier, so the behavioural half of the planting is absorbed and only the folded source-order assertion bites — quoted there as `not ok 67 … # fail 1`. After restoring, `git diff --stat -- src/mcp/vice` printed nothing and the file returned to `# tests 73 / # pass 73 / # fail 0`.

### 28-17's fsync planted red

Deleting `fsyncPath(dirname(snapPath))` from `publishSnapshot`:

```
not ok 50 - the publish path's SOURCE ORDER is the durability guarantee (WR-13): stageSnapshot fsyncs after its vacuum, and publishSnapshot fsyncs the ring directory after its rename
# tests 73
# pass 72
# fail 1
```

Restored: `ok 50 - the publish path's SOURCE ORDER is the durability guarantee (WR-13)…`, `git diff --stat -- src/mcp/vice` empty.

### This plan's synonym planting

Adding a second commit site spelled `db.exec("end")` to `anno-store.ts`:

```
not ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
    the seam must contain exactly one commit statement, found 2 -- a second one splits the durability proof's planted violation across two sites and lets half of it survive
    2 !== 1
# tests 19
# pass 18
# fail 1
```

**The contrast that makes WR-15 real.** The identical planting against the PRE-TASK word-count matcher:

```
ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
# tests 17
# pass 17
# fail 0
```

Restored: `ok 15`, `git diff --stat -- src/mcp/vice` empty.

### The fixture numbers, one versus three

| fixture | pre-task word matcher | statement matcher |
|---|---|---|
| all three spellings (`db.exec("commit")`, `db.exec('end')`, `db.exec("END TRANSACTION")`) | **1** (`1 !== 3`) | **3** |
| identifiers + prose (`commitTransaction`, `applyWriteWithoutCommit`, `doCommit`, `step: "the commit could not be completed"`) | **1** (`1 !== 0`) | **0** |

## Criterion 4's planted red, re-observed on the final tree

With the module's single commit statement replaced by a comment by hand:

```
not ok 1 - STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value
not ok 2 - STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE -- one planting, both halves
not ok 3 - an orphan snapshot file left in the kill window is identified by its revision and does not affect the readback
ok 4 - the mutator is test-only: absent from package.json files[], and its filename does not match the *.test.* glob the runner collects
not ok 5 - CR-06: with a separate OS process holding a READ transaction, the commit REFUSES inside the ViceError family, the revision is unchanged, and the write lock is released
# tests 5
# pass 1
# fail 4
```

The combined test (`not ok 1`) and its planted-violation sibling (`not ok 2`) both report `not ok`, as the criterion requires; two further tests fall out of the same planting. After restoring: `git diff --stat -- src/mcp/vice` printed nothing and the file returned to `# tests 5 / # pass 5 / # fail 0`.

## The CR-08 reproduction, re-driven on the final tree through production entry points only

Built at revision 3 by three `setDataType` calls; `r1.db` truncated to 0 bytes; `revertTo(handle, 1)`. No hand edit of `anno-store.ts` — a temporary script importing only the module's exports.

```
revision after three writes: 3
rows: 3
retainedRevisions() BEFORE truncation: [0,1,2]
live store byte length BEFORE revertTo: 69632
r1.db byte length after truncation: 0
retainedRevisions() AFTER truncation: [0,2]
live store byte length AFTER revertTo: 69632
byte-length pair: 69632 -> 69632
thrown class: AnnoStoreError
thrown instanceof ViceError: true
same handle currentRevision(): 3
same handle listRanges().length: 3
later openStore: SUCCEEDED, revision 3 rows 3
```

| | round-4 verifier (committed code) | this final tree |
|---|---|---|
| live store across `revertTo(handle, 1)` | `69632 -> 0` | **`69632 -> 69632`** |
| handle after the call | none | **alive**, `currentRevision() === 3`, 3 rows |
| later `openStore` | `AnnoStoreCorruptError`, permanently | **succeeds**, revision 3, 3 rows |
| `retainedRevisions()` before / after the truncation | `[0, 1, 2]` / `[0, 1, 2]` | **`[0, 1, 2]` / `[0, 2]`** |

The refusal names the store path, the snapshot path, `NOTHING has been replaced`, the revision the store is still at (`3`), and `Available revisions: 0, 2`.

## Structural invariants, recorded individually

| invariant | observation |
|---|---|
| `node:sqlite` reachable from exactly one shipped module | `ok 1 - node:sqlite is named by exactly one module of the shipped module set (STORE-07)` |
| exactly one commit statement in `anno-store.ts` **under the new statement matcher** | `ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique` |
| `anno-store.ts` and `anno-types.ts` absent from the five-element host-path consumer set | `EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"]` — grep for `anno-store` and `anno-types` in that line both return `0`; `hostpath-consumers.test.ts` 11 pass / 0 fail |
| `SCHEMA_VERSION` still 2 | `anno-types.ts:154: export const SCHEMA_VERSION = 2;` |
| `anno_snapshot` still one column | `create table anno_snapshot ( revision integer primary key );` — parsed column count **1** |
| no test in the round's diff asserts stderr is empty | `git diff 9107d5d..HEAD -- 'src/mcp/vice/*.test.ts' \| grep -iE '^\+.*stderr'` → no output |

## Both docs guards — a recorded NON-REGRESSION, not a repair

| guard | before task 2 | after task 2 | final tree |
|---|---|---|---|
| `docs-review-disposition.test.ts` | `# tests 7 / # pass 7 / # fail 0` | `# tests 7 / # pass 7 / # fail 0` | `# pass 7 / # fail 0` |
| `audit-integrity.test.ts` | `# tests 44 / # pass 44 / # fail 0` | `# tests 44 / # pass 44 / # fail 0` | `# pass 44 / # fail 0` |

**Stated plainly: both guards were green BEFORE this round as well.** 28-VERIFICATION.md states they are RED on the current tree for the six round-4 ids; that statement is wrong, and this plan's objective records the correction. `docs-review-disposition.test.ts` recognises a phase's own `*-VERIFICATION.md` as disposition source 2 of five (named in its own header comment at `:24-33`), so writing the round-4 report is itself what made the six ids dispositioned. No task in this plan was premised on a red guard and no acceptance criterion took a red-to-green form; both appear only as regression criteria over the file task 2 edits.

## Executor self-assertions

These are self-assertions rather than a human checkpoint because this plan is `autonomous: true` and the phase's `human_verify_mode` is `end-of-phase` — the round's human gate sits at the phase boundary.

1. **Criterion 4's planted red WAS re-observed on the final tree and reverted.** Evidence: the `not ok 1` / `not ok 2` lines quoted above with `# pass 1 / # fail 4`; after restore `git diff --stat -- src/mcp/vice` printed nothing and `anno-durability.test.ts` returned `# tests 5 / # pass 5 / # fail 0`.
2. **The CR-08 reproduction WAS re-driven on the final tree through production entry points and is now a refusal.** Evidence: the byte-length pair **`69632 -> 69632`** (round 4 recorded `69632 -> 0`), an `AnnoStoreError` with `instanceof ViceError === true`, the caller's handle still answering `currentRevision() === 3` with 3 rows, and a later `openStore` succeeding. No hand edit of `anno-store.ts`; the temporary script was deleted and `git status --porcelain -- src/mcp/vice` is clean.
3. **The `pragma integrity_check` throw arm remains an OPEN human-verification item, was NOT claimed closed by this round, and the reason is unchanged.** `openStore`'s `integrity_check could not be run at all` arm at `anno-store.ts:432` is defensive and has no reachable input without filesystem- or SQLite-level fault injection, so its presence and wiring are verified in source and no test exercises it. It is recorded as an explicit carried-forward row in `28-REVIEW.md`'s round-4 disposition table and referenced in `.planning/REQUIREMENTS.md`'s round-4 note. No plan in round 4 constructs that input.

**Deliberately NOT done here**, per the plan: the full-glob suite was not run (it outlives the tool timeout and carries an unrelated failure baseline); `.planning/STATE.md` and `.planning/ROADMAP.md` were not touched by any task; and the deliberately accepted UNDER-CLAIM residual was not re-verified — it is recorded as accepted and this round did not touch it.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is that `commit` is promoted to its statement reading rather than forked: one `commitStatements()` helper serves the seam assertion and both fixture controls, so the coverage the fixtures prove is exactly the coverage the assertion gets. The alternative — a second, "stricter" matcher used only by the fixtures — would have let the two drift, which is the same class of defect WR-15 is.

## Deviations from Plan

### Auto-fixed / recorded divergences

**1. [Observation, not a fix] The step 3b planting reddens ONE test on the final tree, not the two the plan's action text names**

- **Found during:** Task 3 (the closing gate)
- **Issue:** The plan says to "record the truncated-image and foreign-bytes tests reporting `not ok`". With step 3b's validation block deleted, only `not ok 68` (truncated image) reddened; the foreign-bytes sibling stayed `ok 69`.
- **Resolution:** No fix, because nothing is broken. 28-16-SUMMARY.md §"The step 3b planted-violation red" already records exactly this on its own final tree (`not ok 67 … # fail 1`) and explains the mechanism: after its task 2, step 2's `snapshotOpenFailure` gate refuses foreign bytes one step earlier, so the behavioural half of the planting is absorbed and only the folded source-order assertion bites. Recorded rather than worked around, and the citation is quoted in the gate section above.
- **Files modified:** none
- **Verification:** the planting was driven, quoted, and reverted with an empty `git diff --stat -- src/mcp/vice`; the restored file is `# tests 73 / # pass 73 / # fail 0`.

**2. [Plan-conditional not triggered] Task 3 produced no code change**

- **Found during:** Task 3
- **Issue:** Task 3's action text allows one addition to `anno-seam.test.ts` "if, and only if, the seam file is missing one of task 1's two fixture controls".
- **Resolution:** Both controls were present (`ok 16`, `ok 17`), so the conditional did not fire. Task 3 therefore has no code commit; its deliverable is the measured evidence in this SUMMARY, committed with it.
- **Files modified:** none

---

**Total deviations:** 2 recorded (1 observation reconciled against an upstream SUMMARY's own record, 1 plan-conditional that did not fire). Neither is a scope change, and no production logic was altered by this plan beyond a deleted comment.
**Impact on plan:** none. Every acceptance criterion of all three tasks passed as written.

## Issues Encountered

None. The one thing worth flagging for the next reader is documentary rather than technical: **28-VERIFICATION.md's closing paragraph asserts that `docs-review-disposition.test.ts` and its `audit-integrity.test.ts` cascade are RED for the six round-4 ids, and they are not** — both were 7/7 and 44/44 before this plan began, because writing the verification report is itself what dispositioned those ids under source 2 of the guard's five. The plan's objective records the correction; this SUMMARY records the four measured runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Round 4 of gap closure is **executed**, not verified. 28-16 closed CR-08 and WR-17; 28-17 closed WR-13, WR-16 and WR-14; this plan closed WR-15 and put all six on the record. The phase's next steps are the orchestrator's code-review gate, the regression gate and the phase verifier.
- **Open going into verification:** `STORE-04` still reads `Gaps Found` with `CR-08` as its recorded reason — the row moves only when a verification pass says so, and this plan deliberately did not move it. `anno-store.ts:432`'s `integrity_check` throw arm is still an open human-verification item. Round-3's still-open warnings (WR-03, WR-05..WR-11, IN-01..IN-05, IN-05 half-closed) are untouched by this round and their round-3 dispositions stand.
- No blockers for Phase 29's MCP surface work from this plan.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

All four modified files exist on disk (`.planning/phases/28-the-store-core/28-18-SUMMARY.md`,
`.planning/phases/28-the-store-core/28-REVIEW.md`, `.planning/REQUIREMENTS.md`,
`src/mcp/vice/anno-seam.test.ts`, `src/mcp/vice/anno-store.ts`) and all four commits are
reachable in `git log --all`: `ccd80bd` (test, RED), `3dde942` (feat, GREEN), `430fe41`
(docs, the record), `a0774a7` (docs, the closing gate + this SUMMARY). Every acceptance
criterion of all three tasks was executed and its output quoted above. `git status
--porcelain -- src/mcp/vice` is clean, and no task touched `.planning/STATE.md` or
`.planning/ROADMAP.md`.

**Requirement status note.** `requirements.mark-complete` was deliberately NOT invoked for
this plan's `requirements: [STORE-04, STORE-05]`. STORE-05 was set to `Complete` by hand in
task 2, transcribing the round-4 verifier's own verdict with its provenance quoted; STORE-04
must STAY `Gaps Found` per the same verifier and per this plan's own prohibition against
moving a requirement's status on an executor's judgement of its own work. The SDK verb marks
every declared id `Complete` indiscriminately, which would have flipped STORE-04 against the
verifier's recorded verdict.
