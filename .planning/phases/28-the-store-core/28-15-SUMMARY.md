---
phase: 28-the-store-core
plan: 15
subsystem: database
tags: [path-confinement, symlink, lstat, error-family, vice-error, gap-closure, regression]

requires:
  - phase: 28-12
    provides: "the `lstat`-based ancestor walk whose ENOENT-only suppression is exactly the regression this plan reverses, and the twelve confinement cases it left untouched"
  - phase: 28-13
    provides: "a `reconcileSnapshotRing` with a structural transaction lifetime — part of the tree this plan's closing gate measures"
  - phase: 28-14
    provides: "a commit that cannot escape the ViceError family — the other half of the tree this plan's closing gate measures"
provides:
  - "a confinement walk in which EVERY stat failure other than ENOENT is a named `AnnoStorePathError` decision rather than an unhandled OS abort (WR-12)"
  - "three confinement cases pinning the regular-file ancestor, the unreadable ancestor and the ANCESTOR symlink cycle at the production entry point as well as at the predicate"
  - "a measured finding the plan expected the other way round: the manual 40-hop bound is structurally UNREACHABLE in ancestor position, because the kernel's own MAXSYMLINKS fires at `lstat` first"
  - "the round's closing gate — 144/144 anno tests at real exit 0, the four named non-vacuity controls re-observed individually, and criterion 4's planted red re-observed and reverted on the final tree"
affects: [29, anno-types, anno-store, confinement, requirements-traceability]

actuals:
  tokens: 3952
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A predicate stays a predicate for the ONE class it is about, and every other outcome becomes a decision: `throwIfNoEntry: false` keeps the absent case a value, the `try` puts everything else in the error family"
    - "A doc claim is made TRUE rather than softened: `realpathOfNearestExisting`'s 'every failure is rethrown' paragraph is left byte-identical and the fourth call site is wrapped to match it"
    - "A test case that contradicts its own plan says so in the case body: case 15 records WHY the ancestor spelling cannot reach the manual hop bound, and pins the leaf spelling beside it as the comparison rather than deleting the expectation"

key-files:
  created: []
  modified:
    - "src/mcp/vice/anno-types.ts"
    - "src/mcp/vice/anno-confinement.test.ts"

key-decisions:
  - "The 40-hop bound is unreachable in ancestor position and case 15 states that as the finding: `lstat` must follow a non-final symlink, so the kernel's MAXSYMLINKS refuses before the manual counter runs once. Both bounds are 40 by construction, so they agree on every input — the constant's own doc comment already predicted this."
  - "Task 3 produced no code change (the count check found 15 cases already), so it has no task commit of its own; its deliverable is the measured evidence below and lands in the SUMMARY commit."
  - "Requirement status was NOT moved from inside task 3 (the plan forbids it); it is moved in the plan's close-out step, on this gate's own evidence, and the shared-ID gate is what decides which IDs are ready."

patterns-established:
  - "Non-vacuity of a new control is measured by reverting ONLY the production file with `git checkout HEAD~1 -- <file>`, running, and restoring — never by `git stash` (shared across worktrees) and never by editing the test to match"
  - "A refusal message names BOTH the entry the walk stopped on and the path the caller asked about, so the three existing wraps and the new fourth are one shape rather than four"

requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-07]

