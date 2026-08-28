---
phase: 28-the-store-core
plan: 10
subsystem: database
tags: [sqlite, node-sqlite, snapshot-ring, schema-version, revert, annotation-store]

# Dependency graph
requires:
  - phase: 28-the-store-core (28-06)
    provides: the durable write sequence, the snapshot ring and the `revertTo` path this plan re-keys
  - phase: 28-the-store-core (28-07)
    provides: the `retainedRevisions()` two-halves definition, the half-state resolver and the per-revision ownership predicate whose structural blindness to CR-01 motivated the rename-the-location fix
  - phase: 28-the-store-core (28-08)
    provides: `stageSnapshot`/`publishSnapshot`/`discardSnapshot` and the anchored `SNAPSHOT_FILE_PATTERN` the ring sweep is confined by
provides:
  - "`snapshotDirFor(handle)` — the ONE authority on where a store's snapshot ring lives, keyed on `basename(handle.path)` so two stores in one directory have distinct rings by construction"
  - "`anno_snapshot` reduced to a single `revision` column — no persisted string locates or deletes a snapshot anywhere in the module"
  - "`SCHEMA_VERSION` 2, with a version-1 store refused BY NAME and its legacy `<dir>/snapshots` ring left on disk untouched"
  - "three tests that would each have caught one reproduced destructive defect: CR-01 cross-store revert, CR-03 directory rename, and the non-destructive version refusal"
  - "`ringHalves(handle, dir, storeFile)` — the independent ring control, now pointable at any store file in a shared directory"
affects: [28-11, 28-12, store-export, repoint]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 8060
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Location as a total function of identity: a snapshot's path is computed from `(handle, revision)` at every read and every delete, and nothing about it is persisted except its revision number"
    - "Fix the LOCATION, not the predicate: when two identities can collide, rename the location so collision is structurally impossible rather than layering an ownership check over the shared location"
    - "Recorded reversal: a rationale that became false is kept and marked false rather than overwritten (`SCHEMA_VERSION`, the `DDL` comment, `retainedRevisions`' existence-witness paragraph)"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.test.ts
    - src/mcp/vice/anno-durability.test.ts

key-decisions:
  - "D-A (task 1 checkpoint, one-way): option `a-bump-and-refuse` — bump SCHEMA_VERSION 1→2, drop `anno_snapshot.path`, refuse a v1 store by name, leave the legacy `<dir>/snapshots` ring untouched. Rejected `b-silent-history-loss` (an existing store keeps opening but its entire revert history becomes unreachable with NO signal, and a persisted absolute-path column stays on disk for a future edit to read — CR-03's primitive left in place) and `c-migrate` (with two stores in one directory the legacy ring is genuinely ambiguous, so the migration would attribute a neighbour's snapshots to whichever store opens first — CR-01 again with a new cause and no test watching)."
  - "The ring directory name, not an ownership predicate, is the fix for CR-01: two distinct store files in one directory have distinct basenames by definition of a filesystem, so distinct rings follow by construction. 28-07's per-revision ownership predicate was structurally blind to CR-01 because revision numbers are not unique ACROSS stores."
  - "`anno_snapshot.path` is DROPPED rather than made relative: a relative filename would leave one persisted field a future edit could go back to reading absolutely, whereas dropping it removes the primitive — there is no persisted absolute string left for a second namespace (a bind mount seen from host and container, a symlinked ancestor, a case-insensitive filesystem) to disagree with."
  - "CORRECTED BY PLAN 28-13 AFTER ROUND-3 VERIFICATION — the original wording is kept below the correction because a decision that became false is evidence, not a typo. AS WRITTEN AT THE TIME: 'The store-FILE-rename residual is stated, not closed: `mv proj.annostore other.annostore` re-points the ring name and the old ring becomes unreachable. It is deliberately never deleted (the sweep only reads `snapshotDirFor(handle)`) and `retainedRevisions()` honestly reports `[]`. An under-claim is accepted over guessing which ring a renamed store used to own, which is CR-01 with a new cause.' AS FALSIFIED (CR-05, reproduced twice through production entry points): true of the FILES, false of the ROWS. Under a second spelling of the store file — a symlink alias as well as a rename — `retainedRevisions()` reported every existing pointer row as unretained and the next write's sweep deleted them all irreversibly; restoring the original name recovered nothing. AS IT NOW STANDS after 28-13: the sweep abstains from the pointer-ROW direction entirely, so the first ring's files are never deleted and its rows are never deleted BY THE SWEEP — but `pruneSnapshots`' doomed loop still reaps every row below `currentRevision() - MAX_SNAPSHOT_REVISIONS`, so restoring the original name restores the floor ONLY while the wrong-spelling handle has not advanced past that many further revisions. The under-claim itself is NOT closed: prohibition 28-07 P2 remains violated in that direction by design, because closing it would mean reading a ring whose ownership the handle cannot establish (28-10 P3 / 28-11 P4)."
  - "`orphanRowRevisions` is expressed as the DIFFERENCE of `ringHalves`' two halves rather than with a second layout literal of its own — one layout spelling in the test tree, so the two halves of one control cannot drift apart."

