---
phase: 28-the-store-core
plan: 20
subsystem: database
tags: [sqlite, annotation-store, node-sqlite, revert, snapshots, argument-validation, transaction-state]

requires:
  - phase: 28-the-store-core
    provides: "`revertTo`'s step-2/step-3b gates, `reconcileSnapshotRing`'s `rollbackFailed` field (28-17), `stageSnapshot`'s per-attempt staging rule, `discardSnapshot`, `anno-overlap.test.ts`'s PLANTING A shape"
provides:
  - "`AnnoRevisionArgumentError` — a named refusal for a revision-shaped argument that is not a revision, in the `ViceError` family and deliberately OUTSIDE the corruption family"
  - "`assertRevisionArgument()` called as `revertTo`'s FIRST statement, so the one value that reaches both a bound SQL parameter and a filename is judged before either exists"
  - "`revertTo`'s staging path unique PER ATTEMPT, derived from `randomUUID` — the same primitive `stageSnapshot` uses"
  - "all three of `revertTo`'s staging cleanups routed through `discardSnapshot()`, so there is one place a staging file is removed"
  - "`AnnoStoreHandle.transactionStateUnknown` — the fact that a sweep on this connection reported its own `rollback` threw, carried from the call that produced it to the call that must act on it"
  - "`pruneSnapshots()` returning the sweep's `rollbackFailed` instead of discarding it"
  - "`runWriteSequence` refusing BY NAME, before `begin immediate`, on a handle whose transaction state is unknown — CR-07's bare nested-transaction error turned into a diagnosis"
  - "`revertTo` step 6 closing and reopening rather than returning a handle it cannot vouch for"
  - "PLANTING D, PLANTING E and PLANTING F — three structural controls observed red on the real tree, one hand edit at a time, each restored to an empty diff"
affects: [29-the-mcp-surface, 30-acme-export]

actuals:
  tokens: 11753
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One unvalidated argument that lands in TWO places (a bound SQL parameter and a filename) is validated at the ENTRY, before either landing site exists — so the two can never disagree about what was asked for"
    - "An argument error gets its own class OUTSIDE the corruption family, so a caller distinguishes `you passed the wrong thing` from `your ring is damaged` by class alone, never by substring-matching a message"
    - "A housekeeping fact the producing call may not report (28-11 P5) is carried on the HANDLE, so the accepted write still returns success and the NEXT call is the one that refuses by name"
    - "A structural control is only evidence once it has been seen red against the shipped function with its fix removed by hand, and the tree confirmed byte-identical afterwards"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "WR-22 refused with a NEW class `AnnoRevisionArgumentError` rather than the review's suggested `AnnoStoreStaleRevisionError`: that class carries the TWO revisions that conflicted (28-08 P2's shape) and an argument error has no second revision, so reusing it would force the class to carry a number the caller never supplied."
  - "The validator is deliberately NOT reused for `baseRevision`. That is WR-06, which the round-5 verification does not route to this round; the declination is recorded in the validator's own doc comment so a later reader sees it was decided rather than missed."
  - "`JSON.stringify` alone was not enough to name the offending value verbatim — it renders `NaN` and both infinities as the string `null`, naming a value the caller never passed. The refusal falls back to `String(value)` for the three numbers JSON cannot represent."
  - "The WR-18 fact lives on `AnnoStoreHandle`, not on `AnnoWriteResult` (the `assumption_delta_decision`'s `promote` over `add-alongside`): `AnnoWriteResult`'s own doc comment states `changed` is the ONLY signal distinguishing a no-op from a real edit, and the consequence of the fact lives on the connection, not on the write."
  - "`revertTo` step 6 reuses ONE close-and-reopen block for both arms (a thrown sweep and a reported `rollbackFailed`) via a single `reopenNeeded` local, rather than a second copy of the remedy that could drift."
  - "The head refusal uses the existing `AnnoStoreError` rather than a new class, and echoes the commit handler's own wording (`CLOSE IT AND REOPEN`), so a caller reads one remedy and not two."