coverage:
  - id: D1
    description: "Every stat failure in the confinement ancestor walk other than ENOENT refuses with `AnnoStorePathError` naming the path, so `realpathOfNearestExisting`'s doc claim is true of every call site (WR-12, 28-07 P3)"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#13. an ancestor that is a REGULAR FILE is refused with AnnoStorePathError at both entry points, and the file is left untouched"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#14. an UNREADABLE ancestor directory is refused with AnnoStorePathError at both entry points"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#15. a symlink cycle in an ANCESTOR position is refused with AnnoStorePathError at both entry points -- and it is the KERNEL's bound, not the manual hop counter, that refuses it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The confinement refusal still DISCRIMINATES after the change — an inside-pointing link, a dangling inside-pointing link, a symlinked root and a not-yet-created store are all still accepted (28-12 P2)"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && node --test anno-confinement.test.ts (15 pass / 0 fail; cases 2, 3, 6, 9, 11 are the discriminating half)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Closing gate: the whole anno surface green with the real exit code captured, the four named non-vacuity controls re-observed individually, criterion 4's planted red re-observed and reverted on the final tree, and the phase's structural invariants unmoved"
    requirement: "STORE-03"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test anno-confinement.test.ts anno-durability.test.ts anno-index.test.ts anno-overlap.test.ts anno-seam.test.ts anno-store.test.ts anno-types.test.ts (144 pass / 0 fail / 0 skipped, REAL_EXIT=0)"
        status: pass
      - kind: integration
        ref: "criterion 4 planted red: commit statement replaced by a comment -> 4 fail / 1 pass; restored -> 5 pass / 0 fail, `git diff --stat -- src/mcp/vice` empty"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p src/mcp/vice/tsconfig.json (exit 0, no output)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`node:sqlite` reachable from exactly one shipped module and the store modules still absent from the closed host-path consumer set (STORE-07)"
    requirement: "STORE-07"
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && node --test hostpath-consumers.test.ts (11 pass / 0 fail; EXPECTED_IMPORTERS is five elements, neither anno-store.ts nor anno-types.ts among them)"
        status: pass
      - kind: other
        ref: "grep -ln 'node:sqlite' src/mcp/vice/*.ts | grep -v '.test.' -> anno-store.ts only"
        status: pass
    human_judgment: false
  - id: D5
    description: "The `pragma integrity_check` THROW path (28-11 WR-04) — still carried as an OPEN human-verification item, unclaimed by this round"
    verification: []
    human_judgment: true
    rationale: "No in-process construction available makes `pragma integrity_check` itself throw; the four corrupt-file tests all reach the non-`ok` branch instead. Carried forward from 28-VERIFICATION.md `human_verification[0]` with its reason unchanged."
  - id: D6
    description: "28-13's prohibition P2 under-claim residual — under a second path spelling `retainedRevisions()` reports `[]` while the first ring's files still exist on disk"
    verification: []
    human_judgment: true
    rationale: "Carried forward OPEN from 28-13, deliberately NOT closed by this plan and deliberately not absorbed into this round's closing report. Closing it needs a ring whose ownership the handle cannot establish; nothing in this plan touched `anno-store.ts`."

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 15: WR-12 and the Round's Closing Gate Summary

**Every stat failure in the confinement ancestor walk other than `ENOENT` is now a named `AnnoStorePathError` decision instead of a bare OS abort — measured at both entry points on the three ordinary inputs 28-12 regressed — and the round closes with 144/144 anno tests at real exit 0, the four non-vacuity controls re-observed one at a time, and criterion 4's planted red re-run against the final tree.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-28T11:51:34Z
- **Completed:** 2026-08-28T11:59:40Z
- **Tasks:** 3 of 3
- **Files modified:** 2

## Accomplishments

- **WR-12 closed at the cause.** `pathEntryExists` takes the confined path as a second parameter and wraps its `lstatSync` call. `throwIfNoEntry: false` suppresses `ENOENT` and nothing else, so three ordinary caller inputs had regressed from a named refusal to a bare `Error` escaping the `ViceError` family entirely. All three are now decisions.
- **The doc claim was made true rather than softened.** `realpathOfNearestExisting`'s paragraph — "Every `realpathSync`, `lstatSync` and `readlinkSync` failure is rethrown as `AnnoStorePathError` naming the path" — is left byte-identical, and is now true of every executable call site in the module (four: the wrapped predicate, the dangling-link probe, the `readlinkSync` hop, and the `realpathSync` resolve). This closes the 28-07 P3 comment violation round 3 recorded at `anno-types.ts:830-833`.
- **Three cases pinned at the production entry point.** Cases 13, 14 and 15 each drive BOTH `storePathWithinWorkspace` and `openStore`, which is the verifier's stated reason for calling the previous state coincidental reliance. Each asserts `AnnoStorePathError`, `instanceof ViceError`, and that the message names the caller's own path.
- **A finding the plan expected the other way round.** The manual 40-hop bound is structurally unreachable in ancestor position. Case 15 says so, in the case body, with both routes pinned side by side.
- **The round's closing gate is numbers, not adjectives.** 144 pass / 0 fail / 0 skipped, real exit code 0 (round-3 baseline 135; the previous measured figure for this seven-file set was 141, and this round added exactly 3).

