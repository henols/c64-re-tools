---
phase: 28-the-store-core
plan: 16
subsystem: database
tags: [sqlite, node-sqlite, annotation-store, revert, snapshot-ring, durability]

# Dependency graph
requires:
  - phase: 28-the-store-core (plans 28-01..28-15)
    provides: the annotation store vertical, the snapshot ring, `revertTo`, `reconcileSnapshotRing`, `pruneSnapshots`, the `Anno*Error` family and the 159-test anno baseline
provides:
  - "`revertTo` whose destructive steps are unreachable until an `openStore` has succeeded: step 2's gate on the source image and step 3b's gate on the STAGED copy, both reading one witness"
  - "`openStore(path, { mustExist: true })` — a judging open that refuses an absent path by name and opens read-only, so judging cannot create or modify the thing judged"
  - "`snapshotOpenFailure(handle, revision)` — the single module-private answer to 'can this revision's image be opened as an annotation store', replacing the presence test at both former sites"
  - "`claimedRevisions(handle)` — the pointer-ROW question the ring's file sweep asks, named apart from `retained` because it is a different question"
  - "`retainedRevisions` / `oldestRetainedRevision` promoted to the openable image, so the published floor cannot steer a caller into a call the gate would refuse"
  - "`revertTo` step 6: both `openStore` calls inside handlers reporting a revert that LANDED ON DISK (WR-17)"
affects: [28-17, 28-18, phase-29-mcp-surface, anno-store, snapshot-ring]

actuals:
  tokens: 15200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One witness, three positions: the advertisement, the source-image gate and the staged-copy gate all call `snapshotOpenFailure`, so they cannot disagree"
    - "A judging open (`mustExist` + `readOnly`) as the alternative to a second list of validity checks"
    - "A differently-NAMED question rather than a fourth answer, when a consumer genuinely asks something else (`claimedRevisions` vs `retainedRevisions`)"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "`retained` is PROMOTED, not forked: the openable-image definition becomes the single meaning, read by `retainedRevisions`, `oldestRetainedRevision`, `revertTo`'s step-2 gate and its `Available revisions:` list from one witness"
  - "The ring's file sweep reads `claimedRevisions` (pointer rows), not the promoted `retainedRevisions` — two independent reasons: a corrupt-but-claimed image must survive as EVIDENCE, and the keep-set is computed inside the sweep's `begin immediate` where 32 `openStore` calls would run under the store's write lock"
  - "`revertTo` step 2's arms split on the POINTER ROW, not on the image's presence — a second presence predicate on a snapshot path is exactly how CR-03 and CR-08 both happened, so the two file-half sub-cases are distinguished by the QUOTED REASON instead (deviation, recorded below)"
  - "The store-identity residual is stated OPEN, not closed: an image that opens cleanly with the expected `schema_version` but belongs to a DIFFERENT store is still ADMITTED, because closing it needs a `SCHEMA_VERSION` bump — this milestone's one-way decision"
  - "Step 3b validates the STAGED COPY (the exact bytes `renameSync` installs), not only the source image, so no window exists between the judgement and the install"

patterns-established:
  - "Doc re-truthing in the same edit that falsifies the doc: five doc blocks in `anno-store.ts` were rewritten by the tasks that made them false, and the machine-checkable half is asserted in both directions (code-scoped grep for the predicate's absence, comment-scoped grep for the stale citation's absence)"
  - "A behavioural test and its source-order assertion in ONE test when they are the same claim seen from two sides — the behavioural half shows the outcome, the structural half shows why the outcome is structural"
  - "Per-iteration fixture rebuild in an invariant loop when a second application of the operation is legitimately refused"

requirements-completed: [STORE-04]