patterns-established:
  - "One layout authority, reached by every consumer: `snapshotPathFor` → `snapshotDirFor` → `basename(handle.path)`, and all four ring consumers (`retainedRevisions`, `revertTo`, `pruneSnapshots`, `reconcileSnapshotRing`) name a file only through it"
  - "The test spells the layout, never the code under test: all ten re-pointed sites write the ring directory out in the test — never via `snapshotDirFor()`, never via an imported `SNAPSHOT_DIR_SUFFIX` — so a future move of the ring goes RED instead of being silently followed"
  - "State a restatement as a restatement: test B's version-gate half is marked in its own comment as a locality restatement of an existing test rather than counted as independent evidence"

requirements-completed: [STORE-04, STORE-05, STORE-07]

coverage:
  - id: D1
    description: "`revertTo` on one of two stores sharing a directory returns that store's OWN rows, never the neighbour's (CR-01 closed)"
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-01: two stores in ONE directory keep separate snapshot rings -- reverting game.annostore to its own revision returns ITS rows, never the neighbour's"
        status: pass
    human_judgment: false
  - id: D2
    description: "A directory rename plus one accepted write destroys no snapshot file and no pointer row, and the published floor is one `revertTo` can still honour (CR-03 closed)"
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-03: renaming the containing directory destroys nothing -- after the move and one accepted write the retained revisions and the snapshot files are the ones that were there before"
        status: pass
    human_judgment: false
  - id: D3
    description: "`anno_snapshot` has exactly one column (`revision`); the snapshot location is computed from the handle at every read and every delete, and no persisted string locates or deletes a snapshot file"
    requirement: STORE-05
    verification:
      - kind: other
        ref: "node -e probe over a fresh store: `pragma table_info(anno_snapshot)` printed 1 column, [\"revision\"]; snapshotDirFor ended in proj.annostore.snapshots; snapshotPathFor(h,7) ended in proj.annostore.snapshots/r7.db"
        status: pass
      - kind: other
        ref: "grep -n 'anno_snapshot' src/mcp/vice/anno-store.ts — every statement selects/deletes by `revision` only; the sole remaining `path`-shaped read is gone"
        status: pass
    human_judgment: false
  - id: D4
    description: "A store DECLARING schema_version 1 is refused by name (naming both 1 and 2) and a legacy per-directory `<dir>/snapshots` ring beside it survives untouched — never adopted, never migrated, never deleted"
    requirement: STORE-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a store written by the previous on-disk shape is REFUSED by name, and its legacy snapshot directory is left untouched"
        status: pass
      - kind: other
        ref: "planted-violation check: with a destructive `rmSync` of the legacy ring added to openStore's version refusal, the full test goes RED on the survival assertion; with that assertion removed the same destructive refusal PASSES — proving the second half carries the no-adoption prohibition"
        status: pass
    human_judgment: false
  - id: D5
    description: "STORE-04 idempotency survives the identity change: a second `pruneSnapshots` drops nothing in either direction and a second `revertTo(r)` leaves the rows and the revision identical"
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#STORE-04 idempotency across the half-states: a second pruneSnapshots reports nothing dropped in either direction and changes neither the files nor the rows, and a second revertTo(r) leaves the same rows and the same revision"
        status: pass
    human_judgment: false
  - id: D6
    description: "STORE-05 ordering: the DDL change touched ONLY `anno_snapshot` — every other table's column list is byte-identical and `bank` is still present and uninterpreted"
    requirement: STORE-05
    verification:
      - kind: other
        ref: "git diff 529d082..HEAD -- src/mcp/vice/anno-store.ts: the only DDL hunk removes `path text not null` from anno_snapshot; no other create-table line changed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts + anno-types.test.ts (139/139) — the schema/bank/xref column probes re-established in the prior round stay green"
        status: pass
    human_judgment: false
  - id: D7
    description: "STORE-07 idempotency: opening and closing a store twice with no write between leaves the revision, the rows and the snapshot ring unchanged, and the single-seam guard's declared seam-private export list is still exactly two entries"
    requirement: STORE-07
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#idempotency of open: opening and closing a store twice with no write between leaves the revision, the rows and the snapshot ring unchanged"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts (17/17) — SEAM_PRIVATE_EXPORTS still 2 entries; snapshotDirFor is a normal export, like snapshotPathFor"
        status: pass
    human_judgment: false
  - id: D8
    description: "No test measures the layout by asking the code that decides it: all ten re-pointed sites spell the ring in the TEST, pinned by count"
    verification:
      - kind: other
        ref: "comment-filtered grep -cF over anno-store.test.ts at end of task 2: old expr 0, bare new literal 7, ${storeFile}.snapshots 1, SNAPSHOT_DIR_SUFFIX 0; over anno-durability.test.ts: 0 and 2"
        status: pass
      - kind: other
        ref: "same pipeline after task 3: old expr exactly 1 (test B's deliberate legacy plant), bare new literal still 7, ${storeFile}.snapshots 1, SNAPSHOT_DIR_SUFFIX 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "ROADMAP success criterion 4's home (`anno-durability.test.ts`) changed by exactly two expressions and no assertion, in task 2, and was green at the end of every task"
    verification:
      - kind: other
        ref: "git diff --numstat -- src/mcp/vice/anno-durability.test.ts reported exactly 2 insertions / 2 deletions at the end of task 2, and an EMPTY diff for task 3"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts — 4/4 passing after task 2 and after task 3"
        status: pass
    human_judgment: false

