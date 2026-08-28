---
phase: 28-the-store-core
verified: 2026-08-28T13:10:41Z
status: gaps_found
score: 11/12 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/12 # round 3; round 2 was 9/11, round 1 was 8/11
  gaps_closed:
    - >-
      "An accepted write and the housekeeping it triggers cannot leave the store's own connection inside
      an open transaction, and everything the store throws stays inside the ViceError family." CLOSED, and
      re-driven here through production entry points rather than read off the SUMMARY. All three of round
      3's reproductions are gone. (a) CR-06, cross-process against a genuinely separate OS process holding
      a real read transaction: the write now refuses with `AnnoStoreError`, `instanceof ViceError` true,
      after a measured 5010 ms — the connection's real `busy_timeout`, so the contention was genuine —
      `currentRevision()` stayed at 1 for a write that never landed, `begin immediate` on the same handle
      SUCCEEDED afterwards proving the write lock was released, and the next `setDataType` advanced the
      revision by exactly one. (b) CR-07 sweep arm, with the ring directory writable-but-not-readable
      (0o300, uid 1000): the ordinary `setDataType` reported success at revision 3 and `begin immediate`
      immediately afterwards SUCCEEDED — the leaked transaction round 3 reproduced deterministically is
      gone. (c) WR-12: a regular-file ancestor (ENOTDIR), an unreadable ancestor (EACCES) and an ANCESTOR
      symlink cycle (ELOOP) each now throw `AnnoStorePathError`, `instanceof ViceError` true, naming the
      path, through BOTH `storePathWithinWorkspace` and `openStore` — six drives, six in-family refusals —
      while the over-refusal control still discriminates (an inside-pointing dangling link is still
      FOLLOWED to a path under the root).
    - >-
      The CR-05 half of gap 1 is closed and independently re-driven. A store reached through a symlink
      alias and written once through it keeps `retained [0,1,2]` and files `[r0.db, r1.db, r2.db]`
      unchanged, and `revertTo(1)` on the real path SUCCEEDS. `mv proj.annostore other.annostore` + one
      write + `mv` back leaves the floor at 0 and `revertTo(0)` SUCCEEDS. `reconcileSnapshotRing` contains
      no `delete from anno_snapshot` at all. The CR-07 revert arm is closed too: with the ring unreadable,
      `revertTo` returns a USABLE handle at the reverted revision (rev=1, listRanges answering) instead of
      round 3's bare non-family `EACCES` after a landed revert.
  gaps_remaining:
    - >-
      The goal's REVERTIBLE clause is still FALSE, now for a FOURTH distinct cause (CR-08), reproduced
      here independently through production entry points. Every cause round 3 named is genuinely closed;
      the CLASS is reopened by an input none of the four rounds asked about — a snapshot image that is
      PRESENT but is not a database.
  regressions:
    - >-
      28-07 P2 has regressed in the DANGEROUS (over-claim) direction, which round 3 recorded as HELD. With
      `r1.db` truncated to 0 bytes, `retainedRevisions()` still advertises `[0,1,2]` and
      `oldestRetainedRevision()` still reports 0 — the store publishes a revert route it cannot honour —
      and following that published route DESTROYS the live store. Round 3's finding was the safe-direction
      under-claim only.