coverage:
  - id: D1
    description: "`revertTo` never closes the caller's handle and never renames anything over the live store until the replacement image has been OPENED as an annotation store this build can speak to"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still answers, and a later openStore succeeds"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-08: a retained snapshot overwritten with FOREIGN BYTES is refused by the same gate -- the fix is an ordering, not a zero-length special case"
        status: pass
    human_judgment: false
  - id: D2
    description: "`retainedRevisions()` and `oldestRetainedRevision()` never advertise a revision whose image cannot be opened, and the refusal's `Available revisions:` list is the promoted one"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-08: retainedRevisions and oldestRetainedRevision never advertise a revision whose image cannot be OPENED -- with the healthy-ring control and the two distinct refusals"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every revision the advertisement publishes can actually be reverted to — asserted as a loop over the advertised list, never over hard-coded numbers, with the fixture rebuilt per iteration"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-08: every revision retainedRevisions() advertises can actually be reverted to -- the loop is over the ADVERTISED LIST, never over literals, and the fixture is rebuilt per iteration"
        status: pass
    human_judgment: false
  - id: D4
    description: "The promotion introduces no second destroyer: the ring's file sweep keeps a corrupt image a pointer row still claims, and its pointer row survives"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#CR-08: the ring's file sweep does NOT unlink a corrupt image a pointer row still claims -- evidence survives, and unlinking it would be a second destruction dressed as a repair"
        status: pass
    human_judgment: false
  - id: D5
    description: "No route out of `revertTo` step 6 reaches the caller as a bare OS error, and the wrap reports a revert that LANDED ON DISK rather than a failed one (WR-17)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-17, STRUCTURAL: every openStore AFTER the rename in revertTo is inside a handler, and the reopen failure reports a revert that LANDED ON DISK"
        status: pass
    human_judgment: true
    rationale: "The control is STRUCTURAL by necessity. The guarded failure is a reopen of a file `revertTo` just wrote; constructing it in-process needs filesystem-level fault injection between the rename and the reopen, which is the same reason the phase's `integrity_check`-throw arm is a standing human-verification item. The source assertion proves the handler exists and reports a landed revert; it does not exercise the arm."
  - id: D6
    description: "`revertTo` run twice to the same revision is well-defined and non-destructive (STORE-04 idempotency edge) — re-observed on the rewritten gate rather than duplicated"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#STORE-04 idempotency across the half-states: a second pruneSnapshots reports nothing dropped in either direction and changes neither the files nor the rows, and a second revertTo(r) leaves the same rows and the same revision"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#idempotency of revert: reverting to r yields the state at r, and a SECOND revert to the same r is refused and leaves that state byte-for-byte unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: 18 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 16: CR-08 and WR-17 — the revert gate becomes an ordering Summary

**`revertTo`'s destructive half is now unreachable until an `openStore` has succeeded — one witness (`snapshotOpenFailure`) read by the advertisement, by the source-image gate and by the staged copy — so a retained snapshot that is not a database is an in-family refusal instead of the irrecoverable loss of the live store.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-28T16:07:20Z
- **Completed:** 2026-08-28T16:25:42Z
- **Tasks:** 3 of 3
- **Files modified:** 2

## Accomplishments

- **The CR-08 class is closed by ordering, not by a byte-pattern check.** `openStore` gained `mustExist` (refuse an absent path by name before `new DatabaseSync`, and open `readOnly`), and `revertTo` gained a step 3b that OPENS the staged copy — the exact bytes step 5 renames — before step 4 closes the caller's handle. The round-4 verifier's exact reproduction now yields a named refusal with the live store byte-identical and the handle still usable.
- **"Retained" has one meaning.** `snapshotOpenFailure` replaced the `existsSync` witness at BOTH of its former sites; `retainedRevisions` is now `claimedRevisions().filter(image opens)`. Code-scoped greps for `existsSync(snapshotPathFor` and `existsSync(snapPath)` both return `0` (each was `1`), and the comment-scoped grep for the superseded predicate citation also returns `0` (was `1`).
- **The fix introduced no second destroyer.** `reconcileSnapshotRing`'s keep-set moved to `claimedRevisions`, so a corrupt image a pointer row still claims survives on disk as evidence — and the 32-image cost never runs inside the sweep's `begin immediate`, where it would have opened up to 32 databases under the store's write lock on every accepted write.
- **WR-17 closed in the same function.** Both `openStore` calls after the rename are inside handlers; a `ViceError` is rethrown unchanged and anything else is wrapped in an `AnnoStoreError` stating the revert **LANDED ON DISK** and naming the store path and the revision (prohibition 28-11 P5).
- **Five doc blocks re-truthed by the tasks that falsified them**, with the machine-checkable half asserted in both directions.
- **Test count: 159 → 165** across `anno-*.test.ts block-class.test.ts` (`# pass 165`, `# fail 0`, `# skipped 0`), split exactly 2 + 3 + 1 across tasks 1, 2 and 3 as the plan's arithmetic predicted. `anno-store.test.ts` alone: 65 → 71.