patterns-established:
  - "Validate-at-the-entry for any argument that reaches more than one landing site, with the refusal naming WHY a plausible-looking value is refused on purpose"
  - "Carry-on-the-handle for a fact the producing call is forbidden to report"
  - "Positive-count-first structural assertions (count the thing that must be PRESENT), with the removed spelling as a secondary assertion scoped to the function body and never to the module"

requirements-completed: [STORE-04]

coverage:
  - id: D1
    description: "`revertTo`'s `revision` argument is validated at the entry: the four spellings SQLite's INTEGER affinity converts are refused by a class OUTSIDE the corruption family, naming the value verbatim, before any read or write."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/anno-store.test.ts#WR-22: revertTo(handle, "0001") is refused as an ARGUMENT error, by name, before any read or write -- and is NOT in the corruption family'
        status: pass
      - kind: unit
        ref: 'src/mcp/vice/anno-store.test.ts#WR-22: revertTo(handle, "1") is refused as an ARGUMENT error, by name, before any read or write -- and is NOT in the corruption family'
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-22: the numeric shapes that are not revisions -- -1, 1.5 and NaN -- are refused by the same class, before any pointer-row query runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The refusal was not bought by broadening: `revertTo(handle, 1)` on a healthy store still returns a handle at revision 1 with the one range revision 1 held."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-22, THE POSITIVE COMPANION: revertTo(handle, 1) on a healthy store still SUCCEEDS and returns a handle at revision 1 -- the refusal was not bought by broadening"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repeated reverts to the same revision leave zero staging residue: every exit `revertTo` takes removes its own staging file, through all three cleanup sites."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-24, BEHAVIOURAL: several sequential reverts to the SAME revision each succeed and leave ZERO revert-staging residue behind"
        status: pass
    human_judgment: false
  - id: D4
    description: "`revertTo`'s staging name derives from `randomUUID` and all three cleanups route through `discardSnapshot` — pinned structurally, and the pin observed red on the real tree as PLANTING D."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync"
        status: pass
    human_judgment: false
  - id: D5
    description: "A handle whose transaction state is unknown refuses its next write BY NAME, before `begin immediate`, with the close-and-reopen remedy — and that remedy is driven and works."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-18, BEHAVIOURAL: a handle whose transaction state is UNKNOWN refuses the next write BY NAME with the close-and-reopen remedy, and reopening recovers"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fix does not convert a committed write into a caller-visible failure (28-11 P5): an accepted write returns `{revision, changed}` and leaves the handle's field `false`, including across a run long enough to prune."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-18, THE 28-11 P5 DIRECTION: an ordinary accepted write still returns its revision and changed, and leaves the handle's transaction state KNOWN"
        status: pass
    human_judgment: false
  - id: D7
    description: "`rollbackFailed` is consumed in production at BOTH call sites — `pruneSnapshots` returns it and step 9 records it on the handle; `revertTo` step 6 binds it and branches. Both pinned structurally, and both pins observed red on the real tree as PLANTING E and PLANTING F."
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle"
        status: pass
    human_judgment: false
  - id: D8
    description: "The CR-08 reproduction still refuses rather than destroys after this plan rewrote `revertTo`: a truncated `r1.db` leaves the store at 69,632 bytes and the caller's handle open."
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "node scratch driver, recorded below: build to revision 3, truncate r1.db to 0, revertTo(handle, 1) -> AnnoStoreError, store byte length 69632 -> 69632"
        status: pass
    human_judgment: false

duration: 41 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 20: `revertTo`'s Three Verifier-Routed WARNINGs Summary