## Task Commits

1. **Task 1: WR-12 — every stat failure other than ENOENT becomes `AnnoStorePathError` naming the path** — `4dc258d` (fix)
2. **Task 2: the three confinement cases the twelve-case file has never planted** — `25e15f4` (test)
3. **Task 3: the closing gate** — no code change was required (the count check found 15 cases already present), so this task has no commit of its own; its deliverable is the measured evidence in this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `pathEntryExists(p, resolved)` gains the confined path and a `try` that wraps every non-`ENOENT` stat failure in `AnnoStorePathError`; its doc comment records the WR-12 reversal; the one call site inside the walk passes `resolved`. Nothing else in the file changed (`36 insertions(+), 5 deletions(-)`, three hunks).
- `src/mcp/vice/anno-confinement.test.ts` — three new cases (13, 14, 15) appended, plus two import lines. Three diff hunks total: the `node:fs` import line, one added `ViceError` import, and the append after case 12.

## The measured evidence

### 1. WR-12, before and after, at both entry points

Measured on this host (Node 22.22) by driving the production export and `openStore` directly. **Before** (pre-task tree, `49826f9`):

```
A predicate (ENOTDIR): threw Error | inViceFamily=false | ENOTDIR: not a directory, lstat '/tmp/wr12-mxDld5/wsA/notes.txt/p.annostore'
A openStore   (ENOTDIR): threw Error | inViceFamily=false | ENOTDIR: not a directory, lstat '/tmp/wr12-mxDld5/wsA/notes.txt/p.annostore'
B predicate (EACCES): threw Error | inViceFamily=false | EACCES: permission denied, lstat '/tmp/wr12-mxDld5/wsB/locked/p.annostore'
B openStore   (EACCES): threw Error | inViceFamily=false | EACCES: permission denied, lstat '/tmp/wr12-mxDld5/wsB/locked/p.annostore'
C predicate (ancestor ELOOP): threw Error | inViceFamily=false | ELOOP: too many symbolic links encountered, lstat '/tmp/wr12-mxDld5/wsC/a/sub/p.annostore'
C openStore   (ancestor ELOOP): threw Error | inViceFamily=false | ELOOP: too many symbolic links encountered, lstat '/tmp/wr12-mxDld5/wsC/a/sub/p.annostore'
```

**After** (task 1), same probe, same host:

```
A predicate (ENOTDIR): threw AnnoStorePathError | inViceFamily=true | cannot stat "…/wsA/notes.txt/p.annostore" while confining "…/wsA/notes.txt/p.annostore" (E…
A openStore   (ENOTDIR): threw AnnoStorePathError | inViceFamily=true | …
B predicate (EACCES): threw AnnoStorePathError | inViceFamily=true | …
B openStore   (EACCES): threw AnnoStorePathError | inViceFamily=true | …
C predicate (ancestor ELOOP): threw AnnoStorePathError | inViceFamily=true | …
C openStore   (ancestor ELOOP): threw AnnoStorePathError | inViceFamily=true | …
```

Six of six in-family, both entry points, all three classes. This is truth 12's clause (c) — "`ENOTDIR`, `EACCES` and an ANCESTOR `ELOOP` all escape `openStore` as bare `Error`s from `anno-types.ts`" — closed by measurement.

### 2. The three new cases DISCRIMINATE

Non-vacuity measured by reverting only the production file (`git checkout HEAD~1 -- src/mcp/vice/anno-types.ts`), running, and restoring:

```
not ok 13 - 13. an ancestor that is a REGULAR FILE is refused with AnnoStorePathError at both entry points, and the file is left untouched
not ok 14 - 14. an UNREADABLE ancestor directory is refused with AnnoStorePathError at both entry points
not ok 15 - 15. a symlink cycle in an ANCESTOR position is refused with AnnoStorePathError at both entry points -- …
# pass 12
# fail 3
```

