---
phase: 28-the-store-core
plan: 11
subsystem: database
tags: [sqlite, node-sqlite, annotation-store, snapshots, concurrency, write-lock, error-handling]

# Dependency graph
requires:
  - phase: 28-the-store-core (plan 28-10)
    provides: "`snapshotDirFor()` — a snapshot's location as a total function of (handle, revision); `anno_snapshot` with a single `revision` column; SCHEMA_VERSION 2"
  - phase: 28-the-store-core (plans 28-07, 28-08)
    provides: "`publishSnapshot` as the only rename site, sitting between the won CAS and the pointer-row insert; `stageSnapshot`/`applyWriteWithoutCommit` as seam-private proof handles; the exactly-one-commit-statement scan"
provides:
  - "`reconcileSnapshotRing` serialises its judgement under `begin immediate`, so a snapshot a concurrent writer has PUBLISHED but not yet committed is unobservable to a sweep by construction rather than by timing (CR-02 closed)"
  - "A third returned field, `deferred: boolean`, so a sweep that declined to judge REPORTS the declining instead of leaving a caller to infer it from an absence"
  - "`pruneSnapshots` consumes that report and returns early on `deferred`, bounding the added write latency at ONE `busy_timeout` and removing a swallowed `SQLITE_BUSY` on every contended write"
  - "The sweep's pointer-row deletes are committed through `commitTransaction` BEFORE any `rmSync`, so an interrupted sweep leaves extra files and never a pointer row aimed at a deleted file (trap 10's rule, now enforced at the second row-deleting site)"
  - "A guarded staging→publish→pointer-insert window in `runWriteSequence` (WR-01), a guarded post-commit prune call (WR-02) and a guarded `pragma integrity_check` (WR-04)"
affects: [28-12, phase-29-mcp-tool-family, anno-store consumers that call revertTo or any accepted write]

actuals:
  tokens: 12400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "An exact exclusion derived from a lock the code already takes, in place of a tuned grace constant"
    - "A repair that DECLINES and reports the declining when it cannot establish the moment it is required to judge from"
    - "Row deletes committed before any unlink, at every site that deletes ring rows — not just the first one"
    - "A structural control that asserts a call sits inside a STILL-OPEN try (the nearest preceding `try {` not yet closed by a `} catch`), rather than merely 'a try exists above'"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "Took gap 1 remedy 2's SECOND route (serialise under `begin immediate`) and refused the first (a grace bound over file mtimes) on the record: a grace bound is a guess about how long a writer may sit between its rename and its transaction's end, it is wrong for a writer that is paged out or stopped at a debugger, and the next reproduction would arrive as a request to raise the constant"
  - "`pruneSnapshots` returns early when its own sweep reports `deferred: true` — the doomed set would otherwise be computed over a ring the sweep just declined to reconcile, and its autocommit deletes would block a SECOND five-second `busy_timeout` and then throw `SQLITE_BUSY` into WR-02's swallowing wrap (~10 s of silent latency for work guaranteed to be redone)"
  - "Every failure of the sweep's `begin immediate` — not only `SQLITE_BUSY` — is treated as 'decline and report', because any failure to open that transaction equally means the function cannot establish the moment it is required to judge from, and a partial sweep is precisely what must not happen"
  - "`revertTo` step 6's over-claim is recorded in place rather than deleted: its first clause survives unchanged (the floor still routes through `retainedRevisions`), its second becomes conditional on the sweep not having deferred"
  - "The CAS-failure branch's own `rollback`/`discardSnapshot` are KEPT under the new outer handler rather than deduplicated: the WR-11 structural control asserts that rollback is present in that slice, positioned after the moved-revision read"
  - "WR-02 and WR-04 are pinned by a source-structural control with a stated reason and named behavioural siblings, following 28-08's established pattern, because neither failure is deterministically constructible in-process"