**An argument error that reads like one (`AnnoRevisionArgumentError`, outside the corruption family), a revert staging path no second attempt can produce (`randomUUID`, three cleanups through `discardSnapshot`), and a reported rollback failure that production code now reads at both call sites — carried on the handle so the committed write still reports success.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-08-28T20:07:00Z (approx)
- **Completed:** 2026-08-28T20:48:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **WR-22 closed.** `revertTo`'s `revision` argument is validated as the function's first statement, before the pointer-row `select` and before `snapshotPathFor`. The refusal is `AnnoRevisionArgumentError` — in the `ViceError` family, deliberately not in the corruption family.
- **WR-24 closed (the uniqueness half).** `revertTo` stages under a per-ATTEMPT name from `randomUUID`, and all three cleanup exits route through `discardSnapshot`. The leak half stays OPEN under WR-11 and the code says so in its own comment.
- **WR-18 closed.** `pruneSnapshots` returns the sweep's `rollbackFailed`; step 9 records it on the handle; the write sequence refuses by name on the next call; `revertTo` step 6 closes and reopens rather than returning a handle it cannot vouch for.
- **Three plantings observed red on the real tree**, one hand edit at a time, each restored to an empty `git diff --stat -- src/mcp/vice`.

## Task Commits

1. **Task 1: WR-22 — the revision argument validated at the entry** — `bf08b30` (feat)
2. **Task 2: WR-24 — a staging path unique per ATTEMPT, three cleanups through one helper** — `7a63c7c` (fix)
3. **Task 3: WR-18 — `rollbackFailed` gets a production reader at both call sites** — `5f3abc0` (feat)

**Plan metadata:** see the `docs(28-20)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `AnnoRevisionArgumentErrorOptions` + `AnnoRevisionArgumentError`, with the doc comment recording why it is neither `AnnoStoreCorruptError` nor `AnnoStoreStaleRevisionError`
- `src/mcp/vice/anno-store.ts` — `assertRevisionArgument()`; `revertTo`'s step 0; the per-attempt staging name and its comment; three `discardSnapshot` call sites; `discardSnapshot`'s extended doc; `AnnoStoreHandle.transactionStateUnknown` + its initialisation in `openStore`; `pruneSnapshots` returning `boolean`; `runWriteSequence`'s head refusal and step-9 consumption; `revertTo`'s step-6 binding
- `src/mcp/vice/anno-store.test.ts` — 12 new controls (listed below)

---

## Task 1 evidence — WR-22

### BEFORE, reproduced live on the pre-task tree (not quoted from `28-REVIEW.md`)

Four fresh stores, each built to revision 2, `revertTo(h, <spelling>)` cast through `as unknown as number`:

```
"0001" -> AnnoStoreError: cannot revert to revision 0001: a pointer row claims it, but its snapshot
          /tmp/anno-wr22-DJrWf0/p.annostore.snapshots/r0001.db is not a readable annotation store (...)
"1"    -> NO THROW; returned handle at revision 1 with 1 row(s)
" 1 "  -> AnnoStoreError: cannot revert to revision  1 : a pointer row claims it, but its snapshot
          /tmp/anno-wr22-ptsSzr/p.annostore.snapshots/r 1 .db is not a readable annotation store (...)
"1.0"  -> AnnoStoreError: cannot revert to revision 1.0: a pointer row claims it, but its snapshot
          /tmp/anno-wr22-X7nY5O/p.annostore.snapshots/r1.0.db is not a readable annotation store (...)
