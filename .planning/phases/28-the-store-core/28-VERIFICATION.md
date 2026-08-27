---
phase: 28-the-store-core
verified: 2026-08-27T23:06:41Z
status: gaps_found
score: 9/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5 # 8/11 must-haves; 3 gaps
  gaps_closed:
    - "Snapshot pruning happens AFTER the commit and outside the write transaction, and a kill between the commit and the prune leaves extra files, never a missing one the revert path still points at (28-06 truth 8) — the prune loop now deletes the POINTER ROW first and unlinks the FILE second, pinned by a reddenable source-order control, and trap 10's inverted conclusion is corrected"
  gaps_remaining:
    - "The snapshots/ ring is bounded, the pointer rows are pruned to match, and a revert past the bound is REFUSED by name (28-06 truth 7) — the PRIOR failure mode (post-revert orphan rows, a lying floor, a raw ENOENT out of a closed handle) is genuinely CLOSED and independently re-verified, but three NEW destructive failure modes were reproduced against the same must-have"
    - "anno-types.ts provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; anno-store.ts trap 7) — the LIVE-symlink half is genuinely closed and the control discriminates; a DANGLING symlink still creates the store file outside the root"
  regressions:
    - "28-07's reconciliation sweep (new code, written to close gap 1) deletes a concurrent writer's published-but-uncommitted snapshot, manufacturing the exact orphan-pointer-row state trap 10 declares unsurvivable — reproduced (CR-02)"
    - "28-07's retainedRevisions() predicate tests the ABSOLUTE path stored in anno_snapshot.path, so one `mv` of the project directory plus one write silently deletes the entire snapshot ring, rows and files. Before 28-07 the ring was computed from rows alone and a move was harmless — this destruction is new (CR-03)"
gaps:
  - truth: "The snapshots/ directory is bounded at MAX_SNAPSHOT_REVISIONS, the anno_snapshot pointer rows are pruned to match, and a revert to a pruned revision is REFUSED by name with the oldest retained revision in the message (28-06 truth 7; 28-06 prohibition 3) — and, at the goal level, the store is REVERTIBLE"
    status: partial
    reason: >-
      The prior round's failure is closed and I re-verified it independently: after 40 writes the ring holds
      exactly 32 files, oldestRetainedRevision() reports 8, a below-floor revert refuses by name inside the
      ViceError family, and — the part that used to throw a raw ENOENT out of a closed handle — a SECOND
      revert at the published floor now SUCCEEDS. Three NEW destructive failure modes were reproduced in its
      place, all against committed code at a8187d2, all silent, all in the exact capability the phase goal
      names. (1) snapshotPathFor() keys the ring on handle.dir and never on the store FILENAME, so two stores
      in one directory share one snapshots/ ring; reverting game.annostore to ITS OWN revision 1 returned
      loader.annostore's rows — reproduced verbatim, including the reviewer's exact output line. (2) The
      reconciliation sweep 28-07 added deletes a concurrent writer's published-but-uncommitted snapshot,
      because the rename is a filesystem act and the pointer row is a transactional one; the destroyed
      revision then becomes permanently unrevertible. (3) anno_snapshot.path is absolute and retainedRevisions()
      tests that stored string, so one `mv` of the project directory plus one write deleted five snapshot files
      and five pointer rows with no error and nothing in AnnoWriteResult to notice it by.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          snapshotPathFor:423-425 keys the ring on handle.dir alone (pre-existing since 28-01, newly
          AMPLIFIED by the sweep); reconcileSnapshotRing:566-582 judges a file it cannot have created,
          from this connection's committed view only, and runs on every accepted write via pruneSnapshots:617;
          retainedRevisions:479-485 filters on the absolute row.path rather than on snapshotPathFor(handle, revision),
          and revertTo:1165 reads pointer.path for the same reason.
      - path: "src/mcp/vice/anno-store.test.ts"
        issue: >-
          No test opens two stores in one directory; no test plants the publish-to-commit interleaving;
          no test renames the containing directory between two writes. All three defects are invisible to a
          green 136-test suite, which is why they shipped.
    missing:
      - "Key the snapshot directory on the store FILE (e.g. `${basename(handle.path)}.snapshots`), read through the one helper that already owns the layout, and pin it with a two-stores-in-one-directory revert test"
      - "Make the sweep unable to judge a file it cannot have created — age it against a grace bound comfortably longer than the publish-to-commit window, or serialise it under `begin immediate` — with a two-connection test planting the exact interleaving"
      - "Stop treating anno_snapshot.path as authoritative: derive the location from the handle in retainedRevisions() and revertTo(), store a relative filename or drop the column, and pin it with a rename-the-directory test"
  - truth: "anno-types.ts provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; anno-store.ts trap 7)"
    status: partial
    reason: >-
      28-09's fix is real and its control genuinely discriminates: I reproduced the LIVE directory-symlink case
      being refused with AnnoStorePathError, and separately confirmed an inside-pointing symlink is still
      followed, so the fix is not the over-broad refuse-everything one. The truth itself is still false.
      realpathOfNearestExisting() walks with existsSync, which FOLLOWS links and therefore reports false for a
      DANGLING one, so the walk steps past the symlink instead of resolving it. Reproduced two ways at
      a8187d2 — storePathWithinWorkspace() ACCEPTS both a dangling leaf link and a dangling directory link
      pointing outside the root, and end-to-end openStore() on the dangling leaf link returned a path inside
      the workspace while creating the store file OUTSIDE it (`file created OUTSIDE workspace: true`).
      A dangling link is a one-line plant needing no privilege and nothing pre-existing — easier than the live
      one the fix does catch — against a path the module's own header states arrives unvalidated from the
      transport. This is CR-04, dispositioned open in
      .planning/todos/pending/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md.
      That disposition records the gap; it is NOT a VERIFICATION.md override and does not carry the truth.
    artifacts:
      - path: "src/mcp/vice/anno-types.ts"
        issue: "realpathOfNearestExisting:732-752 — `while (!existsSync(current))` cannot see a dangling symlink; used by storePathWithinWorkspace:797-807."
      - path: "src/mcp/vice/anno-confinement.test.ts"
        issue: "Six cases, all planting LIVE links. No dangling-leaf and no dangling-directory case, which is why the suite is green over the bypass."
    missing:
      - "Decide path-entry existence with lstatSync(p, { throwIfNoEntry: false }) rather than existsSync, so a symlink counts as present whether or not its target does"
      - "When the stopping entry IS a dangling symlink, resolve it with readlinkSync + resolve(dirname(current), link) and restart the walk there"
      - "Two cases in anno-confinement.test.ts — dangling leaf and dangling directory, both pointing outside the root — each asserting AnnoStorePathError AND that nothing was created outside the workspace, matching test 1's two-part shape; with the planted red observed"