# Metrics
duration: 14 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 10: Snapshot Identity Summary

**A snapshot's location became a total function of `(handle, revision)` — the ring directory is keyed on `basename(handle.path)`, `anno_snapshot.path` is dropped so no persisted absolute string can disagree with it, and `SCHEMA_VERSION` 2 refuses a previous-shape store by name while leaving its legacy ring untouched.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-28T07:57:14Z
- **Completed:** 2026-08-28T08:11:05Z
- **Tasks:** 3 (1 decision checkpoint, 1 TDD tracer, 1 expansion)
- **Files modified:** 4

## Accomplishments

- **CR-01 closed structurally, not by a predicate.** `snapshotDirFor(handle)` returns `join(handle.dir, basename(handle.path) + SNAPSHOT_DIR_SUFFIX)`, so two store files in one directory have distinct rings by definition of a filesystem. There is no per-directory ring left in the code for a second store to find.
- **CR-03 closed by removing the primitive.** `anno_snapshot` now has exactly one column, `revision`. `retainedRevisions`, `revertTo`, `pruneSnapshots` and `reconcileSnapshotRing` each compute the file's location from the handle at the point of use, so a renamed ancestor — or a bind mount seen from two namespaces, a symlinked parent, a container/host path pair — has no persisted string to invalidate.
- **`SCHEMA_VERSION` 2 with a non-destructive refusal.** A store declaring version 1 throws `AnnoStoreCorruptError` naming both 1 and 2, and its legacy `<dir>/snapshots` ring is never adopted, never migrated and never deleted, so the bytes stay recoverable by hand.
- **Three tests that would each have caught one reproduced defect,** two of them with their pre-change RED observed and recorded verbatim below.
- **139/139 green** over the eight targeted test files (136 baseline + 3 new), 11/11 on `hostpath-consumers.test.ts`, `tsc --noEmit` clean.

## Task Commits

1. **Task 1: DECISION — the on-disk format change is one-way for stores already written** — no commit (checkpoint task). Decision recorded under `key-decisions` as **D-A / `a-bump-and-refuse`**.
2. **Task 2: TRACER (tdd) — a snapshot's location becomes a total function of (handle, revision)** — `5d6704d` (test, RED) then `0e15c51` (feat, GREEN)
3. **Task 3: Expand — the rename test, the version-refusal test, and the idempotency re-check** — `bdbab58` (test)

**Plan metadata:** see the `docs(28-10)` commit.

_TDD task 2 carries two commits: `test` (RED) → `feat` (GREEN). No `refactor` commit was needed._