patterns-established:
  - "The exclusion-not-timing rule: when a lock the code already takes makes the hazardous window unreachable, use the lock and state the latency it costs — never a tuned bound"
  - "A repair reports its own abstention as a first-class returned field, so a caller can act on it (here: an early return) and a test can assert it"

requirements-completed: [STORE-04, STORE-07]

coverage:
  - id: D1
    description: "A sweep run by one connection leaves a concurrent writer's published-but-uncommitted snapshot on disk — the sweep either holds the store's write lock or does nothing and says so (CR-02)"
    requirement: STORE-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#CR-02: a sweep cannot delete a snapshot a concurrent writer has published but not yet committed -- the sweep either holds the write lock or does nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sweep commits its pointer-row deletes before it unlinks any file, so an interruption leaves extra files and never a pointer row aimed at a deleted file"
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the sweep's SOURCE ORDER is the guarantee too: inside reconcileSnapshotRing the pointer-row delete precedes the commit, and the commit precedes the unlink"
        status: pass
    human_judgment: false
  - id: D3
    description: "The added write latency is bounded at ONE `busy_timeout`: `pruneSnapshots` returns early on `deferred` and the deferred work is done by the next uncontended prune"
    requirement: STORE-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a prune whose sweep DEFERRED returns early: one busy_timeout and not two, nothing dropped, and the deferred work done by the next uncontended prune"
        status: pass
    human_judgment: false
  - id: D4
    description: "The module still contains exactly ONE commit statement, so the durability proof's single planted-violation site stays unique — and no new string literal in the module names it"
    requirement: STORE-07
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam contains exactly one commit statement, so the single planted-violation site is unique"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-01: a throw at the deepest point of the staging→publish→pointer-insert window leaves no open transaction with the CAS applied, no staged `.tmp`, and an error inside the `ViceError` family — plus the reachable pre-lock arm"
    requirement: STORE-07
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#WR-01: a throw between the staged snapshot and the pointer-row insert leaves no open transaction, no staged .tmp, and an error inside the ViceError family"
        status: pass
    human_judgment: false
  - id: D6
    description: "WR-02 (the post-commit prune) and WR-04 (`pragma integrity_check`) are inside handlers"
    requirement: STORE-07
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-02 and WR-04, STRUCTURAL: the two remaining unguarded calls are inside handlers"
        status: pass
    human_judgment: true
    rationale: "The control is SOURCE-STRUCTURAL by necessity, and the plan required that be stated rather than glossed. WR-02's failure needs a second connection to take the write lock in the instant between one connection's last statement and its next — `runWriteSequence` is synchronous, so no in-process interleave can land there and a spawned racer would be timing-dependent. WR-04's failure needs a genuinely corrupt SQLite page. The reachable arms ARE pinned behaviourally (WR-02's non-throwing path by every accepted-write test and by D3's contended no-throw assertion; WR-04's family membership by the four corrupt-file refusal tests), but a verifier must weigh the structural instrument itself rather than take a pass on trust."
  - id: D7
    description: "`revertTo` step 6's over-claim is recorded as a reversal rather than kept or silently deleted"
    requirement: STORE-04
    verification:
      - kind: other
        ref: "grep -cF 'well as before one.' src/mcp/vice/anno-store.ts  →  1 before, 0 after; grep -c 'unless the sweep deferred' → 0 before, 1 after"
        status: pass
    human_judgment: false

duration: 22 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 11: The Judge Rule — Who May Judge an Unclaimed Snapshot File Summary