deferred: []
prohibition_flags: # judgment-tier; non-authoritative LLM-judge verdicts, human review recommended
  - statement: "28-07 P1 — MUST NOT destroy the only remaining route back to a state the store still advertises as reachable ... a reconciliation that resolves a half-state by deleting the surviving half in the addressable direction is the loss this whole gap exists to close, not a repair of it."
    verdict: violated
    flagged: true
    reason: >-
      Reproduced twice, both times by the reconciliation this prohibition was written to govern. CR-02: the
      sweep deletes a concurrent writer's published snapshot, and that revision can never be undone again.
      CR-03: after a directory move the sweep deletes EVERY file and EVERY row. The prohibition names its own
      violation almost word for word.
  - statement: "28-07 P2 — MUST NOT publish a floor, bound or 'retained' claim the store cannot honour on the very next call."
    verdict: partially_held
    flagged: true
    reason: >-
      Held in the dangerous direction on a single store at a stable path — independently re-verified: the
      published floor is one revertTo honours, and a second revert at it succeeds. It fails in the opposite
      direction after a directory move, where retainedRevisions() reports [] and oldestRetainedRevision()
      reports NO_RETAINED_REVISION while all five snapshot files are sitting there — an under-claim whose
      consequence is that the sweep then deletes them.
  - statement: "28-07 P3 — MUST NOT leave in place, or introduce, a comment that asserts a guarantee the code does not provide."
    verdict: held
    flagged: true
    reason: >-
      Verified by reading: trap 10 (anno-store.ts:109-128) now concludes row-then-file, keeps the premise that
      was right, and records the reversal rather than deleting the paragraph; pruneSnapshots' own ordering
      clause agrees with its loop. Flagged only because verification: judgment admits no automated proof.
  - statement: "28-08 P1 — MUST NOT let a writer that is about to be refused mutate anything a committed writer owns."
    verdict: partially_held
    flagged: true
    reason: >-
      Held as worded, and the mechanism is real: a loser stages under r<rev>.<pid>.<uuid>.tmp, never names
      the published path, and discards its own file. The SPIRIT is broken by two actors the wording does not
      reach — a sweeping writer (CR-02) and a neighbouring store's writer (CR-01) — each of which destroys or
      overwrites bytes a committed pointer row owns.
  - statement: "28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted."
    verdict: held
    flagged: true
    reason: >-
      Probed: a stale-base write threw AnnoStoreStaleRevisionError carrying baseRevision 0 and currentRevision 1.
      The CAS-loss path reads the moved revision from anno_meta BEFORE the rollback (anno-store.ts:819-825),
      confirmed by reading.
  - statement: "28-09 P1 — MUST NOT silently redirect a path the confinement rejects."
    verdict: partially_held
    flagged: true
    reason: >-
      No code path rewrites a rejected path to a safe location, so the prohibition as worded holds. But the
      dangling-symlink bypass produces the outcome the prohibition exists to prevent by a different mechanism:
      storePathWithinWorkspace RETURNS a path inside the workspace while the write lands outside it, with
      nothing recording that it happened.
  - statement: "The eight earlier judgment-tier prohibitions (28-03 P1/P2, 28-04 P3/P4, 28-05 P5/P6, 28-06 P7/P8)"
    verdict: held
    flagged: true
    reason: >-
      Carried forward from the prior round, where each was independently reproduced. Regression-checked here
      via the 136 green tests in the eight phase files plus direct probes of the vocabulary, the split-and-preserve
      cases, the contradicted-comment rule, the label refusals and the census mapping. Flagged only because
      verification: judgment admits no automated proof.
backstop_assessment:
  - id: "28-07 D11"
    statement: "A kill landing between the pointer-row delete and the unlink inside the prune loop leaves an orphan FILE and never an orphan ROW."
    substitution: "A source-order control over the module's own stripped source, plus two directly constructed half-states, instead of a timed mid-prune kill."
    ruling: accepted
    reason: >-
      The substitution covers the whole causal chain the phase owns. See the Backstop Ruling section for the
      argument and the one named residual.
human_verification: []
---

# Phase 28: The Store Core — Verification Report (round 2, post gap-closure)

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-27T23:06:41Z (UTC)
**Commit verified:** `a8187d2`
**Status:** gaps_found
**Re-verification:** Yes — after three gap-closure plans (28-07, 28-08, 28-09)

## What this verification did

Everything below marked VERIFIED was reproduced by this verifier in its own
process against the committed code at `a8187d2` — not read out of a SUMMARY and
not taken from the prior round. That includes:

- running the phase's eight test files (`anno-*.test.ts` + `block-class.test.ts`) → **136 tests, 0 failures**, confirming the reviewer's own count;
- **re-observing criterion 4's planted red on the REWRITTEN shipped call path.** `runWriteSequence` was substantially rewritten by 28-07 and 28-08, so the prior round's observation does not carry. I replaced `commitTransaction`'s `db.exec("commit")` with a no-op by hand: `anno-durability.test.ts:179` — the ONE combined durability-and-revert test — went from `ok` to `not ok`. Restored; `git status --porcelain src/mcp/vice/` clean; 4/4 green again;
- independent probes of the twelve-member vocabulary and the split-orientation control, split-and-preserve, the contradicted-comment rule, the schema/bank/xref columns, the stale-revision refusal, the four corrupt-file refusals, the label refusals, the address-parse refusals and the census mapping;
- **four separate reproduction scripts driving the production functions** for the four blockers `28-REVIEW.md` raised after the gap plans landed.

