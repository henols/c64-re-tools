---
phase: 28-the-store-core
verified: 2026-08-28T19:55:00Z
status: gaps_found
score: 11/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: # round 5, after the fourth gap-closure round (28-16, 28-17, 28-18)
  previous_status: gaps_found
  previous_score: 11/12 # round 4; round 3 was 10/12, round 2 9/11, round 1 8/11
  gaps_closed:
    - >-
      "At the goal level the store is REVERTIBLE — a revert can return the annotation state to a prior
      revision, and can never destroy it." CLOSED, and re-driven here through production entry points
      only, over THREE input classes rather than the one round 4 reported. On a store at revision 3 with
      ring `[r0.db, r1.db, r2.db]` and a 69632-byte live file: (a) `r1.db` truncated to 0 bytes, (b) `r1.db`
      overwritten with 46 bytes of foreign text, (c) `r1.db` truncated to half its length (34816 bytes).
      In all three: `retainedRevisions()` reports `[0, 2]` (round 4 measured `[0, 1, 2]`),
      `oldestRetainedRevision()` reports 0, `revertTo(handle, 1)` throws an `AnnoStoreError` that is
      `instanceof ViceError` naming BOTH the store path and the snapshot path and quoting the underlying
      reason, the live store is **69632 -> 69632** bytes (round 4 measured 69632 -> 0), the SAME handle
      still answers `currentRevision() === 3` and `listRanges()` with 3 rows, and a later `openStore`
      SUCCEEDS at revision 3. THE REFUSAL WAS NOT BOUGHT BY BROADENING: `revertTo(handle, 2)` on the
      uncorrupted image still SUCCEEDS in all three fixtures, and looping over the advertised list on a
      fresh copy per revision, every revision `retainedRevisions()` advertises reverts successfully to
      exactly that revision (0, 2, 3 -> currentRevision 0, 2, 3).
    - >-
      The hazard the CR-08 fix itself introduces is closed too, driven not read. With the 0-byte `r1.db`
      planted, an ordinary `setDataType` (which runs the prune and the ring sweep) leaves `r1.db` STILL
      PRESENT at 0 bytes with its `anno_snapshot` pointer row intact — the corrupt-but-claimed image
      survives as EVIDENCE rather than being unlinked by a repair. Structurally: the sweep's keep-set reads
      `claimedRevisions` (one `select` on the connection already in hand) and not the promoted
      `retainedRevisions`, so the up-to-32-database open cost never runs under the sweep's `begin immediate`.
    - >-
      Round 4's `coincidental_reliance_items` entry (WR-14) is closed. Both root-sensitive controls now use
      node:test's real `{ skip: ... }` declaration form (`anno-store.test.ts:3185`, `:3259`) and the repo
      contains zero `SKIPPED as root` fake passes. Verified as uid 1000, where the precondition IS
      constructible: my own independent drive of the CR-07 property (ring at 0o300, writable but not
      readable) reproduces it — `setDataType` reported success at revision 3 and `begin immediate` on the
      same handle immediately afterwards SUCCEEDED, so no transaction was leaked.
  gaps_remaining: []
  regressions:
    - >-
      NONE from the three plans. The 5 failures in `r2000-session.test.ts` reproduce in isolation and their
      own error text is `R2000SpawnError: regenerator2000 was not found on PATH` — a missing external
      binary, not a phase-28 regression. `audit-integrity.test.ts` is 43/44 and
      `docs-review-disposition.test.ts` 6/7, both caused solely by round 5's twelve undispositioned review
      ids (see Anti-Patterns). The six other docs guards are each GREEN when run individually; the gate
      script runs all seven in ONE `node --test` process and therefore attributes the batch's non-zero exit
      to all seven — a pre-existing coarseness of `scripts/audit-gate.mjs`, not a phase-28 defect.