## The Task 1 Decision, on the record

**Taken: option `a-bump-and-refuse`** (the plan's recommended option and its
`default_if_unattended`; the task carried `gate="blocking"`, config `mode: yolo`).

Bump `SCHEMA_VERSION` 1 → 2, drop the `path` column, refuse a v1 store by name,
leave the legacy `snapshots/` directory untouched.

**Rejected, with their stated costs:**

| Option | Why rejected |
|---|---|
| `b-silent-history-loss` (keep SCHEMA_VERSION at 1, change the layout, leave the legacy ring unread) | An existing store keeps opening, but its **entire revert history silently becomes unreachable with no signal** — `retainedRevisions()` honestly reports `[]` and nothing says why. It also leaves a `path` column on disk carrying absolute strings a future edit could go back to reading, which is CR-03's primitive left in place. |
| `c-migrate` (adopt the legacy ring into the new location on first open) | With two stores in one directory the legacy ring is **genuinely ambiguous** — CR-01 means both may have written into it and nothing recorded which file belonged to which store. The migration would attribute a neighbour's snapshots to whichever store opens first: CR-01 again with a new cause and no test watching. Violates this plan's carried prohibition against adopting a ring whose ownership cannot be established. |

**Accepted cost of A** (threat `T-28-10-05`, disposition `accept`): an existing
store's annotations become unreachable without a hand migration, one-way for data
already written. Accepted because the store is unreleased — `@henols/vice-mcp`
ships no annotation store, so every store on disk today is a phase-28 test
fixture — the refusal is by name inside the `ViceError` family, and the legacy
ring is left on disk so the bytes stay recoverable.

## Observed pre-change RED, verbatim

### CR-01 — `revertTo` returned the neighbour's database

Observed with `snapshotPathFor` still on its pre-change body (the shared
`<dir>/snapshots` ring), before the task-2 implementation:

```
not ok 1 - CR-01: two stores in ONE directory keep separate snapshot rings -- reverting game.annostore to its own revision returns ITS rows, never the neighbour's
  error: |-
    revertTo(game, 1) must restore the GAME's own pre-mutation state -- one `code` row. Got [{"id":1,"start":2064,"endInclusive":2079,"dataType":"petscii","bank":null}]. A `petscii` row here is the neighbour's database restored over this one, which is CR-01.
    + actual - expected

      [
    +   'petscii'
    -   'code'
      ]
  operator: 'deepStrictEqual'
```

This reproduces the verifier's own output: `revertTo(game, 1)` restored
`loader.annostore`'s `petscii` row over `game.annostore`, silently, with no
error. The assertion is on the **row set** deliberately — the defect was a silent
wrong answer, so "it did not throw" is precisely the assertion that would have
passed on the broken code.

### CR-03 — one `mv` plus one write destroyed the whole revert history

Observed against the pre-task-2 source (`git checkout HEAD~1 --` on
`anno-store.ts`/`anno-types.ts`), with test A's two ring reads pointed at the old
layout — the route the plan explicitly sanctions:

```
BEFORE MOVE   retained [0,1,2,3,4]  oldest 0   files ["r0.db","r1.db","r2.db","r3.db","r4.db"]
AFTER MOVE    retained []           oldest -1  files ["r0.db","r1.db","r2.db","r3.db","r4.db"]
AFTER 1 WRITE retained [5]          oldest 5   files ["r5.db"]
pointer rows  [5]
```

`retained []` and `oldest -1` while five snapshot files sat untouched on disk —
the under-claim — and then one accepted write's prune deleted **all five files and
all five pointer rows**. The test itself failed with:

```
not ok 1 - CR-03: renaming the containing directory destroys nothing -- ...
  error: 'r0.db was on disk before the move and must still be on disk after it and after one accepted write; found r5.db'
```

## Test B: which half is the evidence

**Stated explicitly, in the test's own comment as well as here.** Test B's
fixture does not run a version-1 build: it opens a store under the current DDL
and sets `anno_meta.schema_version` back to `1` by hand. The refusal keys on the
declared integer alone, so the assertion holds — but the **first half is a
deliberate RESTATEMENT** of the existing test *"a store file whose schema_version
is not this build's is refused, and the refusal names both versions"*
(`anno-store.test.ts:249`, which forges `SCHEMA_VERSION + 98` and asserts both
names via `assert.match` at `:263`/`:264`). It is present purely for **locality**
— the legacy-ring half needs a version-1 declaration sitting next to a legacy
ring in one fixture — and is **not counted as independent evidence for the
version gate**. This is the same discipline 28-12 task 2 applies to test 11's
boundary restatement.