## Task Commits

1. **Task 1 (tracer): revertTo opens the staged image before it closes or renames anything** — `3fb6e4a` (feat)
2. **Task 2 RED: failing tests for the promoted meaning of "retained"** — `8cd7c1f` (test)
3. **Task 2 GREEN: promote "retained" to the openable image, and give the sweep its own question** — `1cd3453` (feat)
4. **Task 3: WR-17 — the reopen after a landed revert is inside the guarantee** — `a907fb7` (fix)

No REFACTOR commit: the GREEN implementation is the final shape (a two-line `retainedRevisions`, one `select` in `claimedRevisions`, one `try` in the witness), and there was nothing to clean up that would not have been churn.

_Note: task 2 carried `tdd="true"`, so it produced the RED and GREEN commits above._

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — `openStore` gains `mustExist`; new module-private `snapshotOpenFailure` and `claimedRevisions`; `retainedRevisions` promoted; `revertTo` step 2 gains a second arm and step 3b, step 6's two reopens wrapped; five doc blocks re-truthed. +430/-59 lines.
- `src/mcp/vice/anno-store.test.ts` — six new tests plus two shared helpers (`revisionThreeStore`, `assertRefusedRevertLeftEverythingIntact`) and two new section headers. +477 lines.

## The numbers the plan asked for verbatim

### The live store across the truncated-image drive

| | before this plan (round-4 verifier, committed code) | after this plan |
|---|---|---|
| live store before `revertTo(handle, 1)` | 69,632 bytes | 69,632 bytes |
| live store after `revertTo(handle, 1)` | **0 bytes** | **69,632 bytes, byte-identical** |
| handle returned | none | none (it throws) — but the CALLER'S handle is still open and answers `currentRevision() === 3` and `listRanges()` with its 3 rows |
| later `openStore(storePath)` | `AnnoStoreCorruptError: not an annotation store (no such table: anno_meta)`, permanently | succeeds, reads revision 3 and 3 rows |
| the throw | `AnnoStoreCorruptError` from step 6, after the destruction | `AnnoStoreError` naming the store path, the snapshot path, `NOTHING has been replaced`, the revision the store is still at, and `Available revisions: 0, 2` |

The 69,632 figure was re-measured on this host through production entry points before task 1 landed and is pinned in the test, labelled as an OBSERVATION of SQLite's default page size on a three-write store rather than a store invariant.

### `retainedRevisions()` across the same drive

Ring `[r0.db, r1.db, r2.db]`, `r1.db` truncated to 0 bytes:

| | before | after |
|---|---|---|
| `retainedRevisions()` | `[0, 1, 2]` | `[0, 2]` |
| `oldestRetainedRevision()` | `0` | `0` |
| `Available revisions:` in the refusal | `0, 1, 2` | `0, 2` |
| healthy-ring control (all three images intact) | `[0, 1, 2]`, floor `0` | `[0, 1, 2]`, floor `0` — unchanged, asserted |

### The step 3b planted-violation red

Observed twice. **On the task-1 tree**, deleting the step 3b block by hand (2,322 characters) reddened BOTH new tests:

```
not ok 66 - CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still answers, and a later openStore succeeds
not ok 67 - CR-08: a retained snapshot overwritten with FOREIGN BYTES is refused by the same gate -- the fix is an ordering, not a zero-length special case
# tests 67
# pass 65
# fail 2
```

Restoring the block returned `# tests 67 / # pass 67 / # fail 0`.

**Re-observed on the FINAL tree** (after tasks 2 and 3), where task 2's step-2 gate now refuses the same inputs one step earlier, so the behavioural half of the planting is absorbed and only the folded source-order assertion bites:

```
not ok 67 - CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name -- the live store stays byte-identical, the caller's handle still answers, and a later openStore succeeds
# tests 71
# pass 70
# fail 1
```

After restoring, `git diff --stat -- src/mcp/vice/` prints **nothing** (empty diff), and `# tests 71 / # pass 71 / # fail 0`.

That absorption is why step 3b's guarantee is ALSO pinned structurally: the source-order assertion (folded into the truncated-image test) requires the index of `openStore(staging, { mustExist: true })` to be strictly less than the indices of `closeStore(handle)` and `renameSync(staging, storePath)`.