**`reconcileSnapshotRing` now takes the store's `begin immediate` write lock before it decides anything, so a snapshot a concurrent writer has published-but-not-committed is unobservable to a sweep by construction; it commits its row deletes before it unlinks; it reports `deferred` when it declines; `pruneSnapshots` returns early on that report; and the three unguarded regions in the same code (WR-01, WR-02, WR-04) are wrapped.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-28T08:16Z
- **Completed:** 2026-08-28T08:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **CR-02 closed by an exact exclusion, not a timing guess.** A snapshot is a filesystem fact (the `renameSync` in `publishSnapshot`) before it is a transactional one (the pointer-row insert). Publication is reachable only from behind a WON compare-and-swap, and the compare-and-swap runs inside `begin immediate` — so a published-but-uncommitted writer HOLDS the store's write lock. A sweep that takes `begin immediate` before it reads anything therefore cannot run at all while any writer is inside that window. The publish-to-commit window and the write-lock hold are the same interval; nothing is timed and no constant is tuned.
- **The sweep reports its own abstention.** `reconcileSnapshotRing` returns `{ droppedRows, droppedFiles, deferred }`. When it cannot take the lock inside the connection's five-second `busy_timeout` it changes NOTHING and returns `deferred: true`.
- **Its one production caller consumes that report.** `pruneSnapshots` returns before the doomed-set `select` when the sweep deferred, bounding the added latency at one `busy_timeout` instead of two and removing a swallowed `SQLITE_BUSY` on every contended write.
- **Trap 10's rule now holds at the second row-deleting site.** The sweep's pointer-row deletes are committed through `commitTransaction` before any `rmSync`, so an interrupted sweep leaves extra FILES and never a pointer row aimed at a deleted file. Pinned by a second source-order control with a body-length floor and three presence assertions.
- **The three unguarded regions inside the same code are guarded** — the staging call and the staging→publish→insert window (WR-01), the post-commit prune (WR-02) and `pragma integrity_check` (WR-04).

## Task Commits

1. **Task 1: The judge rule — the sweep decides under the store's write lock, commits its rows, then unlinks** — `7919ae4` (fix)
2. **Task 2: Guard the three unguarded regions — WR-01, WR-02, WR-04** — `03e1266` (fix)

**Plan metadata:** see the `docs(28-11)` commit that carries this file.

_Both tasks were `tdd="true"` and were executed RED-first; the observed RED output is recorded verbatim below. The RED was observed by running the new tests against the pre-change implementation in the same working tree, so each task is one `fix` commit carrying its own now-green tests rather than a separate `test` commit._

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — `reconcileSnapshotRing` rewritten (write lock, five numbered steps, `deferred`, ~70 new doc-comment lines recording CR-02, the exactness derivation, the latency and the interrupted-sweep ordering); `pruneSnapshots` gains the early return and a transaction note; `revertTo` step 6's over-claim recorded as a reversal; WR-01's two handlers in `runWriteSequence`; WR-02's non-rethrowing wrap on step 9; WR-04's wrap in `openStore`; `ViceError` imported for the family predicate.
- `src/mcp/vice/anno-store.test.ts` — five new tests (682 insertions), plus `applyWriteWithoutCommit` added to the import list.

## Verification Evidence

### Precondition (28-10 landed)

```
pragma table_info(anno_snapshot) → [{"cid":0,"name":"revision","type":"INTEGER","notnull":0,"dflt_value":null,"pk":1}]
schema_version                  → 2
```

One row named `revision`, SCHEMA_VERSION 2. Precondition met, so the sweep rewrite was made against the post-identity code.

### Test and typecheck results

| Command | Result |
|---|---|
| `node --test` over the eight targeted `anno-*`/`block-class` files | **144 pass, 0 fail** (baseline before this plan: 139; +5 tests, exactly the five this plan authors) |
| `node --test hostpath-consumers.test.ts` | **11 pass, 0 fail** |
| `node --test anno-durability.test.ts` | **4 pass, 0 fail** |
| `node --test anno-seam.test.ts` (exactly-one-commit-statement) | pass; a direct `\bcommit\b` count over `codeOnly(anno-store.ts, true)` returns **1** |
| `npx tsc --noEmit -p tsconfig.json` | clean |