**Every reviewer verdict that bears on a must-have or a success criterion was
reproduced or refuted, not taken on trust.** Result: all four new blockers
**reproduced**, three of them verbatim (matching the reviewer's own output
lines). WR-01 and WR-04 were confirmed **structurally by reading**, not by
reproduction, and are labelled as such below.

Where a reviewer verdict and an executor SUMMARY disagree, the resolution is
stated explicitly in the "Reviewer verdicts, reconciled" section.

## Goal Achievement

### Observable Truths

Truths 1–5 are the ROADMAP success criteria (the contract). Truths 6–11 are
PLAN-frontmatter must-haves that add material scope beyond them. The truth
numbering is kept identical to the prior round so the two are comparable.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full 12-member vocabulary with the four split layouts as first-class members; a `lo_hi_address` fixture read as `hi_lo_address` produces a **differing resolved-target set**; collapsing the four to one `table` makes that control fail | ✓ VERIFIED | Re-probed `resolveSplitTargets` over identical bytes `[00 10 34 12 78 56]`: `lo_hi_address`→`[4608,30736,22068]`, `hi_lo_address`→`[18,4216,13398]` — a differing target set, not a differing reassembly. Second axis also observable: `_address`→`producesXrefs:true`, `_word`→`false`, targets equal. `DATA_TYPES` is exactly 12 in schema order. The collapse planting is a real, passing test (`anno-types.test.ts:208`). |
| 2 | Narrowest-range-wins exact at all **65,536** addresses, cross-validated against a second independent implementation with **zero** disagreements; tie-break, both ends and `$FFFF` pinned; `$0400-$0400` reports length 1; ranges never merged on adjacency, no splitter primitive | ✓ VERIFIED | Regression: `anno-index.test.ts` green (exhaustive `ADDRESS_MIN..ADDRESS_MAX` loop against `resolveByScan`, with `assert.equal(comparisons, 0x10000)` asserted first as the non-vacuity half). `anno-overlap.test.ts:487`'s structural scan of `codeOnly(anno-store.ts)` for `coalesc`/`merg`/`splitter` still reports `[]` — **and is non-vacuous over the ~390 lines 28-07/28-08 added to that file**, which is what makes this a regression check rather than a stale pass. |
| 3 | A partial overwrite **splits and preserves**; total typed bytes unchanged across all five overlap cases; planting `filter()`-and-insert makes the fully-contained case fail; a retype that contradicts a comment returns the contradicted comments **as data** | ✓ VERIFIED | Re-probed case 3 directly: `$2000-$20FF byte`, retype `$2040-$207F code` → 3 rows `[2000-203f byte][2080-20ff byte][2040-207f code]`, total typed bytes 256→256. Re-probed the contradiction rule: the retype **succeeded** (`changed:true`) and returned the `[confirmed-code]` comment as data with `contradictedBy:"byte"` — as data, not as a refusal. Both plantings are passing tests (`anno-overlap.test.ts:312`, `:427`). |
| 4 | Durability and revert proven by **ONE combined planted-violation test**: mutate → `SIGKILL` no clean close → **fresh process** → reopen → reads back **by value** → revert returns prior value; removing the commit makes **that same test** go red, observed; a truncated store file is **refused**, never partial | ✓ VERIFIED | **The red was re-observed on the current, rewritten code** (see above): `:179` goes `not ok` with the commit removed, `ok` with it restored. The child is a genuinely separate OS process (`execFileSync` → `process.kill(process.pid,"SIGKILL")` at `anno-durability-mutator.mjs:125`). Refusals re-probed independently: zero-length, foreign prose and mid-file truncation all → `AnnoStoreCorruptError`. The tail-truncation residual is still honestly STATED, not claimed closed. |
| 5 | Every write carries a schema version and a **reserved, uninterpreted** `bank` field; xref rows carry their access kind; a write on a stale base revision is **refused**, observed cross-process; `node:sqlite` reachable from exactly one module, asserted structurally | ✓ VERIFIED | Re-probed: `anno_meta` = `{id:1, schema_version:1, revision:N}`; `anno_range` cols `id,start,end_inclusive,data_type,bank`; `anno_xref` cols `id,from_address,to_address,access_kind,bank`; `XREF_ACCESS_KINDS` = `READ,WRITE,READ_WRITE,COMPUTED_JUMP`. Stale write refused: `AnnoStoreStaleRevisionError` carrying `base 0 / current 1`. Cross-process CAS proof still present and green (`anno-store.test.ts:1710`, real `execFileSync` child). Single seam re-checked: of the eight files naming `node:sqlite`, `anno-store.ts` is the **only** one in `package.json` `files[]`; `anno-seam.test.ts` asserts it with four planted-violation routes plus a comment-only negative control. |
| 6 | A store file is refused rather than read when zero-length, truncated mid-file, missing its `anno_meta` row, or of a mismatched schema version — with the tail-truncation residual **stated**, not claimed closed (28-06 truth 3) | ✓ VERIFIED | Re-probed zero-length, foreign-text and mid-file truncation: all three `AnnoStoreCorruptError`. `anno-store.test.ts:292-308` still states the tail-truncation residual deliberately without an assertion. |
| 7 | The snapshot ring is bounded, the pointer rows are pruned to match, and a revert past the bound is **REFUSED by name** with the oldest retained revision in the message (28-06 truth 7) — and, at the goal level, the store is **revertible** | ✗ FAILED | **The prior failure mode is genuinely closed** — re-verified independently: 40 writes → 32 files, `oldestRetained` 8, below-floor revert refuses by name inside the `ViceError` family; `revertTo(8)` then 40 more writes → 32 files, `oldestRetained` 16; **a second revert at the published floor SUCCEEDS** instead of throwing a raw `ENOENT` out of a closed handle. **Three new failure modes reproduced in its place** (CR-01, CR-02, CR-03 — see the reproductions below). All three are silent, all three destroy revert history or return another store's data, none is caught by the 136-test suite. See gap 1. |
| 8 | Pruning happens after the commit and outside the transaction, and a kill in the window leaves **extra files, never a missing one the revert path still points at** (28-06 truth 8) | ✓ VERIFIED | Both halves now hold. First half: `runWriteSequence` step 9 calls `pruneSnapshots` after `commitTransaction` and inside the `doCommit` branch. Second half: the prune loop deletes the **pointer row first** (`anno-store.ts:634`) and unlinks the **file second** (`:644`) — the inversion the prior round found is gone, and trap 10's conclusion (`:109-128`) now agrees with the loop and records the reversal rather than deleting it. Pinned by a source-order control over `codeOnly(anno-store.ts)` with a `body.length > 200` non-vacuity pin and both statements asserted present before their order is compared — a control a "tidying" edit genuinely reddens. Backstop D11 ruled acceptable below. **Caveat, not a failure of this truth:** the forbidden state is now reachable by a *different* route (CR-02, a concurrent sweep, not a kill) and is filed under gap 1. |
| 9 | `anno-types.ts` provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; trap 7) | ✗ FAILED | The `..` and sibling-prefix halves refuse. The **live**-symlink half is genuinely fixed and the control discriminates: a live directory symlink pointing outside → `AnnoStorePathError`; an inside-pointing symlink is still followed, so this is not the over-broad refuse-everything fix. The **dangling** half is open: `storePathWithinWorkspace` ACCEPTS both a dangling leaf link and a dangling directory link pointing outside the root, and `openStore` on the dangling leaf returned an in-workspace path while creating the file OUTSIDE the root. CR-04, reproduced. See gap 2. |
| 10 | A label name bound to a different address is refused; an illegal character refuses rather than being sanitised; the mnemonic denylist is DERIVED from `OPCODES` and compares case-insensitively; an unprefixed numeric address string is refused | ✓ VERIFIED | Re-probed all five refusals — `init screen`, `lda`, `LDA`, `Rol`, and rebinding `init_screen` to a second address — every one `AnnoLabelError`, with `listLabels` still holding exactly `["init_screen"]`, so nothing was sanitised into existence. `parseStoreAddress`: `$0810`→2064, `0x0810`→2064, `"2064"`→`AnnoAddressError`. |
| 11 | The census vocabulary boundary accepts the store's lowercase vocabulary alongside the analyser's capitalised one, pinned by a **derived total** cross-check, with `block-class.ts`'s import list still empty | ✓ VERIFIED | Re-probed `blockClassAt` over all 12 `DATA_TYPES`: exactly 1→`code`, exactly 1→`undefined`, 10→`data`. Capitalised `Code`/`Undefined` still map correctly; `CODE` and `cOdE` fall through to `data`, so no third spelling was silently admitted. `block-class.ts` has zero `import` lines. |

