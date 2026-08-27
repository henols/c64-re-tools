---
phase: 28-the-store-core
plan: 06
subsystem: database
tags: [sqlite, node-sqlite, durability, sigkill, optimistic-concurrency, snapshot-ring, annotation-store]

# Dependency graph
requires:
  - phase: 28-the-store-core (plan 28-01)
    provides: "openStore's four refusal branches, runWriteSequence's eight ordered steps and its single commit site, applyWriteWithoutCommit, snapshotPathFor, revertTo, and MAX_SNAPSHOT_REVISIONS declared-but-unenforced in anno-types.ts"
  - phase: 28-the-store-core (plan 28-04)
    provides: "AnnoWriteResult { revision, changed: boolean }, runWriteSequence's rollback on a throwing mutation, AnnoLabelError.identifier"
  - phase: 28-the-store-core (plan 28-05)
    provides: "SetDataTypeResult with its always-present contradictedComments array, and the phase's model for correcting a plan fact by measurement"
  - phase: 27-shared-seams-extracted
    provides: "shipped-modules.ts (shippedTsModules, codeOnly with keepLiteralBodies), and acme-gate.ts's test-only header clause"
provides:
  - "A BOUNDED snapshot ring: pruneSnapshots() and oldestRetainedRevision() plus the named NO_RETAINED_REVISION sentinel, pruned after the commit and outside the transaction, file before pointer row"
  - "revertTo refuses a revision the ring no longer retains BY NAME, carrying the requested revision, the oldest retained one, the current one and the bound -- never substituting the nearest snapshot"
  - "anno-durability-mutator.mjs: a test-only, never-shipped, SPAWNED child that mutates a store and SIGKILLs itself, in three modes sharing one code path"
  - "anno-durability.test.ts: the ONE combined durability-and-revert proof STORE-04 demands, with its planted counterpart in the same shape through the same helper"
  - "The cross-process stale-revision refusal, observed across two genuinely separate OS processes with both error fields and both rows' fates asserted"
  - "node:sqlite bounded in the TEST tree by a declared, deepEqual+length-paired one-element list"
affects: [store query surface, r2000 annotation tooling, any later plan that adds a store test]

# Actuals (#2632) -- same estimateTokens scale (chars/4) as the plan's estimate.
actuals:
  tokens: 16389
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-SIGKILLing spawned child as a durability instrument: a test-only .mjs that imports the .ts seam, mutates, and process.kill(process.pid, 'SIGKILL')s itself; the parent ignores status 137 and reads every claim off the FILE"
    - "Planted violation as a PARAMETER to the same code path (applyWriteWithoutCommit) rather than a hand-edited copy, plus the honest statement that a parameterised planting is never self-sufficient -- the by-hand removal of the real commit is still owed"
    - "Booleans-as-values assertion shape: one observation helper returns the claims as data, the single catch CONVERTS a named domain refusal into false, and every assertion sits outside any try"
    - "Declared-set guard extended to a second scanned set (the test tree) through the SAME predicate, with a non-vacuity assertion on the scanned set before the deepEqual"
    - "Stated residual as a comment with NO assertion, naming the measured behaviour and the undetectable case, so a residual cannot quietly widen into a claim"

key-files:
  created:
    - src/mcp/vice/anno-durability.test.ts
    - src/mcp/vice/anno-durability-mutator.mjs
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts
    - src/mcp/vice/anno-seam.test.ts

key-decisions:
  - "Snapshot pruning runs AFTER the commit and OUTSIDE the write transaction, deleting the file before its pointer row -- the failure direction is EXTRA files, never a pointer row aimed at a deleted file"
  - "A revert past the bound is REFUSED by name, never substituted with the nearest retained snapshot"
  - "oldestRetainedRevision() reads the pointer ROWS, not currentRevision() - MAX_SNAPSHOT_REVISIONS, and reports a named NO_RETAINED_REVISION on an empty ring"
  - "node:sqlite is now bounded in the TEST tree by a declared one-element list whose member is anno-seam.test.ts itself -- the store's own test file needs no such import"
  - "The mutator's mutation is a single raw insert rather than setDataType, forced by the requirement that the planted mode differ from the committing mode ONLY in the write wrapper"