gaps:
  - truth: >-
      At the goal level the store is REVERTIBLE — a revert can return the annotation state to a prior
      revision, and can never destroy it (ROADMAP Phase 28 goal, "durable across a SIGKILL, revertible";
      carried forward from round 3's gap 1)
    status: failed
    reason: >-
      Everything the third gap-closure round set out to close IS closed, and I re-drove each of the four
      handed-over ids myself rather than reading the SUMMARYs (see `gaps_closed`). The truth is still
      FALSE for a NEW reason, and this one destroys data rather than merely refusing. `revertTo` witnesses
      the snapshot image with `existsSync` and nothing else — at step 2's refusal gate (`anno-store.ts`
      `:1632`) and inside `retainedRevisions` (`:605`) — then `copyFileSync`s that file to a staging path,
      CLOSES the caller's handle (step 4, `:1647`) and `renameSync`s the image over the live store (step
      5, `:1677`). No open, no `pragma integrity_check`, at any point before the live store is gone.
      REPRODUCED HERE, through production entry points only, with no hand edit of the store file: a store
      at revision 3 with ring `[r0.db, r1.db, r2.db]`; `r1.db` truncated to 0 bytes;
      `retainedRevisions()` still reports `[0,1,2]` and `oldestRetainedRevision()` still reports 0;
      `revertTo(handle, 1)` throws `AnnoStoreCorruptError`; the live store is left at **0 bytes**; NO
      handle is returned; and every later `openStore` refuses `AnnoStoreCorruptError: not an annotation
      store (no such table: anno_meta)`. The current revision has no snapshot by design, so nothing in the
      module recovers it — after this call there is no production entry point that can even obtain a
      handle. This is the module's own first measured fact ("A ZERO-LENGTH FILE OPENS, so the refusal is
      the store's OWN job", `anno-store.ts:22-31`) applied at `openStore` and never applied to the image
      `revertTo` installs. THE INPUT IS NOT HYPOTHETICAL. `stageSnapshot` (`:1009-1015`) runs `vacuum
      into` with no `fsync` and `publishSnapshot` (`:1047-1049`) is a bare `renameSync` with no file and
      no directory `fsync`, while the pointer row that names the image commits durably through SQLite —
      verified in source. The module already owns `fsyncPath()` (`:322-329`) and uses it correctly on the
      revert path (staging, and the directory after the rename); the publish path is the one place it is
      missing (WR-13). So the very SIGKILL/crash event ROADMAP criterion 4 is built around can leave a
      durable pointer row naming a snapshot whose bytes never reached disk — CR-08's exact input, arrived
      at with nobody editing anything. The suite already writes zero-length snapshot images as a fixture
      (`anno-store.test.ts:2155`), so the byte pattern is trivially reachable; it has simply never been
      handed to `revertTo`. NOT DEFERRABLE: no later phase in the milestone addresses the store's revert
      integrity, and Phase 29 builds the MCP surface directly on this handle, where — by this module's own
      comment — a handle lives as long as the session.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          `revertTo` step 2 (`:1632`) gates on `!pointer || !existsSync(snapPath)` — an existence witness
          only — and steps 3-5 (`:1655-1680`) copy, close the caller's handle and rename that unverified
          image over the live store; `retainedRevisions` (`:605`) publishes retention on the same
          existence-only witness, so the store advertises a route that destroys it. Introduced at 0e15c51
          (28-10), untouched by this round. Separately `stageSnapshot` (`:1009-1015`) and
          `publishSnapshot` (`:1047-1049`) never `fsync` the image or its directory while the pointer row
          commits durably (WR-13), which is what manufactures the input.
      - path: "src/mcp/vice/anno-store.test.ts"
        issue: >-
          No test plants a corrupt, truncated or zero-length SNAPSHOT image and calls `revertTo` — 159
          green tests are blind to the class. The file itself writes a zero-length snapshot image at
          `:2155` as a prune fixture, which is the same byte pattern, so the gap is in which function was
          asked, not in whether the input is constructible.
    missing:
      - >-
        Verify the snapshot image BEFORE the live store is closed: open it and run `pragma
        integrity_check` (plus the store's own `anno_meta`/`schema_version` check) inside `revertTo` step
        2, so a present-but-unusable image is REFUSED by name with the caller's handle still open and
        usable — the same ordering argument step 3's comment already makes for copy/fsync failures
      - >-
        Make `retainedRevisions()` stop advertising a revision whose image cannot be opened, so the
        published floor and the `available revisions` list in the refusal message cannot steer a caller
        into the destroying call (28-07 P2, over-claim direction)
      - >-
        Close WR-13: `fsync` the staged snapshot and the ring directory in `stageSnapshot` /
        `publishSnapshot` before the pointer row commits, using the module's existing `fsyncPath()`, so a
        durable pointer row cannot name a non-durable image
      - >-
        Two tests: a truncated/zero-length snapshot image handed to `revertTo` asserting an in-family
        refusal AND that the live store is byte-identical afterwards and the handle still answers; and a
        foreign-bytes image asserting the same
      - >-
        Disposition the six new REVIEW.md finding ids (CR-08, WR-13, WR-14, WR-15, WR-16, WR-17) — the
        repo's own `docs-review-disposition.test.ts` (AUDIT-01) and its `D-12-02` cascade in
        `audit-integrity.test.ts` are RED on the current tree for exactly these six ids, confirmed by
        running both
deferred: []
behavior_unverified_items:
  - truth: >-
      `openStore`'s `integrity_check could not be run at all` arm (`anno-store.ts:432`) refuses in-family
      — the pending human-verification item REQUIREMENTS.md names as the reason STORE-04 was held back
    test: >-
      Fault-inject so `pragma integrity_check` itself throws rather than returning a non-`ok` row (the
      non-`ok` row path at `:434-436` is already covered by the truncated-mid-file test)
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      The arm is defensive and has no reachable input without filesystem- or SQLite-level fault
      injection; presence and wiring are verified in source but no test exercises it, and a 10-second
      spot-check cannot construct the precondition
coincidental_reliance_items:
  - truth: >-
      "CR-07's behavioural control: with the ring directory writable-but-not-readable, an accepted write
      leaves no open transaction on the caller's connection"
    reason: undeclared-precondition
    harden: >-
      The two controls at `anno-store.test.ts:3098-3104` and `:3187-3193` hold only when the process is
      not root — an unreadable directory is not constructible when the mode bits are ignored — and they
      report `assert.ok(true, "SKIPPED as root: ...")` rather than skipping (WR-14). Under root the suite
      reports 159/159 pass with 0 skipped and CR-07's only behavioural control never executes. Declare the
      precondition with node:test's real `{ skip: ... }`, exactly as the sibling control added in the same
      round does at `anno-confinement.test.ts:578`. NOTE: my own CR-07 evidence does not depend on these
      controls — I drove the unreadable-ring case directly as uid 1000 — so this weakens the round's
      standing guarantee, not this verdict's basis.
prohibition_flags: # judgment-tier; non-authoritative LLM-judge verdicts, human review recommended
  - statement: >-
      28-07 P2 / 28-10 P2 — MUST NOT publish a floor, bound or "retained" claim the store cannot honour on
      the very next call, in EITHER direction.
    verdict: violated
    flagged: true
    reason: >-
      NOW VIOLATED IN BOTH DIRECTIONS, and the second one is new. (a) OVER-CLAIM, the dangerous direction,
      which round 3 recorded HELD: with `r1.db` at 0 bytes `retainedRevisions()` reports `[0,1,2]` and
      `oldestRetainedRevision()` reports 0, and following that published route destroys the store (CR-08,
      reproduced here). (b) UNDER-CLAIM, the safe direction, deliberately recorded by 28-13 and NOT
      closed: opened through a symlink alias the store reports `retained []` / `oldest -1` while the first
      ring's `[r0.db, r1.db, r2.db]` sit on disk — re-driven here and matching the code's own residual
      paragraph (`anno-store.ts:480-521`) exactly. I judge the under-claim ACCEPTABLE as recorded: it is
      safe-direction (it refuses rather than destroys), bounded (I verified rename-back restores the floor
      and `revertTo` then succeeds), accurately documented in the same sentence as its qualifier, and
      closing it would require reading a ring whose ownership the handle cannot establish — the guess
      28-10 P3 / 28-11 P4 forbid. The over-claim is the blocker, and it is filed as the gap above rather
      than only here.
  - statement: >-
      28-07 P1 / 28-10 P1 / 28-11 P1 — MUST NOT destroy the only remaining route back to a state the store
      still advertises as reachable.
    verdict: violated
    flagged: true
    reason: >-
      CR-05, the route round 3 recorded, is genuinely closed — `reconcileSnapshotRing` contains no `delete
      from anno_snapshot` at all and I drove both the alias and the rename cases to survival. Violated by
      a fourth route that is strictly worse than the first three: `revertTo` destroys not merely the route
      back but the STATE ITSELF, on a revision it was advertising as retained one call earlier, with no
      recovery through any production entry point.
  - statement: >-
      28-07 P3 — MUST NOT leave in place, or introduce, a comment that asserts a guarantee the code does
      not provide.
    verdict: held
    flagged: true
    reason: >-
      Regressed in round 3, repaired here and checked by driving rather than by reading. The
      `snapshotDirFor` residual paragraph (`:480-521`) now states what the code does — I reproduced its
      claim exactly (rows survive the sweep, files survive, the prune's doomed loop still reaps below the
      floor, `retained []` under a second spelling). `anno-types.ts`'s "every stat failure is rethrown as
      `AnnoStorePathError`" claim is now TRUE at the `pathEntryExists` call site — six drives, six
      in-family refusals. `revertTo` step 6's comment states its own handler is unreachable rather than
      implying a behavioural proof. Two WEAKER cases noted, not counted as violations: WR-16 (the three
      repaired handlers assert "the transaction has been rolled back" after a rollback whose own failure
      is swallowed) and CR-08 (no comment asserts revert safety, so the omission is silence, not a false
      claim).
  - statement: >-
      28-10 P3 / 28-11 P4 — MUST NOT adopt, migrate, claim or sweep a snapshot ring whose ownership this
      store cannot establish; MUST NOT let a repair judge a state it cannot have produced.
    verdict: held
    flagged: true
    reason: >-
      The row-sweep direction is ABANDONED rather than guarded — verified structurally (no `delete from
      anno_snapshot` anywhere in the sweep) and behaviourally (alias write, rename write, both
      non-destructive). Under an unreadable ring the sweep now declines and reports `deferred` instead of
      misjudging. The one remaining unowned judgement is `existsSync`-as-retention, which is filed as the
      CR-08 gap.
  - statement: >-
      28-11 P5 — MUST NOT convert a committed write into a caller-visible failure.
    verdict: held
    flagged: true
    reason: >-
      Observed directly: with the ring unreadable, `setDataType` reported SUCCESS at revision 3 and the
      write landed. The new CR-06 commit handler runs BEFORE the commit returns, so it does not weaken
      this — verified by the cross-process drive, where the refusal was accompanied by an UNCHANGED
      revision, i.e. no committed write was reported as a failure.
  - statement: "28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted."
    verdict: held
    flagged: true
    reason: >-
      Regression-checked. The stale-base refusal still carries both revisions, the WR-11 structural
      control pinning the moved-revision read before the rollback is green, and the NEW CR-06 refusal
      message names the revision the store is still at ("still at revision 1"), observed in my
      cross-process drive.
  - statement: "28-08 P1 — MUST NOT let a writer that is about to be refused mutate anything a committed writer owns."
    verdict: held
    flagged: true
    reason: >-
      Round 3 recorded this PARTIALLY HELD because a second-spelling writer deleted rows a committed
      writer owned. That actor is gone. The new commit-failure arm rolls the CAS back — observed:
      `currentRevision()` stayed at 1 across the refused write, and the handle was immediately usable.
  - statement: >-
      28-09 P1 / 28-12 P1 / 28-12 P2 — MUST NOT silently redirect a path the confinement rejects, and MUST
      NOT make a confinement control pass by broadening its refusal.
    verdict: held
    flagged: true
    reason: >-
      Both halves driven. The three WR-12 classes refuse in-family through both entry points, AND the
      over-refusal control still discriminates: an inside-pointing dangling link is still FOLLOWED to a
      path under the root. The new refusals were not bought by broadening.
  - statement: >-
      28-10 P4 — MUST NOT change the meaning of an on-disk column or of the on-disk directory layout
      without a schema version bump that makes the older shape refuse BY NAME.
    verdict: held
    flagged: true
    reason: "Unchanged this round: SCHEMA_VERSION is 2, `anno_snapshot` is one column, a v1 store refuses naming both numbers."
  - statement: >-
      28-11 P3 — MUST NOT substitute a tuned timing constant for an exact exclusion when the exact
      exclusion is already available from a lock the code takes anyway.
    verdict: held
    flagged: true
    reason: >-
      Re-read the shipped sweep: `begin immediate` is still its first statement and it declines on
      failure. No grace bound, no mtime comparison, no tunable constant. The one timing number in play is
      SQLite's own `busy_timeout`, measured at 5010 ms in my cross-process drive — a real lock wait, not a
      tuned guess.
---

# Phase 28: The Store Core Verification Report

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-28T13:10:41Z
**Status:** gaps_found
**Re-verification:** Yes — round 4, after the third gap-closure round (28-13, 28-14, 28-15)

## Goal Achievement

The third gap-closure round did what it was scoped to do. I re-drove all four
handed-over ids through production entry points rather than reading the
SUMMARYs, and **CR-05, CR-06, CR-07 and WR-12 are all genuinely closed.** Gap 2
of round 3 — the error-family and open-transaction gap — is CLOSED outright.

The phase still fails, for one reason: **the goal's REVERTIBLE clause is false
for a fourth distinct cause.** `revertTo` installs a snapshot image over the
live store having witnessed it with `existsSync` and nothing else. I reproduced
the consequence independently: the store ends at **0 bytes**, the caller gets no
handle, and no production entry point can ever open it again.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full 12-member vocabulary, four split layouts first-class (SC-1) | ✓ VERIFIED | `DATA_TYPES` exported with exactly 12 members including `lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`. The orientation control and its collapse planting both green in my own 159/159 run. |
| 2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle (SC-2) | ✓ VERIFIED | Oracle cross-validation, the "oracle shares no code path" control, the equal-length tie-break pin and the non-degenerate-fixture pin all green in my run. |
| 3 | Ranges stored as ranges, never merged on adjacency, no splitter primitive (SC-2) | ✓ VERIFIED | Behavioural adjacency test plus the structural scan for `coalesc`/`merg`/`splitter` over the store's stripped source, both green. |
| 4 | Partial overwrite splits and preserves; contradicted comments returned as data (SC-3) | ✓ VERIFIED | The fully-contained case-3 control ("exactly THREE rows, asserted field by field") green, with its filter-and-insert planting. |
| 5 | Combined SIGKILL durability+revert test, and removing the commit reddens it (SC-4) | ✓ VERIFIED | Not taken from the SUMMARY: the planting is executed live by `observeMutateKillReopen("no-commit")` in a real subprocess and asserts `readBackByValue === false` AND `revertReturnsPriorValue === false`. Observed green in my own run. |
| 6 | A truncated/zero-length store FILE is refused at open, never returned partial (SC-4) | ✓ VERIFIED | `openStore` checks `anno_meta`, `schema_version` and `pragma integrity_check`; the zero-length and truncated-mid-file refusal tests are green. Independently: my CR-08 repro's post-destruction `openStore` refused with `AnnoStoreCorruptError`. |
| 7 | Schema version + reserved uninterpreted `bank` + xref access kind (SC-5) | ✓ VERIFIED | DDL carries `schema_version`, `bank integer` on `anno_range`/`anno_label`/`anno_comment`/`anno_xref`, and `access_kind text not null`. The "bank is never READ" and "a fifth access-kind is refused" controls green. |
| 8 | Stale-base write refused, observed from a second OS process (SC-5) | ✓ VERIFIED | `execFileSync` mutator at `anno-store.test.ts:2355`; independently re-driven here — a genuinely separate process holding a read transaction produced a real 5010 ms lock wait, an in-family refusal, and an UNCHANGED revision. |
| 9 | `node:sqlite` reachable from exactly one shipped module (SC-5, STORE-07) | ✓ VERIFIED | Repo-wide grep: only `anno-store.ts` and `anno-durability-mutator.mjs` name it, and the mutator is absent from `package.json` `files[]` (lines 74-76 list only `anno-types.ts`, `anno-index.ts`, `anno-store.ts`). The seam control covers all four access forms with four plantings. |
| 10 | The census boundary accepts the store's lowercase vocabulary (28-03) | ✓ VERIFIED | `block-class` tests green in the 159-test run, including the module-level-mutable-binding and `files[]` structural pins. |
| 11 | An accepted write and its housekeeping cannot leave the connection in an open transaction, and everything thrown stays in the ViceError family | ✓ VERIFIED | **Round 3's gap 2, now closed** — three independent drives, all mine: CR-06 cross-process (in-family, revision unchanged, lock released, store usable after); CR-07 unreadable ring (`begin immediate` SUCCEEDED after an accepted write); WR-12 (six drives across three input classes and two entry points, all `AnnoStorePathError`/`ViceError`). |
| 12 | **At the goal level the store is REVERTIBLE — a revert can return prior state and can never destroy it** | ✗ FAILED | **CR-08, reproduced here.** With `r1.db` truncated to 0 bytes: `retainedRevisions()` still reports `[0,1,2]`, `revertTo(1)` throws `AnnoStoreCorruptError`, the live store is left at **0 bytes**, no handle is returned, and every later open refuses. Unrecoverable through any production entry point. |

**Score:** 11/12 truths verified (1 present, behavior-unverified — the
`integrity_check` throw arm, listed separately and not counted either way)

### Deferred Items

None. I checked every later milestone phase (29 The MCP Surface, 30 ACME Export,
31 Procedure Re-pointing, 32 The Deletion and the Grep Gate): none addresses the
store's revert integrity or snapshot durability. Phase 29 builds the MCP tool
surface directly on this handle, where — by `anno-store.ts`'s own comment — a
handle lives as long as the session.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/anno-store.ts` | Sweep abstains from the row direction; structural transaction lifetime; commit inside the family; `revertTo` hands back a handle | ⚠️ HOLLOW on the revert half | 2225 lines. All four round-3 repairs present AND driven. But `revertTo` steps 2-5 still install an unverified image over the live store, and `stageSnapshot`/`publishSnapshot` never `fsync` while the pointer row commits durably. |
| `src/mcp/vice/anno-types.ts` | `pathEntryExists` wrapping every non-ENOENT stat failure | ✓ VERIFIED | 1255 lines. Six drives, six in-family refusals; the doc claim at the call site is now true. |
| `src/mcp/vice/anno-store.test.ts` | Alias-survival, rename/rename-back, unreadable-ring, strengthened source-order control | ⚠️ PARTIAL | 3303 lines, all green. Two of the three new root-sensitive controls fake their skip (WR-14). No test covers CR-08's class. |
| `src/mcp/vice/anno-confinement.test.ts` | Three new ancestor cases | ✓ VERIFIED | 711 lines, 15 cases; case 14 uses node:test's real `{ skip: … }` at `:578`. |
| `src/mcp/vice/anno-durability.test.ts` | Cross-process reader-versus-commit test | ✓ VERIFIED | 488 lines. The CR-06 test exists and passes; I reproduced its property independently with my own reader process. |
| `src/mcp/vice/anno-durability-mutator.mjs` | Fourth mode holding a read transaction | ✓ VERIFIED | Test-only: absent from `package.json` `files[]`, pinned by its own test. |
| `.planning/phases/28-the-store-core/28-10-SUMMARY.md` | Corrected key decision | ✓ VERIFIED | The corrected residual matches the code's behaviour, which I drove. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `runWriteSequence` step 9 | `pruneSnapshots` → `reconcileSnapshotRing` | production write path | ✓ WIRED | Driven: unreadable ring, write succeeds, no leaked transaction. |
| `reconcileSnapshotRing` | `commitTransaction` | single commit site | ✓ WIRED | Only `db.exec("commit")` in the module is at `:304`; call sites `:377`, `:845`, `:1302`. |
| `runWriteSequence` step 8 | `commitTransaction` → ViceError family | commit arm | ✓ WIRED | Driven cross-process: `AnnoStoreError`, `instanceof ViceError` true. |
| `revertTo` step 6 | `openStore` → `reconcileSnapshotRing` | housekeeping | ✓ WIRED | Driven: unreadable ring returns a usable handle at rev 1. |
| `storePathWithinWorkspace` | `realpathOfNearestExisting` → `pathEntryExists` | confinement walk | ✓ WIRED | Driven through both entry points for all three classes. |
| **`revertTo` step 2** | **the snapshot image it is about to install** | **`existsSync` only** | **✗ NOT_WIRED** | **No open, no `integrity_check`. This is the CR-08 blocker: the verification link the module applies at `openStore` is absent on the one path that overwrites the live store.** |
| `stageSnapshot`/`publishSnapshot` | `fsyncPath()` | durability of the image | ✗ NOT_WIRED | `fsyncPath` exists at `:322-329` and is used on the revert path, but neither publish-path site calls it (WR-13). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `retainedRevisions` | retained list | `anno_snapshot` rows ∩ `existsSync(file)` | Yes, but the file half is an existence witness only | ⚠️ STATIC — a 0-byte image satisfies it; verified by driving |
| `oldestRetainedRevision` | published floor | `retainedRevisions()[0]` | Inherits the same weakness | ⚠️ STATIC |
| `revertTo` | restored store bytes | `copyFileSync(snapPath, …)` → `renameSync` over live store | Yes — including bytes that are not a database | ✗ DISCONNECTED from any validity check |
| `setDataType` → `listRanges` | typed ranges | real SQLite rows through the single seam | Yes | ✓ FLOWING |
| paint index | resolved rows | rebuilt from `listRanges` every call | Yes | ✓ FLOWING |

### Behavioural Spot-Checks

All run by me, as uid 1000, against the committed tree.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Anno suite green | `node --test anno-*.test.ts block-class.test.ts` | 159 tests, 159 pass, 0 fail, 0 skipped, exit 0 (13.3 s) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| CR-05 alias survival | alias write, reopen by real path | retained `[0,1,2]` → `[0,1,2]`, files unchanged, `revertTo(1)` SUCCEEDED | ✓ PASS |
| CR-05 rename/rename-back | `mv`, write, `mv` back | floor 0 → 0, `revertTo(0)` SUCCEEDED | ✓ PASS |
| CR-07 sweep arm | ring `chmod 0o300`, accepted write | write OK rev=3, `begin immediate` SUCCEEDED | ✓ PASS |
| CR-07 revert arm | ring `chmod 0o300`, `revertTo(1)` | handle returned, rev=1, `listRanges` answering | ✓ PASS |
| CR-06 cross-process | separate pid holding a read transaction | `AnnoStoreError`, ViceError true, 5010 ms, revision unchanged at 1, lock released, next write rev=2 | ✓ PASS |
| WR-12 ×3 ×2 entry points | ENOTDIR / EACCES / ELOOP ancestors | 6/6 `AnnoStorePathError`, ViceError true, path named | ✓ PASS |
| WR-12 over-refusal control | inside-pointing dangling link | still FOLLOWED, result under the root | ✓ PASS |
| **CR-08** | **0-byte `r1.db`, then `revertTo(1)`** | **retained `[0,1,2]`; `AnnoStoreCorruptError`; live store 69632 → 0 bytes; no handle; reopen refuses** | **✗ FAIL** |
| CR-05 residual (under-claim) | open through alias | `retained []`, `oldest -1`, real ring files present — matches the code comment exactly | ✓ PASS (documented residual) |
| AUDIT-01 disposition guard | `node --test docs-review-disposition.test.ts` | RED on CR-08, WR-13, WR-14, WR-15, WR-16, WR-17 | ✗ FAIL (undisposed findings) |
| D-12-02 cascade | `node --test audit-integrity.test.ts` | 44 tests, 43 pass, 1 fail — caused by the seven red docs guards above | ✗ FAIL (same cause) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` declared by or applicable to this phase | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STORE-01 | 28-01, 28-04 | Full 12-member vocabulary | ✓ SATISFIED | 12 members exported, four split layouts first-class; orientation control + collapse planting green. Matches REQUIREMENTS.md `Complete`. |
| STORE-02 | 28-02, 28-05 | Ranges never merged; no splitter | ✓ SATISFIED | Behavioural + structural controls green. Matches `Complete`. |
| STORE-03 | 28-02, 28-05 | Narrowest-wins exact at 65,536 | ✓ SATISFIED | Oracle cross-validation + tie-break + non-vacuity pins green. Matches `Complete`. |
| STORE-04 | 28-06, 28-13..15 | Survives restart; an edit **can be reverted**; one combined planted-violation test | ✗ BLOCKED | The proof obligation as literally worded IS met — the combined test and its live planting are green. But "an edit can be reverted" is falsified in the destructive direction by CR-08. **The `Gaps Found` row is CORRECT, for a stronger reason than the one recorded** (REQUIREMENTS.md cites the pending `integrity_check` human item; the real blocker is CR-08). |
| STORE-05 | 28-04, 28-06 | Schema version + reserved `bank` + xref access kind | ✓ SATISFIED | Every clause verified in the DDL and by green controls: `schema_version`, `bank` nullable on all four annotated tables and never read, `access_kind not null` with a fifth value refused. No open finding touches STORE-05. **The `Gaps Found` row is NOT correct on the evidence** — it was held pending this verification pass, and this pass clears it. |
| STORE-07 | 28-01 | Single `node:sqlite` seam | ✓ SATISFIED | Only shipped module naming it is `anno-store.ts`; four-form structural control with four plantings. Matches `Complete`. |

No orphaned requirements: REQUIREMENTS.md maps exactly STORE-01..05 and STORE-07
to Phase 28 (STORE-06 maps to Phase 29), and every one is accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `anno-store.ts` | 1632, 1677 | Destructive overwrite gated on an existence check only | 🛑 Blocker | CR-08 — the live store is replaced by unverified bytes |
| `anno-store.ts` | 1009-1015, 1047-1049 | Durable pointer row naming a non-`fsync`ed image | 🛑 Blocker (contributing) | WR-13 — manufactures CR-08's input from an ordinary crash |
| `anno-store.test.ts` | 3098-3104, 3187-3193 | `assert.ok(true, "SKIPPED as root: …")` — a self-contradicting pass | ⚠️ Warning | WR-14 — under root the suite is 159/159 with CR-07's only behavioural control never executed |
| `anno-seam.test.ts` | 378-392 | `/\bcommit\b/gi` misses SQLite's `END`/`END TRANSACTION` synonyms | ⚠️ Warning | WR-15 — a second commit site spelled `db.exec("end")` passes the control that keeps the durability planting unique |
| `anno-store.ts` | 1311-1314 | Handler asserts "the transaction has been rolled back" after a rollback whose failure is swallowed | ⚠️ Warning | WR-16 — unverifiable claim; Node 22's `DatabaseSync` has no `isTransaction` |
| `anno-store.ts` | 1756, 1766 | `revertTo` step 6 guards the sweep but not the `openStore` the guard depends on | ⚠️ Warning | WR-17 — and that reopen runs `integrity_check` on the image just installed, so it is the more likely failure |
| `28-REVIEW.md` | — | Six finding ids with no recorded disposition | ⚠️ Warning | Reddens `docs-review-disposition.test.ts` (AUDIT-01) and cascades to `audit-integrity.test.ts` (D-12-02) on the current tree |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers were found in the phase's files.

### Human Verification Required

Deferred behind the blocker; recorded so it is not lost:

1. **`integrity_check` throw arm** — fault-inject so `pragma integrity_check`
   itself throws rather than returning a non-`ok` row. Expected:
   `AnnoStoreCorruptError` naming the path, connection closed. Human because the
   precondition needs filesystem- or SQLite-level fault injection.

2. **Judgment-tier prohibitions** — ten recorded above with non-authoritative
   verdicts. The two that most want a human decision: 28-07 P2's **under-claim**
   residual (I judge it acceptable — safe-direction, bounded, honestly
   documented, and closing it would require the guess 28-10 P3 forbids), and
   whether WR-14's fake skips are acceptable until CI's uid is pinned.

### Gaps Summary

**One blocker, and the round that was asked to close four ids closed all four.**

CR-05, CR-06, CR-07 and WR-12 are genuinely, independently closed. I did not
take that from the SUMMARYs — I drove each through production entry points: the
symlink alias and the rename/rename-back both survive with every row and file
intact and `revertTo` succeeding; a genuinely separate OS process holding a read
transaction now produces an in-family `AnnoStoreError` after a real 5010 ms lock
wait with the revision unchanged, the write lock released and the store usable
immediately after; an unreadable ring no longer leaks a transaction onto the
caller's connection and no longer costs the caller a handle on revert; and all
three ancestor stat-failure classes refuse in-family through both entry points
while the over-refusal control still discriminates. Round 3's gap 2 is closed
outright, and the phase moves 10/12 → 11/12.

**What stops the phase is that the goal's REVERTIBLE clause is false for a
fourth time.** Each round has closed the cause the previous round found and been
reopened by a new one in the same clause — a directory rename, then concurrent
publish, then a basename spelling, and now an image that is present but is not a
database. `revertTo` witnesses that image with `existsSync` alone, closes the
caller's handle, and renames it over the live store. I reproduced the outcome
with a 0-byte `r1.db`: `retainedRevisions()` advertising `[0,1,2]` right up to
the call, then a 69632-byte store replaced by 0 bytes, no handle returned, and
every subsequent open refused. The current revision has no snapshot by design,
so there is no route back — and no route even to a handle.

Two things make this a blocker rather than a hardening note. First, the input is
manufactured by the module's own asymmetry: `stageSnapshot` and
`publishSnapshot` never `fsync` the image or its directory while the pointer row
naming it commits durably through SQLite, so the SIGKILL this phase's criterion 4
is built around can leave exactly this state with nobody editing anything — and
`fsyncPath()` already exists in the file and is used correctly on the revert
path. Second, nothing later in the milestone covers it, and Phase 29 puts this
handle on the MCP tool surface for the life of a session.

Two record corrections fall out of this pass. **STORE-04's `Gaps Found` row is
correct**, though the recorded reason (a pending `integrity_check` human item) is
not the real one — CR-08 is. **STORE-05's `Gaps Found` row is not correct**: it
was held pending this verification pass, every clause of it verifies, and no open
finding touches it. It should return to `Complete`.

Finally, the six new review findings need dispositions. This is not bookkeeping
pedantry here: the repo's own `docs-review-disposition.test.ts` and its
`audit-integrity.test.ts` cascade are RED on the current tree for exactly those
six ids, which I confirmed by running both.

---

_Verified: 2026-08-28T13:10:41Z_
_Verifier: Claude (gsd-verifier)_