**Score:** 9/11 truths verified (0 present-but-behavior-unverified)

**All five ROADMAP success criteria are VERIFIED**, each one re-established in
this round rather than carried over — including criterion 4's observed red,
re-run against the rewritten write sequence.

**The phase GOAL is not achieved.** This is the "tasks complete, goal missed"
split the goal-backward method exists to surface, and it is worth stating
precisely rather than softening: the goal sentence promises annotation state
that is *"durable across a `SIGKILL`, revertible, and reachable through exactly
one persistence seam."* Durability holds. The single seam holds. **Revertible
does not** — `revertTo` was reproduced returning a *different store's*
annotations with no error, and the revert history was reproduced being silently
destroyed by an ordinary `mv` and by ordinary write contention. Each success
criterion is a statement about a *specific proof*, and every one of those proofs
exists and is falsifiable; none of them can see any of the three losses, because
each is scoped to one store, at one path, with one writer.

## Reproductions (this verifier's own, against `a8187d2`)

### CR-01 — two stores in one directory share one ring; a revert returns the WRONG store's database ✗ REPRODUCED, verbatim

Driving the production functions, no test hooks:

```
A rev 2 rows [ 'code@4096', 'code@4352' ]        # game.annostore
B rev 2 rows [ 'petscii@2049', 'petscii@2304' ]  # loader.annostore, same directory
snapshots/: [ 'r0.db', 'r1.db' ]
A retained: [ 0, 1 ] snapshotPathFor(A,1) = /tmp/cr01-XXXX/snapshots/r1.db
B retained: [ 0, 1 ] snapshotPathFor(B,1) = /tmp/cr01-XXXX/snapshots/r1.db   <- IDENTICAL
A after revertTo(1): rev 1 rows [ 'petscii@2049' ]
A2 store path: /tmp/cr01-XXXX/game.annostore
```

`game.annostore` reverted to **its own** revision 1 and came back holding
`loader.annostore`'s annotations. Every one of A's rows is gone; no error was
raised; `retainedRevisions()` reported the revision as perfectly retained
beforehand, because both halves of the predicate genuinely exist. The ownership
predicate 28-07 added is structurally unable to see this: it is per-revision,
and revision numbers are not unique across stores in one directory.

**Attribution, checked in git rather than assumed.** The `join(handle.dir, "snapshots", …)`
keying dates from `4c9cea3` (28-01), so consequence 3 pre-dates the gap plans.
Consequence 1 — the sweep *deleting* the neighbour's ring on every accepted
write — is new in `6902301` (28-07). The prior round did not find this because
it never opened two stores in one directory.

### CR-02 — the sweep deletes a concurrent writer's published-but-uncommitted snapshot ✗ REPRODUCED, verbatim

```
rev after two writes: 2 retained: [ 0, 1 ]
B published (uncommitted row) snapshot file exists: true r2.db
A reconcile droppedRows: [] droppedFiles: [ 'r2.db' ]     <- A deleted B's file
B committed. rev: 3
pointer rows: [ [0,'file OK'], [1,'file OK'], [2,'FILE GONE'] ]
retained (B): [ 0, 1 ]
revertTo(2) REFUSED: AnnoStoreError | cannot revert to revision 2: no snapshot is retained for it.
```

Revision 2's pre-mutation snapshot is destroyed, so that write can **never** be
undone. `retainedRevisions()` stops it becoming an `ENOENT` crash — 28-07's fix
doing exactly its job — but the underlying loss is the one trap 10 names as the
direction the revert path cannot survive, now manufactured by the reconciliation
that exists to prevent it.