The two contention tests block on the write lock by design: **CR-02 5036.9 ms, the prune early-return 5111.6 ms** — roughly ten seconds added to a run of these files, stated in each test's own comment so a reader does not mistake it for a hang.

The full workspace suite was deliberately NOT run: it takes ~11 minutes, hangs in `vice-proxy.test.ts` and carries a large unrelated failure baseline, so a truncated run would not be a test result.

### Pre-change RED — CR-02, verbatim

Run against the pre-change `reconcileSnapshotRing` with connection B held between its `renameSync` and its transaction's end by `applyWriteWithoutCommit`:

```
B published r2 at r2.db -- exists BEFORE the sweep: true
reconcileSnapshotRing(A) returned after 1ms:
  droppedRows:  [ [length]: 0 ]
  droppedFiles: [ 'r2.db', [length]: 1 ]
  deferred:     undefined
B's published r2 exists AFTER the sweep: false
```

That is the verifier's own reproduction: `droppedFiles: [ 'r2.db' ]`, B's file gone, revision 2 permanently unrevertible — and it took **1 ms**, because the pre-change sweep took no lock and could not block. The test itself failed first on its elapsed-time half:

```
not ok 1 - CR-02: a sweep cannot delete a snapshot a concurrent writer has published but not yet committed ...
  error: 'the sweep must genuinely have BLOCKED on the write lock rather than completing for an unrelated reason, elapsed 1ms'
```

That elapsed-time half is the one that reddens on its own if a future edit removes the `begin immediate` while keeping the drop-set computation — the most plausible way this repair gets undone.

### Pre-change RED — the prune early-return

```
not ok 2 - a prune whose sweep DEFERRED returns early: one busy_timeout and not two, ...
  duration_ms: 5080.378889
  error: 'database is locked'
  code: 'ERR_SQLITE_ERROR'
  stack: pruneSnapshots (src/mcp/vice/anno-store.ts:709:71)
```

`SQLITE_BUSY` thrown straight out of `pruneSnapshots`' own doomed-set delete after a full five-second `busy_timeout`, failing both the no-throw assertion and the under-8000 ms assertion. **Recorded honestly:** pre-change that five seconds was the FIRST timeout the call paid (the sweep took no lock at all); after the fix, removing the early return would make it the SECOND, on top of the sweep's own — the ~10 s worst case the early return exists to remove. The passing run is **5111.6 ms**, one timeout.

The test's uncontended follow-up call — the half that proves the work was *deferred* rather than abandoned, and without which the test would pass against an implementation that never prunes — passes: after `closeStore(b)` releases the lock, a second `pruneSnapshots(a)` deletes both planted pointer rows and both planted files.

### Pre-change RED — WR-01, which halves failed and with what text