```

Two facts the review did not record, and both are worse than the finding as filed:

1. **`revertTo(h, "1")` did not refuse at all.** It silently reverted the store, closed the caller's handle and returned a handle at revision 1 — a string argument performing a destructive operation with nothing recording that it happened.
2. On a store where the affinity match landed on an unopenable path, the caller's handle was left closed, so the very next `closeStore` threw a bare, non-family `Error: database is not open` (`code: 'ERR_INVALID_STATE'`).

Thrown class before: `AnnoStoreError` (CR-08's corruption refusal). Thrown class after: `AnnoRevisionArgumentError`.

### AFTER, on this plan's tree

```
"0001" -> AnnoRevisionArgumentError | corrupt-family=false
"1"    -> AnnoRevisionArgumentError | corrupt-family=false
" 1 "  -> AnnoRevisionArgumentError | corrupt-family=false
"1.0"  -> AnnoRevisionArgumentError | corrupt-family=false
-1     -> AnnoRevisionArgumentError | corrupt-family=false
1.5    -> AnnoRevisionArgumentError | corrupt-family=false
NaN    -> AnnoRevisionArgumentError | corrupt-family=false
```

The full refusal message for `"0001"`, verbatim:

```
revision "0001" is not a revision -- expected a non-negative integer. A numeric STRING is refused on purpose
rather than coerced: SQLite's column affinity would match the pointer row while the snapshot FILENAME is built
from the string, so the two would disagree about which revision is being reverted to. Nothing has been read and
nothing has been written.
```

- `assert.ok(!(thrown instanceof AnnoStoreCorruptError))` is asserted **in the test**, per spelling, not reasoned about.
- **Positive control:** `revertTo(handle, 1)` on a healthy store at revision 2 returned a handle whose `currentRevision()` is **1**, with **1** range row.
- **Staging residue after every refused call:** directory listing filtered on `.revert-` gave a count of **0**.

### Task 1 numbers

| measurement | before | after |
|---|---|---|
| `node --test anno-store.test.ts` | `# tests 73 / # pass 73 / # fail 0`, exit 0 | `# tests 79 / # pass 79 / # fail 0`, exit 0 |
| `tsc --noEmit -p tsconfig.json` | — | no output, exit **0** |

RED was genuine and observed: with the tests written and `AnnoRevisionArgumentError` not yet exported, the run reported

```
# SyntaxError: The requested module './anno-types.ts' does not provide an export named 'AnnoRevisionArgumentError'
not ok 1 - anno-store.test.ts
```

---

## Task 2 evidence — WR-24

### Behavioural control

**4** sequential `revertTo(store, 2)` calls on ONE store (each followed by a forward write so the next attempt is a real revert rather than a no-op). Every one returned a handle at revision **2** with **2** range rows; `accepted` = **4**. Post-run count of directory entries matching `.revert-`: **0**.

### Structural control

- The matched staging source line: `` const staging = `${storePath}.revert-${process.pid}.${randomUUID()}.tmp`; `` — asserted to contain `randomUUID()` and to keep the `.revert-` marker.
- `discardSnapshot(staging)` occurrences inside `revertTo`'s body: **3** (asserted as the primary, positive count).
- Bare `rmSync(staging` occurrences inside that same body: **0** (secondary, and scoped to the function body — `rmSync` is legitimately used elsewhere in the module: the ring sweep, the prune loop, `discardSnapshot` itself).

The control states in its own comment that its evidence is **structural, not behavioural**, and names the reason: two genuinely concurrent attempts cannot be constructed in-process.

### The sentence recording what is NOT closed

From `revertTo`'s staging comment, quoted verbatim:

> AND WHAT IT DOES NOT CLOSE, stated because a comment that implied otherwise would be prohibition 28-07 P3's exact shape: THE LEAK HALF STAYS OPEN UNDER WR-11. A process killed between the copy and any of the three cleanups still leaves this file behind, and it sits beside the store rather than inside the ring directory, so `reconcileSnapshotRing`'s sweep -- anchored on `r<digits>.db` inside `snapshotDirFor()` -- does not and must not match it. Nothing reclaims it. That is WR-11's other half and it is not closed here.

`discardSnapshot`'s swallowing semantics were confirmed to be what all three sites want (each is already refusing with a named error the caller needs to read); no site needed different semantics, so none is inconsistent with the other two.

### PLANTING D — observed red on the real tree

One `discardSnapshot(staging)` call inside `revertTo` was put back by hand to a bare `rmSync(staging, { force: true })`. `git diff --stat -- src/mcp/vice` while planted:

```
 src/mcp/vice/anno-store.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

`node --test anno-store.test.ts` reported `# tests 81 / # pass 80 / # fail 1` and this `not ok` line, verbatim:

```
not ok 43 - WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync
```

The two numbers the control saw: **expected: 3, actual: 2**.

After restore (`git checkout -- src/mcp/vice/anno-store.ts`), `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY), and `node --test anno-store.test.ts` reported `# tests 81 / # pass 81 / # fail 0`, exit 0.

### Task 2 numbers