**Honest note on the mechanism of my repro:** I used `applyWriteWithoutCommit`
(the test-only sibling export) to hold writer B deterministically between its
`renameSync` at `:832` and its `commit` at `:870`. The *interleaving* is
production-reachable without it: the rename is a filesystem act and the pointer
row is transactional, `pruneSnapshots` runs immediately after every commit
(`:870-875`), and a writer blocked on `begin immediate` is woken by precisely
that commit — so this is the likely interleaving under contention, not a rare
one. The module supports concurrent writers by design (`{ timeout: 5_000 }` at
`:317`, plus a real cross-process CAS proof). The sweep's directory pass needs no
write lock when there are no orphan rows, so it completes while B holds the
transaction.

### CR-03 — `anno_snapshot.path` is absolute; one `mv` plus one write destroys the ring ✗ REPRODUCED, verbatim

```
before move:              rev 5 retained [0,1,2,3,4] files [r0.db..r4.db]
after move, before write: retained []   oldest -1    files [r0.db..r4.db]
after ONE write:          retained [5]               files [ 'r5.db' ]
rows survive: 6
```

Five snapshot files and five pointer rows destroyed, with no error, no report and
nothing in `AnnoWriteResult` to notice it by. The annotations survive; the whole
of `STORE-04`'s revert history does not.

**This is a regression introduced by gap closure.** Before 28-07 the bound was
computed over pointer rows alone, so a moved directory was harmless — a
`rmSync(..., { force: true })` on an absent path is a no-op. `retainedRevisions()`
turned the absolute path into a *destruction* trigger. The repo makes this worse
than hypothetical: the same bind-mounted tree seen from the host and from a
container is exactly the second-absolute-path case, and this project's whole
architecture is built around that boundary.

### CR-04 — dangling-symlink confinement bypass ✗ REPRODUCED

Through `openStore`, end to end:

```
target exists before: false
A) confinement ACCEPTED, returned: /tmp/annosym-XXXX/ws/p.annostore
A) file created OUTSIDE workspace: true
C) refused (good): AnnoStorePathError     (live dir link -- the case 28-09 fixed)
```

And at the predicate itself, which is where the reviewer measured it:

```
A dangling leaf -> ACCEPTED: /tmp/annosym2-XXXX/ws/p.annostore
B dangling dir  -> ACCEPTED: /tmp/annosym2-XXXX/ws/sub/q.annostore
```

**One partial refutation of the reviewer, stated for the record.** The reviewer's
case B output shows `openStore` accepting the dangling *directory* link. Driving
`openStore` I got `AnnoStorePathError` for case B — but for an unrelated reason
(`DatabaseSync` cannot create a file under a non-existent directory, and 28-08's
new wrapper converts that into a path error). The **confinement itself accepts
it**, as the predicate-level run above shows. The reviewer's finding stands; only
the incidental exit path for case B differs.

## Reviewer verdicts, reconciled

