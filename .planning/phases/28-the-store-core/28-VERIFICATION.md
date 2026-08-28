---
phase: 28-the-store-core
verified: 2026-08-28T13:40:00Z
status: gaps_found
score: 10/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11 # round 2; round 1 was 8/11
  gaps_closed:
    - "anno-types.ts provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; anno-store.ts trap 7). CR-04 is genuinely closed by 28-12: a dangling leaf link and a dangling directory link pointing outside the root are both REFUSED with AnnoStorePathError, openStore creates nothing outside the root, and the over-refusal control still discriminates (an inside-pointing dangling link is still FOLLOWED to its target under the root). Reproduced by this verifier against the production predicate and end-to-end through openStore."
  gaps_remaining:
    - "The snapshots/ ring is bounded, the pointer rows are pruned to match, and a revert past the bound is REFUSED by name (28-06 truth 7) — and, at the goal level, the store is REVERTIBLE. CR-01, CR-02 and CR-03's reported cause are genuinely closed and independently re-verified, but the CLASS is reopened by a new cause (CR-05), reproduced twice, and the revert path acquired a second defect (CR-07's step 6)."
  regressions:
    - "28-10 keyed the ring on the store path's BASENAME SPELLING, so reaching the same store file under a second name (a symlink alias, or `mv proj.annostore other.annostore`) makes the very next accepted write DELETE EVERY POINTER ROW and start a second, unbounded ring. Renaming back recovers nothing: `retained []`, `oldestRetainedRevision -1`, `revertTo(1)` refused forever. Before 28-10 the destructive route was a DIRECTORY rename (CR-03); that one is closed and this one is new (CR-05, reproduced twice)."
    - "28-11 gave `reconcileSnapshotRing` a transaction of its own with no `try/finally`, and step 9's WR-02 wrap swallows the throw. Reproduced DETERMINISTICALLY on the production write path: an ordinary accepted write reported SUCCESS (revision 3), the write landed, and the handle was left holding an OPEN transaction with nothing recording it — after which EVERY subsequent write on that handle fails permanently and every other WRITER process is locked out for the handle's lifetime. The wedge does not self-clear (CR-07)."
    - "28-11 left `commitTransaction` at step 8 outside every handler. Reproduced with a genuinely separate OS process holding a read transaction: the write threw a bare `Error: database is locked` OUTSIDE the ViceError family after 5016 ms and left the transaction OPEN with the CAS applied, so `currentRevision()` reported 2 for a write that never landed (CR-06)."