| measurement | before | after |
|---|---|---|
| `node --test anno-store.test.ts anno-durability.test.ts` | `# pass 84` (79 + 5) | `# tests 86 / # pass 86 / # fail 0`, exit 0 |
| `tsc --noEmit -p tsconfig.json` | — | no output, exit **0** |

### `backstop` truth filed by this task

- **statement:** "Two concurrent `revertTo` attempts at the same revision, in this process or another, cannot share a staging path."
  **verification:** `backstop`
  **reason:** two genuinely concurrent attempts cannot be constructed in-process. The in-process evidence for uniqueness is that the name is built from `randomUUID` — presence, not behaviour — and the structural control says exactly that in its own comment. Not dressed up as a behavioural proof (28-17 P5).

---

## Task 3 evidence — WR-18

### The grep, before and after

| | value |
|---|---|
| `grep -c 'rollbackFailed' src/mcp/vice/anno-store.ts` at 28-19's tree | **12** |
| same, after this task | **18** |

**PRODUCTION (non-comment) reader lines, which at plan time was an EMPTY list:**

- `src/mcp/vice/anno-store.ts:1193` — `if (swept.deferred) return swept.rollbackFailed;` (`pruneSnapshots`)
- `src/mcp/vice/anno-store.ts:2502` — `reopenNeeded = reconcileSnapshotRing(restored).rollbackFailed;` (`revertTo` step 6)

The remaining occurrences are the field's declaration (`:967`) and its three producer sites (`:982`, `:1091`, `:1117`), plus comments. Step 9's consumption reads the fact through `pruneSnapshots`' return: `if (pruneSnapshots(handle)) handle.transactionStateUnknown = true;`.

### The behavioural refusal control

Full message, verbatim:

```
/tmp/anno-t3a-SVPi5J/proj.annostore: refusing the write -- a previous write's housekeeping sweep on this
connection could not roll back its own transaction, so this connection may still hold an open transaction and
the store's write lock. Its transaction state cannot be established from this process (Node's DatabaseSync
exposes no transaction-state accessor), so it is not reused: CLOSE IT AND REOPEN rather than reusing it. The
store on disk is unharmed -- the write that produced this state COMMITTED -- and a freshly opened handle on the
same path writes normally.
```

Class: `AnnoStoreError` (an existing in-family class; no new class was added for this).

**The recovery half is driven, not claimed:** after `closeStore` and a fresh `openStore` on the same path, `setDataType` succeeded and returned revision **2**.

### The 28-11 P5 control

Actual result object from an ordinary accepted write on a clean handle:

```json
{"revision":1,"changed":true,"contradictedComments":[]}
```

`handle.transactionStateUnknown` afterwards: **false**. The control additionally drives `MAX_SNAPSHOT_REVISIONS + 2` further writes so the sweep genuinely prunes, and asserts the handle is still clean.

### The two structural controls

Both state in their own comments that their evidence is structural, and both name the reason (the `rollbackFailed: true` arm has no reachable input without fault injection, so no behavioural control can distinguish a bound result from a discarded one).

### PLANTING E — observed red on the real tree

`pruneSnapshots`'s return value discarded again at the step-9 call site by hand (`pruneSnapshots(handle);`). `git diff --stat -- src/mcp/vice` while planted:

```
 src/mcp/vice/anno-store.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

`node --test anno-store.test.ts` reported `# tests 85 / # pass 84 / # fail 1` and this `not ok` line, verbatim:

```
not ok 84 - WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded
```

with the assertion text `step 9 must BIND or TEST pruneSnapshots' return rather than discarding it, got: pruneSnapshots(handle);`.

After restore: `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY), and the file was green again — `# tests 85 / # pass 85 / # fail 0`.

### PLANTING F — observed red on the real tree, as a SEPARATE edit

`revertTo` step 6's sweep result unbound by hand (`reconcileSnapshotRing(restored);` with `reopenNeeded` initialised `false`). `git diff --stat -- src/mcp/vice` while planted:

```
 src/mcp/vice/anno-store.ts | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

`node --test anno-store.test.ts` reported `# tests 85 / # pass 84 / # fail 1` and this `not ok` line, verbatim:

```
not ok 85 - WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle
```

with the assertion text `step 6 must BIND the sweep's result rather than discarding it, got: reconcileSnapshotRing(restored);`.

After restore: `git diff --stat -- src/mcp/vice` produced **no output** (EMPTY), and the file was green again — `# tests 85 / # pass 85 / # fail 0`.

Each planting reddened exactly ONE control, and it was the control that planting targets — no neighbour stood in for the pin.

### The pre-existing happy-path assertion, kept as a regression

`assert.equal(swept.rollbackFailed, false, "an ordinary sweep reports rollbackFailed: false rather than omitting the field")` was at `anno-store.test.ts:4013` on 28-19's tree and is at **`anno-store.test.ts:4276`** on this one. It was NOT rewritten and is still green.

### `backstop` truth filed by this task

- **statement:** "The `rollbackFailed: true` arm behaves as specified end to end, reached through a real `rollback` that throws on a connection whose `begin immediate` succeeded."
  **verification:** `backstop`
  **reason:** reaching it requires `db.exec("rollback")` itself to throw on a connection whose `begin immediate` succeeded, which has no reachable input without filesystem- or SQLite-level fault injection. **No test in this file claims to exercise it**, and none skips silently in its place (28-17 P4): the behavioural control sets the handle's field DIRECTLY and says in its own comment that this is the test constructing the STATE, not simulating the sweep.

### The CR-08 reproduction, re-driven on this plan's tree

Store built to revision 3, `r1.db` truncated to 0 bytes, then `revertTo(handle, 1)`:

```
CR-08 refusal: AnnoStoreError: cannot revert to revision 1: a pointer row claims it, but its snapshot
               /tmp/anno-t3c-748X00/proj.annostore.snapshots/r1.db is not [a readable annotation store]
CR-08 store byte length: 69632 -> 69632
CR-08 handle still usable: revision 3
```

The pair is **`69632 -> 69632`**, as the acceptance criterion requires. The caller's handle was still open and still answered `currentRevision()`.

---

## Suite counts