**The genuinely new evidence is the second half: that the refusal is
NON-DESTRUCTIVE.** Verified load-bearing by planting the violation rather than by
argument:

- With a destructive `rmSync(join(dirname(resolved), "snapshots"), {recursive:true, force:true})` added to `openStore`'s version refusal — a plausible "tidy up the old layout" implementation — the full test goes **RED** on the survival assertion:
  ```
  not ok 1 - a store written by the previous on-disk shape is REFUSED by name, and its legacy snapshot directory is left untouched
    error: 'the legacy <dir>/snapshots ring must SURVIVE the refusal untouched: its ownership is not establishable -- two stores in one directory may both have written into it -- so it is never adopted, never migrated and never deleted, and the bytes stay recoverable by hand'
  ```
- With the survival assertions **removed** and the same destructive refusal still planted, the test **PASSES** (`ok 1 ... # pass 1 # fail 0`).

Those two runs together are what make the second half carry the prohibition *"MUST
NOT adopt, migrate, claim or sweep a snapshot ring whose ownership this store
cannot establish"*. Non-vacuity is pinned separately: the legacy directory and
its `r0.db` are asserted to exist **before** `openStore` is called, so an
empty-directory pass is impossible.

## The STORE-04 idempotency test: passed unchanged

Stated explicitly rather than silently, as the plan requires. The existing
`"STORE-04 idempotency across the half-states"` test **passed unchanged** after
the identity change — no body edit, no signature change and no weakened
assertion. `ringHalves`' new `storeFile` parameter is defaulted, so its two calls
there are byte-identical; the only edit anywhere in that test is task 2's
re-pointing of its two layout literals (lines 1594 and 1603 pre-edit).

## The site counts, as printed

Through the comment-filtered pipeline
(`grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*'`), `grep -cF`:

**End of task 2 — the pinned gate:**

| Expression | `anno-store.test.ts` | `anno-durability.test.ts` |
|---|---|---|
| `join(dir, "snapshots")` (old) | **0** | **0** |
| `join(dir, "proj.annostore.snapshots")` (new, bare) | **7** | **2** |
| `${storeFile}.snapshots` | **1** | — |
| `SNAPSHOT_DIR_SUFFIX` | **0** | — |

**The arithmetic:** 7 + 1 = `anno-store.test.ts`'s **eight** layout sites. The
count reads seven and not eight because the eighth site is `ringHalves`, which by
"the literal is the point" spells its ring as `` join(dir, `${storeFile}.snapshots`) ``
so the CR-01 test can point it at `game.annostore` — a parameterized site cannot
simultaneously be a fixed literal, so **`ringHalves` is the one site pinned BY
NAME** rather than by the bare-literal count. Plus `anno-durability.test.ts`'s 2 =
**ten** re-pointed sites in total. `SNAPSHOT_DIR_SUFFIX` at 0 proves the suffix is
spelled out in the tests rather than imported from the code under test.

**After task 3:** the old expression reads exactly **1** — test B's deliberate
legacy-ring plant at `anno-store.test.ts:313` — and the bare new literal still
reads exactly **7**, `${storeFile}.snapshots` still **1**, `SNAPSHOT_DIR_SUFFIX`
still **0**.

`git diff --numstat -- src/mcp/vice/anno-durability.test.ts` reported exactly
`2 2` at the end of task 2 (two MODIFIED lines and no more — `--numstat`, not
`--stat`, which renders the same two lines as `4 ++--`) and an **empty** diff for
task 3.

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — `SNAPSHOT_DIR_SUFFIX` and the exported `snapshotDirFor()` as the one layout authority; `snapshotPathFor` routed through it; `anno_snapshot` reduced to one column in the `DDL`; `retainedRevisions`, `reconcileSnapshotRing`, `pruneSnapshots`, `revertTo` and the pointer-row insert all switched to computing the path from the handle; four doc comments carrying recorded reversals rather than overwritten claims.
- `src/mcp/vice/anno-types.ts` — `SCHEMA_VERSION` 1 → 2 with the reversal recorded (what version 1 named a snapshot with, both reproduced consequences, and why a v1 store is refused rather than migrated); `MAX_SNAPSHOT_REVISIONS`' now-stale `<dir>/snapshots` reference re-pointed.
- `src/mcp/vice/anno-store.test.ts` — eight layout literals re-pointed; `ringHalves` given an explicit `storeFile` parameter and a comment stating why neither helper may call `snapshotDirFor()` or import the suffix; `orphanRowRevisions` rewritten as the difference of `ringHalves`' halves; three new tests (CR-01, CR-03, the non-destructive version refusal).
- `src/mcp/vice/anno-durability.test.ts` — the two layout expressions re-pointed, every assertion byte-identical.