### Test counts

| tree | `anno-store.test.ts` | `anno-*.test.ts block-class.test.ts` |
|---|---|---|
| baseline (28-15) | `# tests 65 / # pass 65 / # fail 0` | `# tests 159 / # pass 159 / # fail 0 / # skipped 0` |
| after task 1 (+2) | `# tests 67 / # pass 67 / # fail 0` | — |
| after task 2 RED | `# tests 70 / # pass 67 / # fail 3` | — |
| after task 2 GREEN (+3) | `# tests 70 / # pass 70 / # fail 0` | `# tests 164 / # pass 164 / # fail 0 / # skipped 0` |
| after task 3 (+1) | `# tests 71 / # pass 71 / # fail 0` | **`# tests 165 / # pass 165 / # fail 0 / # skipped 0`** |

**28-17 and 28-18 should read their expected counts from `165` (and `71` for `anno-store.test.ts` alone).** The split is exactly the plan's stated 2 + 3 + 1; the six added tests are:

1. `CR-08: a retained snapshot TRUNCATED to zero bytes is REFUSED by name …` (task 1; also carries the source-order assertion)
2. `CR-08: a retained snapshot overwritten with FOREIGN BYTES is refused by the same gate …` (task 1)
3. `CR-08: retainedRevisions and oldestRetainedRevision never advertise a revision whose image cannot be OPENED …` (task 2, TEST A)
4. `CR-08: every revision retainedRevisions() advertises can actually be reverted to …` (task 2, TEST B)
5. `CR-08: the ring's file sweep does NOT unlink a corrupt image a pointer row still claims …` (task 2, TEST C)
6. `WR-17, STRUCTURAL: every openStore AFTER the rename in revertTo is inside a handler …` (task 3)

### Named controls re-observed on the final tree

```
ok 1 - the sweep's SOURCE ORDER is the guarantee too: inside reconcileSnapshotRing there is NO pointer-row delete at all, and the commit precedes the unlink
ok 1 - STORE-04 idempotency across the half-states: a second pruneSnapshots reports nothing dropped in either direction and changes neither the files nor the rows, and a second revertTo(r) leaves the same rows and the same revision
ok 1 - idempotency of revert: reverting to r yields the state at r, and a SECOND revert to the same r is refused and leaves that state byte-for-byte unchanged
ok 1 - revertTo step 6, STRUCTURAL BACKSTOP: the sweep call sits inside a handler, so a future edit that reintroduces a throw cannot cost the caller a handle
```

Adding `select revision from anno_snapshot order by revision` to `reconcileSnapshotRing`'s body (through `claimedRevisions`) did **not** trip the sweep's absence control — confirmed by running it, not by assuming it. No duplicate double-revert test was added; re-observation is the evidence.

### WHAT THE WITNESS REFUSES AND WHAT IT STILL ADMITS

Refused — every one of these makes `snapshotOpenFailure` return a reason, so the revision drops out of `retainedRevisions()` and `revertTo` refuses before anything is closed or renamed:

1. **An ABSENT image.** Refused by `mustExist` before `new DatabaseSync` is constructed, so the create-and-initialise branch is unreachable and the judge cannot manufacture the empty store it was asked to detect.
2. **A ZERO-LENGTH image.** It opens as SQLite and reports `integrity_check ok`; the `anno_meta` read is what refuses it (`AnnoStoreCorruptError`).
3. **A TRUNCATED image** (cut mid-file) — the `anno_meta` read or `pragma integrity_check`.
4. **FOREIGN BYTES / not a database at all** — SQLite's own `file is not a database`.
5. **An UNREADABLE image** (permissions, `EIO`, a path that is a directory) — the wrapped constructor, `AnnoStorePathError`.
6. **An image whose `schema_version` is not this build's** — refused naming both versions.
7. **An image whose `integrity_check` reports anything but a single `ok`, or cannot be run at all.**

Still ADMITTED — **and this is an OPEN residual, explicitly NOT claimed closed:**

> An image that OPENS cleanly, passes `pragma integrity_check` and carries the expected `schema_version`, but whose CONTENT belongs to a **different store**, is admitted and installed. Nothing in the schema records store identity, so there is nothing for the witness to compare. Closing it requires a store-identity column, which is a `SCHEMA_VERSION` bump — this milestone's one-way decision and explicitly out of scope for a gap-closure round. This is threat register row **T-28-18 (Spoofing, medium, `accept`)** and it stays open.