| suite | before (28-19's tree) | after |
|---|---|---|
| `node --test anno-store.test.ts` | `# tests 73 / # pass 73 / # fail 0 / # skipped 0`, exit 0 | `# tests 85 / # pass 85 / # fail 0 / # skipped 0`, exit 0 |
| `node --test anno-store.test.ts anno-durability.test.ts` | `# pass 84` | `# tests 86 / # pass 86 / # fail 0`, exit 0 |
| `node --test anno-*.test.ts block-class.test.ts` | `# tests 186 / # pass 186 / # fail 0 / # skipped 0`, exit **0** | `# tests 198 / # pass 198 / # fail 0 / # skipped 0`, exit **0** |
| task 3's eight-file set | — | `# tests 198 / # pass 198 / # fail 0 / # skipped 0`, exit **0** |
| `tsc --noEmit -p src/mcp/vice/tsconfig.json` | no output, exit 0 | no output, exit **0** |

Every `<automated>` command in this plan was run with the load-bearing `set -o pipefail` prefix, so the reported exit statuses are the test runner's and not `tail`'s.

### The 12 tests added, so the growth from 186 to 198 is accounted for rather than rounded

All 12 are in `anno-store.test.ts` (73 → 85):

1. `WR-22: revertTo(handle, "1") is refused as an ARGUMENT error, by name, before any read or write -- and is NOT in the corruption family`
2. `WR-22: revertTo(handle, "0001") ...` (same shape)
3. `WR-22: revertTo(handle, " 1 ") ...` (same shape)
4. `WR-22: revertTo(handle, "1.0") ...` (same shape)
5. `WR-22: the numeric shapes that are not revisions -- -1, 1.5 and NaN -- are refused by the same class, before any pointer-row query runs`
6. `WR-22, THE POSITIVE COMPANION: revertTo(handle, 1) on a healthy store still SUCCEEDS and returns a handle at revision 1 -- the refusal was not bought by broadening`
7. `WR-24, BEHAVIOURAL: several sequential reverts to the SAME revision each succeed and leave ZERO revert-staging residue behind`
8. `WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync`
9. `WR-18, BEHAVIOURAL: a handle whose transaction state is UNKNOWN refuses the next write BY NAME with the close-and-reopen remedy, and reopening recovers`
10. `WR-18, THE 28-11 P5 DIRECTION: an ordinary accepted write still returns its revision and changed, and leaves the handle's transaction state KNOWN`
11. `WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded`
12. `WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle`

---

## Prohibition dispositions

| prohibition | disposition |
|---|---|
| **28-20 P1 (NEW)** — MUST NOT return a handle whose transaction state the function cannot vouch for | **Honoured.** `revertTo` step 6 binds the sweep's `rollbackFailed` and, when set, closes `restored` and reopens rather than returning it. Pinned by the step-6 structural control (PLANTING F). |
| 28-11 P5 — MUST NOT convert a committed write into a caller-visible failure | **Honoured, and asserted.** Step 9 neither throws nor logs; the accepted write returns `{"revision":1,"changed":true,...}` and the handle's field stays `false`. The refusal lives on the NEXT call, before `begin immediate`. |
| 28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted | **Honoured.** The argument refusal names the offending value verbatim and what was expected; it deliberately does NOT invent a second revision it does not have — which is exactly why `AnnoStoreStaleRevisionError` was rejected for it. |
| 28-07 P1 / 28-10 P1 / 28-11 P1 — MUST NOT destroy the only remaining route back | **Honoured.** The CR-08 reproduction was re-driven on this plan's tree: `69632 -> 69632`, handle still usable at revision 3. |
| 28-07 P2 / 28-10 P2 — MUST NOT publish an unhonourable floor/bound/`retained` claim | **Honoured.** `retainedRevisions()` and the refusal's available-revisions list are untouched by this plan; the four `revertTo` refusal tests that assert the available list are unchanged and green. |
| 28-16 P2 — MUST NOT let the ring's file sweep unlink a snapshot merely because it failed to open | **Honoured.** WR-24 changed only the REVERT staging file's name and its removal helper. `SNAPSHOT_FILE_PATTERN`, the ring sweep and its keep-set are unmodified; the revert staging file still sits beside the store, outside `snapshotDirFor()`. |
| 28-16 P1 — MUST NOT close the caller's handle, or modify the live store, for an image not itself OPENED as a store | **Honoured.** Step 3b's ordering is untouched; the WR-18 close-and-reopen happens AFTER the rename has landed and the store has already been reopened once. |
| 28-17 P4 — MUST NOT let a test report a PASS for a precondition it could not construct | **Honoured.** The `rollbackFailed: true` end-to-end arm is a recorded `backstop` truth with its reason, not a skipped test and not a conditional fake. |
| 28-17 P5 — MUST NOT make a uniqueness claim whose only evidence is that the code was written down | **Honoured.** WR-24's collision-avoidance claim is a recorded `backstop` truth, and the structural control says in its own comment that its evidence is structural. |
| 28-19 P1 — MUST NOT let the store persist a range row it would refuse at its own entry point | **Honoured.** This plan touches no range writer; `anno-overlap.test.ts`'s round-trip invariant is green in the 198-test run. |

## Scope fence held

WR-06 (no bound on `baseRevision`) was **NOT** widened into. The round-5 review's WR-22 sketch suggests reusing the new validator for `baseRevision`; that suggestion is **declined**, and the declination is recorded in `assertRevisionArgument`'s own doc comment so a later reader sees it was decided rather than missed. WR-03, WR-05, WR-07, WR-09, WR-10, WR-11's leak half and IN-01..IN-05 are all carried forward untouched.

## Decisions Made

See the `key-decisions` frontmatter block. The two worth restating in prose:

1. **The review's own fix sketch was declined on class choice.** `28-REVIEW.md` §WR-22 suggests throwing `AnnoStoreStaleRevisionError`. That class exists to carry the TWO revisions that conflicted (28-08 P2's shape), and an argument error has no second revision — reusing it would force the class to carry a number the caller never supplied. A new class outside both the corruption and the staleness families is what makes the three distinguishable by `instanceof` alone.
2. **`revertTo` step 6 reuses one remedy block rather than two.** A thrown sweep and a reported `rollbackFailed` both set a single `reopenNeeded` local, and one `if` performs the close-and-reopen. A second copy of the remedy is a second place it can drift, and the existing structural control that pins the handler's shape still passes over the restructured form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `JSON.stringify` renders `NaN` and both infinities as the string `null`, naming a value the caller never passed**