## Decisions Made

See `key-decisions` in the frontmatter and **The Task 1 Decision, on the record**
above. In short: the ring's location is keyed on the store FILE (structural, not
a predicate); the `path` column is dropped rather than made relative (remove the
primitive, not the symptom); a version-1 store is refused rather than migrated
(its ring's ownership is unrecoverable); and the store-FILE-rename residual is
stated as an accepted under-claim rather than closed by guessing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `orphanRowRevisions` expressed through `ringHalves` instead of with a second layout literal**
- **Found during:** Task 2 (step 11)
- **Issue:** The plan instructed `orphanRowRevisions` to "test each revision's file at the literal computed path". Doing that literally adds a **new** bare `join(dir, "proj.annostore.snapshots")` occurrence, which would have driven the pinned bare-literal count to **8** and failed task 2's own acceptance criterion (pinned at 7). It would also have put a second, independently-drifting layout spelling in the same file — the exact "two halves of one control drift apart" failure the plan warns about for `ringHalves`.
- **Fix:** `orphanRowRevisions(handle, dir, storeFile = "proj.annostore")` returns the set difference of `ringHalves`' `rowRevisions` and `fileRevisions`. `ringHalves` is itself independent of the code under test, so the difference is too; the semantics ("rows whose file is absent") are unchanged.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** counts printed 7 / 1 / 0 as pinned; the four `orphanRowRevisions` callers (all inside `inTempDir((dir) => …)`) updated to pass `dir`; all four enclosing tests still green.
- **Committed in:** `0e15c51`

**2. [Rule 2 - Missing Critical] Test B's no-migration assertion expressed over the directory listing**
- **Found during:** Task 3 (test B)
- **Issue:** The first draft asserted `!existsSync(join(dir, "proj.annostore.snapshots"))`, which pushed the pinned bare-literal count from 7 to 8 — turning a count that measures *re-pointed sites* into one that also measures *assertions written around them*, and leaving a later verifier re-running the task-2 pin over the final tree reading 8 as a violation.
- **Fix:** assert that `readdirSync(dir)` contains no entry ending in `.snapshots`. Strictly stronger — it catches a migration into ANY store-keyed ring, not just this store's — and adds no layout literal.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** count back to exactly 7; test B still green; the destructive-plant RED still fires.
- **Committed in:** `bdbab58`

**3. [Rule 1 - Bug] Three doc comments falsified by this change, updated rather than left stale**
- **Found during:** Task 2
- **Issue:** `MAX_SNAPSHOT_REVISIONS` (`anno-types.ts`), `SNAPSHOT_FILE_PATTERN` and `pruneSnapshots` (`anno-store.ts`) each described the ring as "the `snapshots/` sibling directory". After this plan that sentence is simply false, and this module's own header discipline treats a stale rationale as a defect (trap-10's own recorded reversal exists because an inverted comment produced an inverted loop).
- **Fix:** re-pointed all three to name `snapshotDirFor()` as the authority, with `MAX_SNAPSHOT_REVISIONS`' comment additionally naming the version-1 shape it replaced.
- **Files modified:** `src/mcp/vice/anno-types.ts`, `src/mcp/vice/anno-store.ts`
- **Verification:** `grep -n '\`snapshots/\`' anno-store.ts` returns nothing; `anno-types.test.ts` 15/15 (the four-entry import-specifier pin unchanged — no import was added to that module).
- **Committed in:** `0e15c51`

**4. [Rule 3 - Blocking] Test A restructured so `revertTo`'s handle transfer is safe**
- **Found during:** Task 3 (test A)
- **Issue:** The first draft called `revertTo(second, …)` inside a `try` and closed `second` in a `catch`, which double-closes (`revertTo` closes the handle it is given) and leaks the returned handle on the success path.
- **Fix:** `let second = …; second = revertTo(second, oldestBefore);` with a single `finally { closeStore(second); }`, matching the `let store` pattern the file's other revert tests already use. A comment records why the reassignment is load-bearing.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** `tsc --noEmit` clean; test A green; no temp-directory leak (`inTempDir`'s unconditional `rmSync` still owns cleanup).
- **Committed in:** `bdbab58`