The twelve pre-existing cases stayed green in that same run, which is the 28-12 P3 evidence: the new cases fail against the old predicate and the old cases do not. After restore: `15 pass / 0 fail / 0 skipped`. Case 14's root-skip did not fire (`getuid() != 0`), so the EACCES class was genuinely planted and measured rather than skipped.

### 3. The closing gate — the whole anno surface

```
$ cd src/mcp/vice && node --test anno-confinement.test.ts anno-durability.test.ts \
    anno-index.test.ts anno-overlap.test.ts anno-seam.test.ts anno-store.test.ts anno-types.test.ts
REAL_EXIT=0
# tests 144
# pass 144
# fail 0
# skipped 0
# todo 0
# duration_ms 13004.050008
```

**144**, against the round-3 baseline of 135 the plan names, and against the 141 the previous plan measured for the same seven-file set. The count GREW by exactly the three cases this round added. The real exit code was captured with a redirect, not a pipe.

`npx tsc --noEmit -p src/mcp/vice/tsconfig.json` → no output, exit 0.

### 4. The four named non-vacuity controls, re-observed one at a time

Not an aggregate. Each was run in its own file and the `ok` line is quoted verbatim:

**Criterion 1 — the split-orientation control and its collapse planting** (`anno-types.test.ts`):

```
ok 4 - criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets
ok 5 - the collapse planting, observed: a single-orientation implementation makes the control's OWN comparison report the two readings as identical
```

**Criterion 2 — the exhaustive index cross-validation with its `comparisons` assertion** (`anno-index.test.ts`):

```
ok 1 - the paint index and an independently written linear scan agree at every one of the 65,536 addresses
```

The non-vacuity assertion is inside it, at `anno-index.test.ts:233-235`: `assert.equal(comparisons, 65536, "the cross-validation must be EXHAUSTIVE, not sampled -- expected 65536 comparisons, performed ${comparisons}")`. Present and green.

**Criterion 3 — the fully-contained overlap case and its `filter()`-and-insert planting** (`anno-overlap.test.ts`):

```
ok 7 - case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field
ok 8 - planting A, OBSERVED and SELECTIVE: filter-and-insert loses bytes in exactly the three cases that have a head or a tail, and is indistinguishable from the real path in the other two
```

**The no-splitter structural scan and its non-vacuity companion** (`anno-overlap.test.ts` + `anno-store.test.ts`):

```
ok 12 - adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code
ok 42 - STORE-02 non-vacuity: the code this gap closure adds is inside the source the no-splitter structural scan reads
```

### 5. Criterion 4's planted red, re-observed on the FINAL tree and reverted

Required by the plan because 28-13 and 28-14 both rewrote code this control runs over. The module's single `commit` statement (`anno-store.ts:304`, inside `commitTransaction`) was replaced by a comment by hand:

```
not ok 1 - STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value
not ok 2 - STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE -- one planting, both halves
not ok 3 - an orphan snapshot file left in the kill window is identified by its revision and does not affect the readback
ok 4 - the mutator is test-only: absent from package.json files[], and its filename does not match the *.test.* glob the runner collects
not ok 5 - CR-06: with a separate OS process holding a READ transaction, the commit REFUSES inside the ViceError family, the revision is unchanged, and the write lock is released
# pass 1
# fail 4
```

The combined test and its planted-violation sibling both report `not ok`, which is the criterion's stated red. Two further tests went red as a bonus signal, including 28-14's new CR-06 control — the durability surface is more sensitive to the missing commit now than it was in round 3, not less.

After `git checkout HEAD -- src/mcp/vice/anno-store.ts`:

```
$ git diff --stat -- src/mcp/vice
(no output)
$ grep -c 'db.exec("commit")' src/mcp/vice/anno-store.ts
1
$ node --test anno-durability.test.ts
REAL_EXIT=0
# pass 5
# fail 0
```

### 6. Structural invariants, unmoved