| Half | Pre-fix result |
|---|---|
| 1 — error inside the `ViceError` family | **FAILED.** `thrown is Error, instanceof ViceError = false`, message `UNIQUE constraint failed: anno_snapshot.revision` — a bare SQLite error. |
| 2 — `currentRevision` unchanged (the CAS rolled back) | **FAILED.** Read `2`, expected `1`: the transaction was left OPEN with the compare-and-swap applied, so a refused write read as an advanced revision. |
| 3 — no staged `.tmp` in the ring | **PASSED even pre-fix**, and this is stated rather than claimed as a red. At this planting `publishSnapshot` has already renamed the staging file onto `r1.db` before the failing insert, so no `.tmp` remains. The half is retained because it is the assertion a leftover `.tmp` would trip, and its reader is non-vacuity-pinned by staging a real one through `stageSnapshot` first. The `.tmp` direction is genuinely exercised by the reachable pre-lock arm and by the pre-existing `"a refusal leaves NOTHING behind on disk"` test. |
| 4 — a following `applyWrite` on the SAME handle succeeds | **FAILED.** `Error: cannot VACUUM from within a transaction` — direct evidence the transaction was left open, which is exactly what this half exists to detect. |
| Reachable pre-lock arm (a regular FILE at the ring directory's path) | **FAILED.** `thrown is Error, instanceof ViceError = false`, message `EEXIST: file already exists, mkdir '<dir>/proj.annostore.snapshots'`. |

The structural WR-02/WR-04 control also reddened pre-change, on the site whose guard was missing:

```
not ok 2 - WR-02 and WR-04, STRUCTURAL: the two remaining unguarded calls are inside handlers
  error: the try above pruneSnapshots(handle) must still be OPEN where the call is made -- an already-closed handler guards nothing
  44 !== -1
```

### Criterion 4's planted violation still reddens under the sweep's new transaction

`anno-durability.test.ts`'s planted violation is "remove the commit", driven through `applyWriteWithoutCommit`. The reasoning that it still reddens, walked through the new code:

1. With `commitTransaction` not reached, the write sequence's `begin immediate` transaction stays OPEN on that connection.
2. `applyWriteWithoutCommit` passes `doCommit: false`, so step 9 is not reached at all in the planted mode — and in the committing mode the transaction is closed before step 9, so the sweep's own `begin immediate` opens cleanly.
3. Even if the sweep were reached inside an open transaction, its `begin immediate` would fail ("cannot start a transaction within a transaction"), its catch would return `deferred: true`, `pruneSnapshots` would return early without touching a row, and WR-02's wrap would in any case swallow anything that did escape.
4. The mutator then self-`SIGKILL`s with nothing committed, and the reopen finds revision 0 with no pointer row.

So the planted run still reddens in BOTH halves (`readBackByValue` false and `revertReturnsPriorValue` false) from the one planting, and the committing run still reads back revision 1 with its pointer row. Observed: `anno-durability.test.ts` **4/4 pass**, and the module still contains exactly **one** commit statement, so the planting site is still unique. No new string literal in the module names the standalone word either — the seam's scan keeps literal bodies, so the new `AnnoStoreError` messages deliberately say "the write sequence", "the transaction" and "publish the snapshot and insert its pointer row" instead.

### `revertTo` step 6's recorded reversal — before/after grep counts

| Search | Pre-change | Post-change |
|---|---|---|
| `grep -cF 'well as before one.'` | **1** (at `anno-store.ts:1304`) | **0** |
| `grep -cF 'as well as before one.'` | 0 (the sentence WRAPS — this is why the shorter single-line form is the one used) | 0 |
| `grep -c 'unless the sweep deferred'` | **0** | **1** |

The pre-change 1 makes the post-change 0 a **demonstrated removal** rather than a search term that never matched.

**The first clause survived unchanged and was not weakened.** The handle `revertTo` hands back still never advertises a revision it cannot deliver, because the published floor routes through `retainedRevisions()`, which requires BOTH halves of a revision's record (pointer row AND file) regardless of whether the sweep ran. 28-07 P2 therefore still holds at that seam. Only the SECOND clause — the directory bound after a revert — became conditional on the sweep not having deferred.

## Shipped fact: the new caller-visible write latency

**This is new behaviour a reader of the old code would not expect, and it is stated here as well as in the `reconcileSnapshotRing` doc comment and in `T-28-11-03`.**

Before this change the sweep took no write lock and could not block at all. After it, under contention, a caller blocks inside `reconcileSnapshotRing` for **up to the connection's five-second `busy_timeout`** before it proceeds — at **BOTH** of the sweep's two call sites:

1. **Every accepted write**, through `pruneSnapshots` at `runWriteSequence` step 9.
2. **Every `revertTo`**, through its own step-6 sweep on the restored handle.

Phase 29 puts both on an MCP tool path. Each is bounded at **ONE** timeout and not two, because `pruneSnapshots` returns early when the sweep reports `deferred` rather than running its own autocommit deletes into the same contention — where they would block a second five seconds and then throw `SQLITE_BUSY` into WR-02's swallowing wrap, making the worst case roughly ten seconds of silent added latency for work guaranteed to be redone.

The accepted consequence in the other direction: the ring may temporarily exceed `MAX_SNAPSHOT_REVISIONS` files until the next accepted write sweeps successfully. That is the extra-FILES direction, which trap 10's own premise calls harmless and reconcilable by revision number, and it is REPORTED (`deferred: true`) rather than silent.

## Decisions Made

See `key-decisions` in the frontmatter. The two that a later reader is most likely to want to reverse, and the reason not to:

- **The grace bound was refused, on the record.** Gap 1's remedy 2 offered either a grace bound over the publish-to-commit window or serialisation under `begin immediate`. A grace bound has a tuned constant, is wrong for a writer that is paged out or stopped at a debugger, and the next reproduction of this defect would arrive as "just raise the constant" — the exact "closed the reproduction, the property stayed false one step to the side" pattern the verification named. The lock is available from code the writer already runs, so the exclusion is exact by derivation.
- **`pruneSnapshots` returns early rather than pressing on.** Acting on a doomed set computed over a ring its own sweep just declined to reconcile is 28-07 P2's forbidden shape with an extra step, and it costs a second `busy_timeout` for work guaranteed to be redone.

## Deviations from Plan

**1. [Rule 3 - Blocking] The `unless the sweep deferred` marker had to be lowercase**

- **Found during:** Task 1 (the `revertTo` step-6 comment rewrite)
- **Issue:** The module's house style uses SHOUTING CAPS for emphatic clauses, and the reversal clause was first written as `UNLESS THE SWEEP DEFERRED`. Task 1's acceptance criterion greps case-sensitively for `unless the sweep deferred`, which then returned **0**.
- **Fix:** Reworded the bullet so the CAPS label (`THE SECOND CLAUSE IS CONDITIONAL.`) and the lowercase prose clause coexist. Re-checked: `grep -c 'unless the sweep deferred'` → 1, and `grep -cF 'well as before one.'` → 0.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** both greps re-run; committed in `7919ae4`.

**2. [Rule 2 - Missing Critical] The reachable pre-lock arm was folded into the WR-01 test rather than added as a sixth `test()`**

- **Found during:** Task 2
- **Issue:** Task 2's `<action>` says "Add the reachable-arm sibling", but the plan's `<artifacts_this_phase_produces>` names exactly five new test names and Task 2's own acceptance criterion pins the test count at "the count after 28-10 plus the 5 tests this plan adds". A sixth `test()` would have broken that count.
- **Fix:** The reachable arm lives inside the WR-01 test as a second `inTempDir` block with its own fixture (it needs a store whose ring directory does not exist yet). Both arms are asserted; the test count is exactly 144 = 139 + 5.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** `node --test` over the eight targeted files reports 144 tests, 144 pass.
- **Committed in:** `03e1266`

**3. [Rule 2 - Missing Critical] `ViceError` imported directly into `anno-store.ts`**

- **Found during:** Task 2
- **Issue:** The WR-01 handlers must "rethrow a `ViceError` unchanged", and `anno-store.ts` did not import the class.
- **Fix:** Added `import { ViceError } from "./vice.ts";` with a comment stating it is for that one purpose. Nothing new enters the module graph: `anno-types.ts` already imports the same class from the same file, and `vice.ts` imports nothing from the `anno-*` family, so there is no cycle. Verified `anno-confinement.test.ts`, `anno-seam.test.ts` and `hostpath-consumers.test.ts` all stay green.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `tsc --noEmit` clean; 144/144 and 11/11.
- **Committed in:** `03e1266`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical)
**Impact on plan:** All three are mechanical consequences of the plan's own constraints (a case-sensitive grep, a pinned test count, a needed import). No scope creep, and no plan decision was reinterpreted.