---

**Total deviations:** 4 auto-fixed (2 missing-critical, 1 bug, 1 blocking).
**Impact on plan:** No scope creep. Two deviations exist specifically to keep the
plan's own pinned counts meaningful; one repairs prose the plan's change
falsified; one is a handle-lifecycle correctness fix inside a new test. Every
plan-specified assertion, count and ordering was delivered as written.

## Issues Encountered

- **The RED for task 2 required care about *which* function to leave unchanged.** Routing `snapshotPathFor` through `snapshotDirFor` alone already fixes CR-01, so a RED observed after that edit would have been vacuous. The RED commit (`5d6704d`) therefore lands `SNAPSHOT_DIR_SUFFIX` + `snapshotDirFor` **without** routing `snapshotPathFor` through them, which is a genuine red on the new test and green on all 136 baseline tests. Recorded here because the sequencing is the difference between a real RED and a decorative one.
- **The CR-03 RED needed the pre-change source, and `git stash` is forbidden in this repo.** Observed instead with a targeted `git checkout HEAD~1 -- anno-store.ts anno-types.ts` plus test A's two ring reads temporarily pointed at the old layout — the route the plan explicitly offers ("or by pointing the helper at the old layout"). Both files restored with `git checkout HEAD --` and verified byte-identical to `HEAD` before the task-3 commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **28-11 is unblocked and its dependency is now concrete.** It sweeps the directory this plan renamed: `reconcileSnapshotRing` already names its ring only through `snapshotDirFor(handle)`, and its transaction discipline was deliberately left untouched here so the two changes do not entangle. Its `deferred` third return field and its three new tests (CR-02, WR-01, WR-02) land on a ring whose identity is now settled.
- **28-12 is unaffected by this plan** (dangling-symlink confinement, `anno-types.ts`'s `pathEntryExists`/`MAX_SYMLINK_HOPS`). This plan added no import to `anno-types.ts`, so `hostpath-consumers.test.ts`'s five-element closed consumer set and its length assertion are untouched (11/11).
- **Gap 1's remedies 1 and 3 are closed; remedy 2 (CR-02, the sweep's judge rule) remains open** and is 28-11's subject. The phase goal's REVERTIBLE clause is no longer false in the two ways this plan addressed, but the sweep's concurrency behaviour is still unproven.
- **One residual, stated rather than closed — CORRECTED BY PLAN 28-13 AFTER ROUND-3 VERIFICATION.** As written at the time: "renaming the store FILE itself re-points the ring name, so the old ring becomes unreachable. It is never deleted and `retainedRevisions()` honestly reports `[]` — an under-claim, accepted on the record, documented in `snapshotDirFor`'s doc comment." The verifier falsified it by driving the code (CR-05): the FILES were never deleted, but the ROWS were — under a symlink alias or a store-file rename the next write's sweep deleted every pointer row irreversibly, and restoring the name recovered nothing. As it now stands after 28-13: the sweep no longer deletes a pointer row at all, so the rows survive **by the sweep** — bounded, in the same breath, by `pruneSnapshots`' doomed loop, which still reaps every row below `currentRevision() - MAX_SNAPSHOT_REVISIONS`. The under-claim itself remains open by design (28-07 P2), because closing it would require reading a ring this handle cannot establish ownership of.
- **No stubs, no skipped tests, no unrun `<verify>`.** Nothing was appended to `.planning/WINDOWS.md`.

## Self-Check: PASSED

- `src/mcp/vice/anno-store.ts` — FOUND
- `src/mcp/vice/anno-types.ts` — FOUND
- `src/mcp/vice/anno-store.test.ts` — FOUND
- `src/mcp/vice/anno-durability.test.ts` — FOUND
- Commit `5d6704d` — FOUND
- Commit `0e15c51` — FOUND
- Commit `bdbab58` — FOUND
- All task `<acceptance_criteria>` re-run and passing; plan-level `<verification>` re-run: 139/139 over the eight targeted files, 11/11 `hostpath-consumers.test.ts`, `tsc --noEmit` exit 0.
- No commit in this plan deleted a tracked file (`git diff --diff-filter=D` empty for all three).

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*