| Invariant | Measurement |
|---|---|
| `node:sqlite` reachable from exactly one shipped module | `grep -ln 'node:sqlite' *.ts *.mts \| grep -v '.test.'` → `anno-store.ts`, and nothing else |
| Exactly one `commit` statement in `anno-store.ts` | `grep -c 'db.exec("commit")'` → `1` |
| `anno-store.ts` / `anno-types.ts` absent from the closed host-path consumer set | `EXPECTED_IMPORTERS` is `["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"]`; `hostpath-consumers.test.ts` 11 pass / 0 fail |
| No test in the diff asserts stderr is empty | `git diff 49826f9..HEAD -- src/mcp/vice \| grep -i '^+.*stderr'` → no matches |
| `pathEntryExists` has exactly one call site | `grep -c 'pathEntryExists('` → `2` (definition + call site) |
| Case count | `grep -c '^test('` on `anno-confinement.test.ts` → `15` |
| `.planning/REQUIREMENTS.md` / `.planning/STATE.md` untouched by the tasks | `git status --porcelain` on both → empty at the end of task 3 |

## Executor self-assertions

The plan requires these as statements of fact rather than as a human checkpoint, because the plan is `autonomous: true` and the phase's `human_verify_mode` is `end-of-phase` — the human gate for this round sits at the phase boundary.

1. **Criterion 4's planted red WAS re-observed on the final tree and reverted.** The `not ok 1` and `not ok 2` lines are quoted verbatim in §5 above, from a run with the module's single `commit` statement replaced by a comment. The restore left `git diff --stat -- src/mcp/vice` producing **no output**, the file back to exactly one `db.exec("commit")` site, and `anno-durability.test.ts` at `5 pass / 0 fail` with real exit code 0.
2. **The `pragma integrity_check` human-verification item is still carried as OPEN and was NOT claimed closed by this round.** The reason is unchanged from `28-VERIFICATION.md`: no in-process construction available makes the pragma itself throw, and the four corrupt-file refusal tests all reach the non-`ok` branch rather than the throw. Nothing in this plan touched that code path, so nothing in this plan can have changed its status. It remains a human-verification item for the phase boundary.

## Prohibition Dispositions

Every prohibition carried by this plan, with its evidence. `status: unverified` in the plan frontmatter means "this executor must dispose of it", not "assumed held".

| Id | Statement | Disposition | Evidence |
|---|---|---|---|
| P1 | MUST NOT silently redirect a path the confinement rejects, including by any mechanism that returns an in-workspace path while the write lands outside it (28-09 P1 / 28-12 P1) | **HELD** | The change converts an abort into a named refusal and returns nothing on any of the three classes: all six probe rows in §1 throw at both entry points. `storePathWithinWorkspace`'s comparison and its return statement are byte-identical (the whole `anno-types.ts` diff is three hunks, none of them in that function). Cases 13, 14 and 15 each assert that nothing was created outside the root, and case 13 additionally asserts the ancestor file is still a regular file with byte-identical contents. |
| P2 | MUST NOT make a confinement control pass by broadening its refusal (28-12 P2) | **HELD** | The discriminating half is green after the change: case 2 (a live inside-pointing link is FOLLOWED to its real location), case 9 (a DANGLING inside-pointing link is FOLLOWED to `<ws>/real/p.annostore`, not refused), case 6 (a symlinked workspace ROOT does not make every path foreign), case 3 (a not-yet-created store still opens), case 11 (the root itself and one segment in are ACCEPTED). 15/15 with `# fail 0`. A blanket-refusal implementation reddens all five. |
| P3 | MUST NOT weaken, delete or narrow an existing confinement case to accommodate the new one (28-12 P3) | **HELD** | `git diff` on `anno-confinement.test.ts` shows exactly three hunks: `@@ -93 +93 @@` (the `node:fs` import line), `@@ -98,0 +99 @@` (one added `ViceError` import), `@@ -493,0 +495,217 @@` (the append). No hunk touches lines 100-493, where the twelve cases live. They were also green in the reverted-predicate run (`# pass 12`), which is the stronger statement: they neither changed nor became dependent on the fix. |
| P4 | MUST NOT claim a residual is closed when it is only untested (28-12 P4) | **HELD** | The residual-limits block at `anno-confinement.test.ts:61-79` is **byte-identical** to its pre-task state (`diff` of that range against `HEAD` → no output): the check-then-open window and the byte-wise non-normalising comparison stay STATED as limits and no new case is written as though covering either. Three residuals are carried forward OPEN rather than absorbed: 28-13's P2 under-claim (see below), the `pragma integrity_check` throw path, and the newly-named ancestor-position hop-bound unreachability. |
| P5 | MUST NOT leave in place, or introduce, a comment that asserts a guarantee the code does not provide (28-07 P3, recorded VIOLATED in round 3 at `anno-types.ts:830-833`) | **HELD — and the round-3 violation is CLOSED** | The paragraph is left byte-identical and is now true. Audited every executable `fs` call in the module: `lstatSync` at `:799` (newly wrapped), `lstatSync`/`existsSync` at `:891` (wrapped since 28-12), `readlinkSync` at `:910` (wrapped), `realpathSync` at `:924` (wrapped). Four of four. Behaviourally confirmed by §1's six in-family rows. The new `pathEntryExists` doc comment claims only what §1 measured. |