Two further residuals are unchanged by this plan and remain open, restated so they are not read as closed by association: the UNDER-CLAIM direction of prohibition 28-07 P2 (a store opened through a second path spelling reports `retained []` while the first ring's files exist — untouched by design, closing it would require reading a ring whose ownership the handle cannot establish, which 28-10 P3 / 28-11 P4 forbid); and the `pragma integrity_check`-throw arm as a standing human-verification item.

### WR-17 disposition

**`fix`.** Decided together with CR-08 because they are the **same function and the same failure**: CR-08's step 3b removes the reopen's most likely cause of throwing (an image that is not a store) without removing the class, so what is left — a store that became unopenable BETWEEN the rename and the reopen — needs the handler that WR-17 asks for. Both `openStore` calls after the rename are now inside handlers, and the wrap reports a **landed** revert rather than presenting it as a failed one (prohibition 28-11 P5).

## Decisions Made

See `key-decisions` in the frontmatter. The one that changed the plan's letter is recorded as a deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking contradiction in the plan] `revertTo` step 2's arms split on the pointer ROW, not on the image's presence**

- **Found during:** Task 2, action item (d).
- **Issue:** (d) specifies arm 1 as "no pointer row, **or the image is absent** → the EXISTING refusal message, wording unchanged". Implementing that literally requires a second predicate answering "is this snapshot file present" — but the SAME task's first two acceptance criteria require the code-scoped counts of `existsSync(snapshotPathFor` and `existsSync(snapPath)` to be **0**, and the action's own item (a) states that after this task "no presence test on a snapshot path survives anywhere in the module". The two cannot both hold. The only alternative routes to the distinction are string-sniffing my own `mustExist` refusal message or type-sniffing which `Anno*Error` subclass came back — both of which reintroduce exactly the "two truths about one file" primitive that CR-03 and CR-08 were each caused by.
- **Fix:** arm 1 fires on `!pointer` alone, with its wording **unchanged**. The image half — absent OR present-but-unopenable — falls to arm 2, whose message QUOTES the underlying reason, so an absent image reads `the file does not exist` and a corrupt one reads what SQLite said. The caller can still tell them apart; the module has one witness. The rationale is recorded in the code at the gate itself, not only here.
- **Blast radius checked:** arm 2's message begins `cannot revert to revision ${revision}:` so the two pre-existing orphan-ROW tests (which assert exactly that prefix, `AnnoStoreError` and `ViceError`) still pass — verified by running them. The revert-past-the-bound test and both double-revert tests hit arm 1 and are unaffected.
- **Verification:** `# tests 165 / # pass 165 / # fail 0 / # skipped 0`; both grep criteria return `0`; the two refusal messages asserted non-identical in TEST A.
- **Committed in:** `1cd3453` (part of task 2's GREEN commit).

**2. [Rule 2 - Missing critical: a comment asserting a guarantee the code does not provide] Two doc sites beyond the three the plan named**

- **Found during:** Tasks 2 and 3.
- **Issue:** The plan named three falsified doc blocks. Two more were falsified by the same edits and prohibition 28-07 P3 does not distinguish a comment you wrote from one you left: (i) `oldestRetainedRevision`'s closing sentence, "the floor is now the first element of `retainedRevisions()`, which **requires the file** as well as the row" — presence, the very witness being promoted; and (ii) `reconcileSnapshotRing`'s transaction-bracket comment citing "an `EIO` out of the **`existsSync` sweep inside `retainedRevisions`**" as a throw reachable inside the bracket, which after (c) is not called from there at all.
- **Fix:** both rewritten in the same commit as the change that falsified them. (i) now records the second, same-direction shortfall (`existsSync` published `0` on a store whose `r0.db` was present but was not a database) and states the floor requires the image to OPEN. (ii) now names the keep-set `select`.
- **Verification:** read; plus `grep -c "the EXISTENCE WITNESS"` = 0 and the comment-scoped `existsSync(snapPath)` count = 0.
- **Committed in:** `1cd3453`.

**3. [Rule 3 - Blocking arithmetic constraint] Task 1's source-order assertion folded into a behavioural test rather than added as a third test**

- **Found during:** Task 1.
- **Issue:** Task 1's acceptance criteria require BOTH a source-order assertion on `revertTo`'s body AND "a pass count exactly two greater than before this task" — and the plan states the 2 + 3 + 1 split is load-bearing because 28-17 and 28-18 chain their expected counts off it. A third `test()` in task 1 would have made the count `+3` and broken those two plans' arithmetic.
- **Fix:** the source-order assertions live at the end of the truncated-image test, with a comment stating why they belong there: they are the same claim as the behavioural half seen from the other side, and splitting them would let the behavioural half pass against an arrangement that closes the handle first and reopens it on failure.
- **Verification:** `anno-store.test.ts` reported `# tests 67` after task 1 (65 + 2), and the final anno suite reports 165 = 159 + 6.
- **Committed in:** `3fb6e4a`.

---

**Total deviations:** 3 auto-fixed (1 × Rule 2, 2 × Rule 3).
**Impact on plan:** No scope creep. Deviation 1 resolves a genuine internal contradiction in the plan and does so in the direction the plan's own decision (`promote`, one witness) requires; deviations 2 and 3 are the plan's own stated constraints applied to sites it did not enumerate. Every acceptance criterion is satisfied, and the plan's exact test arithmetic (159 → 165, split 2 + 3 + 1) holds.

## Issues Encountered

None. `npx tsc --noEmit -p src/mcp/vice/tsconfig.json` exits 0 with no output at every commit. No auto-fix attempt limit was approached. The full-glob suite was deliberately NOT run (~660 s, its own failure baseline); every run was scoped to `anno-*.test.ts block-class.test.ts` plus the three adjacent structural files (`docs-linerefs`, `hostpath-consumers`, `shipped-modules` — `# tests 27 / # pass 27 / # fail 0`).

## Known Stubs

None. No hardcoded empty value, placeholder string, `TODO` or `FIXME` was introduced. The one behaviour deliberately left unimplemented — refusing an image that belongs to a different store — is a stated OPEN residual with a named cause (`SCHEMA_VERSION` bump, this milestone's one-way decision) and a threat-register row (T-28-18, `accept`), not a stub.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. The one new file-access pattern — `openStore` opening a snapshot image — reads only paths derived from `snapshotDirFor(handle)`, i.e. from the already-confined `handle.path`, and accepts no caller-supplied path; `grep -n mustExist` shows the option used at exactly two call sites, both inside this module (T-28-19 mitigated as planned). No on-disk column, directory layout or `SCHEMA_VERSION` changed. No dependency added; `node:sqlite` gained no new importer.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for **28-17**. Two numbers 28-17 and 28-18 must read from here rather than from 28-16's plan arithmetic (they agree, but the recorded actual is authoritative): `anno-*.test.ts block-class.test.ts` → **165** tests, and `anno-store.test.ts` alone → **71**.

Concerns to carry forward:

- **STORE-04's `Gaps Found` row** should now reflect that CR-08 — the cause round 3's row was wrongly attributed to, and the cause round 4 correctly identified — is closed. Not edited from here.
- **WR-13** (the published snapshot is never fsynced) is the mechanism that manufactures CR-08's input without anyone doing anything unusual, and is 28-17's subject. This plan makes that input a refusal rather than a destruction; it does not make the input rarer.
- **Three open residuals**, all stated above and none claimed closed: the store-identity admission (T-28-18), the 28-07 P2 under-claim under a second path spelling, and the `integrity_check`-throw arm as a human-verification item.
- **`docs-review-disposition.test.ts`** will go red the moment round 4's verification overwrites `28-VERIFICATION.md`, per the warning recorded in STATE.md. Unchanged by this plan.

## Self-Check: PASSED

- `src/mcp/vice/anno-store.ts` — FOUND (modified, +430/-59)
- `src/mcp/vice/anno-store.test.ts` — FOUND (modified, +477)
- `3fb6e4a` — FOUND in `git log --oneline --all`
- `8cd7c1f` — FOUND
- `1cd3453` — FOUND
- `a907fb7` — FOUND
- All acceptance criteria for tasks 1, 2 and 3 re-run on the final tree and passing; plan-level `<verification>` items all satisfied, including `git status --porcelain .planning/REQUIREMENTS.md .planning/STATE.md` returning empty.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*