patterns-established:
  - "Durability instrument: spawn a sibling .mjs with execFileSync(process.execPath, ..., { stdio: 'pipe' }), let it SIGKILL itself, swallow status 137, and read every claim off the store file"
  - "Two-guard disclosure: when a claim is defended by two independent guards and only one is reachable from a synchronous test, both plantings are run and BOTH results are recorded at the test site"

requirements-completed: [STORE-04, STORE-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The snapshots/ directory is BOUNDED at MAX_SNAPSHOT_REVISIONS: after more writes than the bound, the files on disk, the anno_snapshot pointer rows and the reported floor all agree"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#the snapshot ring is BOUNDED at MAX_SNAPSHOT_REVISIONS: after more writes than the bound, the files on disk, the pointer rows and the reported floor all agree"
        status: pass
      - kind: manual_procedural
        ref: "planted violation: pruneSnapshots() call removed -- 'the snapshots directory must hold at most 32 files, found 40' (35 tests, 2 fail), reverted"
        status: pass
    human_judgment: false
  - id: D2
    description: "A revert to a revision the ring no longer retains is REFUSED by name -- requested revision, oldest retained, current revision and the bound all in the message -- and the store is unchanged afterwards"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a revert PAST the bound is REFUSED by name -- it names the requested and the oldest retained revision, and does NOT substitute the nearest retained snapshot"
        status: pass
      - kind: manual_procedural
        ref: "planted violation: revertTo falls back to the nearest available snapshot -- the revert-past-the-bound and revert-idempotency tests both go red (35 tests, 2 fail), reverted"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reverting and opening are both idempotent in the form that actually holds: the observable state after one revert equals the state after a refused second revert, and opening/closing twice with no write between changes nothing"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#idempotency of revert: reverting to r yields the state at r, and a SECOND revert to the same r is refused and leaves that state byte-for-byte unchanged"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#idempotency of open: opening and closing a store twice with no write between leaves the revision, the rows and the snapshot ring unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four corrupt-file shapes are refused with AnnoStoreCorruptError -- zero-length, mid-file truncation, a foreign file, and a schema_version mismatch -- each assertion checking the error CLASS and a substring of its MESSAGE"
    requirement: "STORE-05"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a zero-length store file is REFUSED with AnnoStoreCorruptError instead of opening as a pristine empty database"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a file that is not a database at all is refused, and the refusal names what SQLite said as well as what the store refuses to assume"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a store truncated mid-file is refused rather than read -- and integrity_check reports exactly one row reading ok on a healthy one"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#a store file whose schema_version is not this build's is refused, and the refusal names both versions"
        status: pass
    human_judgment: false
  - id: D5
    description: "The tail-truncation residual is STATED, not claimed closed: a 100-byte tail truncation of a 12 KB store opens and returns correct rows on raw node:sqlite and is closed here only by pragma integrity_check; a truncation small enough for integrity_check to still report ok WOULD open"
    requirement: "STORE-05"
    verification: []
    human_judgment: true
    rationale: "Deliberately carries NO assertion. The undetectable case was not measured as detectable, and asserting a behaviour nobody measured is exactly how a stated residual becomes a false claim. A human reading the comment is the only check, and that is the intended shape."
  - id: D6
    description: "ONE combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value -- both halves computed as booleans outside any try"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value"
        status: pass
    human_judgment: false
  - id: D7
    description: "The planted counterpart, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE, plus the mechanism (revision 0, no pointer row, the orphaned r0.db still on disk, a NAMED refusal)"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE -- one planting, both halves"
        status: pass
    human_judgment: false
  - id: D8
    description: "STORE-04's OBSERVED RED: runWriteSequence's single commit removed BY HAND, the committing mode then yielding revision=0 readBackByValue=false revertReturnsPriorValue=false -- both halves, matching phase research exactly -- and reverted before the commit"
    requirement: "STORE-04"
    verification:
      - kind: manual_procedural
        ref: "commitTransaction(handle.db) deleted from runWriteSequence's doCommit branch; both booleans read via a probe mirroring the test helper; reverted from a file copy (never git checkout). Recorded verbatim in commit aefe2ed's message"
        status: pass
    human_judgment: true
    rationale: "A by-hand planting against the real shipped call path is a one-off observation, not a CI artefact -- D7's permanently-green test proves the criterion's SHAPE is falsifiable but never exercises the absence of the commit in the real path. The verifier must read this as the observed red and D7 as its complement, not as a substitute."
  - id: D9
    description: "An interrupted write is all-or-nothing (both acceptable states enumerated explicitly), and an orphan snapshot file is identified by its revision from its filename alone and does not affect the readback"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#STORE-04, one combined test ... (all-or-nothing assertions folded into the same run)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-durability.test.ts#an orphan snapshot file left in the kill window is identified by its revision and does not affect the readback"
        status: pass
    human_judgment: false
  - id: D10
    description: "A write whose base revision is not the current on-disk revision is REFUSED with AnnoStoreStaleRevisionError carrying BOTH revisions, observed after a genuinely separate OS process committed -- the other process's row intact, the refused write's row absent"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#cross-process compare-and-swap: after a genuinely separate OS process commits, a write with the now-stale base revision is REFUSED with both revisions -- the other process's row survives and the refused write's row is absent"
        status: pass
      - kind: manual_procedural
        ref: "planted violation: the step-2 base-revision refusal removed -- 'Missing expected exception' (36 tests, 2 fail); the stale write is silently accepted, which is T-28-lostwrite happening. Reverted"
        status: pass
    human_judgment: false
  - id: D11
    description: "Last-write-wins is refused, not resolved: after the refusal, the same write with the CURRENT revision as its base succeeds, so a caller that wants to overwrite must supply a fresh base explicitly"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#cross-process compare-and-swap: ... (the retry-with-a-fresh-base assertion in the same test)"
        status: pass
    human_judgment: false
  - id: D12
    description: "node:sqlite is still named by exactly one module of the shipped set AND the set of TEST files naming it is a declared, deepEqual+length-paired one-element list, with a planted non-vacuity control"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#node:sqlite is bounded in the TEST tree too: the set of test files naming it is a DECLARED list"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#non-vacuity of the test-tree scan: a planted test file naming the specifier IS reported by the same predicate"
        status: pass
    human_judgment: false
  - id: D13
    description: "The mutator is test-only: absent from package.json files[] (asserted mechanically), and its filename does not match the *.test.* glob the runner collects -- checked with test-gate.mjs's own predicate"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-durability.test.ts#the mutator is test-only: absent from package.json files[], and its filename does not match the *.test.* glob the runner collects"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs -- exit 0, @henols/vice-mcp 80 files, neither new file listed"
        status: pass
    human_judgment: false
  - id: D14
    description: "The default `delete` journal mode is pinned, and its on-disk consequence too: no -wal, -shm or -journal sidecar beside a cleanly closed store"
    requirement: "STORE-05"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#pragma journal_mode on a freshly created store reads delete -- the default is the decision, and nothing sets it"
        status: pass
    human_judgment: false
  - id: D15
    description: "Phase-close whole-glob evidence run reconciled item by item against the 44-failure clean baseline, with the VICE broker stopped and the leaked vice-proxy.test.ts child terminated by hand"
    verification:
      - kind: manual_procedural
        ref: "cd src/mcp/vice && npm test -- 2748 tests / 2632 pass / 44 fail; failures grouped by location: 39 vice-proxy.test.ts + 5 r2000-session.test.ts, zero elsewhere"
        status: pass
    human_judgment: true
    rationale: "The run does not terminate unaided and its exit code is not the gate -- the failure LIST is, reconciled by file against a documented baseline. Both steps (terminating the hung child by PID, and the item-by-item reconciliation) are human judgment, not an automated assertion."

# Metrics
duration: 43 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 06: The Combined Durability Proof, the Cross-Process Refusal and the Bounded Snapshot Ring Summary

**One combined test proves durability and revert together across a real `SIGKILL` in a separate OS process — with the removed `COMMIT` observed reddening both halves — plus the cross-process stale-revision refusal, four corrupt-file refusals with the tail residual stated rather than claimed, and a snapshot ring bounded at a single-homed constant.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-08-27T18:17:33Z
- **Completed:** 2026-08-27T19:00:09Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **`STORE-04`'s combined proof exists and is falsifiable two ways.** `anno-durability-mutator.mjs` opens a store in a separate OS process, writes through the real `runWriteSequence`, and `process.kill(process.pid, "SIGKILL")`s itself with **no clean close and no `process.exit`**. The parent — a genuinely different OS process — reopens the file, reads the mutation back by value, and reverts. Both claims are computed as **booleans by one shared helper called exactly twice** (once per mode) and asserted as values outside any `try`.
- **The removed `COMMIT` was observed reddening both halves.** With `commitTransaction(handle.db)` deleted from `runWriteSequence`'s `doCommit` branch, the **committing** mode yields `revision=0 readBackByValue=false revertReturnsPriorValue=false` — identical to phase research's `[no-commit]` line — against `revision=1/true/true` on the pristine build. Reverted from a file copy before the commit.
- **The snapshot ring is bounded, closing `WINDOWS.md` window 16 (`T-28-diskgrowth`).** `pruneSnapshots()` runs as step 9 of the write sequence, **after the commit and outside the transaction**, deleting the file before its pointer row. `oldestRetainedRevision()` reads the pointer rows; `NO_RETAINED_REVISION` is a named sentinel. `MAX_SNAPSHOT_REVISIONS` is imported from `anno-types.ts` — no literal copy anywhere.
- **A revert past the bound refuses by name.** The message carries the requested revision, the oldest retained one, the current one and the bound. The test additionally asserts the store is **unchanged** after the refusal, because a best-effort substitution would also throw nothing.
- **The stale-revision refusal is proven across two genuinely separate OS processes.** The mutator's commit-and-exit mode commits a *different* range (status checked, not ignored), then the parent's stale-base write is refused with **both** `AnnoStoreStaleRevisionError` fields checked, the child's row asserted present and the refused row asserted absent — and the same write with a fresh base is asserted to succeed, because the store refuses a stale base rather than resolving it.
- **`node:sqlite` is now bounded in the test tree as well as in the shipped set**, by a declared `deepEqual`+`length`-paired one-element list through the same `namesNodeSqlite` predicate, with a planted non-vacuity control.
- **The tail-truncation residual is stated with no assertion**, and the two corrupt-file refusals that previously checked only the error class now check a message substring too.

## Task Commits

1. **Task 1: Bound the snapshot ring, prove the four corrupt-file refusals with the tail residual stated, widen the seam guard to the test tree** — `3fccfc5` (feat)
2. **Task 2: The self-SIGKILLing mutator child and the ONE combined durability-and-revert test** — `d86739e` (test)
3. **Task 3: Observe the removed COMMIT reddening both halves, and prove the cross-process stale-revision refusal** — `aefe2ed` (test)

## Files Created/Modified

- `src/mcp/vice/anno-durability-mutator.mjs` (136 lines, new) — the test-only, **spawned never imported** child. Three modes (`commit`, `no-commit`, `commit-and-exit`) sharing ONE function whose only parameters are the write wrapper and the range. Absent from `files[]`; its name deliberately misses the `*.test.*` glob because collected as a test it would SIGKILL the runner.
- `src/mcp/vice/anno-durability.test.ts` (372 lines, new) — the combined test, its planted counterpart, the all-or-nothing and orphan-snapshot assertions, and the mechanical `files[]`/glob checks. 4 tests.
- `src/mcp/vice/anno-store.ts` (+95/-8) — `NO_RETAINED_REVISION`, `oldestRetainedRevision()`, `pruneSnapshots()`, the step-9 prune call, `revertTo`'s named refusal past the bound, header trap 10, and step 9 added to `runWriteSequence`'s ordered list.
- `src/mcp/vice/anno-store.test.ts` (+382) — the bound, the refusal past the bound, the two idempotency proofs, the cross-process CAS proof, the stated residual, the no-sidecar half of the journal-mode pin, and message substrings on two refusals. 36 tests.
- `src/mcp/vice/anno-seam.test.ts` (+87/-2) — `TEST_FILES_NAMING_SQLITE`, the test-tree scan through the shared predicate, and its planted non-vacuity control. 16 tests.

## Decisions Made

1. **Pruning runs after the commit and outside the transaction, file before pointer row.** A filesystem unlink is not transactional, so the ordering *chooses* which failure a kill in the window produces. The choice is **extra files** — harmless and reconcilable by revision number — over a pointer row aimed at a deleted file, which is the one state the revert path cannot survive.
2. **A revert past the bound is refused by name, never substituted.** Returning a different revision than the one asked for changes the caller's intent with nothing recording it.
3. **`oldestRetainedRevision()` reads the rows, not the arithmetic.** `currentRevision() - MAX_SNAPSHOT_REVISIONS` agrees with the rows only on a store written forward; after a revert it names a revision no row records, and a floor naming an unrevertable revision is worse than no floor.
4. **The declared test-tree list's member is the guard file itself.** The store's own test file needs no `node:sqlite` import (see Deviations), and `anno-seam.test.ts` is unavoidably a member because its four planted access routes are *string literals* and a specifier scan must keep literal bodies.
5. **The mutator's mutation is a raw insert, not `setDataType`.** `setDataType` hard-wires the committing wrapper, so routing one mode through it would make the two modes differ in more than the commit — the exact drift a parameterised planting exists to prevent. `retype()`'s split-and-preserve logic is `STORE-02`'s subject and is proven in `anno-overlap.test.ts`.

## Deviations from Plan

### Measured false: three plan facts that did not survive measurement

Following plan 28-05's precedent — the evidence is not bent to fit the plan text.

**1. [Rule 1 — Bug in the plan's premise] The corrupt-fixture `node:sqlite` import is unnecessary, so it was NOT added.**
- **Found during:** Task 1.
- **Issue:** The plan states the `schema_version` mismatch fixture requires importing `DatabaseSync` from `node:sqlite` **in `anno-store.test.ts`**, "because the store deliberately exposes no way to write a wrong version", and an acceptance criterion asks for a three-part annotation at that import site. Measured false: `AnnoStoreHandle` exposes its own `db`, and the pre-existing test at `anno-store.test.ts` already forges that fixture with one `UPDATE` through the open handle.
- **Fix:** No import was added. Adding one purely to satisfy a grep count would be exactly the dependency spread the seam guard exists to prevent.
- **Consequence for the plan's Test 10:** the declared test-tree list still has **one** member and is still `deepEqual`+`length`-paired — but the member is `anno-seam.test.ts` itself, because its planted route strings are string literals a `keepLiteralBodies` specifier scan cannot distinguish from route (d). Measured over all 121 test files: exactly one hit. `grep -c "node:sqlite" anno-store.test.ts` reports 2 (both in the residual comment, which `codeOnly()` strips), so that criterion is satisfied without a code-level dependency.
- **Committed in:** `3fccfc5`.

**2. [Rule 1 — Bug in the plan's premise] `revertTo(r)` twice is structurally impossible, not idempotent.**
- **Found during:** Task 1.
- **Issue:** The plan's Test 9 asks that "`revertTo(r)` twice in a row leaves the same `listRanges()` result and the same `currentRevision()`". Measured: the snapshot of revision *r* is a whole-store image taken **before** the write that produced *r+1*, so it contains pointer rows for `0..r-1` only — a snapshot cannot record a snapshot of itself. A second `revertTo(r)` is therefore refused by name.
- **Fix:** Asserted the idempotency that **does** hold, which is stronger: the observable store state after "revert to *r*" and after "revert to *r*, then attempt it again" is **identical** — the second attempt is refused and changes nothing — and the revision *below* it is still reachable, which makes the refusal a bound rather than a dead end. The measurement and its structural reason are recorded at the test site.
- **Committed in:** `3fccfc5`.

**3. [Rule 1 — Bug in the plan's premise] An unconditional step-5 CAS does not redden the cross-process test.**
- **Found during:** Task 3.
- **Issue:** The plan's third planting asserts that "temporarily changing `runWriteSequence`'s compare-and-swap to an unconditional `update anno_meta set revision = revision + 1 where id = 1` makes the cross-process test FAIL". Two measurements:
  - The **literal** planting (dropping the `revision = ?` placeholder while keeping `.run(rev)`) reddens 27 of 36 tests with `column index out of range` — a bound-parameter arity error, not a semantic red.
  - A **tautological** CAS (`and ? is not null`, parameter preserved so the statement still runs) leaves the cross-process test **GREEN** and reddens only `anno-seam.test.ts`'s structural CAS assertion (52 tests, 1 fail).
- **Root cause:** the cross-process refusal comes from `runWriteSequence`'s **step-2** pre-transaction base-revision check, not from step 5's CAS. The CAS guards a *different* window — a writer committing between step 1's read and step 5's update — which a synchronous single-threaded test cannot open, which is precisely why it is pinned structurally.
- **Fix:** Ran the planting that actually falsifies the claim — removing the step-2 check — and observed the cross-process test fail with `Missing expected exception` (36 tests, 2 fail): the stale write is silently accepted, which is `T-28-lostwrite` happening. **Both** results are recorded in a comment at the test site so a later reader concludes neither that the CAS is dead code nor that this test's green proves the CAS.
- **Committed in:** `aefe2ed`.

---

**Total deviations:** 3 auto-fixed (3 × Rule 1, all plan-premise corrections rather than implementation bugs).
**Impact on plan:** No scope creep and no criterion abandoned. Every truth the plan states is discharged; three of its stated *mechanisms* were wrong and the correct ones are proven and documented in place. One acceptance criterion (`grep -c "assert.equal(.*length, 1)"` ≥ 2 in `anno-seam.test.ts`) is satisfied as written — measured 2.

## Verification

All runs with the **VICE broker confirmed stopped** (verified by reading `/proc/<pid>/cmdline` for every live `node` process — never a pattern match) and **no `x64sc` running**.

| Gate | Command | Result |
|---|---|---|
| Store test files | `cd src/mcp/vice && node --test anno-store.test.ts anno-seam.test.ts anno-durability.test.ts anno-types.test.ts anno-index.test.ts anno-overlap.test.ts test-gate.test.ts shipped-modules.test.ts` | **114 tests / 114 pass / 0 fail** |
| Typecheck | `cd src/mcp/vice && npm run typecheck` | exit 0 |
| Tarball validator | `node scripts/check-npm-packages.mjs` | `check-npm-packages: OK` — `@henols/vice-mcp` 80 files; neither new file listed |
| Routine gate | `cd src/mcp/vice && npm run test:automated` | exit 1 on the baseline alone: **2621 tests / 2582 pass / 5 fail** — all 5 the named `plan 18-06:` tests in `r2000-session.test.ts` (`regenerator2000` absent from `PATH`). **Zero failures in any other file.** The `:615` load-sensitive flake did not appear. |
| Glob membership | `automatedTestFiles()` | `anno-durability.test.ts` present (113 files), `anno-durability-mutator.mjs` absent, `MANUAL_ONLY_TESTS` still 9 entries — **no edit** |
| **Phase-close evidence run** | `cd src/mcp/vice && npm test` | **2748 tests / 2632 pass / 44 fail** — reconciled by `location:` field: **39 `vice-proxy.test.ts` + 5 `r2000-session.test.ts` = 44**, exactly the documented clean baseline. **Zero failures in any phase-28 file.** |

**Phase-close run mechanics, recorded because they are not reproducible from the command alone.** `npm test` does not terminate unaided: its results were complete and static at ~550 s, and the hung `vice-proxy.test.ts` child was then terminated **by PID** (`kill -TERM 285308`), identified by walking `ps` from the `npm` process I spawned down through `sh -c` to `node --test` to its one live grandchild. Nothing outside that tree was signalled, and no pattern kill was used anywhere. The runner printed its summary immediately afterwards.

**Four observed reds, each named in its own commit message and reverted from a file copy before that commit** (never `git checkout`, per the work-loss incident in plan 28-04):

| Planting | Observed | In |
|---|---|---|
| `pruneSnapshots()` call removed | "the snapshots directory must hold at most 32 files, found 40" (35 tests, 2 fail) | `3fccfc5` |
| `revertTo` falls back to the nearest available snapshot | the revert-past-the-bound and revert-idempotency tests both red (35 tests, 2 fail) | `3fccfc5` |
| `runWriteSequence`'s single `commit` removed by hand | committing mode: `revision=0 readBackByValue=false revertReturnsPriorValue=false` — **both halves** | `aefe2ed` |
| step-2 base-revision check removed | cross-process test: `Missing expected exception` (36 tests, 2 fail) — the lost write | `aefe2ed` |

## Issues Encountered

- **`state.update-progress` cannot find its target in this project** (`"Progress field not found in STATE.md"`) — the plan counters live in STATE.md frontmatter rather than as a body progress bar, as `28-01-SUMMARY.md` already records. `completed_plans` was corrected by hand from 10 to 11 **three times**, because `state.advance-plan`, `state.record-session` and `state.add-decision` each recompute and reset it.
- **`state.record-session` orphaned the previous `Stopped at:` detail block**, swapping only its first line and leaving plan 28-05's twenty-line body beneath a `Completed 28-06-PLAN.md` header. Repaired by hand with a 28-06 block.
- **`roadmap.update-plan-progress` emitted the malformed row `| In Progress|  |`** (missing the date column) and left the `**Plans**: N/6` prose clause stale, exactly as on four of the five prior plans. Repaired by hand.
- **No emulator, broker or network was started at any point.** These tests spawn only `process.execPath`.
- **No temp-directory leak:** `ls -d /tmp/anno-*` reports 0 after the full run. Every case uses `mkdtempSync` with an unconditional `finally rmSync`, and **the parent cleans up** because on the `SIGKILL` path the child cannot.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced. The one deliberate no-assertion site — the stated tail-truncation residual — is documented as coverage entry `D5` with `human_judgment: true`, not a stub.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. `SCHEMA_VERSION` stays 1, no `ALTER TABLE`, no new SQL identifier: this plan reads and deletes from `anno_snapshot` and reads `anno_meta`, both created by plan 28-01's DDL. Zero package installs — `node:sqlite`, `node:test`, `node:child_process` and `node:fs` are Node builtins and every other import is a relative path inside `src/mcp/vice/`.

The plan's own register is discharged as follows: `T-28-corrupt` (D4 + D5), `T-28-lostwrite` (D10, planting observed), `T-28-lastwritewins` (D11), `T-28-diskgrowth` (D1 + D2, both plantings observed; **`WINDOWS.md` window 16 resolved**), `T-28-prunerace` (D1, ordering and its chosen failure direction documented at `pruneSnapshots` and in header trap 10), `T-28-absorbedred` (D6 + D7, booleans as values, one shared helper), `T-28-seamspread` (D12, and *tighter* than planned — no test-side import exists), `T-28-journalmode` (D14), `T-28-SC` (accept, zero installs).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 28 is complete: all six plans executed.** `STORE-01` through `STORE-05` and `STORE-07` are discharged across the six plans; this plan closes `STORE-04` and the file-level half of `STORE-05`.
- **Ready for phase-28 verification.** The orchestrator owns marking the phase complete.
- **Carried forward, stated so a verifier does not look for it here:** `STORE-06`'s search surface is deliberately not foreclosed and not built (header trap 5 — an indexed `LIKE 'prefix%'` measured faster than FTS5 `MATCH`, and adding FTS5 later is additive). No per-edit inverse-command journal, no changeset-based revert (`sqlite3changeset_invert` is the one missing session primitive — `createSession` and `applyChangeset` **are** present, so no comment may claim the session surface is absent), no WAL mode, no `MANUAL_ONLY_TESTS` entry, and no fallback that reverts to the nearest available snapshot.
- **Three ledger entries filed** (`WINDOWS.md` 19, 20, 21) recording the three measured-false plan premises, so a later re-read of `28-06-PLAN.md` does not read the corrections as regressions.

## Self-Check: PASSED

- All five `key-files` entries exist on disk (`[ -f ]`), and `28-06-SUMMARY.md` with them.
- All four commits resolve in `git log --oneline --all`: `3fccfc5`, `d86739e`, `aefe2ed`, `de14253`.
- **Zero deletions** across the whole plan: `git diff --diff-filter=D --name-only 214b7f4..HEAD` returns nothing.
- Every plan `min_lines` floor met: `anno-durability.test.ts` 372 (≥150), `anno-durability-mutator.mjs` 136 (≥90), `anno-store.ts` 1290 (≥510), `anno-store.test.ts` 1280 (≥300).
- Both plan-declared new exports are present and exported: `pruneSnapshots`, `oldestRetainedRevision`.
- Every task-level `<acceptance_criteria>` grep re-run green: `residual` 4, `MAX_SNAPSHOT_REVISIONS` 10 in the test / 6 in the seam, `assert.equal(.*length, 1)` 2 in `anno-seam.test.ts`, `node:sqlite` 2 in `anno-store.test.ts`, `execFileSync` calls 2 = `stdio: "pipe"` 2, `applyWrite(` 1 and `applyWriteWithoutCommit(` 1 in the mutator, `process.kill(process.pid` present. **No assertion anywhere compares stderr to an empty string** (measured 0 in both files).
- No stray planting artefact: no `*.orig`, no `*.planting-backup`, and `ls -d /tmp/anno-*` reports 0 leaked temp directories.
- Plan-level `<verification>` re-run and recorded in the Verification table above, including the phase-close whole-glob evidence run.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*