**Carried forward, still VIOLATED, not this plan's to close:** 28-13 recorded prohibition 28-07 **P2 as VIOLATED in the UNDER-CLAIM direction, by design and explicitly not claimed closed** — under a second path spelling `retainedRevisions()` reports `[]` and `oldestRetainedRevision()` reports `NO_RETAINED_REVISION` while the first ring's files still exist on disk. This plan touched `anno-store.ts` not at all, so that residual is unchanged and is **restated here as OPEN**. It must not be read as closed by this round's green suite.

## Decisions Made

1. **Case 15 records the ancestor/leaf asymmetry as its finding rather than asserting the plan's expected message.** The plan's acceptance criterion expected case 15's message to contain `40`. Measurement says it cannot, for a structural reason worth writing down (see the deviation below). The case asserts the honest property for the ancestor spelling and pins the leaf spelling's `40` beside it as an explicit comparison, so the criterion's *intent* — both spellings refuse by name, and a reader can tell them apart — is satisfied and the mechanism is stated correctly.
2. **Task 3 gets no commit of its own.** It changes no file by design (`grep -c "^test("` returned 15, so its conditional edit did not fire). Its deliverable is this SUMMARY's measured evidence, which lands in the SUMMARY commit.
3. **Requirement status is moved in the close-out step, not from inside task 3.** The plan explicitly forbids task 3 from touching `REQUIREMENTS.md` or `STATE.md`, and that criterion was verified empty at the end of task 3. The close-out step is a separate, orchestrator-delegated responsibility and it acts on this gate's evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own expectation] Case 15's `40` criterion is unsatisfiable for an ANCESTOR cycle**

- **Found during:** Task 2 (writing case 15), confirmed by direct measurement before and after task 1.
- **Issue:** The plan's acceptance criterion states *"Case 15's message contains the number `40` — the hop bound — proving the ancestor cycle reaches the same named refusal the leaf cycle does."* It cannot. `lstat` does not follow the FINAL path component but MUST follow every ancestor component, so with `a -> b`, `b -> a` planted:
  - the LEAF spelling `<ws>/a` makes `lstat` succeed on the link itself, the walk stops there, the manual hop loop runs, and `MAX_SYMLINK_HOPS` refuses naming `40` — that is case 10;
  - the ANCESTOR spelling `<ws>/a/sub/p.annostore` makes the kernel resolve `a` and hit its own `MAXSYMLINKS` first, so `lstat` throws `ELOOP` **before the walk has descended anywhere and before the hop counter has run once**. Measured pre-task as `ELOOP: too many symbolic links encountered, lstat '…/wsC/a/sub/p.annostore'`.

  The manual counter is therefore **structurally unreachable in ancestor position**, for every input, not just this fixture.