## Known Stubs

None.

## Issues Encountered

- **Half 3 of the WR-01 test does not redden at the planted collision.** Recorded rather than papered over, in the RED table above. The primary-key collision fires *after* `publishSnapshot` has renamed the staging file away, so no `.tmp` survives even pre-fix. The half is retained (a leftover `.tmp` would trip it, and its reader is non-vacuity-pinned by a real planting), and the `.tmp` direction is genuinely exercised by the reachable pre-lock arm and by the pre-existing `"a refusal leaves NOTHING behind on disk"` test. The plan predicted "all three of the last three halves fail"; two of the three did.
- **The sweep's `begin immediate` failure is caught unconditionally**, not filtered to `SQLITE_BUSY`. `node:sqlite` surfaces the busy case as a plain `Error` with `code: 'ERR_SQLITE_ERROR'` and `errcode: 5` and no distinct class, so a class-based filter is not available; and any other failure to open that transaction equally means the function cannot establish the moment it is required to judge from. Deferring is therefore correct in every arm. Documented in the code.

## Named Residual Carried Forward, Unattempted

**Backstop D11's link 3 is unproven under POWER LOSS as distinct from `SIGKILL`.** This is deliberately NOT attempted here, exactly as the plan directs: it is outside the phase's stated failure model, and `28-VERIFICATION.md` states explicitly that it does not gate the phase. Nothing in this plan narrows or widens it — the durability proof's kill model is unchanged.