- **Found during:** Task 1 (WR-22 validator)
- **Issue:** The plan specifies naming the offending value with `JSON.stringify` so a string is visibly a string. That is right for every value except the three numbers JSON cannot represent: `revertTo(handle, NaN)` produced `revision null is not a revision`, which names a value the caller never supplied — the opposite of the verbatim naming the refusal exists to provide, and a small instance of the very confusion WR-22 is filed against.
- **Fix:** the refusal falls back to `String(value)` when the value is a non-finite number, with a comment stating why. `NaN` now renders as `revision NaN is not a revision ...` and `Infinity` as `revision Infinity is not a revision ...`.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** driven directly for both `NaN` and `Number.POSITIVE_INFINITY`; both render their own name. `node --test anno-store.test.ts` 79/79 at the time, `tsc --noEmit` clean.
- **Committed in:** `bf08b30` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** none on scope. The fix is inside the refusal message the plan specifies and makes it satisfy the plan's own "names the offending value VERBATIM" requirement in the three cases where `JSON.stringify` alone did not.

## Issues Encountered

**A planting restored uncommitted work.** The first attempt at PLANTING D was run before Task 2 was committed, so `git checkout -- src/mcp/vice/anno-store.ts` reverted the whole task's production edits rather than just the planted line — and the "empty diff" check could not mean what it is supposed to mean, because the diff was against 28-19's tree. Re-applied the Task 2 edits, committed the task, then planted. **The ordering that makes the acceptance criterion meaningful is: commit the task first, then plant, then `git checkout` and confirm the diff against HEAD is empty.** PLANTING E and F followed that ordering from the start. All three plantings recorded above are the post-commit runs.

A related trap worth recording for the next executor: `git diff --stat -- src/mcp/vice` run from inside `src/mcp/vice` matches nothing and prints an empty result at exit 0 — indistinguishable from a clean tree. Every diff check above was run from the repository root.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Three of the round's five verifier-routed WARNINGs (WR-18, WR-22, WR-24) are closed with evidence; WR-06 and the rest are carried forward untouched and named above.
- `AnnoStoreHandle` gained one field and `pruneSnapshots` changed its return type. Both are additive: no existing consumer breaks, and `anno-seam.test.ts`, `anno-confinement.test.ts` and the rest of the eight-file set are green. Phase 29 should read `transactionStateUnknown`'s doc comment before wiring a session-lived handle onto the MCP tool path — the remedy it names (close and reopen) is the session's responsibility.
- The plan's own warning stands for the next round: three functions in `anno-store.ts` were rewritten here (`revertTo`, `pruneSnapshots`, `runWriteSequence`). Any plan touching those should be serialised against this one, not parallelised.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

- `src/mcp/vice/anno-types.ts` — FOUND
- `src/mcp/vice/anno-store.ts` — FOUND
- `src/mcp/vice/anno-store.test.ts` — FOUND
- commit `bf08b30` — FOUND
- commit `7a63c7c` — FOUND
- commit `5f3abc0` — FOUND
- plan `<verification>` re-run at close: `node --test anno-*.test.ts block-class.test.ts` → `# tests 198 / # pass 198 / # fail 0 / # skipped 0`, exit 0; `tsc --noEmit -p src/mcp/vice/tsconfig.json` → no output, exit 0
- working tree clean against HEAD for `src/mcp/vice` after all three plantings were restored