gaps:
  - truth: "The snapshot ring is bounded at MAX_SNAPSHOT_REVISIONS, the anno_snapshot pointer rows are pruned to match, and a revert to a pruned revision is REFUSED by name with the oldest retained revision in the message (28-06 truth 7) — and, at the goal level, the store is REVERTIBLE"
    status: partial
    reason: >-
      Everything the second gap-closure round set out to close IS closed, and I re-verified each
      independently: two stores in one directory now have distinct rings and `revertTo(A,1)` returns A's
      own rows (`game.annostore.snapshots` vs `loader.annostore.snapshots`, restored row `1000:code`);
      renaming the containing DIRECTORY destroys nothing (`retained [0,1,2]` and `[r0,r1,r2]` before the
      move, `[0,1,2,3]` and `[r0..r3]` after the move plus one write, every pre-move file still present);
      `anno_snapshot` has exactly one column, `revision`; a store DECLARING schema_version 1 is refused
      with `AnnoStoreCorruptError: schema_version 1, expected 2` and its legacy `<dir>/snapshots` ring
      survives untouched; a second `revertTo(r)` refuses in-family and leaves the rows, the revision, the
      pointer rows and the ring byte-identical, and the handle stays usable; a second `pruneSnapshots`
      changes nothing. The truth is still FALSE for a NEW reason. The ring's identity is now the store
      path's BASENAME SPELLING, and `openStore` does not realpath without a `workspaceRoot` (`:346`),
      which `revertTo` itself never supplies (`:1551`). Reproduced twice through production entry points
      only: (a) `ln -s real.annostore alias.annostore`, one write through the alias -> pointer rows go
      from `[0,1,2]` to `[3]`, the old ring's three files survive UNREACHABLE, a second unbounded ring
      appears, and reopening by the REAL path reports `retained []` / `oldest -1` and refuses
      `revertTo(1)`; (b) `mv proj.annostore other.annostore`, one write, `mv` back -> rows `[3]`, files
      `[r0,r1,r2]` still on disk, `retained []`, `revertTo(1)` refused forever. Nothing in
      `AnnoWriteResult` reports any of it, and `MAX_SNAPSHOT_REVISIONS` no longer bounds the on-disk
      footprint because each spelling accretes its own ring. Separately, `revertTo` step 6 is
      `openStore(...); reconcileSnapshotRing(restored)` with no handler: with the ring unreadable I
      observed `revertTo` throw a bare non-family `Error EACCES` AFTER the revert had already succeeded
      on disk (`rev 4 -> rev 2`, ranges 4 -> 2), so the caller gets an exception for a successful revert,
      no handle, and an unreachable `restored` connection nothing can close.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          snapshotDirFor:491-493 keys the ring on `basename(handle.path)` — a path spelling, not the
          store; retainedRevisions:571-574 therefore reports every existing pointer row as unretained
          under a second spelling; reconcileSnapshotRing:735-749 classifies those rows as orphan ROWS —
          the direction it exists to destroy — and deletes them under its own committed transaction
          (:757); revertTo:1551-1552 calls openStore WITHOUT a workspaceRoot and then sweeps with no
          handler. The doc comment at :479-489 states the residual as an accepted UNDER-claim ("it is
          deliberately NEVER DELETED and `retainedRevisions()` then honestly reports `[]`") — true of the
          FILES, false of the ROWS.
      - path: "src/mcp/vice/anno-store.test.ts"
        issue: >-
          No test opens a store through a symlink alias; no test renames the store FILE, writes, renames
          back and asserts the floor survives. The CR-01 and CR-03 tests both hold the store FILENAME
          fixed, which is exactly the axis the new defect moves — 135 green tests are blind to it.
    missing:
      - "Make the ring's identity travel with the store's CONTENTS, not its name — mint a ring id into anno_meta at first open and site the ring at a RELATIVE sibling of handle.dir — or, as a minimum, apply 28-11's own decline rule: an ABSENT ring directory beside a non-empty anno_snapshot is ownership this handle cannot establish, so return `deferred: true` and delete nothing"
      - "Two tests: open a store through a symlink alias, write, and assert the pointer rows and files survive; and rename the store file, write, rename back, and assert revertTo still honours the pre-rename floor"
      - "Correct the residual paragraph at anno-store.ts:479-489 and the matching key-decision in 28-10-SUMMARY.md — the loss is a deletion of rows, not an honest under-claim, and it is not reversible by restoring the name"
      - "Wrap revertTo step 6 so a sweep failure closes `restored` and still returns a usable handle inside the ViceError family — the revert has already succeeded and the sweep is housekeeping"
  - truth: "An accepted write and the housekeeping it triggers cannot leave the store's own connection inside an open transaction, and everything the store throws stays inside the ViceError family (derived this round from 28-11's WR-01 truth, the module's own doc-comment guarantees at anno-store.ts:301-305 and anno-types.ts:830-833, and 28-11 prohibition 5)"
    status: failed
    reason: >-
      Three independent reproductions, all through production entry points, all against committed code
      at 42544e8. (1) CR-07 on the PRODUCTION PATH, deterministic: with the ring directory writable but
      not readable, an ordinary `setDataType` reported SUCCESS (revision 3), the write really landed
      (rows 1000,1010,2000), and the handle was left holding an OPEN transaction — `begin immediate` ->
      "cannot start a transaction within a transaction" — with nothing in the result recording it.
      Another WRITER process blocked the full busy_timeout and then failed `database is locked`; readers
      still read. The wedge does NOT self-clear: the next write fails at the staging step (`vacuum into`
      cannot run inside a transaction) and its pre-lock handler does not roll back, so the second and
      third writes both refused and the transaction was STILL OPEN after each. On the Phase 29 tool path
      a handle lives as long as the session. (2) CR-06: with a genuinely separate OS process holding a
      read transaction, step 8's `commitTransaction` — the one statement outside every handler at
      `:1162` — threw a bare `Error: database is locked` OUTSIDE the ViceError family after 5016 ms and
      left the transaction open with the CAS, the mutation and the pointer row applied;
      `currentRevision()` then reported 2 for a write that never landed. (3) WR-12, and wider than
      reported: `pathEntryExists`'s `lstatSync` suppresses ENOENT only, so `<ws>/notes.txt/p.annostore`
      (an ancestor that is a regular file) and an unreadable ancestor both escape `openStore` as bare
      `Error`s, and an ANCESTOR symlink cycle escapes as bare `Error: ELOOP` — while the LEAF cycle the
      new test plants correctly refuses with `AnnoStorePathError` naming the 40-hop bound. 28-12's own
      must-have truth 3 ("a symlink CYCLE ... refuse with AnnoStorePathError naming the path and the hop
      bound") is therefore true only of the spelling the test plants.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          commitTransaction call at :1162 sits outside every try in runWriteSequence (the WR-02
          structural control at anno-store.test.ts:2684 proves the `pruneSnapshots` call one line BELOW
          it is guarded); reconcileSnapshotRing:690-781 opens `begin immediate` at :702 and commits at
          :757 with no try/finally, so readdirSync (:735), dropRow.run (:747), the two reads and the
          commit itself can each leave that transaction open on the CALLER's connection; step 9's
          deliberately non-rethrowing wrap (:1182-1186) then makes it silent.
      - path: "src/mcp/vice/anno-types.ts"
        issue: >-
          pathEntryExists:773-775 is an unwrapped `lstatSync`, so ENOTDIR, EACCES and ELOOP escape the
          family — contradicting the same function's own doc comment at :830-833 ("Every realpathSync,
          lstatSync and readlinkSync failure is rethrown as AnnoStorePathError naming the path").
      - path: "src/mcp/vice/anno-confinement.test.ts"
        issue: "Twelve cases, none planting a non-directory ancestor, an unreadable ancestor, or an ANCESTOR cycle — which is why the escapes are invisible to a green suite."
    missing:
      - "Wrap step 8's commitTransaction: roll back so the write lock is released, discard the staging file, and refuse BY NAME inside the family stating that nothing was written and the store is still at revision N"
      - "Give reconcileSnapshotRing a structural transaction lifetime — `try { ... commitTransaction } catch { rollback; return { droppedRows: [], droppedFiles: [], deferred: true } }` — so a throw can never leave the caller's connection in a transaction, and state in the doc comment that `deferred` now covers both contention and an incomplete sweep"
      - "Wrap pathEntryExists so every stat failure other than ENOENT becomes AnnoStorePathError naming the path, and add three confinement cases: a regular-file ancestor, an unreadable ancestor, and an ANCESTOR symlink cycle"
      - "One cross-process test in anno-durability.test.ts's shape: a child holding a read transaction, a parent write, asserting the throw is an AnnoStoreError, that currentRevision() is unchanged, and that `begin immediate` afterwards succeeds"
deferred: []
prohibition_flags: # judgment-tier; non-authoritative LLM-judge verdicts, human review recommended
  - statement: "28-07 P1 / 28-10 P1 / 28-11 P1 — MUST NOT destroy the only remaining route back to a state the store still advertises as reachable. A reconciliation that resolves a half-state by deleting the surviving half in the addressable direction is the loss this gap exists to close, not a repair of it."
    verdict: violated
    flagged: true
    reason: >-
      Reproduced twice this round, again by the reconciliation written to govern it. Under a second path
      spelling the sweep deletes EVERY pointer row while the snapshot files sit on disk, and no rename
      back recovers them: `retained []`, `oldest -1`, `revertTo(1)` refused forever (CR-05). The two
      routes round 2 recorded (CR-02's concurrent publish, CR-03's directory rename) are genuinely
      closed; the prohibition is violated by a third.
  - statement: "28-07 P2 / 28-10 P2 — MUST NOT publish a floor, bound or 'retained' claim the store cannot honour on the very next call, in EITHER direction. An UNDER-claim is a violation too: reporting no retained revisions while the files are sitting there is what let the sweep delete them."
    verdict: violated
    flagged: true
    reason: >-
      The plan named the exact mechanism and the shipped code reproduces it. Opened under a second
      spelling, `retainedRevisions()` reports `[]` and `oldestRetainedRevision()` reports
      NO_RETAINED_REVISION while three snapshot files are present — and that under-claim is precisely
      what drives the sweep into deleting the rows on the next write. Held in the dangerous direction on
      a single store at a stable path (re-verified: the published floor is one `revertTo` honours, a
      second revert at it refuses in-family and changes nothing).
  - statement: "28-07 P3 — MUST NOT leave in place, or introduce, a comment that asserts a guarantee the code does not provide."
    verdict: violated
    flagged: true
    reason: >-
      Two comments introduced by this round assert guarantees I falsified by driving the code.
      anno-store.ts:479-489 states the store-file-rename residual as an accepted under-claim ("it is
      deliberately NEVER DELETED and `retainedRevisions()` then honestly reports `[]`") — true of the
      files, false of the rows, which are deleted irreversibly. anno-types.ts:830-833 states "Every
      realpathSync, lstatSync and readlinkSync failure is rethrown as AnnoStorePathError naming the
      path" — false for the `lstatSync` inside `pathEntryExists`, where ENOTDIR, EACCES and ELOOP all
      escape as bare `Error`s. Round 2 recorded this prohibition as HELD; it regressed.
  - statement: "28-10 P3 / 28-11 P4 — MUST NOT adopt, migrate, claim or sweep a snapshot ring whose ownership this store cannot establish; MUST NOT let a repair judge a state it cannot have produced. If it cannot establish that moment it must decline and report the declining rather than guess."
    verdict: violated
    flagged: true
    reason: >-
      Held for the case the plan aimed at — a legacy `<dir>/snapshots` ring survives a v1 refusal
      untouched (verified: the ring still holds `r0.db` after the refusal), and a concurrent
      published-but-uncommitted snapshot is excluded by the write lock rather than by a timing guess.
      Violated in the state the plan did not consider: an ABSENT ring directory beside a FULL pointer
      table is ownership this handle cannot establish, and the sweep deletes every row rather than
      declining. Under an unreadable ring the same misjudgement arrives a third way — `existsSync`
      returns false for "cannot stat", so `retainedRevisions()` reported `[]` for a ring whose files
      exist.
  - statement: "28-10 P4 — MUST NOT change the meaning of an on-disk column or of the on-disk directory layout without a schema version bump that makes the older shape refuse BY NAME."
    verdict: held
    flagged: true
    reason: >-
      Verified by construction and by probe: SCHEMA_VERSION is 2, `anno_snapshot` is one column, and a
      store declaring 1 refuses with `AnnoStoreCorruptError: schema_version 1, expected 2` — both
      numbers named — while the legacy per-directory ring beside it is left on disk untouched.
  - statement: "28-11 P3 — MUST NOT substitute a tuned timing constant for an exact exclusion when the exact exclusion is already available from a lock the code takes anyway."
    verdict: held
    flagged: true
    reason: >-
      Verified by reading the shipped sweep: it takes `begin immediate` as its first statement and
      declines on any failure; there is no grace bound, no mtime comparison and no tunable constant
      anywhere in the ring code. The exclusion is derived from a lock a publishing writer already holds.
  - statement: "28-11 P5 — MUST NOT convert a committed write into a caller-visible failure. Once the commit has returned, the write happened; a later housekeeping failure that throws makes a caller retry an additive verb and produce a second row."
    verdict: held
    flagged: true
    reason: >-
      Observed directly and deterministically rather than argued: with the sweep throwing after a
      successful commit, `setDataType` reported SUCCESS at revision 3 and the row was present. This is
      the WR-02 backstop's reachable arm, now behavioural evidence. It is also exactly what makes CR-07
      silent, so the prohibition holds and its cost is a separate gap.
  - statement: "28-08 P1 — MUST NOT let a writer that is about to be refused mutate anything a committed writer owns."
    verdict: partially_held
    flagged: true
    reason: >-
      Held as worded and the staging mechanism is intact (unique `.tmp` per attempt, publication only
      behind a won CAS, anchored sweep pattern). The SPIRIT is broken by an actor the wording does not
      reach: a writer arriving under a second spelling of the same store file deletes pointer rows a
      committed writer owns (CR-05).
  - statement: "28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted."
    verdict: held
    flagged: true
    reason: >-
      Regression-checked: a stale-base write still throws `AnnoStoreStaleRevisionError` carrying base 0
      and current 1, and the WR-11 structural control that pins the moved-revision read before the
      rollback is green in the 135-test run.
  - statement: "28-09 P1 / 28-12 P1 — MUST NOT silently redirect a path the confinement rejects, including by any mechanism that returns an in-workspace path while the write lands outside it."
    verdict: held
    flagged: true
    reason: >-
      Round 2 recorded this PARTIALLY HELD because the dangling bypass produced the forbidden outcome by
      a different mechanism. That mechanism is gone: the dangling leaf and dangling directory cases both
      refuse with `AnnoStorePathError` and `openStore` created nothing outside the root (`outside file
      created: false`). No path rewrites a rejected path, and no accepted answer now disagrees with
      where the write lands.
  - statement: "28-12 P2 — MUST NOT make a confinement control pass by broadening its refusal."
    verdict: held
    flagged: true
    reason: >-
      The control genuinely discriminates in its dangling form: a dangling link pointing INSIDE the
      workspace is still FOLLOWED and resolves to `<ws>/inner/p3.annostore`. A refuse-every-symlink
      implementation would have refused it.
  - statement: "28-12 P3 — MUST NOT weaken, delete or narrow an existing confinement case to accommodate the new one."
    verdict: held
    flagged: true
    reason: >-
      The six live-link cases (tests 1-6) are all still present and green in a 12-case file, and the `..`
      and sibling-prefix refusals plus the symlinked-root case were re-probed directly.
  - statement: "28-12 P4 — MUST NOT claim a residual is closed when it is only untested."
    verdict: held
    flagged: true
    reason: >-
      Both confinement residuals are stated as limits in anno-confinement.test.ts:61-79 (the
      check-then-open window, and the byte-wise non-normalising comparison), explicitly "closed by
      nothing below". Held for 28-12's own residuals. The neighbouring failure of the same discipline
      belongs to 28-10 and is flagged under 28-07 P3 above.
  - statement: "The eight earlier judgment-tier prohibitions (28-03 P1/P2, 28-04 P3/P4, 28-05 P5/P6, 28-06 P7/P8)"
    verdict: held
    flagged: true
    reason: >-
      Carried forward from rounds 1-2 where each was independently reproduced. Regression-checked here by
      running the seven anno test files myself (135 pass / 0 fail) plus direct probes of the twelve-member
      vocabulary, the split-orientation control, split-and-preserve, the contradicted-comment rule, the
      four label refusals, the rebinding refusal and the census mapping. Flagged only because
      verification: judgment admits no automated proof.
backstop_assessment:
  - id: "28-07 D11"
    statement: "A kill landing between the pointer-row delete and the unlink inside the prune loop leaves an orphan FILE and never an orphan ROW."
    substitution: "A source-order control over the module's own stripped source, plus two directly constructed half-states, instead of a timed mid-prune kill."
    ruling: accepted
    reason: "Carried forward from round 2 unchanged; the control is still present and green, and the loop still deletes the row (:848) before the unlink (:871)."
  - id: "28-11 WR-02"
    statement: "A pruneSnapshots failure after a successful commitTransaction never reports the committed write to the caller as a failure."
    substitution: "A source-structural control asserting the call sits inside a still-open try, because the executor judged the failure not deterministically constructible in-process."
    ruling: accepted
    reason: >-
      The substitution is no longer needed: I constructed the failure deterministically (a ring directory
      writable but not readable makes the sweep's readdirSync throw after the commit) and observed the
      accepted write report SUCCESS at revision 3 with the row present. Behavioural evidence, not
      structure. Note that the same construction is what proves CR-07.
  - id: "28-11 WR-04"
    statement: "A throw from `pragma integrity_check` closes the connection and refuses inside the ViceError family rather than leaking the connection and escaping the family."
    substitution: "A source-structural control plus the four corrupt-file refusal tests, which exercise the non-`ok` BRANCH rather than a throw."
    ruling: insufficient_spec
    reason: >-
      The guard is present and correct by reading (anno-store.ts:427-433: close, then AnnoStoreCorruptError
      naming the path), and the four corrupt-file refusals are green — but they all reach the non-`ok`
      branch, never the throw. No test, and no probe available to me, makes `pragma integrity_check` itself
      throw, so presence plus wiring is all the evidence there is. Recorded as a human-verification item
      rather than counted as verified; it does not affect the score, because the truth it belongs to
      (truth 5) is carried by other evidence.
  - id: "28-12 STORE-01 concurrency / encoding"
    statement: "The check-then-open window and the byte-wise, non-normalising comparison are stated limits, not handled cases."
    substitution: "None — declared unclosable at this layer (node:sqlite's DatabaseSync takes a path, not a descriptor, so there is no O_NOFOLLOW/openat route)."
    ruling: accepted
    reason: "Verified as honestly stated in the place the guarantee is claimed (anno-confinement.test.ts:61-79), and no test is written as though it covered either."
coincidental_reliance_items:
  - truth: "anno-types.ts provides workspace path confinement — a store write cannot land outside the workspace root"
    reason: undeclared-precondition
    harden: >-
      On three input classes the confinement outcome is right for the wrong reason. A regular-file
      ancestor, an unreadable ancestor and an ANCESTOR symlink cycle do not REFUSE — they abort with an
      unhandled OS error out of `pathEntryExists`'s unwrapped `lstatSync` (bare ENOTDIR / EACCES / ELOOP,
      outside the ViceError family), and nothing in the phase's artifacts declares that those inputs are
      confined. Wrap the predicate so every stat failure other than ENOENT becomes AnnoStorePathError, and
      pin the three inputs, so the refusal is a decision rather than a side effect. Advisory only: the
      truth is VERIFIED and this changes neither the score nor the status.
human_verification:
  - test: "Make `pragma integrity_check` itself THROW on a real store (e.g. a page-level corruption SQLite errors on rather than reports), and confirm openStore closes the connection and refuses with AnnoStoreCorruptError naming the path."
    expected: "AnnoStoreCorruptError inside the ViceError family; no leaked DatabaseSync; the store is still openable after the file is repaired or replaced."
    why_human: "28-11 declared this truth `verification: backstop`. The guard is present by reading and the four corrupt-file tests all take the non-`ok` branch instead; no in-process construction available to this verifier makes the pragma throw."
---

# Phase 28: The Store Core — Verification Report (round 3, post second gap-closure round)

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-28T13:40:00Z (UTC)
**Commit verified:** `42544e8`
**Status:** gaps_found
**Re-verification:** Yes — third verification, after gap-closure plans 28-10, 28-11 and 28-12

## What this verification did

Everything marked VERIFIED below was reproduced by this verifier in its own process
against the committed code at `42544e8`. Nothing was taken from a SUMMARY, and no
reviewer verdict was inherited — `28-REVIEW.md`'s three new blockers were each
re-derived independently, and one of them (CR-07) was reproduced in a **stronger and
more deterministic form than the review achieved**, on the production write path.

- Ran the seven `anno-*.test.ts` files myself: **135 pass / 0 fail** (12.6 s).
- **Re-observed criterion 4's planted red on the post-28-12 code.** I replaced the module's single `db.exec("commit")` (`anno-store.ts:304`) with a comment by hand: `anno-durability.test.ts` went from 4/4 `ok` to **3 of 4 `not ok`**, including the ONE combined durability-and-revert test and its own planted-violation sibling. Restored; `git diff --stat -- src/mcp/vice` empty; 4/4 green again.
- Independently re-probed the twelve-member vocabulary, the split-orientation control, split-and-preserve, the contradicted-comment rule, the label and address refusals, the schema/bank/xref column set, the stale-base refusal, the single `node:sqlite` seam, the single `commit` statement and the census mapping.
- **Seven reproduction scripts driving the production functions** for the round-3 findings and for each of 28-10/28-11/28-12's own must-have truths.

Where an executor SUMMARY and my own observation disagree, my observation is stated
and the SUMMARY's claim is named as wrong. The one material disagreement is 28-10's
key-decision that the store-file-rename residual is an accepted under-claim: it is a
deletion of pointer rows, and it is not reversible by restoring the name.

## Goal Achievement

### Observable Truths

Truths 1–5 are the ROADMAP success criteria (the contract). Truths 6–11 are
PLAN-frontmatter must-haves adding material scope beyond them; their numbering is
kept identical to rounds 1 and 2 so the three reports are comparable. Truth 12 is
**new this round**, derived from 28-11's own WR-01 property, the module's two
doc-comment guarantees and 28-11 prohibition 5.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full 12-member vocabulary with the four split layouts as first-class members; a `lo_hi_address` fixture read as `hi_lo_address` produces a **differing resolved-target set**; collapsing the four to one `table` makes that control fail | ✓ VERIFIED | Re-probed `resolveSplitTargets` over identical bytes `[00 10 34 12 78 56]`: `lo_hi_address` → `[4608,30736,22068]`, `hi_lo_address` → `[18,4216,13398]`. `DATA_TYPES` is exactly 12 in schema order (`code,byte,word,address,petscii,screencode,lo_hi_address,hi_lo_address,lo_hi_word,hi_lo_word,external_file,undefined`). The collapse planting is a real, passing test (`anno-types.test.ts`). |
| 2 | Narrowest-range-wins exact at all **65,536** addresses, cross-validated against a second independent implementation with **zero** disagreements; tie-break, both ends and `$FFFF` pinned; `$0400-$0400` reports length 1; ranges never merged on adjacency, no splitter primitive | ✓ VERIFIED | Regression: `anno-index.test.ts` green (exhaustive `ADDRESS_MIN..ADDRESS_MAX` loop against `resolveByScan` with `assert.equal(comparisons, 0x10000)` asserted first). The no-splitter structural scan over `codeOnly(anno-store.ts)` is green and its non-vacuity test (`anno-store.test.ts:1684`) covers the ~150 lines 28-10/28-11 added. Caveat, not a failure of the criterion as worded: an explicit union retype at the same type collapses two rows a human kept separate (`#1 1000-10ff:byte #2 1100-11ff:byte` → `#3 1000-11ff:byte`, `changed:true`) — a caller-initiated overwrite, not automatic adjacency coalescing, and still unpinned (WR-08). |
| 3 | A partial overwrite **splits and preserves**; total typed bytes unchanged across all five overlap cases; planting `filter()`-and-insert makes the fully-contained case fail; a retype that contradicts a comment returns the contradicted comments **as data** | ✓ VERIFIED | Re-probed case 3 directly: `$2000-$20FF byte`, retype `$2040-$207F code` → 3 rows `[2000-203f byte][2080-20ff byte][2040-207f code]`, 256 typed bytes → 256. Re-probed the contradiction rule: the retype **succeeded** and returned `[{address:12288, grade:"[confirmed-code]", contradictedBy:"byte"}]` — as data, not as a refusal. Both plantings are passing tests in `anno-overlap.test.ts`. |
| 4 | Durability and revert proven by **ONE combined planted-violation test**: mutate → `SIGKILL` no clean close → **fresh process** → reopen → reads back **by value** → revert returns prior value; removing the commit makes **that same test** go red, observed; a truncated store file is **refused**, never partial | ✓ VERIFIED | **The red was re-observed on the current code**, which 28-10 and 28-11 both rewrote: with `db.exec("commit")` replaced by a comment, `anno-durability.test.ts` reports `not ok 1` (the combined test), `not ok 2` (its planted-violation sibling) and `not ok 3`; restored → 4/4 `ok`. The child is a genuinely separate OS process. The four corrupt-file refusals are green, and the schema-version refusal names both versions (`schema_version 1, expected 2`). The tail-truncation residual is still STATED, not claimed closed. |
| 5 | Every write carries a schema version and a **reserved, uninterpreted** `bank` field; xref rows carry their access kind; a write on a stale base revision is **refused**, observed cross-process; `node:sqlite` reachable from exactly one module, asserted structurally | ✓ VERIFIED | Re-probed on a fresh store: `anno_meta(id,schema_version,revision)`, `anno_range(id,start,end_inclusive,data_type,bank)`, `anno_xref(id,from_address,to_address,access_kind,bank)`, and `bank` present on all four annotated tables; `XREF_ACCESS_KINDS` = `READ,WRITE,READ_WRITE,COMPUTED_JUMP`. The 28-10 DDL change touched **only** `anno_snapshot` (now one column, `revision`). Stale write refused with `AnnoStoreStaleRevisionError` carrying both numbers; the cross-process CAS proof is green. Single seam: of the eight files naming `node:sqlite`, `anno-store.ts` is the only shipped one, and the module contains exactly **one** `commit` statement (`:304`). |
| 6 | A store file is refused rather than read when zero-length, truncated mid-file, missing its `anno_meta` row, or of a mismatched schema version — with the tail-truncation residual **stated** (28-06 truth 3) | ✓ VERIFIED | Regression green, plus two direct probes: a store with no meta row → `AnnoStoreCorruptError: annotation store has no meta row`; a store declaring `schema_version 1` → `AnnoStoreCorruptError: schema_version 1, expected 2`, both in-family. |
| 7 | The snapshot ring is bounded, the pointer rows are pruned to match, and a revert past the bound is **REFUSED by name** — and, at the goal level, the store is **revertible** | ✗ FAILED | **Everything the round set out to close IS closed and independently re-verified** (distinct rings per store file; a DIRECTORY rename destroys nothing; one-column `anno_snapshot`; v1 refused by name with the legacy ring untouched; a second `revertTo(r)` refuses in-family leaving rows, revision, rows-list and ring identical, handle still usable; a second prune drops nothing). **The class is reopened by a new cause and the revert path acquired a second defect.** CR-05 reproduced twice: a symlink alias and a store-file `mv` each make the next write delete every pointer row (`[0,1,2]` → `[3]`), leaving the files unreachable and `revertTo(1)` refused forever, with a second unbounded ring beside them. CR-07 reproduced: `revertTo` threw a bare `Error EACCES` AFTER the revert succeeded, returning no handle and leaking the restored connection. See gap 1. |
| 8 | Pruning happens after the commit and outside the transaction, and a kill in the window leaves **extra files, never a missing one the revert path still points at** (28-06 truth 8) | ✓ VERIFIED | Both halves hold, and 28-11 extended the rule to the second row-deleting site: the sweep deletes rows (step 3), commits through the single `commitTransaction` (step 4, `:757`) and unlinks only afterwards (step 5); `pruneSnapshots`' loop still deletes the pointer row (`:848`) before the unlink (`:871`). Both source-order controls are green in the 135-test run. **Caveat, not a failure of this truth:** the forbidden orphan-ROW state is now reachable by a route that is not a kill — CR-05's row deletion — and is filed under gap 1. |
| 9 | `anno-types.ts` provides workspace path confinement — a store write cannot land outside the workspace root (28-01 artifact `provides`; trap 7) | ✓ VERIFIED (coincidental-reliance) | **Round 2's gap is closed.** Probed directly: a dangling LEAF link written `../outside/p1.annostore` → `AnnoStorePathError`, and `openStore` created nothing outside (`outside file created: false`); a dangling DIRECTORY link outside → `AnnoStorePathError` at the predicate; the over-refusal control discriminates (a dangling link pointing INSIDE is still FOLLOWED to `<ws>/inner/p3.annostore`); root itself and one segment in ACCEPTED, `<root>/..` and sibling-prefix REFUSED; the check is idempotent byte-for-byte. Advisory: on three input classes (regular-file ancestor, unreadable ancestor, ANCESTOR symlink cycle) the write is prevented by an **unhandled OS error** out of an unwrapped `lstatSync`, not by a refusal — see `coincidental_reliance_items` and gap 2. |
| 10 | A label name bound to a different address is refused; an illegal character refuses rather than being sanitised; the mnemonic denylist is DERIVED from `OPCODES` and compares case-insensitively; an unprefixed numeric address string is refused | ✓ VERIFIED | Re-probed all five refusals — `init screen`, `lda`, `LDA`, `Rol`, and rebinding `init_screen` to a second address — every one `AnnoLabelError` in-family, with `listLabels` still holding exactly `["init_screen"]`, so nothing was sanitised into existence. |
| 11 | The census vocabulary boundary accepts the store's lowercase vocabulary alongside the analyser's capitalised one, pinned by a **derived total** cross-check, with `block-class.ts`'s import list still empty | ✓ VERIFIED | Re-probed `blockClassAt` over all 12 `DATA_TYPES`: exactly 1 → `code`, exactly 1 → `undefined`, 10 → `data`. `Code`/`Undefined`/`Data` map correctly; `CODE` and `cOdE` fall through to `data`, so no third spelling was admitted. `block-class.ts` has zero `import` lines. |
| 12 | **NEW this round.** An accepted write and the housekeeping it triggers cannot leave the store's own connection inside an open transaction, and everything the store throws stays inside the `ViceError` family | ✗ FAILED | Three reproductions. (a) **Silent, permanent, production-path wedge:** an ordinary `setDataType` reported SUCCESS at revision 3 with the row present, while leaving the handle in an OPEN transaction; other WRITER processes then blocked the full timeout and failed `database is locked`, and the wedge did **not** self-clear — the next two writes both refused (`vacuum into` cannot run inside a transaction) with the transaction STILL OPEN. (b) With a separate OS process holding a read transaction, step 8's unguarded `commitTransaction` threw a bare `Error: database is locked` outside the family after 5016 ms, leaving the CAS applied (`currentRevision()` → 2 for a write that never landed). (c) `ENOTDIR`, `EACCES` and an ANCESTOR `ELOOP` all escape `openStore` as bare `Error`s from `anno-types.ts`. See gap 2. |

**Score:** 10/12 truths verified (0 present-but-behavior-unverified)

**All five ROADMAP success criteria remain VERIFIED**, each re-established in this
round rather than carried over — including criterion 4's planted red, re-run against
the code 28-10 and 28-11 rewrote.

**The phase GOAL is still not achieved.** Two of its three clauses are true and
independently re-verified — the store is **durable across a `SIGKILL`** and is
**reachable through exactly one persistence seam** — and the vocabulary, scopes and
project enums are complete. The **REVERTIBLE** clause is false, for the third round
running and for a third distinct cause, and a new defect makes an accepted write able
to wedge the handle it succeeded on.

### Deferred Items

None. I read every later phase in the milestone (29 MCP surface, 30 ACME export, 31
re-pointing, 32 deletion) and none of their goals or success criteria covers snapshot
ring identity, transaction exception-safety, or the confinement error family. Phase 29
puts this store on an MCP tool path, where a session-lifetime handle makes gap 2
strictly worse rather than resolving it.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/mcp/vice/anno-store.ts` | `SNAPSHOT_DIR_SUFFIX`, `snapshotDirFor()`, `snapshotPathFor()` routing through it, four consumers deriving location from the handle | ⚠️ HOLLOW | All present and wired (2011 lines); the identity they compute is the store path's basename SPELLING, so the value that flows into every ring read and every row delete is not a truth about the store — CR-05. |
| `src/mcp/vice/anno-store.ts` | a `reconcileSnapshotRing` that serialises under `begin immediate`, commits row deletes, unlinks afterwards | ⚠️ ORPHANED-BY-FAILURE | Serialisation, commit-before-unlink and the three-field report are all real and verified. The transaction has no `try/finally`, so a throw leaves it open on the caller's connection — CR-07. |
| `src/mcp/vice/anno-store.ts` | guarded staging→publish→pointer-insert window, guarded `pragma integrity_check`, guarded step-9 prune | ✓ VERIFIED (with an unguarded neighbour) | The three named wraps exist at `:1039-1048`, `:427-433` and `:1182-1186` and behave. The statement BETWEEN the last two — `commitTransaction` at `:1162` — is outside every handler (CR-06). |
| `src/mcp/vice/anno-types.ts` | `SCHEMA_VERSION` at 2 with the reason recorded; `pathEntryExists()`, `MAX_SYMLINK_HOPS`, a walk that stops at a symlink whether or not its target exists | ✓ VERIFIED | `SCHEMA_VERSION = 2`, `MAX_SYMLINK_HOPS = 40` (Linux's `MAXSYMLINKS`), the walk stops on `lstat` and hops a dangling link against the link's own directory. The reversal is recorded in place rather than overwritten. |
| `src/mcp/vice/anno-store.test.ts` | ring sites re-pointed, `orphanRowRevisions` off the dropped column, plus the CR-01, CR-03 and schema-v1 tests, the CR-02 interleave, the deferred-prune test, the WR-01 collision test and the structural controls | ✓ VERIFIED | 2801 lines, 60 tests green; each named test exists and I re-derived what four of them assert. Blind spots named in gap 1: no symlink-alias test, no store-file-rename test. |
| `src/mcp/vice/anno-confinement.test.ts` | dangling leaf, dangling directory, dangling over-refusal control, cycle, boundary, idempotency | ✓ VERIFIED (with a blind spot) | Twelve tests green; tests 1-6 (the live-link regression surface) untouched. Test 10 pins the LEAF cycle, which refuses in-family; the ANCESTOR cycle it does not plant escapes as bare `ELOOP`. |
| `src/mcp/vice/anno-durability.test.ts` | two snapshot-directory expressions re-pointed, every assertion byte-identical | ✓ VERIFIED | 4/4 green, and the planted-red observation confirms the assertions still bite. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `snapshotPathFor` | `snapshotDirFor` | `basename(handle.path)` | ⚠️ WIRED, WRONG IDENTITY | One layout authority reached by every consumer — verified by reading and by probe (`proj.annostore.snapshots/r7.db`). The identity itself is a path spelling (CR-05). |
| `retainedRevisions` / `revertTo` / `pruneSnapshots` / `reconcileSnapshotRing` | `snapshotPathFor(handle, revision)` | the only file-naming route | ✓ WIRED | No persisted string participates: `anno_snapshot` is one column, `revision`, verified on a fresh store. |
| `openStore` | `SCHEMA_VERSION` → `AnnoStoreCorruptError` | version gate | ✓ WIRED | A store declaring 1 refuses naming both versions; the legacy ring beside it survives. |
| `publishSnapshot` | the won CAS → the sweep's `begin immediate` | the exclusion | ✓ WIRED | Publication is reachable only from behind a won CAS inside `begin immediate`, so a published-uncommitted writer holds the lock the sweep takes first. CR-02 closed by derivation, not timing. |
| `runWriteSequence` step 9 | `pruneSnapshots` → `reconcileSnapshotRing` | the one production call site, wrapped | ⚠️ WIRED, SWALLOWS A WEDGE | The wrap is correct and verified (a committed write is not reported as a failure) — and it is what makes CR-07 silent. |
| `revertTo` step 6 | `openStore(storePath)` → `reconcileSnapshotRing(restored)` | post-restore sweep | ✗ NOT GUARDED | No handler and no `workspaceRoot`: a sweep throw escapes as a bare `Error` after the revert has succeeded and the restored handle is unreachable. |
| `realpathOfNearestExisting` | `pathEntryExists` → `lstatSync(p, { throwIfNoEntry: false })` | entry existence without following | ✓ WIRED | The one entry-existence question, answered without following the link — this is the whole of CR-04's closure. The predicate is unwrapped, which is gap 2's third leg. |
| `anno-types.ts` | `hostpath.ts` / `containerpath.ts` | MUST NOT EXIST | ✓ ABSENT | `hostpath-consumers.test.ts` and the three targeted absence assertions in `anno-types.test.ts` are green. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `anno-store.ts` | `retainedRevisions()` | `select revision from anno_snapshot` filtered by `existsSync(snapshotPathFor(...))` | Yes — but reports `[]` for a real ring under a second spelling, and `[]` for an unreadable one (`existsSync` is false for "cannot stat") | ⚠️ STATIC-UNDER-ALIAS |
| `anno-store.ts` | `listRanges` / `listLabels` / `listComments` / `listScopes` / `listProjectEnums` / `listXrefs` | bound `prepare().all()` per table | Yes — round-tripped by value across close/reopen and across a genuinely separate OS process | ✓ FLOWING |
| `anno-store.ts` | `revertTo`'s restored rows | `copyFileSync` of `snapshotPathFor(handle, r)` then reopen | Yes on a stable single spelling (`revertTo(A,1)` returned A's own `1000:code`); nothing to flow from under a second spelling | ⚠️ STATIC-UNDER-ALIAS |
| `anno-index.ts` | `paintIndexOf` | rebuilt from `listRanges` every call, nothing cached | Yes — exhaustively cross-validated at all 65,536 addresses | ✓ FLOWING |
| `anno-types.ts` | `storePathWithinWorkspace` return | `realpathOfNearestExisting` on both sides | Yes — the returned path is now the location the write lands at, verified end-to-end on the dangling cases | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| The phase's seven test files pass | `node --test anno-*.test.ts` (seven files) | 135 pass / 0 fail, 12.6 s | ✓ PASS |
| Criterion 4's control still bites on the current code | replace `db.exec("commit")` with a comment, `node --test anno-durability.test.ts` | 3 of 4 `not ok`, including the ONE combined test; restored → 4/4 `ok`, tree clean | ✓ PASS |
| Two stores in one directory keep separate rings | probe: two stores, two writes each, `revertTo(A,1)` | rings differ; A's restored row is `1000:code` (its own) | ✓ PASS |
| A directory rename destroys nothing | probe: 3 writes, `mv` the directory, 1 write | before `[0,1,2]`/`[r0,r1,r2]`; after `[0,1,2,3]`/`[r0..r3]`; every pre-move file present | ✓ PASS |
| A v1 store refuses by name, legacy ring untouched | probe: declare `schema_version=1`, plant `<dir>/snapshots/r0.db`, `openStore` | `AnnoStoreCorruptError: schema_version 1, expected 2`; legacy ring still `['r0.db']` | ✓ PASS |
| A symlink ALIAS to the store file | probe: `ln -s real alias`, one write through the alias | rows `[0,1,2]` → `[3]`; old ring unreachable; `revertTo(1)` refused forever | ✗ FAIL (CR-05) |
| `mv proj.annostore other.annostore` | probe: 3 writes, rename the FILE, 1 write, rename back | rows `[3]`, files `[r0,r1,r2]` present, `retained []`, `revertTo(1)` refused | ✗ FAIL (CR-05) |
| A concurrent READER during a write | probe: child holds `begin`, parent `setDataType` | bare `Error: database is locked` after 5016 ms, outside the family; transaction left OPEN; `currentRevision()` → 2 | ✗ FAIL (CR-06) |
| A sweep failure after a successful commit | probe: ring writable but not readable, one write | write reported SUCCESS rev 3 and landed; handle left in an OPEN transaction; other writers locked out; wedge permanent | ✗ FAIL (CR-07) / ✓ PASS (WR-02's arm) |
| `revertTo` whose step-6 sweep fails | probe: ring exec-only, `revertTo(g2, 2)` | bare `Error EACCES` outside the family; revert HAD succeeded (rev 4 → 2, ranges 4 → 2); no handle returned | ✗ FAIL (CR-07) |
| Dangling leaf / directory links outside the root | probe: predicate + `openStore` | both `AnnoStorePathError`; `outside file created: false` | ✓ PASS (CR-04 closed) |
| The dangling over-refusal control | probe: dangling link pointing INSIDE | ACCEPTED and FOLLOWED to `<ws>/inner/p3.annostore` | ✓ PASS |
| Confinement boundary, one step either side | probe: root, one in, `<root>/..`, sibling-prefix | ACCEPTED, ACCEPTED, `AnnoStorePathError`, `AnnoStorePathError` | ✓ PASS |
| Confinement family closure on odd ancestors | probe: regular-file ancestor, unreadable ancestor, ancestor cycle | bare `Error ENOTDIR`, bare `Error EACCES`, bare `Error ELOOP` — all outside the family | ✗ FAIL (WR-12, wider than reported) |
| Single seam and single commit | `grep -rl 'node:sqlite'`, `grep -n '"commit"'` | one shipped module (`anno-store.ts`); exactly one `commit` statement | ✓ PASS |
| Debt markers in the phase's files | `grep -nE 'TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER'` over the 13 phase files | no matches | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | `find scripts -path '*/tests/probe-*.sh'` | no conventional probes exist in this repository, and neither the 12 PLANs nor the 12 SUMMARYs declare one | ? SKIP (no probes declared or present) |

The phase's runnable verification is its test files and the planted-violation
controls, both exercised above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| STORE-01 | 28-01, 28-03, 28-04, 28-09, 28-12 | Labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums | ✓ SATISFIED | `DATA_TYPES` is exactly 12; labels, comments (both placements), scopes and project enums all round-trip by value across a reopen; confinement now refuses the dangling cases. 28-12's own must-have truth 3 is true only of a LEAF cycle — the ancestor spelling escapes the family (gap 2), which is an error-class defect rather than a vocabulary one. |
| STORE-02 | 28-05, 28-07 | Ranges stored as ranges, never merged on adjacency, no splitter introduced | ✓ SATISFIED | The structural scan of `codeOnly(anno-store.ts)` for `coalesc`/`merg`/`splitter` reports `[]` and its non-vacuity test covers the code this round added. WR-08's union-retype collapse is a caller-initiated overwrite, still unpinned — carried as a warning. |
| STORE-03 | 28-02, 28-05, 28-07 | Narrowest-range-wins exact at all 65,536 addresses, cross-validated, with the overwrite behaviour pinned | ✓ SATISFIED | Exhaustive cross-validation green with the `0x10000` comparison count asserted; split-and-preserve re-probed with total typed bytes unchanged; post-revert empty and ordering cases green. |
| STORE-04 | 28-06, 28-07, 28-08, 28-10, 28-11 | Survives a restart AND an edit can be reverted, proven by one combined planted-violation test | ✗ BLOCKED | The durability half is proven and its red re-observed on the current code. The **revert** half is destroyed by a second path spelling (CR-05, two reproductions) and the revert path itself throws outside the family while leaking a handle (CR-07). 28-10 and 28-11 both marked this Complete; `REQUIREMENTS.md` records it Complete. That is not supportable on this evidence. |
| STORE-05 | 28-04, 28-06, 28-08, 28-10 | Schema version + reserved uninterpreted `bank` from the first write; xref access kinds | ✓ SATISFIED | Re-probed the full column set; `bank` present on all four annotated tables and never read outside the row mappers; the four access kinds enforced; the 28-10 DDL change touched only `anno_snapshot`. |
| STORE-07 | 28-08, 28-09, 28-10, 28-11 | `node:sqlite` reached through exactly one seam module | ✓ SATISFIED | `anno-store.ts` is the only shipped module naming `node:sqlite`; `anno-seam.test.ts` (17 tests) asserts it with four planted-violation routes plus a comment-only negative control; exactly one `commit` statement. Two warnings ride along: WR-10 (two seam-private exports are public API of the published tarball, and 28-11's new tests widened the dependency) and the family-closure property 28-11 attached to this requirement, which CR-06 falsifies one statement past the window it closed. |

**No orphaned requirements.** `REQUIREMENTS.md` maps exactly STORE-01..05 and
STORE-07 to Phase 28, and every one appears in at least one PLAN's `requirements`
field. STORE-06 is correctly mapped to Phase 29.

**Two traceability inconsistencies to resolve (I did not edit `REQUIREMENTS.md`):**
STORE-02 and STORE-03 are recorded "Gaps Found" and unchecked although the evidence
for both is verified in this and the previous two rounds; STORE-04 is recorded
"Complete" and checked although its revert half is falsified above. The direction of
both errors is the same one the project's own record warns about — a phase-level
status written across individual requirement rows.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/mcp/vice/anno-store.ts` | 491-493 | Identity derived from a mutable NAME rather than from contents | 🛑 Blocker | The ring is keyed on `basename(handle.path)`; a second spelling of one file is a second store to every ring consumer (CR-05). |
| `src/mcp/vice/anno-store.ts` | 479-489 | Comment asserting a guarantee the code does not provide | 🛑 Blocker | States the rename residual as an accepted under-claim ("NEVER DELETED … honestly reports `[]`"); the rows are deleted irreversibly. Violates the carried-forward 28-07 P3. |
| `src/mcp/vice/anno-store.ts` | 1162 | A state-committing statement outside every handler | 🛑 Blocker | Bare `Error` escaping the family, transaction left open with the CAS applied, write lock held (CR-06). |
| `src/mcp/vice/anno-store.ts` | 690-781 | A transaction opened without a structural lifetime (`try/finally`) | 🛑 Blocker | Combined with the correct WR-02 swallow at `:1182-1186`, produces a silent, permanent wedge of a handle whose write succeeded (CR-07). |
| `src/mcp/vice/anno-store.ts` | 1551-1552 | An unguarded call after an irreversible act | 🛑 Blocker | `revertTo` throws after the revert succeeded, returning no handle and leaking the restored connection. |
| `src/mcp/vice/anno-types.ts` | 773-775 | A predicate that throws | ⚠️ Warning | `lstatSync` suppresses ENOENT only; ENOTDIR/EACCES/ELOOP escape `openStore` as bare `Error`s (WR-12, plus the ancestor-cycle case the review did not name). |
| `src/mcp/vice/anno-types.ts` | 830-833 | Comment asserting a guarantee the code does not provide | ⚠️ Warning | Claims every `lstatSync` failure is rethrown as `AnnoStorePathError`; true of three wrapped call sites, false of the predicate. |
| `src/mcp/vice/anno-store.ts` | 1243-1269 | Unpinned observable behaviour on a requirement that forbids merging | ⚠️ Warning | WR-08, carried forward: a union retype at the same type collapses two rows and reports `changed:true`. |
| `src/mcp/vice/anno-store.ts` | 906, 1212 | Seam-private exports in a published package's public API | ⚠️ Warning | WR-10, carried forward and widened by 28-11's two new tests. |
| `src/mcp/vice/anno-store.ts` | 1929 | Unguarded `JSON.parse` on stored data | ⚠️ Warning | WR-09, carried forward: a bare `SyntaxError` escapes the family. |
| `src/mcp/vice/anno-store.ts` | 391-403, 1024, 1840, 1450-1554 | WR-03, WR-06, WR-05, WR-11 | ⚠️ Warning | All four carried forward unchanged and re-confirmed present in the source by the round-3 review; none is a goal blocker. |
| `src/mcp/vice/anno-store.ts` | 1043-1047, 1121-1125, 360, 432 | IN-05: every wrap drops the SQLite code | ℹ️ Info | Contention and corruption are distinguishable only by substring, which is what makes CR-06 hard to classify even once wrapped. |
| `src/mcp/vice/anno-store.ts` | 322-329, 1393-1394 | IN-02 (`fsyncPath` opens with `"r"`), IN-01 | ℹ️ Info | Carried forward; IN-02 has its own pending todo covering Windows portability. |
| `src/mcp/vice/anno-index.ts`, `anno-index.test.ts` | 142-150, 155 | IN-03, IN-04 | ℹ️ Info | Carried forward unchanged. |

**Debt-marker gate: PASS.** No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` or
`PLACEHOLDER` marker exists in any of the thirteen files this phase modified.

**Finding-id dispositions.** Round-3 ids CR-05, CR-06, CR-07, WR-12 and IN-05 are
dispositioned OPEN in
`.planning/todos/pending/2026-08-28-phase-28-review-round-3-five-open-findings.md`;
IN-02 in `.planning/todos/pending/2026-08-28-phase-28-review-in-02-fsync-portability-on-windows.md`;
CR-04 in `.planning/todos/completed/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md`.
Round-2 ids CR-01, CR-02, CR-03, WR-01 through WR-11 and IN-01 through IN-04 are all
named in this report and in `28-REVIEW.md`'s carry-forward table. My own assessment
agrees with the review that CR-01, CR-02 and CR-04 are closed, and that CR-03 is
closed only for its reported cause.

### Reviewer verdicts, reconciled

`28-REVIEW.md` ran immediately before this verification. I re-derived every verdict
bearing on a must-have rather than inheriting it.

| Review verdict | My finding |
| -------------- | ---------- |
| CR-01 closed by 28-10 | **Confirmed** by probe: distinct rings, `revertTo(A,1)` returns A's own rows. |
| CR-02 closed by 28-11 | **Confirmed** by reading the derivation and by the green two-connection interleave test; publication is reachable only from behind a won CAS inside `begin immediate`. |
| CR-03 closed for its cause, class reopened as CR-05 | **Confirmed both halves.** The directory-rename case is genuinely harmless now; the basename-spelling case destroys the rows. Reproduced twice, matching the review's own output lines. |
| CR-04 closed by 28-12 | **Confirmed** at the predicate and end-to-end, with the over-refusal control still discriminating. |
| WR-01/WR-02/WR-04 closed by 28-11 | **Confirmed.** WR-02's reachable arm I proved behaviourally rather than structurally; WR-04 remains structure-only (recorded as `insufficient_spec`). |
| CR-06 blocker | **Reproduced verbatim**, including the 5-second stall, the bare `Error`, the leaked transaction and the advanced `currentRevision()`. |
| CR-07 blocker | **Reproduced, and stronger than the review's own evidence.** The review demonstrated the leak by driving the exported sweep; I reproduced the SILENT case on the production write path, deterministically, and additionally established that the wedge is **permanent** (the next two writes both fail and the transaction stays open). |
| CR-07's "locks the store out for every reader" | **Partly refuted.** In the EACCES/production route the leaked transaction holds RESERVED, so other READERS still read (measured: `another READER: [0,1,2]`); it is other WRITERS that are locked out (2006 ms then `database is locked`). The reader lockout the review measured belongs to the `SQLITE_BUSY`-at-commit route, where the lock escalates. The defect is real either way; the blast radius is writers-always, readers-sometimes. |
| CR-07 silent on the production path | **Confirmed, with a reachability note.** The EACCES-on-the-ring route pre-empts at staging when the ring is fully unreadable, and I could not hit the `SQLITE_BUSY` window in 3287 writes against a flapping reader — but a writable-not-readable ring reaches it deterministically, so "reachable and silent" is established. |
| WR-12 warning | **Confirmed and widened**: an ANCESTOR symlink cycle escapes as bare `ELOOP` too, so 28-12's own cycle truth holds only for the leaf spelling its test plants. |
| 28-10's stated residual is understated | **Confirmed.** The files survive; the rows do not, and renaming back recovers nothing. |

### Human Verification Required

Status is `gaps_found`, so the gaps take precedence — but one backstop item needs a
human and is recorded in the frontmatter so it is not lost:

#### 1. Make `pragma integrity_check` itself throw

**Test:** Produce a store whose `pragma integrity_check` raises rather than returning
a non-`ok` row (a page-level corruption SQLite errors on), and open it.
**Expected:** `AnnoStoreCorruptError` inside the `ViceError` family naming the path,
with the `DatabaseSync` closed and not leaked.
**Why human:** 28-11 declared this truth `verification: backstop`. The guard is
present by reading (`anno-store.ts:427-433`) and the four corrupt-file tests all take
the non-`ok` branch instead; no construction available to this verifier makes the
pragma throw, so presence plus wiring is the only evidence.

### Gaps Summary

Two gaps, and their shapes are worth stating together because they rhyme with the
defects this round closed.

**Gap 1 — the store is still not revertible, for a third distinct cause.** 28-10 did
exactly what it set out to do: it removed a persisted absolute path, made a
snapshot's location a total function of `(handle, revision)`, gave two stores in one
directory distinct rings, and bumped the schema so the old shape refuses by name. All
of that is verified. But the identity it chose is `basename(handle.path)` — a path
*spelling*, and `openStore` does not realpath without a `workspaceRoot` that
`revertTo` itself never supplies. Reach the same file under a second name and the
next accepted write deletes **every** pointer row, silently, irreversibly, while
starting a second ring nothing bounds. That is the same shape as CR-03 (two truths
about one file, which can disagree) with the persisted string replaced by a mutable
name. The minimum fix is 28-11's own decline rule applied to the ownership question
the sweep cannot answer; the complete fix makes the ring's identity travel with the
store's contents.

**Gap 2 — a transaction without a structural lifetime, and an error family with two
holes.** 28-11 closed WR-01's window with two handlers and wrapped the post-commit
prune, correctly. It left the one statement between them unguarded, and gave its new
sweep a transaction with no `finally`. The consequences compound in opposite
directions: a concurrent *reader* makes an accepted write escape the family and leave
the CAS applied (CR-06), while a sweep failure lets a write report **success** and
leave the handle permanently unusable with every other writer locked out (CR-07) —
the swallow that makes the second one silent is the same swallow that makes WR-02
correct. `anno-types.ts` has the same hole in miniature: a predicate that throws,
under a doc comment promising it does not.

Neither gap touches the five ROADMAP success criteria, all of which are verified for
the third round running, nor the goal's durability and single-seam clauses. What they
touch is the goal's REVERTIBLE clause and STORE-04 — recorded Complete in
`REQUIREMENTS.md` on evidence this round contradicts.

---

_Verified: 2026-08-28T13:40:00Z_
_Verifier: Claude (gsd-verifier), round 3_