Also carried forward untouched, and stated so the set is closed: the eight remaining `28-REVIEW.md` warnings (WR-03, WR-05..WR-10) and the four info items, which the verification re-read and found falsify no must-have and no success criterion.

## Plan Success Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | A sweep leaves a concurrent writer's published-but-uncommitted snapshot on disk, proven by the two-connection test whose pre-change RED reproduced `droppedFiles: [ 'r2.db' ]` | **met** |
| 2 | The sweep commits its row deletes before it unlinks, pinned by a reddenable source-order control | **met** |
| 3 | Exactly one commit statement remains, and no new string literal names it | **met** (count = 1) |
| 3a | Added latency bounded at ONE `busy_timeout`, proven by the early-return test with its uncontended follow-up, and recorded in the doc comment and in `T-28-11-03` | **met** |
| 4 | A throw at the deepest point of the staging→insert window leaves no open transaction, no `.tmp` and no non-family error, proven by a deterministic primary-key collision | **met** |
| 5 | The two structurally-pinned warnings are guarded, with the reason stated and the behavioural sibling named | **met** |
| 6 | Eight targeted files green; `hostpath-consumers.test.ts` 11/11; `tsc --noEmit` clean; `anno-durability.test.ts` 4/4 | **met** |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap 1 of `28-VERIFICATION.md` is now closed in all three of its parts: 28-10 settled which store owns a ring and how a revision's file is located; this plan settles who may judge an unclaimed file.
- `STORE-04` and `STORE-07` are marked complete for this plan's declaration; the shared-ID gate defers any ID a sibling plan still declares without a SUMMARY.
- **Carry into Phase 29 planning:** the write path and `revertTo` can now each stall for up to five seconds under contention. Any MCP tool built over `applyWrite` or `revertTo` inherits that, and its own timeout budget must accommodate it.
- **Carry into 28-12:** the sweep's return type gained a field. Any code that destructures `reconcileSnapshotRing`'s result must account for `deferred`, and any new caller must be outside an open transaction.

## Self-Check: PASSED

- `src/mcp/vice/anno-store.ts` — FOUND, modified
- `src/mcp/vice/anno-store.test.ts` — FOUND, modified
- Commit `7919ae4` — FOUND in `git log`
- Commit `03e1266` — FOUND in `git log`
- All task `<acceptance_criteria>` re-run after the final commit: 144/144 on the eight targeted files, 11/11 `hostpath-consumers.test.ts`, 4/4 `anno-durability.test.ts`, `tsc --noEmit` clean, commit-statement count 1, both greps at their required values.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*