- **Fix:** Case 15 asserts what is true and states why. It pins the ancestor spelling as `AnnoStorePathError` + `instanceof ViceError` + message naming the caller's path + message matching `/ELOOP/` (proving it is the delegated kernel bound), at BOTH entry points; and it asserts, beside it, that the LEAF spelling of the *same cycle* is refused by the manual counter with a message matching `/40/`. The case comment states the two routes and the reason. The plan's criterion is therefore met in the letter — case 15 contains a `40` assertion — while the SUMMARY records that the ancestor refusal's own message does not carry it, and why.
- **Why this is not a weakened test:** the two bounds are both 40 *by construction* — `MAX_SYMLINK_HOPS`' own doc comment already says "40 is Linux's own `MAXSYMLINKS`, so a chain this walk refuses is a chain the kernel would refuse too, and the two disagree about no input." The measurement confirms that sentence rather than contradicting it. The confinement answer is identical either way; only the bound that fires differs.
- **Files modified:** `src/mcp/vice/anno-confinement.test.ts`
- **Verification:** case 15 green after the fix, `not ok 15` against the pre-task predicate.
- **Committed in:** `25e15f4`

---

**Total deviations:** 1 auto-fixed (1 × Rule 1 — a plan expectation contradicted by measurement).
**Impact on plan:** None on scope. No file outside `files_modified` was touched, `anno-store.ts` was not modified (it was reverted-and-restored only for the criterion-4 red observation, ending byte-identical), and the deviation makes the test *more* informative than the plan's expectation would have.

## Issues Encountered

- **A residual named by this plan's own measurement, stated and NOT closed.** The manual 40-hop bound in `realpathOfNearestExisting` is unreachable in ancestor position. It is not dead code — it is the bound for the leaf spelling, where the kernel cannot help — but a future reader should not assume it governs ancestor cycles. Recorded in case 15's body and here. No code change proposed: the kernel's bound is correct, identical, and already delegated to.
- **An unchanged, pre-existing behaviour observed while auditing P5, deliberately not touched.** `existsSync(current)` at `anno-types.ts:891` swallows every error and returns `false`, so a stopping entry whose *target* lookup fails (rather than being absent) is treated as dangling and hopped. This is 28-12's shape, is outside this plan's `files_modified` intent (the plan names ONE function), and is not covered by the doc claim P5 audits — that claim enumerates `realpathSync`, `lstatSync` and `readlinkSync`, and `existsSync` does not throw. Recorded so it is neither mistaken for a new regression nor read as verified.
- **`28-13-SUMMARY.md`'s two stray XML-ish tokens** (`</content>`, `</invoke>`) noted by 28-14 are still present. Another plan's artifact; not repaired here for the same reason 28-14 gave.
- **The full-glob `npm test` was NOT run** and is not a signal for this plan: it outlives the Bash timeout and carries a known 44-failure baseline unrelated to this work. The scoped anno runs and the named structural test files are the evidence.

## Known Stubs

None. No placeholder, empty-value or "coming soon" construct was introduced; both changed files are production code and production tests with measured non-vacuity.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **WR-12 is closed**, and with it truth 12's third clause. Truth 12's other two clauses (CR-06, CR-07) were closed by 28-13 and 28-14 in this same round.
- **The anno surface is green at 144/144 with real exit code 0**, `tsc --noEmit` is clean, and every control that makes ROADMAP criteria 1-4 able to go red has been re-observed individually on the final tree rather than inferred from the aggregate.
- **Still open at the phase boundary, and deliberately so:** 28-13's P2 under-claim residual (a second path spelling makes `retainedRevisions()` report `[]` while the first ring's files exist); the `pragma integrity_check` throw path as a human-verification item; the check-then-open window and the byte-wise non-normalising comparison as stated limits. None of these is claimed closed by this round.
- **The phase is ready for verification.** The requirement transition this SUMMARY's close-out records is an executor's reading of this gate's evidence; the verifier remains the authority on whether the phase goal's REVERTIBLE clause is now true.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

- `.planning/phases/28-the-store-core/28-15-SUMMARY.md`, `src/mcp/vice/anno-types.ts`, `src/mcp/vice/anno-confinement.test.ts` — all present on disk.
- Commits `4dc258d`, `25e15f4`, `e65cd84` — all present in `git log --oneline --all`.
- Every task acceptance criterion was executed as a command and logged above; no criterion was asserted from the plan text.