| Finding | Reviewer's verdict | This verifier | How resolved |
|---|---|---|---|
| old CR-01 (orphan rows, lying floor, `ENOENT` out of a closed handle) | Resolved | **Confirmed resolved** | Reproduced the whole forward-and-revert sequence myself: 32-file bound holds after a revert, floor honest, second revert at the floor succeeds. Independently observed, not read off the review. |
| old CR-02 (a loser overwrites a winner's snapshot) | Resolved | **Confirmed resolved** | Read the staging/publish/discard triple: `stageSnapshot` vacuums into `r<rev>.<pid>.<uuid>.tmp`, `publishSnapshot` renames only after the CAS is won (`:832`), `discardSnapshot` is called on both non-committing exits (`:820`, `:865`). |
| old CR-03 (symlink bypass) | PARTIALLY resolved | **Confirmed partial** | Reproduced both halves: live link refused (fixed), dangling link accepted with the file created outside (open). |
| old WR-01 (prune deletes file before row) | Resolved | **Confirmed resolved** | Row at `:634`, file at `:644`, plus a genuinely reddenable source-order control and a corrected trap 10. |
| old WR-02 (`revertTo` closes the handle first) | Resolved | **Confirmed resolved** | Read `revertTo`: copy + two `fsyncPath` calls at `:1173-1187` precede `closeStore` at `:1194`, and the rename-failure residual is stated in the error text rather than claimed closed. |
| old WR-04 (`openStore` raw errors + leaked connection) | Mostly resolved | **Confirmed mostly** | Constructor wrapped (`:334-336`) and the fresh-init block wrapped with rollback + `db.close()` (`:349-362`). `pragma integrity_check` at `:394` is still unwrapped and still leaks the connection — **structurally confirmed by reading, not reproduced**. Warning, not a must-have failure. |
| old WR-11 (CAS refusal omits `currentRevision`) | Resolved | **Confirmed resolved** | Probed: both numbers present. The moved revision is read before the rollback (`:819-825`). |
| new CR-01 / CR-02 / CR-03 / CR-04 | BLOCKER ×4 | **All four reproduced** | See above. CR-01, CR-02 and CR-03 reproduce verbatim including the reviewer's own output lines. |
| WR-01 (unguarded staging→mutation window) | WARNING | **Structurally confirmed, not reproduced** | `stageSnapshot` at `:805`; the first `try` in the sequence is at `:848`. No handler covers `begin immediate` (`:807`), the CAS `.run()` (`:809`), the rename (`:832`) or the pointer insert (`:834`). A throw there leaks a `.tmp` the sweep is deliberately anchored not to collect, and escapes the `ViceError` family. Warning. |
| WR-08 ("`retype` merges adjacent same-type rows", framed as a `STORE-02` contradiction) | WARNING | **Refuted in that framing, again** | The prior round refuted it; the structural scan of `codeOnly(anno-store.ts)` for `coalesc`/`merg`/`splitter` still reports `[]`, non-vacuously over the new code. Whatever `retype` does on a same-type subrange is not an adjacency coalescer and does not contradict `STORE-02`. |

### Where a SUMMARY and the code disagree

- **28-09-SUMMARY.md declares `requirements-completed: [STORE-01, STORE-07]`.**
  Its own coverage item D1 is worded around a *symlinked subdirectory* (a live
  link) and is literally true. But `STORE-01`'s confinement half is not complete:
  the dangling case creates the store file outside the root. The SUMMARY's
  per-item claims survive; its requirement-level claim overstates. The executors
  were right to leave `REQUIREMENTS.md` at `Gaps Found`, and I have not changed it.
- **28-07-SUMMARY.md presents the reconciliation sweep as the repair for gap 1.**
  It is, for gap 1. It is also the direct cause of CR-02 and CR-03. No SUMMARY
  claims otherwise — the defects simply were not looked for — but the net effect
  of 28-07 on the ring is one failure mode closed and two opened.

## Backstop Ruling — 28-07 coverage item D11

**The item.** *"A kill landing between the pointer-row delete and the unlink
inside the prune loop leaves an orphan FILE and never an orphan ROW. The real
interleaving is not deterministically reachable from a test without a hook in
shipped code, so this is carried as a backstop over the source-order assertion
plus the two constructed half-states rather than as a timed control."*

**Ruling: the substitution is ACCEPTED.**

The claim decomposes into three links, and the evidence covers the two this
phase owns:

1. *The source order is row-then-file.* Proven by a mechanical control that
   genuinely reddens — I read it: it extracts `pruneSnapshots`' body from the
   stripped source, asserts a `> 200` character non-vacuity floor, asserts both
   statements are **present** before comparing their indices, and only then
   asserts `rowDelete < unlink`. Swapping the two statements flips it. This is
   the correct instrument for the property: both statements are present in either
   arrangement and both leave the same end state absent a kill, so no behavioural
   assertion can distinguish them. A test that cannot see the thing it claims to
   test is worse than an honest structural one.
2. *Each half-state, once it exists, is handled correctly.* Proven by the two
   constructed half-states (`anno-store.test.ts:1432` and `:1481`), each of which
   asserts the ring is full **before** the half-state is constructed and that the
   construction really took effect — so neither can pass vacuously.
3. *A `SIGKILL` between two adjacent statements actually yields the state the
   source order implies.* This is the untested link, and it is a property of the
   platform, not of this code: it asks whether SQLite's autocommit of the row
   delete is durable before the following `rmSync`. Under the failure model the
   phase actually declares — `SIGKILL`, not power loss — the page cache survives,
   so it holds. And the phase already exercises that platform property directly
   elsewhere, with a real self-`SIGKILL`ing child process in
   `anno-durability.test.ts`.

Reaching link 3 by a timed control would require a hook inside a shipped module,
which this project's conventions refuse and which would itself weaken the
`STORE-07` single-seam and no-test-scaffolding-in-shipped-code properties the
phase spends real effort on. Trading a proven structural control for an
unreliable timing race that also degrades a verified invariant is a bad trade.

**Named residual:** link 3 is unproven under *power loss* (as distinct from
`SIGKILL`), where WAL durability ordering versus an unlink is genuinely open.
That is outside the phase's stated failure model and should be recorded as a
known limit rather than closed silently. **This residual is advisory and does
not gate the phase.**

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-store.ts` | The single `node:sqlite` seam: ownership predicate, half-state resolver, staged/published snapshots, revert, prune | ✓ EXISTS, SUBSTANTIVE, WIRED — ⚠️ defective | 1677 lines (28-08 floor 1480). All declared exports present. Wired: imported by `anno-index`-adjacent tests, the mutator and the census boundary. Data flows (real `DatabaseSync`, no static returns). Three reproduced destructive defects in the ring — see gap 1. |
| `src/mcp/vice/anno-types.ts` | Vocabulary, validators, error family, workspace confinement | ✓ EXISTS, SUBSTANTIVE, WIRED — ⚠️ defective | 1074 lines (28-09 floor 1019). `storePathWithinWorkspace` present and reached from `openStore:323`. Dangling-symlink bypass — see gap 2. |
| `src/mcp/vice/anno-index.ts` | Pure narrowest-wins paint index | ✓ VERIFIED | 150 lines. Rebuilt from rows on every call via `paintIndexOf`; nothing cached. |
| `src/mcp/vice/block-class.ts` | The census vocabulary boundary | ✓ VERIFIED | 183 lines, zero `import` lines, both vocabularies as two explicit arms. |
| `src/mcp/vice/anno-confinement.test.ts` | Symlink refusal + non-over-broad control | ✓ EXISTS, SUBSTANTIVE — ⚠️ incomplete | 218 lines (floor 180), 6 cases, all green. All six plant **live** links; no dangling case, which is why CR-04 is invisible to it. |
| `src/mcp/vice/anno-seam.test.ts` | `STORE-07` structural proof + seam-private export bound | ✓ VERIFIED | 445 lines (floor 419). Four planted-violation routes incl. `process.getBuiltinModule`, a comment-only negative control, declared lists paired with length checks. |
| `src/mcp/vice/anno-store.test.ts` | Ring, revert, ownership, refusal and half-state proofs | ✓ EXISTS, SUBSTANTIVE — ⚠️ incomplete | 2123 lines (28-08 floor 1610). Blind to two-stores-in-one-directory, to the publish-to-commit interleaving and to a directory rename. |
| `src/mcp/vice/anno-durability.test.ts` + `anno-durability-mutator.mjs` | The ONE combined `SIGKILL` proof and its planting | ✓ VERIFIED | 372 + 136 lines. Real separate OS process; real self-`SIGKILL`; planted red re-observed by hand on the current code. |
| `src/mcp/vice/anno-types.test.ts`, `anno-index.test.ts`, `anno-overlap.test.ts`, `block-class.test.ts` | Vocabulary, exhaustive index, five overlap cases, census cross-check | ✓ VERIFIED | 615 / 530 / 588 lines + `block-class.test.ts`. All green inside the 136. |

## Key Link Verification

`gsd-tools query verify.key-links` reports 2/30 across the nine plans. **Those
failures are a tool artifact, not a wiring finding** — the tool passes the
`pattern` field with its surrounding quote characters into the search, so no
pattern with a quoted literal can match. Every link was therefore verified by
hand with `grep`:

| From | To | Via | Status | Detail |
|---|---|---|---|---|
| `anno-store.ts` | `anno-store.ts` | one `retainedRevisions()`, three consumers | ✓ WIRED | Defined `:479`; read by `oldestRetainedRevision:507`, `reconcileSnapshotRing:555`, `revertTo:1153`. `pruneSnapshots` reads it through the resolver — the set is closed, exactly as the doc comment claims. |
| `anno-store.ts` | `anno-store.ts` | `stageSnapshot` → `publishSnapshot` → `discardSnapshot` | ✓ WIRED | `:805` stage, `:832` publish (after the won CAS), `:820`/`:865` discard on both non-committing exits. |
| `anno-store.ts` | `anno-types.ts` | `MAX_SNAPSHOT_REVISIONS`, `AnnoStoreError`, `AnnoStoreStaleRevisionError` | ✓ WIRED | Imported at `:151` and used as the single bound; both error classes thrown from the ring and CAS paths. No second literal for the bound. |
| `anno-types.ts` | `node:fs` | `existsSync`, `realpathSync` for the ancestor walk | ✓ WIRED | `import { existsSync, realpathSync } from "node:fs"` at `:110`. |
| `anno-types.ts` | `hostpath.ts` | **MUST NOT exist** | ✓ ABSENT (correct) | The only `hostpath` occurrence in `anno-types.ts` is a doc-comment reference at `:794`. `hostpath-consumers.test.ts` green: 11/11. |
| `anno-confinement.test.ts` | `anno-store.ts` | `openStore` end-to-end so the FILE is checked, not just the throw | ✓ WIRED | 6 `openStore` references. |
| `anno-seam.test.ts` | `anno-store.ts` | seam-private export scan over the shipped module set | ✓ WIRED | `stageSnapshot` joined `applyWriteWithoutCommit` in the declared list, paired with a length check and a non-vacuity presence pin at `:335`. |
| `package.json` | shipped modules | `files[]` ships the four modules, no test file | ✓ WIRED | `files[]` contains `anno-store.ts`, `anno-types.ts`, `anno-index.ts`, `block-class.ts`; no `anno-*.test.ts` and no `anno-durability-mutator.mjs`. |

## Data-Flow Trace (Level 4)

| Artifact | Value | Source | Real data | Status |
|---|---|---|---|---|
| `listRanges` | typed ranges incl. `bank` | `select id, start, end_inclusive, data_type, bank from anno_range order by id` | yes | ✓ FLOWING |
| `paintIndexOf` | narrowest-wins index | `buildPaintIndex(listRanges(handle))`, rebuilt each call | yes | ✓ FLOWING |
| `retainedRevisions` | retained revision list | `select revision, path from anno_snapshot` **filtered on the stored absolute path** | yes, but the predicate is location-fragile | ⚠️ FLOWING-BUT-FRAGILE (CR-03) |
| `oldestRetainedRevision` | the published floor | first element of `retainedRevisions()` | yes | ✓ FLOWING |
| `revertTo` | restored store contents | `copyFileSync(pointer.path, staging)` → rename | **the file at that path may be another store's** | ✗ WRONG-SOURCE (CR-01) |
| `currentRevision` | revision counter | `select revision from anno_meta where id = 1` | yes | ✓ FLOWING |
| `setDataType` result | `contradictedComments` | `collectContradictedComments` reading `anno_comment` inside the same transaction | yes — probed, returned a real row as data | ✓ FLOWING |
| `blockClassAt` | census class | the caller's block list, two explicit vocabulary arms | yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| The phase's own eight test files pass | `node --test anno-store anno-types anno-confinement anno-seam anno-index anno-overlap anno-durability block-class` | 136 tests / 136 pass / 0 fail | ✓ PASS |
| `hostpath` isolation still holds over the new `node:fs` import | `node --test hostpath-consumers.test.ts` | 11 pass / 0 fail | ✓ PASS |
| Criterion 4's planted red on the CURRENT shipped path | `commitTransaction` → no-op by hand; `node --test anno-durability.test.ts` | `not ok 1` (the ONE combined test), `# pass 1 / fail 3`; restored → `# pass 4 / fail 0`, `git status` clean | ✓ PASS (red observed) |
| Ring bound holds after a revert | 40 writes → revert → 40 writes, production functions | 32 files both times; floor 8 then 16; second revert at the floor SUCCEEDS | ✓ PASS |
| Two stores in one directory keep their own rings | production `openStore`/`setDataType`/`revertTo` | A's revert returned B's rows | ✗ FAIL (CR-01) |
| A concurrent writer's published snapshot survives a sweep | two connections, production `reconcileSnapshotRing` | `droppedFiles: [r2.db]`; revision 2 permanently unrevertible | ✗ FAIL (CR-02) |
| The ring survives a project-directory rename | `mv` + one write, production functions | 5 files and 5 rows destroyed silently | ✗ FAIL (CR-03) |
| A dangling symlink cannot place the store outside the root | `openStore` + `storePathWithinWorkspace` | accepted; file created outside | ✗ FAIL (CR-04) |
| The full workspace suite | **not run** | — | ? SKIP — documented ~19 min runtime with a hang in `vice-proxy.test.ts`; a truncated run is not a test result. Targeted files run instead, per the phase's own guidance. |

## Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| `scripts/*/tests/probe-*.sh` | `find scripts -path '*/tests/probe-*.sh'` | none found; no phase-28 PLAN or SUMMARY declares a probe script | N/A — not a probe-based phase |

## Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
|---|---|---|---|---|
| **STORE-01** | 28-01, 28-04, 28-09 | Labels, comments, per-range typing over the **full 12-member** vocabulary, scopes, project enums | ✗ BLOCKED | The vocabulary half is fully satisfied and re-probed (truths 1, 3, 10). The confinement half that 28-09 declares under this ID is not: a dangling symlink puts the store file outside the workspace root (truth 9, gap 2). |
| **STORE-02** | 28-02, 28-05 | Ranges never merged on adjacency; no splitter introduced | ✓ SATISFIED | Behavioural (two adjacent ranges stay two rows) and structural (`codeOnly` scan for `coalesc`/`merg`/`splitter` → `[]`, non-vacuous over 28-07/28-08's additions). Truth 2. |
| **STORE-03** | 28-02, 28-05 | Narrowest-wins exact at all 65,536 addresses, cross-validated; partial-overwrite behaviour pinned | ✓ SATISFIED | Exhaustive loop with an asserted comparison count of `0x10000`; five overlap cases with the fully-contained case load-bearing. Truths 2, 3. |
| **STORE-04** | 28-06, 28-07, 28-08 | Survives a restart; an edit can be **reverted**; one combined planted-violation test with the red observed | ✗ BLOCKED | The durability half is satisfied, and the observed red was re-run against the rewritten write sequence (truth 4). The **revert** half is not: reproduced returning another store's database (CR-01), reproduced losing a revision permanently under contention (CR-02) and losing the entire history on a directory move (CR-03). Truth 7, gap 1. |
| **STORE-05** | 28-01, 28-04, 28-06 | Schema version + reserved uninterpreted `bank`; xref access kinds; stale-base writes refused | ✓ SATISFIED | Columns re-probed; `bank` written `NULL`, read back, never branched on; four access kinds frozen; stale write refused with both revisions; cross-process CAS proof green. Truth 5. |
| **STORE-07** | 28-01, 28-08, 28-09 | `node:sqlite` reached through exactly one seam module | ✓ SATISFIED | `anno-store.ts` is the only entry in `files[]` naming `node:sqlite`; asserted structurally with four planted-violation routes and a comment-only negative control; `anno-types.ts`'s new `node:fs` import is a Node builtin, and `hostpath-consumers.test.ts` stays green. Truth 5. |

**Orphaned requirements: none.** `REQUIREMENTS.md` maps exactly
`STORE-01..05, STORE-07` to Phase 28, and every one is claimed by at least one
plan's `requirements` frontmatter. `STORE-06` maps to Phase 29 and is correctly
absent here.

**`REQUIREMENTS.md` was NOT modified by this verification.** All six rows stay at
`Gaps Found`, which my own verdict supports: `STORE-01` and `STORE-04` are
blocked, and the milestone convention is not to flip the others independently
while the phase is open.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across all 12 phase files | — | **None found.** The debt-marker gate is clean. |
| `anno-store.ts` | 805–848 | 43 lines between `stageSnapshot` and the first `try` — `begin immediate`, the CAS, the rename and the pointer insert are all unguarded | ⚠️ Warning | A throw there leaks a `.tmp` the sweep is deliberately anchored not to collect (unbounded growth in the directory `MAX_SNAPSHOT_REVISIONS` exists to bound), leaves the transaction open with the CAS applied, and escapes the `ViceError` family. Structurally confirmed. (WR-01) |
| `anno-store.ts` | 394 | `pragma integrity_check` outside any `try` | ⚠️ Warning | A throw leaks the connection and escapes the family — the one path 28-08's `openStore` wrapping missed. (WR-04) |
| `anno-store.ts` | 870–877 | `pruneSnapshots` runs after `commitTransaction` with no handler | ⚠️ Warning | Its two `delete from anno_snapshot` statements are autocommit writes; `SQLITE_BUSY` after the 5 s timeout reports a **committed** write to the caller as a failure, and a retry of an additive verb produces a second row. (WR-02) |
| `anno-store.ts` | 566–582 | The sweep's `readdirSync` + unconditional unlink | 🛑 Blocker | Root cause of CR-02 and, with the absolute-path predicate, of CR-03. Filed as gap 1. |
| `anno-types.ts` | 732–752 | `existsSync` used as a path-entry-existence test | 🛑 Blocker | Root cause of CR-04. Filed as gap 2. |

The eight remaining `28-REVIEW.md` warnings (WR-03, WR-05..WR-10) and four info
items were re-read; none falsifies a must-have or a success criterion, and they
are correctly dispositioned in the review. They are not repeated here.

## Human Verification Required

None. Every truth resolved to VERIFIED or FAILED against reproduced evidence; no
truth was left present-but-behavior-unverified, and no truth needed a judgment
call I could not make from the code. The judgment-tier prohibitions are carried
in `prohibition_flags` as non-authoritative verdicts with human review
recommended, per the standing convention for that tier — but they are not
blocking items and they are not the reason for this phase's status.

## Gaps Summary

Three gap-closure plans ran, and they did real work: **one of the three prior
gaps is genuinely closed** (the prune's ordering, plus the inverted trap-10
comment that would have misled the next reader), and the other two had their
*named* remedies correctly implemented — the ownership predicate, the half-state
resolver, the per-attempt staging with publish-after-CAS, the real-path
confinement. I re-verified each of those mechanisms independently rather than
reading them off a SUMMARY, and each does what it claims. The score moved 8/11 →
9/11 and all five ROADMAP success criteria hold, each re-established in this
round.

But **two of the three gaps are not closed at the level the must-have states**,
and the reason is worth naming because it is a pattern rather than an accident:
in both cases the plan closed the *specific reproduction* the prior verification
happened to write, and the underlying property stayed false one step to the side
of it. Gap 3's remedy handles live symlinks and not dangling ones — a strictly
easier plant. Gap 1's remedy fixes the post-revert ring on one store, at one
path, with one writer, and introduces two new destructive defects in the ring
the moment any of those three assumptions is relaxed.

The concentration is striking and should drive the closure design: **all three
new ring blockers are the same missing idea — a snapshot's identity.** CR-01 is
"the ring has no identity, so two stores share one." CR-03 is "the identity is
an absolute path, so it changes when the tree moves." CR-02 is "identity is
decided from one connection's committed view, so a file mid-publication looks
unowned." A closure plan that fixes them one at a time will keep finding the
fourth. One that decides what identifies a snapshot — which store, keyed on the
store *file*; which revision, derived from the handle rather than stored; and
who may judge an unclaimed file, which is nobody who cannot have created it —
closes all three and makes the fourth hard to write.

CR-04 is separate and much smaller: `existsSync` cannot answer the question the
confinement is asking, and `lstatSync` can. Its real cost is the test surface
(dangling leaf, dangling directory, broken chains, and the over-refusal control
that must survive), which is exactly what the existing todo says.

**Not deferrable.** Phase 29 exposes this store through an MCP tool family; no
later phase in the milestone touches the snapshot ring or the confinement, so
nothing downstream absorbs these. Shipping the surface over a store whose revert
can return a neighbouring store's annotations would put the silent-wrong-answer
in front of an agent.

---

_Verified: 2026-08-27T23:06:41Z at `a8187d2`_
_Verifier: Claude (gsd-verifier), round 2_