gaps:
  - truth: >-
      A partial overwrite splits and PRESERVES: the surviving region keeps an annotation the store itself
      accepts and its own resolver can decode (ROADMAP Phase 28 criterion 3, and the goal clause "owns the
      annotation state — ... per-range typing over the full 12-member vocabulary")
    status: failed
    reason: >-
      CR-09, REPRODUCED HERE through production entry points only — no hand-edited store, no test-only
      export, two `setDataType` calls. `retype()`'s split-and-preserve re-inserts the surviving remainders
      of an overlapped row carrying `row.data_type` forward with NO shape check, so it writes a split-table
      row the store refuses at its own entry point.

      DRIVE, verbatim from my run:
        setDataType($1000..$100f, "lo_hi_address")  -> revision 1, changed true   (16 bytes, 8 entries)
        setDataType($1004..$1004, "byte")           -> revision 2, changed TRUE, contradictedComments []
        listRanges() ->
          id=2  $1000..$1003  lo_hi_address  span 4   (even — legal)
          id=3  $1005..$100f  lo_hi_address  span 11  (ODD — a shape the store refuses)
          id=4  $1004..$1004  byte           span 1
        setDataType($1005..$100f, "lo_hi_address")   -> AnnoRangeShapeError: "a lo_hi_address table needs
          an even byte count, but 4101..4111 is 11 byte(s) -- the low half and the high half must be the
          same length"

      So the store persisted a row it will not accept as input, and `resolveSplitTargets()` — the very
      function ROADMAP criterion 1 names as the ONE observable consequence of recording orientation —
      throws `AnnoRangeShapeError` on an odd byte count (`anno-types.ts:1239-1245`), so the module's own
      resolver cannot decode that row either. The write reported `changed: true` with an EMPTY
      `contradictedComments`; nothing anywhere tells the caller that a previously decodable split table is
      now undecodable.

      WHICH CRITERIA THIS DOES AND DOES NOT FALSIFY, stated plainly because the framing matters.
      Criterion 1 HOLDS as written: the vocabulary has exactly 12 members, the four split layouts are
      first-class, and the differing-resolved-target-set control plus its collapse planting are green
      (observed in my own 169/169 run). Criterion 3's three NAMED controls also hold: total typed bytes are
      unchanged (16 -> 4 + 11 + 1 = 16), the filter-and-insert planting still reddens the fully-contained
      case, and the contradicted-comment rule still returns comments as data. What is FALSE is criterion
      3's own stated purpose — "Silently un-documenting a previously annotated region is the exact failure
      the store exists to prevent." For the four split members a one-byte retype leaves the surviving
      region annotated with a type no reader can act on, silently. A region whose only reader throws is not
      a documented region, and the store is the one component that was supposed to make that impossible.
      This is also the module's own trap 6 ("NEVER let a validator return a value instead of throwing")
      honoured at the entry point and bypassed by the store's own remainder writer — the one writer a
      caller cannot inspect.

      NOT DEFERRABLE, checked against every later phase of the milestone. Phase 29 (The MCP Surface) puts
      `set_data_type` and `list_ranges` on an agent-driven tool path where, per `anno-types.ts`'s own
      header, the proxy's `validate: (value) => ({ value })` means arguments arrive unvalidated — it
      amplifies this rather than addressing it. Phase 30 (ACME Export) reads these rows to emit source.
      Phases 31 and 32 do not touch range typing. No later phase's goal or success criteria mention split
      remainders, retype shape, or overlap semantics.

      NOT A ONE-BYTE EDGE. The input is an agent finding a single byte inside what it thought was a table —
      ordinary annotation work, and the whole reason the split-and-preserve path exists.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          `retype()` (`:1707-1733`) re-inserts both remainders with `row.data_type` carried forward and no
          `assertRangeShape` call — `:1724` (`insertRange(db, row.start, start - 1, row.data_type)`) and
          `:1727` (`insertRange(db, endInclusive + 1, row.end_inclusive, row.data_type)`). `setDataType`
          calls `assertRangeShape` at `:1859` for the CALLER's range only. There is no shape check on any
          path that writes a remainder, so the store's own writer is the only unvalidated writer in the
          module.
      - path: "src/mcp/vice/anno-overlap.test.ts"
        issue: >-
          The suite that exists to prove STORE-02 and criterion 3 contains ZERO split-table overlap cases.
          Its only two `lo_hi_address` mentions are `:524` and `:531`, in the NON-overlapping second-range
          test. All five overlap shapes are exercised with `byte`/`code`/`word`-class types only, so the
          entire class is invisible to 169 green tests. Criterion 1's vocabulary and criterion 3's
          split-and-preserve have never been tested together.
    missing:
      - >-
        Decide the remainder semantics and enforce them inside `retype()`, in the same transaction, so the
        store never persists a shape `assertRangeShape` refuses. Three defensible answers, and the fourth
        is forbidden: (a) DEMOTE an illegal remainder to `undefined` — the vocabulary member that asserts
        nothing; (b) REFUSE the whole retype, naming the table and the entry boundary; (c) return the
        damaged split tables AS DATA, which is the pattern this module already established for
        `contradictedComments` and is the answer most consistent with criterion 3's own reasoning.
        Rounding the retype outward to the nearest entry boundary is forbidden by the module's own trap 7
        ("never substitute, nothing records that it happened").
      - >-
        Whichever answer is chosen, REPORT IT. Today the call returns `changed: true` with an empty
        `contradictedComments` and no diagnostic of any kind, which is the silence criterion 3 names as the
        failure the store exists to prevent.
      - >-
        `anno-overlap.test.ts` gains split-table overlap coverage: at minimum the fully-contained case with
        a `lo_hi_address` row and each end-overlap case, asserting the resulting row set BY VALUE, plus a
        planting that reddens when the remainder rule is removed — the same non-vacuity shape the
        filter-and-insert planting already uses.
      - >-
        Add the invariant assertion that would have caught the CLASS rather than this instance: for every
        row `listRanges()` returns, the row must be re-acceptable at the store's own entry point
        (`assertRangeShape(row.start, row.endInclusive, row.dataType)` must not throw), and for a split
        member `resolveSplitTargets()` over a byte array of the row's span must not throw. Assert it after
        a randomised or table-driven sequence of retypes, so any future writer that bypasses validation is
        caught by the invariant rather than by a hand-written case.
deferred: []
behavior_unverified_items:
  - truth: >-
      `openStore`'s `integrity_check could not be run at all` arm refuses in-family (now
      `anno-store.ts:465-468`; round 4 cited `:432`, which the round's edits moved). CARRIED FORWARD
      UNCHANGED from round 4 — recorded still-open by 28-18 and claimed closed by nothing.
    test: >-
      Fault-inject so `pragma integrity_check` itself THROWS rather than returning a non-`ok` row (the
      non-`ok` row path at `:470-472` is already covered by the truncated-mid-file test at
      `anno-store.test.ts:363`)
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection.
      Presence and wiring verified in source, plus the structural
      `assertInsideHandler("export function openStore", "pragma integrity_check", 800)` control at
      `anno-store.test.ts:2983`; no test exercises the throw, and a 10-second spot-check cannot construct
      the precondition.
  - truth: >-
      28-17's `backstop`-tagged truth: after an interruption between `vacuum into` and the pointer row's
      commit, the reachable outcomes are bounded to two, both non-destructive — a missing directory entry
      (an orphan ROW, made inert by 28-13) or an entry whose contents ARE durable. ABSTAINED, per the
      backstop-abstention contract: `insufficient_spec`.
    test: >-
      Host-level crash or power-loss injection (or an equivalent fs-level fault harness) across the
      `stageSnapshot` fsync / `publishSnapshot` rename / pointer-row commit sequence, confirming no
      surviving pointer row names a file whose bytes did not reach disk
    expected: "No reachable post-crash state in which a durable pointer row names a non-durable image"
    why_human: >-
      An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two
      `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop` and
      its control says so in its own comment rather than dressing a presence check as a durability proof;
      I verified the calls exist (`stageSnapshot`'s `fsyncPath(staging)` unguarded after `vacuum into`,
      `publishSnapshot`'s `fsyncPath(dirname(snapPath))` best-effort after `renameSync`) and that the
      guarded/unguarded asymmetry is the measured one (a directory fsync needs the same read bit
      `readdirSync` needs, so an unguarded one would redden the 0o300 CR-07 control). Presence + wiring
      never qualify as behavioural evidence for a durability claim.
coincidental_reliance_items:
  - truth: >-
      "Ranges are stored as ranges and are never merged on adjacency, so no splitter primitive exists to
      introduce" (ROADMAP criterion 2 / STORE-02) — VERIFIED, but the evidence holds for a shape the
      fixture chose.
    reason: fixture-only
    harden: >-
      The behavioural adjacency control issues TWO SEPARATE `setDataType` calls and asserts two rows
      survive — which I re-drove and which holds. But `retype()` DOES collapse rows when the caller's range
      spans them: driven here, `$1000..$1007 byte` + `$1008..$100f byte` then
      `setDataType($1000..$100f, "byte")` deletes BOTH rows and inserts ONE (`id=3 $1000..$100f byte`),
      reporting `changed: true` for what resolves identically at every address, with both original ids
      gone. STORE-02's letter still holds — the store introduced no merge of its own; the caller asked for
      one range — but the criterion's evidence never exercises the shape where a merge happens, so the
      control cannot distinguish "does not merge" from "was never asked to". Pin the union-retype and
      same-type-subrange shapes BY VALUE (this is round 3's WR-08, still carried and still unpinned), and
      state in `retype()`'s doc comment next to its STORE-02 reference whether the collapse is intended.
prohibition_flags: # judgment-tier; non-authoritative LLM-judge verdicts, human review recommended
  - statement: >-
      28-16 P1 (NEW round 4) — MUST NOT close the caller's handle, or modify the live store, on behalf of a
      replacement image the code has not itself OPENED as an annotation store.
    verdict: held
    flagged: true
    reason: >-
      HELD, and held as an ORDERING rule rather than as a check for one byte pattern, which is what makes
      the class closed rather than the instance. Verified in source (step 3b at `anno-store.ts:2043-2054`
      opens the STAGED copy — the exact bytes step 5 renames — before step 4's `closeStore` at `:2058`)
      and driven over three input classes (0 bytes, 46 foreign bytes, half-truncated): live store
      byte-identical at 69632 in all three, caller's handle still answering, later `openStore` succeeding.
  - statement: >-
      28-16 P2 (NEW round 4) — MUST NOT let the ring's file sweep unlink a snapshot image merely because it
      failed to open. A corrupt image a pointer row still claims is EVIDENCE.
    verdict: held
    flagged: true
    reason: >-
      HELD, driven. After the 0-byte `r1.db` is planted and an ordinary `setDataType` runs its prune and
      sweep, `r1.db` is still present at 0 bytes and its pointer row still exists. The mechanism is
      structural, not incidental: `reconcileSnapshotRing`'s keep-set is `claimedRevisions` (`:1004`), the
      pointer-ROW question, named differently from `retainedRevisions` precisely so the two are not
      confused.
  - statement: >-
      28-16 P3 (NEW round 4) — MUST NOT let the act of JUDGING a snapshot image create it, initialise it,
      or modify it.
    verdict: held
    flagged: true
    reason: >-
      HELD, and stronger than the prohibition asks. `openStore`'s `mustExist` arm refuses BEFORE `new
      DatabaseSync` is constructed (`:376-384`, with the reason stated in the code: after that line the
      question can no longer be asked), and the same option opens `readOnly: true` (`:393`). So a judging
      open can neither create nor write. Confirmed behaviourally: across all three corruption drives the
      ring gained no files and the corrupt image's byte length never changed.
  - statement: >-
      28-07 P2 / 28-10 P2 — MUST NOT publish a floor, bound or "retained" claim the store cannot honour on
      the very next call, in EITHER direction.
    verdict: held
    flagged: true
    reason: >-
      THE OVER-CLAIM DIRECTION — recorded VIOLATED in round 4 and the dangerous one — IS NOW CLOSED, driven
      three ways: `retainedRevisions()` reports `[0, 2]` with the unopenable image excluded,
      `oldestRetainedRevision()` reports 0, the refusal's `Available revisions:` list reads `0, 2`, and
      every revision the list advertises reverts successfully on a fresh copy. THE UNDER-CLAIM RESIDUAL
      REMAINS AND I JUDGE IT ACCEPTABLE AS RECORDED, having driven it rather than read it: a symlink alias
      no longer reproduces it at all (confinement's realpath normalisation resolves both spellings to the
      same ring — `retained [0,1]` through both), so I constructed a genuinely different basename with a
      HARD LINK. Through it, `retained []`, `oldest -1`, and `revertTo(0)` REFUSES BY NAME. It is
      safe-direction (refuses, never destroys), bounded and reversible — verified: the write through the
      hard link left the original ring untouched, both ring directories coexist, and reopening the real
      path restores `retained [0,1]` with `revertTo(0)` succeeding — and accurately documented in the code
      (`:480-521`). Closing it would need a ring whose ownership the handle cannot establish, which
      28-10 P3 / 28-11 P4 forbid.
  - statement: >-
      28-07 P1 / 28-10 P1 / 28-11 P1 — MUST NOT destroy the only remaining route back to a state the store
      still advertises as reachable.
    verdict: held
    flagged: true
    reason: >-
      HELD for the first time in five rounds. Round 4's fourth route (CR-08) is closed and re-driven over
      three input classes; the earlier three (CR-01/CR-02/CR-03 identity, CR-05 spelling, the sweep's row
      deletes) stay closed on regression — `reconcileSnapshotRing` contains no `delete from anno_snapshot`
      at all, and the hard-link and alias drives above are both non-destructive.
  - statement: >-
      28-07 P3 — MUST NOT leave in place, or introduce, a comment or a user-facing message that asserts a
      guarantee the code does not provide.
    verdict: held
    flagged: true
    reason: >-
      HELD, including round 4's two noted WEAKER cases. WR-16's shape is genuinely repaired: three handlers
      record whether their own `rollback` returned (`:1049`, `:1479`, `:1595`), the two throwing sites
      branch their message on the recorded fact and carry `rolledBack` in `data`, and the sweep's
      `deferred` doc block carries its qualifier in the SAME SENTENCE as the "THIS SWEEP CHANGED NOTHING"
      claim (`:887-897`) — I read it specifically to check whether it over-claims, and it does not. WR-13's
      control states in its own comment that its evidence is structural rather than behavioural. CR-09
      introduces no false comment: the omission is silence, not a false claim — which is why it is filed as
      the gap and not here.
  - statement: >-
      28-10 P3 / 28-11 P4 — MUST NOT adopt, migrate, claim or sweep a snapshot ring whose ownership this
      store cannot establish; MUST NOT let a repair judge a state it cannot have produced.
    verdict: held
    flagged: true
    reason: >-
      HELD. Opening an image this handle's own `snapshotPathFor` names is not reading an unowned ring, and
      no new ring, spelling or directory is read. The hard-link drive confirms the boundary is still
      enforced in the refusing direction rather than the adopting one.
  - statement: "28-11 P5 — MUST NOT convert a committed write into a caller-visible failure."
    verdict: held
    flagged: true
    reason: >-
      HELD, driven as uid 1000 where the precondition is real: with the ring directory at 0o300 (writable,
      not readable) `setDataType` reported SUCCESS at revision 3 and `begin immediate` on the same handle
      immediately afterwards SUCCEEDED. 28-17's directory fsync is best-effort for exactly this reason, and
      that asymmetry is measured rather than stylistic. WR-17's new wraps sit AFTER the rename has landed
      and their messages state the revert LANDED ON DISK.
  - statement: >-
      28-17 P4 (NEW round 4) — MUST NOT let a test report a PASS for a precondition it could not construct.
    verdict: held
    flagged: true
    reason: >-
      HELD. Both root-sensitive controls use node:test's real `{ skip: ... }` form (`:3185`, `:3259`) with a
      stated reason; `grep -rn "SKIPPED as root"` over the anno tests returns nothing. The round's uid-0
      observation was a FORGED uid rather than real root, and 28-17 offers it on exactly that footing — my
      own CR-07 evidence does not depend on these controls (I drove the property directly as uid 1000), so
      this restores the round's standing guarantee rather than my verdict's basis.
  - statement: >-
      28-17 P5 (NEW round 4) — MUST NOT make a durability claim whose only evidence is that the code was
      written down.
    verdict: held
    flagged: true
    reason: >-
      HELD in the honest direction: the claim is NOT presented as proven. The control is structural, says so
      in its own comment, and 28-17 filed the host-crash bound as a `backstop` truth needing human
      judgment. I have carried that as an ABSTENTION (`insufficient_spec`) in
      `behavior_unverified_items` rather than counting it verified.
  - statement: >-
      28-18 P1 (NEW round 4) — MUST NOT make a structural invariant that constrains the wording of
      user-facing error messages.
    verdict: held
    flagged: true
    reason: >-
      HELD. The coupling comment is gone from `anno-store.ts` and the matcher now keys on `exec()` calls
      carrying a bare statement literal rather than on the word `commit` anywhere in the file, so no error
      message's prose can redden a control in another file. Its replacement has a coverage hole (WR-19,
      confirmed below) but that is a completeness defect in the control, not a re-coupling.
  - statement: >-
      28-18 P2 (NEW round 4) — MUST NOT move a requirement's status on an executor's own judgement of its
      own work.
    verdict: held
    flagged: true
    reason: >-
      HELD. `.planning/REQUIREMENTS.md`'s STORE-05 restoration and STORE-04 reason correction both quote
      the round-4 verifier's own sentences and name the source file and table. I re-verified STORE-05 on the
      evidence independently and agree with the row.
  - statement: >-
      28-18 P3 (NEW round 4) — MUST NOT close, silently drop, or re-file as done the carried-forward
      `behavior_unverified` item.
    verdict: held
    flagged: true
    reason: >-
      HELD. `28-REVIEW.md`'s round-4 disposition table carries an explicit STILL-OPEN row for the
      `integrity_check` throw arm with its unchanged reason, and no plan in the round claims it. I have
      carried it forward again.
  - statement: >-
      28-10 P4 — MUST NOT change the meaning of an on-disk column or of the on-disk directory layout
      without a schema version bump that makes the older shape refuse BY NAME.
    verdict: held
    flagged: true
    reason: "`SCHEMA_VERSION` is still 2 (`anno-types.ts:154`), `anno_snapshot` is still one column, and no on-disk shape moved this round."
  - statement: >-
      28-11 P3 — MUST NOT substitute a tuned timing constant for an exact exclusion when the exact
      exclusion is already available from a lock the code takes anyway.
    verdict: held
    flagged: true
    reason: >-
      HELD. `begin immediate` is still the sweep's first statement and it declines on failure. No grace
      bound, no mtime comparison, no new tunable. The only timing number is SQLite's own `busy_timeout`
      (5000 ms, set at `:393`).
  - statement: "28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted."
    verdict: held
    flagged: true
    reason: >-
      HELD, regression-checked in the messages I observed: the CR-08 refusal names the requested revision,
      the revision the store is still at, the store path, the snapshot path, the quoted underlying reason
      and the available-revisions list.
  - statement: >-
      28-08 P1 — MUST NOT let a writer that is about to be refused mutate anything a committed writer owns.
    verdict: held
    flagged: true
    reason: "Unchanged this round. Regression only: the CAS rollback arm is still in place and no accepted write in my drives changed a revision it did not own."
  - statement: >-
      28-09 P1 / 28-12 P1 / 28-12 P2 — MUST NOT silently redirect a path the confinement rejects, and MUST
      NOT make a confinement control pass by broadening its refusal.
    verdict: held
    flagged: true
    reason: >-
      HELD on regression: `anno-confinement.test.ts` is 15 cases green in my own run, including case 14's
      real `{ skip: … }`. Independently observed this round: opening through an inside-pointing SYMLINK
      alias is still FOLLOWED (it resolved to the same real path and the same ring), so the refusals were
      not bought by broadening.
human_verification:
  - test: >-
      Fault-inject so `pragma integrity_check` itself throws inside `openStore` (filesystem- or
      SQLite-level), rather than returning a non-`ok` row
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      Defensive arm with no reachable input without fault injection; presence and wiring verified in source
      plus a structural control, but nothing exercises the throw. Carried forward unchanged from round 4.
  - test: >-
      Host-level crash / power-loss injection across the `stageSnapshot` fsync -> `publishSnapshot` rename
      -> pointer-row commit sequence
    expected: >-
      No surviving state in which a durable `anno_snapshot` pointer row names a snapshot image whose bytes
      never reached disk; the only reachable outcomes are a missing directory entry or a durable one
    why_human: >-
      `fsync` has no in-process observable, so the only in-process evidence is the source order of two
      calls. 28-17 filed this as a `backstop` truth; the abstention is recorded rather than scored.
---

# Phase 28: The Store Core Verification Report

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-28T19:55:00Z
**Status:** gaps_found
**Re-verification:** Yes — round 5, after the fourth gap-closure round (28-16, 28-17, 28-18)

## Goal Achievement

**The fourth gap-closure round did what it was scoped to do, and it did it as a
class rather than as an instance.** I re-drove CR-08 through production entry
points over three input classes rather than the one round 4 reported, and the
goal's REVERTIBLE clause is now TRUE for the first time in five rounds: the live
store is left **69632 -> 69632** bytes byte-identical where round 4 measured
69632 -> 0, the refusal is in the `ViceError` family and names both paths, the
caller's handle keeps answering, a later `openStore` succeeds — and the refusal
was not bought by broadening, because every revision `retainedRevisions()`
advertises still reverts successfully. Truth 12, carried as FAILED for four
rounds, is VERIFIED.

**The phase still fails, on one new blocker in a different clause of the same
goal.** `retype()`'s split-and-preserve writes a split-table row with an ODD byte
count — a shape `setDataType` refuses at its own entry point and
`resolveSplitTargets()` cannot decode. Two ordinary calls produce it; the write
reports `changed: true` with no diagnostic. Criterion 3's three named controls
all still pass, and I say so plainly. What fails is criterion 3's own stated
purpose — *"Silently un-documenting a previously annotated region is the exact
failure the store exists to prevent"* — for the four split members, and with it
the goal clause *"owns the annotation state — ... per-range typing over the full
12-member vocabulary"*. The suite that exists to prove that criterion contains
**zero** split-table overlap cases, so 169 green tests are blind to the class.

**On the orchestrator's framing of CR-09, asked to judge it rather than accept
it:** the framing is correct on the facts, which I reproduced independently, and
I differ on one point of attribution. CR-09 does **not** falsify criterion 1 —
the vocabulary is 12 members, the four split layouts are first-class, and the
differing-resolved-target-set control with its collapse planting is green. It
**does** falsify criterion 3, not in its measured clauses but in the sentence
that states what those clauses are for.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full 12-member vocabulary, four split layouts first-class (SC-1) | ✓ VERIFIED | Driven: an invalid type name is refused with the full list of exactly 12 — `code, byte, word, address, petscii, screencode, lo_hi_address, hi_lo_address, lo_hi_word, hi_lo_word, external_file, undefined`. The orientation control (`anno-types.test.ts:191-223`) and its collapse planting both green in my own 169/169 run. |
| 2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle (SC-2) | ✓ VERIFIED | Oracle cross-validation, the "oracle shares no code path" control, the equal-length tie-break pin, the `$FFFF` boundary and the length-1 pin all green in my run. |
| 3 | Ranges stored as ranges, never merged on adjacency, no splitter primitive (SC-2) | ✓ VERIFIED (coincidental-reliance) | Re-driven: two adjacent same-type ranges written by two calls stay two rows with distinct ids. Structural scan for `coalesc`/`merg`/`splitter` green. Advisory: a caller-spanning retype DOES collapse them, and the control never exercises that shape — see `coincidental_reliance_items`. |
| 4 | **A partial overwrite splits and PRESERVES — the surviving region keeps an annotation the store accepts and its own resolver can decode (SC-3)** | ✗ FAILED | **CR-09, reproduced here through public entry points only.** `setDataType($1000..$100f,"lo_hi_address")` then `setDataType($1004..$1004,"byte")` leaves `id=3 $1005..$100f lo_hi_address` — span **11**, odd. Re-asserting that exact row through `setDataType` throws `AnnoRangeShapeError`; `resolveSplitTargets()` throws on an odd count. `changed: true`, `contradictedComments: []`, no diagnostic. Criterion 3's three named controls are green; its stated purpose is not met. |
| 5 | Combined SIGKILL durability+revert test, and removing the commit reddens it (SC-4) | ✓ VERIFIED | Not read off the SUMMARY: the planting is executed live by `observeMutateKillReopen("no-commit")` in a real subprocess (`anno-durability.test.ts:271-290`) and asserts `readBackByValue === false` AND `revertReturnsPriorValue === false`. Green in my run. |
| 6 | A truncated/zero-length store FILE is refused at open, never returned partial (SC-4) | ✓ VERIFIED | `openStore` checks `anno_meta`, `schema_version` and `pragma integrity_check` (`:426-472`); the zero-length and truncated-mid-file refusal tests green. Independently: my corruption drives' `snapshotOpenFailure` path is the same refusal reached through `mustExist`. |
| 7 | Schema version + reserved uninterpreted `bank` + xref access kind (SC-5) | ✓ VERIFIED | Read the DDL myself: `anno_meta.schema_version integer not null`; `bank integer` on `anno_range`, `anno_label`, `anno_comment`, `anno_xref`; `access_kind text not null`. The "bank is never READ" and "a fifth access-kind is refused" controls green. |
| 8 | Stale-base write refused, observed from a second OS process (SC-5) | ✓ VERIFIED | `execFileSync` mutator test green in my run; the cross-process CR-06 reader test in `anno-durability.test.ts` green (5/5). |
| 9 | `node:sqlite` reachable from exactly one shipped module (SC-5, STORE-07) | ✓ VERIFIED | Repo-wide grep of `.ts`/`.mts`/`.mjs`: the only CODE reference is `anno-store.ts:132`. Every other hit is a comment or a test-side declared-list assertion. `anno-durability-mutator.mjs` is absent from `package.json` `files[]` (which lists `anno-types.ts`, `anno-index.ts`, `anno-store.ts` and no mutator). Four-form seam control with four plantings green. |
| 10 | The census boundary accepts the store's lowercase vocabulary (28-03) | ✓ VERIFIED | `block-class.test.ts` green in my 169-test run, including the module-level-mutable-binding and `files[]` structural pins (`ok 168`, `ok 169`). |
| 11 | An accepted write and its housekeeping cannot leave the connection in an open transaction, and everything thrown stays in the ViceError family | ✓ VERIFIED | Re-driven as uid 1000 with a real precondition: ring at 0o300, `setDataType` reported success at revision 3, `begin immediate` on the same handle immediately afterwards SUCCEEDED. Structural transaction lifetime confirmed in source (`:976-1063`). |
| 12 | **At the goal level the store is REVERTIBLE — a revert can return prior state and can never destroy it** | ✓ VERIFIED | **Round 4's blocker, CLOSED.** Three input classes (0 bytes / 46 foreign bytes / half-truncated): `retained [0,2]`, in-family refusal naming both paths, live store **69632 -> 69632**, same handle answering `rev 3` with 3 rows, later `openStore` succeeding, and `revertTo(2)` on the good image still succeeding. Advertised-is-revertable driven as a loop: 0, 2, 3 → currentRevision 0, 2, 3. |

**Score:** 11/12 truths verified (2 evidence-gap items reported separately and
counted neither way: the `integrity_check` throw arm, present-behaviour-unverified;
and 28-17's host-crash durability bound, abstained as `insufficient_spec`)

### Deferred Items

None. I read every later phase of the milestone (29 The MCP Surface, 30 ACME
Export, 31 Procedure Re-pointing, 32 The Deletion and the Grep Gate) and grepped
their goals and success criteria for `split`, `overlap`, `remainder`, `retype`
and `shape`. No later phase addresses split-table remainder integrity. Phase 29
**amplifies** it — it puts `set_data_type` and the range listing on an
agent-driven MCP path where, by `anno-types.ts`'s own header, the proxy's
`validate: (value) => ({ value })` means every argument arrives unvalidated —
and Phase 30 reads these rows to emit ACME source.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/anno-store.ts` | `mustExist`/`readOnly` judging open; one `snapshotOpenFailure` witness; `claimedRevisions` for the sweep; `revertTo` step 3b before any close or rename; fsync on the publish path; `rolledBack` recorded at three handlers | ⚠️ HOLLOW on the retype half | 2663 lines. Every round-4 artifact present AND driven: `mustExist` refuses before `new DatabaseSync` (`:376`) and opens `readOnly: true` (`:393`); `snapshotOpenFailure` (`:624`) is the single witness at both former `existsSync` sites; `claimedRevisions` (`:650`) is the sweep's keep-set (`:1004`); step 3b opens the STAGED copy (`:2043`) before step 4's `closeStore` (`:2058`); `fsyncPath` count 6 with `stageSnapshot`'s unguarded and `publishSnapshot`'s best-effort; `rolledBack` at `:1049`, `:1479`, `:1595`. **But `retype()` (`:1707-1733`) writes both remainders with `row.data_type` and no shape check** — the module's only unvalidated writer. |
| `src/mcp/vice/anno-types.ts` | 12-member `DATA_TYPES`, `assertRangeShape`'s odd-split refusal, `resolveSplitTargets`' odd refusal, `pathEntryExists` | ✓ VERIFIED | 1255 lines. `SCHEMA_VERSION` 2; 12 members driven off a refusal message; the odd-count refusal exists at both `:685-690` and `:1239-1245` — which is precisely why the store's own remainder writer contradicts it. |
| `src/mcp/vice/anno-store.test.ts` | Six new round-4 tests: truncated image, foreign-bytes image, retained/floor exclusion + healthy control, advertised-is-revertable, sweep-preserves-evidence, WR-17 structural | ✓ VERIFIED | 3989 lines (was 3303). 73/73 in the combined run. Both root-sensitive controls converted to real `{ skip: … }` at `:3185` and `:3259`; zero `SKIPPED as root` leftovers. |
| `src/mcp/vice/anno-overlap.test.ts` | Five overlap cases with the fully-contained case load-bearing, plus the filter-and-insert planting | ⚠️ HOLLOW | 588 lines, all green — and **zero split-table overlap cases**. The only `lo_hi_address` mentions are `:524`/`:531`, in the NON-overlapping second-range test. The suite proving criterion 3 has never met the vocabulary of criterion 1. |
| `src/mcp/vice/anno-seam.test.ts` | Single-commit-site control counting STATEMENTS across the three SQLite spellings | ⚠️ PARTIAL | 517 lines, 17/17 green. `commitStatements()` (`:382-389`) correctly counts `commit`, `end`, `end transaction` — and returns **0** for `db.exec("commit;")`, `db.exec("end;")` and `db.exec("COMMIT ;")`, each of which commits (WR-19, confirmed by running the regex). Today there is exactly one commit site, so criterion 4's planting IS unique; the guard against a future second one has a hole. |
| `src/mcp/vice/anno-confinement.test.ts` | Three ancestor cases, case 14 skipping for real | ✓ VERIFIED | 711 lines, 15 cases green; `skip:` at `:578`. |
| `src/mcp/vice/anno-durability.test.ts` | Combined SIGKILL test with a live subprocess planting; cross-process reader-vs-commit | ✓ VERIFIED | 488 lines, 5/5. |
| `.planning/REQUIREMENTS.md` | STORE-05 → `Complete`; STORE-04 stays `Gaps Found` with CR-08 as the recorded reason | ✓ VERIFIED | Both transcribed with the round-4 verifier's own sentence quoted and its source named. I re-verified STORE-05 independently and agree. |
| `.planning/phases/28-the-store-core/28-REVIEW.md` | Round-4 disposition table covering all six ids | ✓ VERIFIED | Present at `:167-184`, each `fix` naming its plan and quoting a number or line reference, plus an explicit STILL-OPEN row for the `integrity_check` item. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `retainedRevisions` | `openStore(path, { mustExist: true })` | `snapshotOpenFailure` | ✓ WIRED | `:730` — the advertisement and `revertTo`'s gate read ONE witness. Driven: advertised list `[0,2]` excludes the unopenable image and every advertised revision reverts. |
| `revertTo` step 2 / step 3b | `closeStore(handle)` (step 4) | source-image gate then STAGED-copy open, both before any close or rename | ✓ WIRED | `:1982`, `:2043`, `:2058`. Ordering IS the guarantee; driven three ways. |
| `reconcileSnapshotRing` | `claimedRevisions` (NOT `retainedRevisions`) | keep-set inside `begin immediate` | ✓ WIRED | `:1004`. Corrupt-but-claimed image survived the sweep at 0 bytes with its row intact; the 32-database cost never runs under the write lock. |
| `stageSnapshot` / `publishSnapshot` | `fsyncPath` | image fsync unguarded, directory fsync best-effort | ✓ WIRED (structural only) | Both calls present; the asymmetry is the measured one. Durability itself is the abstained `backstop` item. |
| `commitTransaction` failure | refusal message | recorded `rolledBack` fact, branched prose + `data.rolledBack` | ✓ WIRED | `:1479-1507`, `:1595-1623`. |
| `reconcileSnapshotRing` → `rollbackFailed` | any production consumer | — | ✗ NOT WIRED | The field 28-17 added to report a failed rollback has exactly ONE reader in the repo: an assertion at `anno-store.test.ts:3981`. `revertTo`'s step-6 call at `:2186` discards the whole result, so a `rollbackFailed: true` sweep hands the caller back a connection that may still be inside the sweep's transaction (WR-18). WARNING, not a blocker: reaching it requires `db.exec("rollback")` itself to throw on a connection whose `begin immediate` succeeded, which has no reachable input without fault injection. |
| `setDataType` | `assertRangeShape` | entry-point validation | ✓ WIRED | `:1859`, for the CALLER's range. |
| `retype` remainder inserts | `assertRangeShape` | — | ✗ NOT WIRED | `:1724` and `:1727` carry `row.data_type` forward with no shape check. **This is the gap.** |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `listRanges` | `rows` | `select id, start, end_inclusive, data_type, bank from anno_range` | Yes — driven, returned the three post-split rows by value | ✓ FLOWING |
| `retainedRevisions` | advertised list | `claimedRevisions` filtered by a real `openStore` per revision | Yes — `[0,2]` on a corrupt ring, `[0,1,2]` on a healthy one | ✓ FLOWING |
| `revertTo` | returned handle | real `renameSync` + real reopen | Yes — reverted handles answered at the requested revision | ✓ FLOWING |
| `currentRevision` | revision | `select revision from anno_meta` | Yes | ✓ FLOWING |
| `reconcileSnapshotRing` | `rollbackFailed` | recorded fact | Yes, but consumed by nothing in production | ⚠️ STATIC — reaches a test assertion only |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| The phase's own suite is green at a real exit code | `node --test anno-*.test.ts block-class.test.ts` | `# tests 169 / # pass 169 / # fail 0 / # skipped 0`, real exit **0** | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit -p tsconfig.json` | exit **0**, no output | ✓ PASS |
| CR-08 closed, 0-byte image | driven script, production entry points only | `retained [0,2]`; `AnnoStoreError`; **69632 -> 69632**; handle answers rev 3; later open succeeds | ✓ PASS |
| CR-08 closed, foreign-bytes image | same | identical outcome | ✓ PASS |
| CR-08 closed, half-truncated image | same | identical outcome | ✓ PASS |
| The refusal was not bought by broadening | `revertTo(handle, 2)` on the good image, in all three fixtures | returns a handle at revision 2 | ✓ PASS |
| Advertised-is-revertable | loop over `retainedRevisions()` on a fresh copy per revision | 0, 2, 3 → currentRevision 0, 2, 3 | ✓ PASS |
| Sweep preserves a corrupt-but-claimed image | plant 0-byte `r1.db`, run an ordinary `setDataType` | `r1.db` still present at 0 bytes, pointer row intact | ✓ PASS |
| No leaked transaction after an accepted write (uid 1000, ring 0o300) | `setDataType` then `begin immediate` | success at rev 3, then `begin immediate` SUCCEEDED | ✓ PASS |
| **CR-09** | two `setDataType` calls, public API only | `id=3 $1005..$100f lo_hi_address` span **11**; re-asserting it throws `AnnoRangeShapeError` | ✗ **FAIL** |
| WR-08 union-retype collapse | two adjacent `byte` rows then a spanning retype | both rows deleted, one row `id=3` inserted, `changed: true` | ✗ FAIL (advisory — see coincidental-reliance) |
| WR-19 commit matcher | run `commitStatements`' regex over the six spellings | `commit`→1, `end`→1, `end transaction`→1; `commit;`→**0**, `end;`→**0**, `COMMIT ;`→**0** | ✗ FAIL (warning) |
| Under-claim residual is safe-direction and reversible | hard-link spelling then reopen the real path | `retained []` / `oldest -1` / `revertTo` refuses by name; original ring untouched; real path restores `[0,1]` and `revertTo(0)` succeeds | ✓ PASS |
| `node:sqlite` seam | repo-wide grep over `.ts`/`.mts`/`.mjs` | one code reference: `anno-store.ts:132` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | `find scripts -path '*/tests/probe-*.sh'` | none found; no PLAN or SUMMARY in this phase declares a probe | N/A — no probes in scope |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `anno-types.test.ts` | STORE-01 | all | 0 | No — the oracle is hand-written arithmetic pinned to bytes computed in research | Value | ✓ SOUND |
| `anno-index.test.ts` | STORE-03 | all | 0 | No — the oracle is an independently written implementation, with a "shares no code path" control and a `comparisons` non-vacuity assertion | Value (65,536 comparisons) | ✓ SOUND |
| `anno-overlap.test.ts` | STORE-02, STORE-03 | all | 0 | No | Value | ⚠️ INSUFFICIENT COVERAGE — zero split-table overlap cases; the union-retype and same-type-subrange shapes unpinned (WR-08) |
| `anno-durability.test.ts` | STORE-04 | all | 0 | No — the planting runs the real write path in a real subprocess | Behavioural | ✓ SOUND |
| `anno-store.test.ts` | STORE-01, -04, -05 | all | 0 (2 under root, declared) | No | Behavioural + structural | ✓ SOUND |
| `anno-seam.test.ts` | STORE-07 | all | 0 | No | Structural, with four plantings | ⚠️ INCOMPLETE MATCHER (WR-19) |
| `anno-confinement.test.ts` | STORE-01 (path safety) | 15 | 1 declared | No | Behavioural | ✓ SOUND |
| `block-class.test.ts` | STORE-01 boundary | all | 0 | No | Value + structural | ✓ SOUND |

**Disabled tests on requirements:** 0 — the only skips are declared root
preconditions that cannot be constructed as uid 0, and they are counted by the
runner rather than reported as passes.
**Circular patterns detected:** 0.
**Insufficient assertions:** 2 warnings (`anno-overlap.test.ts` coverage,
`anno-seam.test.ts` matcher). Neither is a BLOCKER by itself; the overlap
coverage hole is the *reason* CR-09 survived 169 green tests and is named in the
gap's `missing` list.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STORE-01 | 28-01, 28-03, 28-04 | Store holds labels, comments, per-range typing over the full 12-member vocabulary, scopes, project enums | ✗ **BLOCKED** | The vocabulary IS 12 members and every category is stored and read back by value — but the store persists a per-range typing it refuses at its own entry point and its own resolver cannot decode (CR-09). `.planning/REQUIREMENTS.md` records `Complete`; that row is no longer correct on the evidence and should move to `Gaps Found` with CR-09 as its reason. |
| STORE-02 | 28-02, 28-05 | Ranges stored as ranges, never merged on adjacency, no splitter introduced | ✓ SATISFIED | Behaviourally re-driven and structurally scanned. Advisory only: the union-retype collapse (WR-08) is unpinned and the control never exercises the merging shape — recorded under `coincidental_reliance_items`, not scored against the requirement. |
| STORE-03 | 28-02, 28-05 | Narrowest-wins exact at all 65,536 addresses, cross-validated, with the partial-overwrite behaviour pinned | ✗ **BLOCKED** | The lookup half is fully satisfied — exhaustive cross-validation against an independent oracle with a non-vacuity assertion, both ends, `$FFFF`, length-1 and the tie-break all pinned. The requirement's third clause, *"the behaviour when a typed range is partially overwritten"* pinned, is NOT met for the four split members: the pin exists for non-split types only and the split shape produces a row the store refuses. Recorded `Complete`; should move to `Gaps Found` on the partial-overwrite clause. |
| STORE-04 | 28-06, 28-07, 28-08, 28-09, 28-10..28-18 | Survives a process restart and an edit can be reverted, proven by ONE combined planted-violation test, with the removed commit observed red | ✓ SATISFIED | Both halves now hold. The combined test and its live subprocess planting are green (truth 5), and the REVERT half — round 4's recorded blocker — is closed and re-driven over three input classes (truth 12). `.planning/REQUIREMENTS.md` records `Gaps Found` with CR-08 as the reason; **CR-08 is closed and that row can move to `Complete`.** |
| STORE-05 | 28-01, 28-04, 28-06, 28-18 | Schema version + reserved uninterpreted `bank` from the first write + xref access kinds | ✓ SATISFIED | Re-verified in the DDL myself and by green controls: `schema_version integer not null`, `bank integer` on all four annotated tables and read in exactly one place, `access_kind text not null` with a fifth value refused. No open finding touches it. `Complete` is correct. |
| STORE-07 | 28-01 | `node:sqlite` reached through exactly one seam module | ✓ SATISFIED | One code reference repo-wide (`anno-store.ts:132`); four-form seam control with four plantings; `anno-store.ts` and `anno-types.ts` both absent from the five-element host-path consumer set. `Complete` is correct. |

**All six declared requirement IDs are accounted for.** No orphans:
`.planning/REQUIREMENTS.md` maps exactly STORE-01, -02, -03, -04, -05 and -07 to
Phase 28 (STORE-06 maps to Phase 29 by design), and every one appears in at least
one plan's `requirements` frontmatter.

**Three record rows are now wrong in a direction nobody has flagged**, and I
state them together because two move in the *opposite* direction to the one the
round expected: STORE-04 should move UP to `Complete` (its blocker is closed),
while STORE-01 and STORE-03 should move DOWN to `Gaps Found` (CR-09 falsifies a
clause each of them carries). Per prohibition 28-18 P2 the rows move only on a
verification verdict — this is that verdict, and the sentences above are the
authorising ones.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `HACK` / `PLACEHOLDER` scan over all 13 phase-28 source and test files | — | **CLEAN — zero markers.** No unreferenced debt markers; the debt-marker gate does not fire. |
| `src/mcp/vice/anno-store.ts` | 1724, 1727 | Write path bypasses its own validator | 🛑 BLOCKER | CR-09 — filed as the gap. |
| `src/mcp/vice/anno-store.ts` | 2186 | Result discarded from a call whose result carries a failure state | ⚠️ WARNING | WR-18 — `rollbackFailed` has no production reader; `revertTo` can hand back a connection inside the sweep's transaction. Unreachable without fault injection. |
| `src/mcp/vice/anno-seam.test.ts` | 389 | Structural control with an evasion hole | ⚠️ WARNING | WR-19 — a commit statement with a trailing semicolon counts as zero. Verified by running the regex. |
| `src/mcp/vice/anno-overlap.test.ts` | whole file | Coverage gap on the requirement the file exists to prove | ⚠️ WARNING | The reason CR-09 survived five rounds. Named in the gap's `missing` list. |
| `src/mcp/vice/docs-review-disposition.test.ts` | — | Guard red on the real tree | ⚠️ WARNING | 6/7. Twelve round-5 ids undispositioned; `audit-integrity.test.ts`'s D-12-02 cascade is 43/44 in consequence. Both go green once the ids are dispositioned. **Correction to the round-4 report, which this file replaces: both guards were GREEN (7/7 and 44/44) before the round-5 review gate ran. The round-4 report's closing claim that they were red for the six round-4 ids was wrong — the guard treats a phase's own `*-VERIFICATION.md` as a disposition source, so writing that report is what dispositioned them. That incorrect claim is NOT carried forward.** |
| `scripts/audit-gate.mjs` | 198 | All-or-nothing attribution | ℹ️ INFO | The gate runs all seven docs guards in ONE `node --test` process, so one failure marks all seven red in `redGuards`. I ran the other six individually: all GREEN. Pre-existing, not phase-28. |

### Round-5 Finding Dispositions (from the verifier seat)

`28-REVIEW.md` deliberately files no disposition for its own findings and marks
these twelve as required from the orchestrator. Recording a verdict for each
here so the guard turns green on a real decision rather than on an incidental
mention — **and the orchestrator should still transcribe these into
`28-REVIEW.md`'s own table, because a disposition that lives only in this file
disappears the next time this file is overwritten.** That is exactly how round 4
lost the disposition it thought it had.

| Id | Verdict |
|---|---|
| CR-09 | **BLOCKER, confirmed and filed as this round's gap.** Reproduced independently through public entry points; the review's analysis is correct on every fact I checked. Its severity attribution needs one correction: it falsifies criterion 3's stated purpose, not criterion 1. |
| WR-18 | **Confirmed, WARNING → gap-closure round.** `rollbackFailed` has exactly one reader (a test assertion) and `revertTo:2186` discards the result. 28-17's fix is incomplete in its own terms. Not a blocker: reaching `rollbackFailed: true` needs `rollback` itself to throw. |
| WR-19 | **Confirmed by running the matcher, WARNING → gap-closure round.** `commit;` / `end;` / `COMMIT ;` all count 0. 28-18's fix is incomplete in its own terms. Not a blocker: there is exactly one commit site today, so criterion 4's planting is in fact unique. |
| WR-20 | **Accepted as recorded, low priority.** Four hand-copied variants of the no-module-level-mutable-state control. Not verified in depth this round; no criterion or requirement depends on it. |
| WR-21 | **Confirmed by inspection, WARNING → gap-closure round.** `addScope` has neither idempotence nor a shape rule. Phase 29's criterion 5 requires a repeated edit to succeed reporting no change, so this lands there if not fixed here. |
| WR-22 | **Confirmed by reading the code, WARNING.** `revertTo`'s `revision` is unvalidated and reaches both a bound parameter and a filename. Safe-direction today (it produces a refusal, not a destruction) but it produces a CORRUPTION message for an argument error, which the module's own doc comment forbids. Phase 29 puts it on an unvalidated transport. |
| WR-23 | **Accepted as recorded, low priority.** An `undefined`-data-type asymmetry in `contradictedCommentsFor` with a false recorded rationale. Fix the comment when the function is next touched. |
| WR-24 | **Confirmed by reading the code, WARNING → gap-closure round.** `revertTo`'s staging path is per-(pid, revision) where `stageSnapshot`'s is per-attempt, and three unguarded `rmSync` sites can delete another attempt's in-flight copy. Same-function neighbour of the CR-09 fix. |
| WR-25 | **Confirmed, WARNING with a note.** Confinement is opt-in on `openStore`, and the module's own stated threat model says an out-of-workspace store path is one of the three things nothing upstream validates. The three internal judging call sites are legitimate, which is what makes the fix shaped as the review proposes rather than as a hard requirement. |
| IN-06 | **Confirmed, INFO.** `retype`'s remainder inserts drop the reserved `bank` column — the same two lines CR-09 is filed against. Fix them together. |
| IN-07 | **Accepted, INFO.** A bad enum variant name is refused with a message naming the enum. |
| IN-08 | **Accepted, INFO.** `buildPaintIndex` accepts a row whose `id` collides with `NO_ROW`. |

### Decision Coverage

Non-blocking. `28-CONTEXT.md` is absent for this phase, so the decision-coverage
gate skips cleanly. `decision_coverage: { honored: 0, total: 0, not_honored: [] }`.

### Human Verification Required

#### 1. `openStore`'s `integrity_check could not be run at all` arm

**Test:** Fault-inject so `pragma integrity_check` itself throws inside
`openStore` — filesystem- or SQLite-level — rather than returning a non-`ok`
row. The non-`ok` row path is already covered by the truncated-mid-file test.
**Expected:** `AnnoStoreCorruptError` naming the path, connection closed,
nothing partial returned.
**Why human:** The arm is defensive and has no reachable input without fault
injection. Presence and wiring are verified in source (`anno-store.ts:465-468`)
plus a structural `assertInsideHandler` control, but nothing exercises the
throw. Carried forward unchanged from round 4, exactly as `28-REVIEW.md`'s
round-4 table records.

#### 2. The host-crash durability bound (28-17's `backstop` truth)

**Test:** Host-level crash or power-loss injection across the `stageSnapshot`
fsync → `publishSnapshot` rename → pointer-row commit sequence.
**Expected:** No surviving state in which a durable `anno_snapshot` pointer row
names a snapshot image whose bytes never reached disk; the only reachable
outcomes are a missing directory entry or a durable one.
**Why human:** An `fsync` has no in-process observable, so the only in-process
evidence is the SOURCE ORDER of two calls — presence, not behaviour. 28-17 filed
this honestly as a `backstop` truth rather than claiming it proven, and I have
abstained (`insufficient_spec`) rather than counting it verified. Both
`fsyncPath` calls exist and the guarded/unguarded asymmetry is the measured one.

### Gaps Summary

One gap, and it is narrow, specific and reproducible in six lines of caller
code: **`retype()`'s split-and-preserve writes a shape the store refuses.**

The fourth gap-closure round succeeded at what it was scoped to. CR-08 is closed
as a class by ordering rather than as an instance by a byte-pattern check, and I
verified that distinction by handing `revertTo` three *different* kinds of
unusable image, all of which now refuse identically with the live store
byte-identical and the caller's handle still alive. The `retained` promotion did
not become its own second destroyer. WR-13, WR-14, WR-16 and WR-17 are all
genuinely fixed, WR-15 is fixed with a residual hole in its replacement, and the
round's records — the disposition table and the two REQUIREMENTS.md corrections —
are honest, sourced, and correct.

What remains is a defect in a part of the store that four rounds of
revert-integrity work never looked at. The pattern is the same one every prior
round found: a validator honoured at the entry point and bypassed by an internal
writer, invisible because the suite proving that requirement never constructed
the input. Here the missing input is a split-table row in an overlap case —
`anno-overlap.test.ts` exercises five overlap shapes and not one of them uses any
of the four split members, while `anno-types.test.ts` exercises all four split
members and never overlaps them. Criterion 1's vocabulary and criterion 3's
split-and-preserve have simply never met.

A gap-closure round can act on this directly: pick one of the three defensible
remainder semantics (demote to `undefined`, refuse the retype by name, or return
the damaged tables as data in the shape `contradictedComments` already
established), enforce it inside `retype()` in the same transaction, report it to
the caller, add the split-table overlap cases with a planting, and add the
round-trip invariant — every row `listRanges()` returns must be re-acceptable at
the store's own entry point — that would have caught the class rather than this
instance. IN-06 lives on the same two lines and should go in the same edit.

Three record rows should move on this verdict: STORE-04 up to `Complete`, and
STORE-01 and STORE-03 down to `Gaps Found`.

---

_Verified: 2026-08-28T19:55:00Z_
_Verifier: Claude (gsd-verifier), round 5_
