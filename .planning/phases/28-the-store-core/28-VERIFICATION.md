---
phase: 28-the-store-core
verified: 2026-08-28T22:23:24Z
status: gaps_found
score: 11/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: # round 6, after the fifth gap-closure round (28-19, 28-20, 28-21, 28-22)
  previous_status: gaps_found
  previous_score: 11/12 # round 5; round 4 11/12, round 3 10/12, round 2 9/11, round 1 8/11
  gaps_closed:
    - >-
      CR-09 IS GENUINELY CLOSED, re-driven here through production entry points only.
      `setDataType($3000..$300f, "lo_hi_address")` then `setDataType($3004..$3004, "byte")` throws
      `AnnoSplitRemainderError` (in the `AnnoRangeShapeError` and `ViceError` families) naming the
      overlapped row's span and type, the 11-byte tail remainder, the side, and the two nearest legal
      caller boundaries — and the refusal costs nothing: `listRanges()` still returns exactly 1 row and the
      revision did not move. The gate is structural rather than instance-shaped: `retype()`'s pre-delete
      loop (`anno-store.ts:1979-1990`) asks `assertRangeShape()` ITSELF through `remainderRefusal()`
      (`:1855-1896`) rather than re-implementing the even-count rule, and it runs over every remainder of
      every overlapping row BEFORE the first `delete`. The round-5 verification's one `✗ NOT WIRED` key
      link — `retype()`'s remainder writer → `assertRangeShape()` — is WIRED.
    - >-
      Round 5's `coincidental_reliance_items` entry (truth 3 / WR-08) is CLOSED. Both shapes its evidence
      could not distinguish are now pinned BY VALUE in `anno-overlap.test.ts` — the union retype
      (`:872`, one row survives and NEITHER original id) and the same-type subrange (`:910`, one row
      fragments into three with every id churned) — and `retype()`'s doc comment records the collapse as
      INTENDED next to its STORE-02 reference (DECISION 2, `anno-store.ts:1941-1957`). The control can now
      tell "does not merge" from "was never asked to". Advisory cleared.
    - >-
      The round's four other routed WARNINGs are closed as written, each checked in source and three of
      them driven. WR-22: `assertRevisionArgument()` (`:2229`) is `revertTo`'s first statement (`:2252`).
      WR-24: the staging path is `${storePath}.revert-${process.pid}.${randomUUID()}.tmp` (`:2339`) and
      every cleanup routes through `discardSnapshot`. WR-25: workspace confinement is `openStore`'s
      DEFAULT — the guard is its first statement (`:425-433`) — with `unconfinedModuleDerivedPath: true`
      pinned to exactly 4 module-derived opens (`:695`, `:2388`, `:2520`, `:2559`), and the default was NOT
      bought by broadening (every confined open in my own drives succeeded). WR-18: `rollbackFailed` now
      has two production readers (`:1234`, `:2547`) and the fact rides on
      `AnnoStoreHandle.transactionStateUnknown` (`:325`), read at `runWriteSequence`'s first statement
      (`:1501`) and thrown in-family — a real production data flow where round 5 measured `⚠️ STATIC`.
      WR-19: `commitStatements()` (`anno-seam.test.ts:378-397`) tests statement contents inside `exec()`
      literals.
    - >-
      The round's three RECORD deliverables landed and are honest. `28-REVIEW.md` carries a round-5
      disposition table for all twelve ids; `.planning/REQUIREMENTS.md` moved STORE-04 to `Complete` while
      quoting the round-5 verifier's own authorising sentence, left STORE-01/STORE-03 at `Gaps Found`, and
      states in its own words that "This round is EXECUTED, not VERIFIED"; both `behavior_unverified` items
      are carried as explicit STILL-OPEN rows and are claimed closed by nothing.
  gaps_remaining: []
  regressions:
    - >-
      NONE from the four plans in the phase-scoped surface: 210/210 at `# fail 0 / # skipped 0` and a REAL
      exit code of 0 (`node --test anno-*.test.ts block-class.test.ts`, 13.3 s), and
      `./node_modules/.bin/tsc --noEmit` exits 0.
    - >-
      Regression gate outside the phase: 7 failures, all attributed and none a phase-28 code regression.
      Five are `r2000-session.test.ts` plan-18-06 cases failing with `R2000SpawnError` — I confirmed
      `command -v regenerator2000` is EMPTY on this host, so the cause is a genuinely absent external
      binary, environmental and pre-existing (the same five as round 5). The other two are the docs guards
      reddened by the code-review commit `0aff94d` minutes before this run:
      `docs-review-disposition.test.ts` (AUDIT-01) is 6/7 and its failure message names EXACTLY the nine
      new undispositioned ids and nothing else — `CR-10, IN-09, IN-10, IN-11, WR-26, WR-27, WR-28, WR-29,
      WR-30` — and `audit-integrity.test.ts` (D-12-02) is 43/44 cascading from it. Both go green when the
      nine ids are dispositioned; this report is a recognised disposition source
      (`docs-review-disposition.test.ts:281` accepts a phase's own `*-VERIFICATION.md`) and dispositions
      all nine below.
gaps:
  - truth: >-
      A partial overwrite splits and PRESERVES: the surviving region keeps an annotation whose MEANING is
      what it was (ROADMAP Phase 28 criterion 3's stated purpose, and the goal clause "owns the annotation
      state — ... per-range typing over the full 12-member vocabulary")
    status: failed
    reason: >-
      CR-10, INDEPENDENTLY REPRODUCED HERE through production entry points only — no hand-edited store, no
      test-only export, two `setDataType` calls — and BROADENED beyond the review's single case to five
      distinct overlap geometries.

      THE MECHANISM, read out of the source rather than argued. A split table's layout is
      first-half/second-half: `resolveSplitTargets` pairs `bytes[i]` with `bytes[n + i]`
      (`anno-types.ts:1345-1352`), so an entry's partner is a function of the ROW'S START AND THE ROW'S
      LENGTH, and any change to either end re-pairs EVERY entry. `assertRangeShape()` knows exactly one
      rule about split tables — the byte count must be even (`anno-types.ts:784-789`). CR-09's gate asks
      that one rule about each remainder (`anno-store.ts:1979-1990` via `remainderRefusal()`). So it
      refuses the ODD fragment and ACCEPTS EVERY EVEN ONE — including every even fragment that destroys the
      pairing. The gate refuses the loud case and admits every silent one, which inverts the module's own
      stated priority.

      MY DRIVE, verbatim, on a 16-byte `lo_hi_address` table at `$1000..$100f` seeded through
      `setDataType`, with the byte image `00 01 02 ... 0f` resolved through the module's own
      `resolveSplitTargets` before and after. ORIGINAL 8 targets:
      `$0800 $0901 $0a02 $0b03 $0c04 $0d05 $0e06 $0f07`.

        mid EVEN fragment  setDataType($1004..$1007, byte)          -> ACCEPTED changed=true contradicted=0
                           2 surviving split rows, targets $0200 $0301 $0c08 $0d09 $0e0a $0f0b  -> preserved 0/8
        head-overlap       setDataType($0ffe..$1003, byte)          -> ACCEPTED changed=true contradicted=0
                           1 surviving split row,  targets $0a04 $0b05 $0c06 $0d07 $0e08 $0f09  -> preserved 0/8
        tail-overlap       setDataType($100c..$1011, byte)          -> ACCEPTED changed=true contradicted=0
                           1 surviving split row,  targets $0600 $0701 $0802 $0903 $0a04 $0b05  -> preserved 0/8
        midpoint split     setDataType($1008..$100f, byte)          -> ACCEPTED changed=true contradicted=0
                           1 surviving split row,  targets $0400 $0501 $0602 $0703             -> preserved 0/8
        SAME-TYPE subrange setDataType($1004..$1007, lo_hi_address) -> ACCEPTED changed=true contradicted=0
                           3 surviving split rows, targets $0200 $0301 $0604 $0705 $0c08 $0d09 $0e0a $0f0b -> preserved 0/8
        odd fragment       setDataType($1004..$1004, byte)          -> REFUSED AnnoSplitRemainderError
        full cover         setDataType($1000..$100f, byte)          -> ACCEPTED, 0 split rows (CORRECT — no preservation claimed)

      FIVE accepted geometries, `preserved 0/8` in every one. Not one recorded 16-bit target survives any
      of them. `changed: true`, `contradictedComments: []`, no diagnostic, no refusal, and no field
      anywhere recording that the table was ever 16 bytes wide. The SAME-TYPE subrange case is the sharpest:
      the caller asked for `lo_hi_address` over a sub-range of a `lo_hi_address` table and got three tables
      none of whose eight targets is one of the original eight.

      STRICTLY WORSE THAN CR-09, WHICH THIS PHASE TREATED AS BLOCKING FOR A FULL ROUND. CR-09 produced an
      11-byte row `resolveSplitTargets()` REFUSES — loud, detectable, recoverable. CR-10 produces rows that
      are re-acceptable at `setDataType`, decode happily, and return plausible WRONG 16-bit values. A
      refusal is recoverable; a plausible wrong answer is not.

      THE MODULE'S OWN COMMENT CONDEMNS ITS OWN BEHAVIOUR, two lines above the code. `retype()`'s DECISION
      1 (`anno-store.ts:1920-1932`) rejects demoting an illegal remainder "because it destroys the recorded
      split ORIENTATION, which this module's own header calls the one irreversible decision in this area
      with no field to migrate -- a one-way data decision taken silently on the caller's behalf". The
      accepted path takes exactly that decision, silently, on the caller's behalf. That is two contradictory
      readings of one rule in the same function.

      THE SUITE CERTIFIES THE DEFECT — which is why 210 green tests are blind to it, exactly as 169 were
      blind to CR-09. `anno-overlap.test.ts:592` ("the LEGAL remainder case on the same split row") asserts
      BY VALUE the three-row set my first drive produced and calls it legal. Four steps of the round-trip
      invariant's `SEQUENCE` (`:1170-1180`) are annotated "both even" and marked `expect: "accepted"`. And
      the invariant itself (`:1190`) asks only that every row be re-acceptable and decodable —
      DECODABILITY IS NOT PRESERVATION: a re-paired table decodes perfectly.

      WHICH CRITERIA THIS DOES AND DOES NOT FALSIFY, stated plainly because the attribution is the point.
      Criterion 1 HOLDS as written and CR-10 does not touch it: the vocabulary is exactly 12 members
      (driven — an invalid name is refused with the full list), the four split layouts are first-class, and
      the differing-resolved-target-set control with its collapse planting is green in my own 210/210 run.
      Criterion 3's THREE NAMED CLAUSES also hold: total typed bytes are unchanged (16 -> 4 + 4 + 8), the
      `filter()`-and-insert planting still reddens the fully-contained case, and the contradicted-comment
      rule still returns comments as data. What is FALSE is criterion 3's own stated PURPOSE — "Silently
      un-documenting a previously annotated region is the exact failure the store exists to prevent." For
      the four split members an ordinary partial overwrite leaves the surviving region annotated with a
      meaning it does not have, silently. A region documented WRONG is worse than one documented not at
      all, and the store is the one component that was supposed to make that impossible. STORE-03's third
      clause — "the behaviour when a typed range is partially overwritten [is] pinned" — is pinned, and
      pinned to the corrupting outcome.

      NOT DEFERRABLE, checked against every later phase of the milestone. No later phase's goal or success
      criteria mention split remainders, retype shape, or overlap semantics. Phase 29 puts `set_data_type`
      and `list_ranges` on an agent-driven tool path where, per `anno-types.ts`'s own header, the proxy's
      `validate: (value) => ({ value })` means arguments arrive unvalidated — it amplifies this. Phase 30
      reads these rows to emit ACME source, and its oracle CANNOT SEE THIS: Phase 30 criterion 1 settles
      every verdict by "a byte-diff against the input", and CR-10 changes no bytes — it changes which two
      bytes the store says are one 16-bit target. That is precisely the "it reassembles clean" assertion
      ROADMAP criterion 1 already rules out as a control for orientation, so the milestone's strongest
      downstream oracle is structurally blind to this class.

      NOT AN EDGE CASE. Every input is ordinary annotation work — correcting a few bytes inside a table, or
      trimming a table you typed one entry too wide — and the split-and-preserve path exists for exactly
      that.
    artifacts:
      - path: "src/mcp/vice/anno-store.ts"
        issue: >-
          `retype()`'s gate (`:1979-1990`) asks only `assertRangeShape()`, whose sole split rule is byte-count
          parity, so every EVEN fragment of a split row passes and the remainder inserts at `:1995` and
          `:1998` carry `row.data_type` forward onto a span whose entry pairing is now different. Nothing on
          any path reports it: the call returns `changed: true` with an empty `contradictedComments`.
      - path: "src/mcp/vice/anno-overlap.test.ts"
        issue: >-
          `:592` pins the corrupted three-row set BY VALUE and names it "the LEGAL remainder case"; four
          `SEQUENCE` steps at `:1170-1180` are annotated "both even" with `expect: "accepted"`; and the
          round-trip invariant at `:1190` asserts re-acceptability and decodability, neither of which a
          re-paired table violates. No control in the suite can go red on this class, and the control
          closest to it certifies it.
    missing:
      - >-
        Decide and enforce the SPLIT-ROW FRAGMENTATION rule inside `retype()`, in the same pre-delete gate
        CR-09 added and reusing `AnnoSplitRemainderError`. Two defensible answers, and the parity check
        stays under either (removing it would drop CR-09's control): (a) REFUSE any partial overlap of a
        split row outright — there is no interior boundary at which first-half/second-half halves survive,
        the midpoint included, as my midpoint drive shows; the cost is that a split table becomes editable
        only wholesale, and the refusal must say so and name the remedy. (b) Return the re-interpreted
        tables AS DATA, the pattern this module already established for `contradictedComments` and the one
        criterion 3's own reasoning favours — the caller keeps the ability to make the edit and is told,
        with both target sets, what it cost. Forbidden either way: rounding the caller's range outward to
        an entry boundary (`anno-types.ts` trap 7), and demoting the remainder to `undefined` (DECISION 1).
      - >-
        Whichever answer is chosen, REPORT IT. Today the call is silent, and silence is the failure
        criterion 3 names as the one the store exists to prevent.
      - >-
        REWRITE THE TESTS THAT CERTIFY THE DEFECT — this part is required under either answer.
        `anno-overlap.test.ts:592` must assert the chosen outcome instead of the corrupted row set; the four
        "both even" `SEQUENCE` steps and their `expect` values must be re-derived; and the `refusals >= 3`
        non-vacuity floor rises with them.
      - >-
        Add the assertion that can SEE this class, which no existing control can: `resolveSplitTargets()`
        over the row's byte span BEFORE and AFTER, asserting that every target a surviving split row
        reports is a target the original table reported. Decodability is not preservation; only a
        target-set comparison distinguishes them. Assert it across all five accepted geometries, not one.
deferred: []
behavior_unverified_items:
  - truth: >-
      `openStore`'s `integrity_check could not be run at all` arm refuses in-family (now
      `anno-store.ts:529-535`; round 5 cited `:465-468`, round 4 `:432` — the arm moves every round and is
      unchanged in substance). CARRIED FORWARD UNCHANGED for a third round — recorded still-open by 28-22
      and claimed closed by nothing.
    test: >-
      Fault-inject so `pragma integrity_check` itself THROWS rather than returning a non-`ok` row (the
      non-`ok` row path at `:536-539` is already covered by the truncated-mid-file test in
      `anno-store.test.ts`)
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection.
      Presence and wiring verified in source this round (`db.close()` precedes the throw, and the message
      names `resolved`); no test exercises the throw, and a 10-second spot-check cannot construct the
      precondition.
  - truth: >-
      28-17's `backstop`-tagged truth: after an interruption between `vacuum into` and the pointer row's
      commit, the reachable outcomes are bounded to two, both non-destructive — a missing directory entry
      (an orphan ROW, made inert by 28-13) or an entry whose contents ARE durable. ABSTAINED again, per the
      backstop-abstention contract: `insufficient_spec`.
    test: >-
      Host-level crash or power-loss injection (or an equivalent fs-level fault harness) across the
      `stageSnapshot` fsync / `publishSnapshot` rename / pointer-row commit sequence, confirming no
      surviving pointer row names a file whose bytes did not reach disk
    expected: "No reachable post-crash state in which a durable pointer row names a non-durable image"
    why_human: >-
      An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two
      `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop`.
      Presence + wiring never qualify as behavioural evidence for a durability claim.
coincidental_reliance_items: []
round_6_review_dispositions: # every id opened by 28-REVIEW.md round 6, judged on my own evidence
  - id: CR-10
    severity_reviewer: BLOCKER
    verdict: CONFIRMED — BLOCKER, and broadened
    disposition: gap-closure round 6
    evidence: >-
      Reproduced through production entry points and extended from the review's one geometry to FIVE, each
      preserving 0 of 8 recorded targets. See the `gaps` entry above. The review's severity argument holds
      on my own evidence, and one of its three legs is strengthened: Phase 30's byte-diff oracle is
      structurally blind to this class, so the milestone's strongest downstream check cannot catch it later.
  - id: WR-26
    severity_reviewer: WARNING
    verdict: CONFIRMED on the facts, severity moderated
    disposition: fold into round 6 (cheap, same file) or accept with the reason recorded
    evidence: >-
      `handle.transactionStateUnknown = true` is set at exactly one site (`anno-store.ts:1782`, after
      `pruneSnapshots`). The other three sites that compute `rolledBack === false` (`:1123`, `:1610`,
      `:1722`) do not set it. MODERATING FACT the review does not weigh: two of those three THROW an
      in-family `AnnoStoreError` whose prose and whose `data.rolledBack` both say CLOSE IT AND REOPEN, so
      the caller is told; prohibition 28-20 P1 ("MUST NOT return a handle whose transaction state the
      function cannot vouch for") is therefore held on its letter. The residual is real but narrower than
      stated: a caller that CATCHES and continues keeps an unmarked handle that `runWriteSequence`'s
      `:1501` guard will not stop.
  - id: WR-27
    severity_reviewer: WARNING
    verdict: CONFIRMED — I ran it
    disposition: fold into round 6 or accept
    evidence: >-
      Verified against `node:sqlite` in a scratch process, not argued: after `begin immediate` +
      `prepare("commit").run()`, a fresh `begin immediate` SUCCEEDS and the row is present — a fully
      working commit. `commitStatements()` looks only inside `exec()` literals, so it counts that spelling
      as 0. Control-completeness gap, not a live defect: the module has exactly one commit site today and
      the control is green for the right reason.
  - id: WR-28
    severity_reviewer: WARNING
    verdict: CONFIRMED
    disposition: accept with the reason recorded, or carry to Phase 29
    evidence: >-
      `grep "delete from anno_" anno-store.ts` returns exactly two hits (`:1250` `anno_snapshot`, `:1993`
      `anno_range`) and the only scope verbs are `addScope` (`:2761`) and `listScopes` (`:2812`). So
      28-21's new overlap refusal has no inverse. Safe-direction (nothing is destroyed) and reversible
      inside the 32-revision ring, but round 5 converted a permissive bug into a permanent block, and
      Phase 29 puts `addScope` on an agent-driven surface where a mistyped span is likelier.
  - id: WR-29
    severity_reviewer: WARNING
    verdict: CONFIRMED
    disposition: fold into round 6 (a comment move, no behaviour)
    evidence: >-
      Read in source: `revertTo`'s contract block runs `anno-store.ts:2166-2209` and is immediately
      followed by `assertRevisionArgument`'s own doc block at `:2210-2228` and then the private function at
      `:2229`; `revertTo` itself is at `:2247`. The contract is not false, it is detached from the function
      it documents — a real defect in a module whose whole convention is documentation-as-code.
  - id: WR-30
    severity_reviewer: WARNING
    verdict: CONFIRMED
    disposition: fold into round 6 (a doc line)
    evidence: >-
      `export function pruneSnapshots(handle): boolean` (`:1191`); its doc block (`:1160-1190`) documents
      the bound, the transaction and the latency, and says nothing about what the boolean means. The only
      translator is the in-module caller at `:1782`.
  - id: IN-09
    severity_reviewer: WARNING (informational tier)
    verdict: CONFIRMED
    disposition: accept
    evidence: >-
      `AnnoSplitRemainderError`'s constructor passes `options.start` / `options.endInclusive` to `super`
      (`anno-types.ts:582`), and `remainderRefusal` binds those to `remainderStart` / `remainderEndInclusive`
      (`anno-store.ts:1888-1889`). So the inherited fields carry the REMAINDER where every other family
      member carries the caller's range. Cosmetic while the dedicated fields exist alongside.
  - id: IN-10
    severity_reviewer: WARNING (informational tier)
    verdict: ACCEPTED as reported, not independently re-driven
    disposition: accept
    evidence: >-
      `remainderRefusal`'s "nearest legal boundary" advice is computed from the single row it was called
      about (`anno-store.ts:1873-1878`), and the gate loops over every overlapping row, so with two
      overlapped rows the advice can name a value the other would refuse. Structurally evident from the
      per-row call; low impact because the whole retype is refused either way and the caller re-drives.
  - id: IN-11
    severity_reviewer: WARNING (informational tier)
    verdict: CONFIRMED
    disposition: accept, or fold the one-line regex into round 6
    evidence: >-
      `ESCAPE_AT_A_CALL_SITE` is the exact substring `"unconfinedModuleDerivedPath: true"` counted by
      `split().length - 1` against `ENUMERATED_DERIVED_OPENS = 4` (`anno-seam.test.ts:639, 649, 661-668`).
      The repo has no formatter config, so a fifth escape spelled without the space keeps the count at 4.
      The cross-module scan at `:671` is spelling-independent, so only additional sites INSIDE the seam can
      evade.
prohibition_flags: # judgment-tier; NON-AUTHORITATIVE LLM-judge verdicts — human review recommended
  - statement: >-
      28-19 P1 (NEW round 5) — MUST NOT let the store persist, by ANY writer, a range row it would refuse
      at its own entry point.
    verdict: held
    flagged: true
    reason: >-
      HELD, and held as a writer-level rule: the gate asks `assertRangeShape()` itself, and the round-trip
      invariant states the property class-wide. Every row my five accepted-geometry drives produced is
      re-acceptable at `setDataType`. RECORDED PLAINLY BECAUSE IT MATTERS: this prohibition is fully
      satisfied WHILE CR-10 is open. It was written to CR-09's shape — shape, not meaning — and a rule about
      shape cannot see a defect about pairing.
  - statement: >-
      28-19 P2 (NEW round 5) — MUST NOT resolve the remainder question by silently substituting a type, a
      boundary or a default.
    verdict: violated
    flagged: true
    reason: >-
      VIOLATED, on my own drive. No TYPE is substituted — the token is carried forward — but the table's
      EXTENT is silently changed from 16 bytes to 4 and 8, and extent is what determines every entry's
      partner under a first-half/second-half layout. The result is a one-way data decision taken silently
      on the caller's behalf, which is the exact thing `retype()`'s DECISION 1 comment says it refuses to
      do. Judgment-tier and non-authoritative: a human may reasonably read "boundary" narrowly as the
      CALLER's boundary, which is untouched.
  - statement: >-
      28-20 P1 (NEW round 5) — MUST NOT return a handle whose transaction state the function cannot vouch
      for.
    verdict: held
    flagged: true
    reason: >-
      HELD on its letter. `revertTo` step 6 reads `reconcileSnapshotRing(restored).rollbackFailed`
      (`:2547`) and reopens rather than handing the connection back, and `pruneSnapshots` returns the fact
      (`:1234`) so `runWriteSequence` can mark the handle (`:1782`) and refuse the next write (`:1501`).
      The three sites WR-26 names all throw rather than return, so no handle is returned unvouched-for.
      Residual carried as WR-26.
  - statement: >-
      28-21 P1 (NEW round 5) — MUST NOT leave two contradictory readings of the same rule in the tree.
    verdict: violated
    flagged: true
    reason: >-
      VIOLATED, and by the round's own tracer plan rather than by 28-21. `retype()`'s DECISION 1 comment
      (`:1920-1932`) states that destroying the recorded split orientation silently on the caller's behalf
      is forbidden; the code sixty lines below does exactly that on every even geometry. The comment and
      the code are two contradictory readings of one rule, in one function. WR-29's displaced `revertTo`
      contract is a second, milder instance in the same module. Judgment-tier and non-authoritative.
  - statement: >-
      28-21 P2 (NEW round 5) — MUST NOT make the safety-critical option the one a caller has to remember.
    verdict: held
    flagged: true
    reason: >-
      HELD, and inverted in the right direction. Confinement is `openStore`'s DEFAULT and its guard is the
      function's first statement (`:425-433`), before `resolve()` and before `new DatabaseSync`; the escape
      is explicit, greppable and pinned to four enumerated module-derived opens. Verified not bought by
      broadening: every legitimate confined open in my own drives succeeded, and `anno-confinement.test.ts`
      is green in the 210-test run. IN-11's spelling-sensitivity of the pin is the only residual.
  - statement: >-
      28-22 P1 (NEW round 5) — MUST NOT premise a task, or an acceptance criterion, on a guard being RED.
    verdict: held
    flagged: true
    reason: >-
      HELD. Both guards were green at plan time and no plan in the round is premised on a red guard. They
      are red NOW only because the code-review commit `0aff94d` landed nine new ids minutes before this
      run, which is the guard working exactly as designed — and this report dispositions all nine.
  - statement: >-
      28-19 P-carried / 28-11 P5 — MUST NOT convert a committed write into a caller-visible failure.
    verdict: held
    flagged: true
    reason: >-
      HELD. Every CR-09 refusal I drove is raised BEFORE the first delete, so `listRanges()` is
      byte-identical and the revision does not move — nothing that landed is reported as a failure. The
      `transactionStateUnknown` path likewise refuses the NEXT write and states in its own message that
      "the write that produced this state COMMITTED".
  - statement: >-
      28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted.
    verdict: held
    flagged: true
    reason: >-
      HELD, and extended this round. The new `AnnoSplitRemainderError` names the overlapped row's id, its
      span in decimal AND hex, its type, the remainder's span and byte count, the side, and the two nearest
      legal caller boundaries. `AnnoRevisionArgumentError` names the offending value verbatim and what was
      expected. CR-10 introduces no false message — its defect is SILENCE, which is why it is filed as the
      gap and not here.
  - statement: >-
      28-10 P4 — MUST NOT change the meaning of an on-disk column or of the on-disk directory layout
      without a schema version bump that makes the older shape refuse BY NAME.
    verdict: held
    flagged: true
    reason: "`SCHEMA_VERSION` is still 2 (`anno-types.ts:154`), the DDL is unchanged, and no on-disk shape moved this round."
  - statement: >-
      28-07 P3 — MUST NOT leave in place, or introduce, a comment or a user-facing message that asserts a
      guarantee the code does not provide.
    verdict: violated
    flagged: true
    reason: >-
      VIOLATED this round, and the instance is the same one as 28-21 P1: `retype()`'s DECISION 1 comment
      asserts a guarantee ("a one-way data decision taken silently on the caller's behalf" is refused) that
      the same function does not provide on the even path. WR-29 adds a second, milder instance. Recorded
      separately from 28-21 P1 because they are different prohibitions from different plans landing on the
      same two comments. Judgment-tier and non-authoritative.
  - statement: >-
      28-17 P4 — MUST NOT let a test report a PASS for a precondition it could not construct.
    verdict: held
    flagged: true
    reason: >-
      HELD on regression: the 210-test run reports `# skipped 0`, both root-sensitive controls still use
      node:test's real `{ skip: … }` declaration form, and `grep -rn "SKIPPED as root"` over the anno tests
      returns nothing.
  - statement: >-
      28-09 P1 / 28-12 P1 / 28-12 P2 — MUST NOT silently redirect a path the confinement rejects, and MUST
      NOT make a confinement control pass by broadening its refusal.
    verdict: held
    flagged: true
    reason: >-
      HELD, and re-tested against the NEW default. `anno-confinement.test.ts` is green inside the 210-test
      run, and every legitimate confined `openStore({ workspaceRoot })` in my own drives succeeded — so
      making confinement the default did not buy the refusals by broadening them.
  - statement: >-
      28-07 P1 / 28-10 P1 / 28-11 P1 — MUST NOT destroy the only remaining route back to a state the store
      still advertises as reachable.
    verdict: held
    flagged: true
    reason: >-
      HELD on regression, re-driven. With a 0-byte `r1.db` planted in the ring of a store at revision 3:
      `retainedRevisions()` reports `[0, 2]`, `oldestRetainedRevision()` reports 0, `revertTo(handle, 1)`
      throws an `AnnoStoreError` naming both paths and quoting the underlying reason, the live store is
      69632 -> 69632 bytes, and the SAME handle still answers `currentRevision() === 3` with 3 rows.
  - statement: >-
      28-18 P2 — MUST NOT move a requirement's status on an executor's own judgement of its own work.
    verdict: held
    flagged: true
    reason: >-
      HELD. `.planning/REQUIREMENTS.md`'s STORE-04 move quotes the round-5 verifier's authorising sentence
      verbatim and names the source file and table, and the same section states in its own words that "This
      round is EXECUTED, not VERIFIED, and STORE-01 and STORE-03 move only when a verification pass says
      so."
  - statement: >-
      28-18 P3 — MUST NOT close, silently drop, or re-file as done a carried-forward `behavior_unverified`
      item.
    verdict: held
    flagged: true
    reason: >-
      HELD. Both items are recorded STILL-OPEN in `.planning/REQUIREMENTS.md` and in `28-REVIEW.md`'s
      round-5 disposition section, no plan in the round claims either, and I have carried both forward again.
human_verification:
  - test: >-
      Fault-inject so `pragma integrity_check` itself throws inside `openStore` (filesystem- or
      SQLite-level), rather than returning a non-`ok` row
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      Defensive arm with no reachable input without fault injection; presence and wiring verified in source
      (`anno-store.ts:529-535`), but nothing exercises the throw. Carried forward unchanged from rounds 4
      and 5.
  - test: >-
      Host-level crash / power-loss injection across the `stageSnapshot` fsync -> `publishSnapshot` rename
      -> pointer-row commit sequence
    expected: >-
      No surviving state in which a durable `anno_snapshot` pointer row names a snapshot image whose bytes
      never reached disk; the only reachable outcomes are a missing directory entry or a durable one
    why_human: >-
      `fsync` has no in-process observable, so the only in-process evidence is the source order of two
      calls. Filed by 28-17 as a `backstop` truth; the abstention (`insufficient_spec`) is recorded rather
      than scored.
---

# Phase 28: The Store Core Verification Report

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-28T22:23:24Z
**Status:** gaps_found
**Re-verification:** Yes — round 6, after the fifth gap-closure round (28-19, 28-20, 28-21, 28-22)

## Goal Achievement

**The fifth gap-closure round did what it was scoped to do.** All seven of its
code claims reproduce through production entry points on my own drives, not off
the SUMMARYs: CR-09 is genuinely closed and closed structurally (the gate asks
`assertRangeShape()` ITSELF, so a rule added there later applies to the store's
own writer for free), WR-18's `rollbackFailed` now reaches a production throw
where round 5 measured `⚠️ STATIC`, WR-22 validates eight bad revision values at
`revertTo`'s first statement, WR-24 is per-attempt, WR-21 gives `addScope`
idempotence and a nesting refusal, WR-25 makes confinement the DEFAULT with the
escape pinned to four enumerated sites, and WR-19's matcher tests statement
contents. Round 5's `coincidental_reliance_items` advisory is closed outright:
the union-retype and same-type-subrange shapes are now pinned by value and
`retype()`'s DECISION 2 states that the collapse is intended. The record
deliverables landed and are honest — including `.planning/REQUIREMENTS.md`
saying in its own words that the round is "EXECUTED, not VERIFIED".

**The phase still fails, on one new blocker in the same clause of the same
goal.** CR-10: `retype()`'s new remainder gate checks byte-count PARITY and
nothing else, but a split table's layout is first-half/second-half, so the byte
that partners entry `i` is determined by the row's start and its length. The
gate refuses the odd fragment — the loud one — and accepts every even one. I
drove five distinct accepted geometries against a 16-byte `lo_hi_address` table
and **every one preserved 0 of the 8 recorded targets**, with `changed: true`,
an empty `contradictedComments`, and no diagnostic of any kind. This is strictly
worse than the CR-09 it replaced: CR-09 produced a row `resolveSplitTargets()`
refuses; CR-10 produces rows that decode happily and return plausible wrong
16-bit values.

**On attribution, and I am deliberate about it because round 5 was and the
precision matters.** CR-10 falsifies **no named clause of any of the five
ROADMAP success criteria**. Criterion 1's vocabulary is twelve, its four split
layouts are first-class, and its differing-resolved-target-set control and
collapse planting are green. Criterion 3's three measured clauses all hold:
total typed bytes are unchanged (16 -> 4 + 4 + 8), the `filter()`-and-insert
planting still reddens the fully-contained case, and contradicted comments still
come back as data. What is false is **criterion 3's own stated purpose** —
*"Silently un-documenting a previously annotated region is the exact failure the
store exists to prevent"* — and with it the goal clause *"owns the annotation
state — ... per-range typing over the full 12-member vocabulary"*. That is the
same attribution round 5 made for CR-09, at the same site, for a worse instance.

**And the reason it survived six rounds is the same reason CR-09 survived five:
the suite certifies it.** `anno-overlap.test.ts:592` pins the corrupted row set
BY VALUE and calls it "the LEGAL remainder case"; four `SEQUENCE` steps are
annotated "both even" and marked accepted; and the round-trip invariant asks
only for re-acceptability and decodability. **Decodability is not preservation.**
A re-paired table decodes perfectly. 210 green tests are blind to this class in
exactly the way 169 were blind to CR-09.

### 1. The FIVE ROADMAP Success Criteria — the phase contract

| # | Criterion | Named clauses | Stated purpose | Verdict |
|---|-----------|---------------|----------------|---------|
| SC-1 | Full 12-member vocabulary, four split layouts first-class, proven by a differing-resolved-target-set control with a collapse planting | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle, tie-break/ends/`$FFFF`/length-1 pinned; ranges never merged on adjacency | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-3 | A partial overwrite splits and preserves; contradicted comments as data | ✓ HOLD (all three) | ✗ **FALSIFIED** | **FALSIFIED — purpose only** |
| SC-4 | ONE combined `SIGKILL` durability+revert test with its planting observed; truncated file refused | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-5 | Schema version, reserved uninterpreted `bank`, xref access kind, cross-process stale-base refusal, one `node:sqlite` seam | ✓ HOLD | ✓ HOLD | **VERIFIED** |

**Goal-text clauses, separately:** *durable across a `SIGKILL`* — TRUE.
*revertible* — TRUE (re-driven this round; see truth 12). *reachable through
exactly one persistence seam* — TRUE. *the milestone's one irreversible decision
lands here* — TRUE (`SCHEMA_VERSION = 2` with the twelve-member vocabulary and
the four split layouts frozen on disk). *scopes and project enums* — held, with
WR-28 as a recoverability warning. *owns the annotation state — per-range typing
over the full 12-member vocabulary* — **FALSE for the four split members** under
ordinary partial overwrite.

### 2. Named clauses versus stated purpose — the distinction, applied

CR-10 does **not** falsify:

- **SC-1, any clause.** The vocabulary is exactly twelve — driven: an invalid
  type name is refused with the full list `code, byte, word, address, petscii,
  screencode, lo_hi_address, hi_lo_address, lo_hi_word, hi_lo_word,
  external_file, undefined`. The orientation control and its collapse planting
  are green. CR-10 never changes a recorded orientation TOKEN; it changes the
  row's EXTENT, which is a different fact.
- **SC-3's three measured clauses.** Total typed bytes unchanged: 16 -> 4 + 4 +
  8 in my drive. The `filter()`-and-insert planting still reddens the
  fully-contained case. The contradicted-comment rule still returns comments as
  data with its own planting.
- **SC-2, SC-4, SC-5** in any respect — none of them touches split-row extents.

CR-10 **does** falsify:

- **SC-3's stated purpose**, the sentence the three clauses exist to serve. For
  the four split members an ordinary edit leaves a region annotated with a
  meaning it does not have, and says nothing. A region documented *wrong* is a
  worse outcome than one documented not at all — CR-09 at least threw.
- **The goal's "owns the annotation state ... per-range typing" clause**, for
  the four split members.
- **STORE-03's third clause** — "the behaviour when a typed range is partially
  overwritten" is pinned, and pinned to the corrupting outcome.

**STORE-01 is a change from round 5 and I state the reason.** Round 5 blocked
STORE-01 on CR-09 with the stated reason "the store persists a per-range typing
it refuses at its own entry point and its own resolver cannot decode." Neither
half of that sentence is true any longer: every row CR-10 produces is
re-acceptable and decodable. CR-10 attaches to the partial-overwrite clause,
which is STORE-03's, not STORE-01's. **STORE-01 is SATISFIED and its row may
move to `Complete`; this is the authorising verdict.** STORE-03 stays
`Gaps Found`.

### Observable Truths

The truth set is **carried forward unchanged from round 5** — twelve truths, not
re-derived and deliberately not expanded from the four round-5 plans' own
frontmatter. See §3 for the denominator.

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Full 12-member vocabulary, four split layouts first-class | SC-1 | ✓ VERIFIED | Driven: `setDataType(..., "table")` throws `AnnoTypeError` listing exactly 12 names. Orientation control + collapse planting green in my own 210/210 run. |
| 2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle | SC-2 | ✓ VERIFIED | `anno-index.test.ts` green in the 210-test run: oracle cross-validation, the "oracle shares no code path" control, the equal-length tie-break, `$FFFF`, length-1. |
| 3 | Ranges stored as ranges, never merged on adjacency, no splitter primitive | SC-2 | ✓ VERIFIED | Re-driven: two adjacent `byte` ranges written by two calls stay two rows with distinct ids (`id 1 $2000-$2007`, `id 2 $2008-$200f`). **Round 5's coincidental-reliance advisory is CLEARED** — the union retype (`anno-overlap.test.ts:872`) and same-type subrange (`:910`) are now pinned by value, and DECISION 2 records the collapse as intended. |
| 4 | **A partial overwrite splits and PRESERVES — the surviving region keeps an annotation whose meaning is what it was** | SC-3 | ✗ FAILED | **CR-10, independently reproduced and broadened to five geometries, `preserved 0/8` targets in each.** See the `gaps` entry. |
| 5 | Combined SIGKILL durability+revert test, and removing the commit reddens it | SC-4 | ✓ VERIFIED | Ran `anno-durability.test.ts` on its own: 5/5. `ok 1` is the combined test; `ok 2` is the live planting in a real subprocess asserting `readBackByValue === false` AND `revertReturnsPriorValue === false`. |
| 6 | A truncated/zero-length store FILE is refused at open, never returned partial | SC-4 | ✓ VERIFIED | `openStore` checks `anno_meta`, `schema_version` and `pragma integrity_check` (`anno-store.ts:492-539`); refusal tests green. Independently: my planted 0-byte snapshot is refused through the same path with the message quoted below. |
| 7 | Schema version + reserved uninterpreted `bank` + xref access kind | SC-5 | ✓ VERIFIED | Read the DDL myself: `anno_meta.schema_version integer not null` (`:233`), `bank integer` on `anno_range`/`anno_label`/`anno_comment`/`anno_xref` (`:242,:250,:258,:280`), `access_kind text not null` (`:279`). `SCHEMA_VERSION = 2`. |
| 8 | Stale-base write refused, observed from a second OS process | SC-5 | ✓ VERIFIED | `anno-durability.test.ts` `ok 5` (CR-06, a separate OS process holding a read transaction) and the `execFileSync` mutator test green. |
| 9 | `node:sqlite` reachable from exactly one shipped module | SC-5, STORE-07 | ✓ VERIFIED | Repo-wide grep over `.ts`/`.mts`/`.mjs` excluding tests: the only CODE reference is `anno-store.ts:132`; every other hit is a comment. `anno-durability-mutator.mjs` is absent from `package.json` `files[]` (which carries `anno-types.ts`, `anno-index.ts`, `anno-store.ts`, `block-class.ts` and no mutator). |
| 10 | The census boundary accepts the store's lowercase vocabulary | plan-derived (28-03) | ✓ VERIFIED | `block-class.test.ts` green in the 210-test run, including the module-level-mutable-binding and `files[]` structural pins (`ok 209`, `ok 210`). |
| 11 | An accepted write and its housekeeping cannot leave the connection in an open transaction, and everything thrown stays in the ViceError family | plan-derived (28-11/28-14/28-17) | ✓ VERIFIED | Regression: `anno-store.test.ts` green in the 210 run. Strengthened this round — the leaked-transaction fact now has a production path (`:1234` → `:1782` → `:1501`) that refuses the NEXT write in-family, where round 5 measured it reaching a test assertion only. WR-26 is a completeness residual on three sites that throw rather than return. |
| 12 | **At the goal level the store is REVERTIBLE — a revert can return prior state and can never destroy it** | goal text | ✓ VERIFIED | **Re-driven this round, not carried on round 5's word.** Ring at revision 3, `r1.db` overwritten with 0 bytes: `retainedRevisions()` → `[0, 2]`, `oldestRetainedRevision()` → 0, `revertTo(h, 1)` throws `AnnoStoreError` naming BOTH paths and quoting the reason (`"not a readable annotation store (no such table: anno_meta)"`), live store **69632 → 69632**, the same handle still answers `rev 3` with 3 rows. |

**Score:** **11/12 truths verified.** Two evidence-gap items are reported
separately and counted neither way (the `integrity_check` throw arm,
present-behaviour-unverified; and 28-17's host-crash durability bound, abstained
as `insufficient_spec`).

### 3. The denominator, explained

Twelve truths, and I did **not** grow the denominator on this round's own plan
frontmatter. 28-19..28-22 declare roughly thirty plan-level truths between them;
every one of them is a closure claim for a named review finding, and I verify
them as *"did the round deliver what it claimed"* (§ Round-5 Delivery below)
rather than promoting them to phase must-haves. The twelve are:

| Kind | Count | Which |
|------|-------|-------|
| ROADMAP success criteria | **9** | truths 1 (SC-1), 2 and 3 (SC-2), 4 (SC-3), 5 and 6 (SC-4), 7, 8 and 9 (SC-5) |
| ROADMAP goal text, not a numbered SC | **1** | truth 12 (the "revertible" clause) |
| Plan-derived, carried since earlier rounds | **2** | truth 10 (28-03's census boundary), truth 11 (the transaction/error-family invariant) |

**The single failing truth is a ROADMAP-derived one (SC-3), not a plan-derived
one.** This round's gap is not denominator inflation: CR-10 was found by
attacking criterion 3's purpose, and it would be a gap under a denominator of
nine.

### Round-5 Delivery — did the round do what it claimed?

Verified independently; SUMMARY claims were not the evidence.

| Claim | Status | Evidence |
|---|---|---|
| 28-19: CR-09 closed by a pre-delete remainder gate over every remainder of every overlapping row | ✓ DELIVERED | Gate at `anno-store.ts:1979-1990` calling `remainderRefusal()` (`:1855-1896`), which asks `assertRangeShape()` itself. Driven: the two-call reproduction throws `AnnoSplitRemainderError`, `listRanges()` still 1 row, revision unmoved. |
| 28-19: `AnnoSplitRemainderError` extends `AnnoRangeShapeError` | ✓ DELIVERED | `anno-types.ts:572`; my drive confirms the thrown value's constructor name and the suite asserts the `ViceError` chain. |
| 28-19: IN-06 — remainders carry the row's own `bank` | ✓ DELIVERED (input state constructed, filed `backstop` by the plan) | `insertRange` takes `bank`; the control at `anno-overlap.test.ts:617` builds the non-null precondition through `applyWrite` and says so in its own comment. Honest labelling. |
| 28-19: WR-08 pins by value + DECISION 2 recorded | ✓ DELIVERED | `anno-overlap.test.ts:872`, `:910`; `anno-store.ts:1941-1957`. |
| 28-20: WR-22 `assertRevisionArgument` as `revertTo`'s first statement | ✓ DELIVERED | `:2229` defined, `:2252` called first. |
| 28-20: WR-24 per-attempt staging via `randomUUID` | ✓ DELIVERED | `:2339`; no bare `rmSync(staging)` remains. |
| 28-20: WR-18 `rollbackFailed` given production readers on `transactionStateUnknown` | ✓ DELIVERED | `:325` field, `:1234` return, `:1782` set, `:1501` read-and-refuse. Residual WR-26. |
| 28-21: WR-21 `addScope` idempotence + nesting refusal | ✓ DELIVERED | Green in the 210 run. Residual WR-28 (no inverse verb). |
| 28-21: WR-25 confinement as `openStore`'s DEFAULT, escape pinned to 4 sites | ✓ DELIVERED | Guard at `:425-433` is the first statement; escape at `:695`, `:2388`, `:2520`, `:2559`; pin at `anno-seam.test.ts:649`. Residual IN-11 (substring, not regex). |
| 28-22: WR-19 matcher tests statement contents inside `exec()` literals | ✓ DELIVERED for the two spellings named | `anno-seam.test.ts:378-397`. Residual WR-27 — `prepare("commit").run()` is invisible, and I verified against `node:sqlite` that it really commits. |
| 28-22: twelve round-5 dispositions in `28-REVIEW.md`'s own table | ✓ DELIVERED | Round-5 disposition section present with per-id `fix`/`accept` cells. |
| 28-22: STORE-04 → `Complete` on the verifier's quoted sentence | ✓ DELIVERED | `.planning/REQUIREMENTS.md:219` and the quoting paragraph at `:244`. |
| 28-22: both `behavior_unverified` items carried as OPEN | ✓ DELIVERED | `.planning/REQUIREMENTS.md:248` names both and claims neither closed. |
| 28-22: closing gate at 210/210, real exit 0 | ✓ DELIVERED | Re-measured here: 210 pass / 0 fail / 0 skipped, exit 0, 13.3 s. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-store.ts` | The single `node:sqlite` seam; write entry points; snapshot ring; revert; the CR-09 remainder gate | ⚠️ **HOLLOW — wired but the gate under-checks** | Exists, substantive, wired, and its data flows. The gate at `:1979-1990` is present and reached on every retype (I drove it), but it enforces only parity, so the five even geometries pass. This is the CR-10 gap. |
| `src/mcp/vice/anno-types.ts` | The frozen 12-member vocabulary, `assertRangeShape`, `resolveSplitTargets`, the error family incl. `AnnoSplitRemainderError` and `AnnoRevisionArgumentError` | ✓ VERIFIED | `SCHEMA_VERSION = 2` (`:154`), `AnnoSplitRemainderError` (`:572`), `AnnoRevisionArgumentError` (`:493`), `resolveSplitTargets` (`:1329`). Imported and used by `anno-store.ts`. |
| `src/mcp/vice/anno-index.ts` | The pure narrowest-wins index | ✓ VERIFIED | Unchanged this round; green in the 210 run. |
| `src/mcp/vice/block-class.ts` | The census boundary accepting the store's lowercase vocabulary | ✓ VERIFIED | Green; present in `files[]`. |
| `src/mcp/vice/anno-overlap.test.ts` | Proof of criterion 3 across five overlap geometries incl. split members | ✗ **CERTIFIES THE DEFECT** | Exists and is substantive, but `:592` pins the corrupted row set by value as "the LEGAL remainder case", four `SEQUENCE` steps mark the corrupting geometries `accepted`, and the round-trip invariant (`:1190`) checks re-acceptability + decodability, neither of which a re-paired table violates. |
| `src/mcp/vice/anno-seam.test.ts` | The single-seam and single-commit-site structural controls, the WR-25 escape pin | ⚠️ **WIRED, two known holes** | `commitStatements()` (`:378-397`) closes WR-19's two spellings but not `prepare("commit").run()` (WR-27, verified working). `ESCAPE_AT_A_CALL_SITE` (`:639`) is an exact substring (IN-11). |
| `src/mcp/vice/anno-durability.test.ts` | The ONE combined SIGKILL test + its planting | ✓ VERIFIED | 5/5 run on its own; `ok 2` is the live planting. |
| `src/mcp/vice/anno-confinement.test.ts` | Confinement refusals with a discriminating positive control | ✓ VERIFIED | Green inside the 210 run; my own confined opens all succeeded, so the new default was not bought by broadening. |
| `.planning/REQUIREMENTS.md` | STORE-04 moved on a verifier's authorising sentence; the two open items carried | ✓ VERIFIED | `:219` `Complete`; `:244` quotes the round-5 verifier; `:248` carries both open items and states the round is unverified. |
| `.planning/phases/28-the-store-core/28-REVIEW.md` | The round-5 disposition table for all twelve ids | ✓ VERIFIED | Present; the round-6 section is additive and preserves rounds 3-5 verbatim. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `retype()`'s remainder writer | `assertRangeShape()` | `remainderRefusal()` in the pre-delete gate | ✓ **WIRED** | Round 5's one `✗ NOT WIRED` link. Closed — and the gate asks the entry point's own function rather than re-implementing the rule. |
| `retype()`'s remainder writer | the split layout's PAIRING rule (`resolveSplitTargets`) | — | ✗ **NOT WIRED** | **The CR-10 link.** Nothing on any write path consults the first-half/second-half layout that determines what a split row MEANS. `assertRangeShape` knows only parity; the pairing rule has no writer-side consumer at all. |
| `listRanges()` output | `setDataType()`'s entry-point validation | the round-trip invariant | ✓ WIRED | `rowsTheStoreWouldRefuse()` over a deterministic sequence, after every write. |
| `listRanges()` output | `resolveSplitTargets()` | the round-trip invariant | ⚠️ **WIRED BUT INSUFFICIENT** | It asserts the resolver does not THROW. It never compares the target set, which is the only observation that can see CR-10. |
| `reconcileSnapshotRing().rollbackFailed` | `runWriteSequence`'s refusal | `pruneSnapshots` → `handle.transactionStateUnknown` | ✓ WIRED | `:1234` → `:1782` → `:1501`, throwing in-family. Round 5 measured `⚠️ STATIC`. |
| `revertTo`'s `revision` argument | `assertRevisionArgument` | first statement | ✓ WIRED | `:2252`. |
| `openStore` | the confinement guard | first statement, before `resolve()` and `new DatabaseSync` | ✓ WIRED | `:425-433`, default-on. |
| `snapshotOpenFailure` | `retainedRevisions` / `revertTo` step 2 / step 3b | the single openability witness | ✓ WIRED | Re-driven: `[0, 2]` with the unopenable image excluded, and the refusal names both paths. |

### Data-Flow Trace (Level 4)

| Artifact | Data value | Source | Produces real data | Status |
|---|---|---|---|---|
| `listRanges()` | range rows | `select ... from anno_range` on the live connection | Yes — driven, values match what was written | ✓ FLOWING |
| `retainedRevisions()` | the advertised revision list | `anno_snapshot` rows filtered by `snapshotOpenFailure()` | Yes — `[0,1,2]` before the plant, `[0,2]` after | ✓ FLOWING |
| `setDataType()` `changed` | the row-set-changed signal | computed in `retype()` from the actual row mutation | Yes | ✓ FLOWING |
| `setDataType()` `contradictedComments` | the contradiction report | `contradictedCommentsFor` query | Yes for comments — **but structurally silent on split re-pairing** | ⚠️ **STATIC for the CR-10 class** — always `[]`, because no producer exists for it |
| `handle.transactionStateUnknown` | the poisoned-handle flag | `pruneSnapshots` → `reconcileSnapshotRing().rollbackFailed` | Yes — reaches a production throw | ✓ FLOWING (set at 1 of 4 observing sites — WR-26) |
| `resolveSplitTargets()` | the 16-bit targets | derived from the caller's byte array + the row's layout | Yes — and this is what made CR-10 visible | ✓ FLOWING |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Phase-scoped suite green at a real exit code | `node --test anno-*.test.ts block-class.test.ts` | 210 pass / 0 fail / 0 skipped, exit 0, 13.3 s | ✓ PASS |
| Typecheck clean | `./node_modules/.bin/tsc --noEmit` | exit 0, no output | ✓ PASS |
| Vocabulary is exactly twelve | drive `setDataType(..., "table")` | `AnnoTypeError` listing all 12 | ✓ PASS |
| CR-09 closed (odd fragment refused, costs nothing) | drive `$3000..$300f lo_hi` then `$3004..$3004 byte` | `AnnoSplitRemainderError`; `listRanges()` still 1 row | ✓ PASS |
| **CR-10 (even fragment preserves meaning)** | drive five even geometries + target-set comparison | **ACCEPTED in all five; `preserved 0/8` in all five** | ✗ **FAIL** |
| Adjacency: two calls, two rows | drive `$2000..$2007` then `$2008..$200f`, both `byte` | two rows, ids 1 and 2 | ✓ PASS |
| Revert refuses an unopenable image without destroying | plant a 0-byte `r1.db`, `revertTo(h, 1)` | in-family refusal naming both paths; 69632 → 69632; handle alive | ✓ PASS |
| Combined SIGKILL durability+revert and its planting | `node --test anno-durability.test.ts` | 5/5 | ✓ PASS |
| `prepare("commit").run()` really commits (WR-27) | scratch `node:sqlite` script | it commits; a new `begin immediate` succeeds | ✓ PASS (confirms the WARNING) |
| `regenerator2000` present on PATH | `command -v regenerator2000` | empty | ✓ PASS (confirms the 5 failures are environmental) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` is declared by any Phase 28 plan and none exists
for this phase. Step 7c is **N/A** — the phase's runnable gate is the scoped
`node --test` command above, which was executed in this process and is recorded
with its real exit code.

### Test Quality Audit

| Test file | Linked req | Active | Skipped | Circular | Assertion level | Verdict |
|---|---|---|---|---|---|---|
| `anno-types.test.ts` | STORE-01 | all | 0 | No | Value / behavioural | ✓ Sound |
| `anno-index.test.ts` | STORE-03 | all | 0 | **No** — the oracle is independently written and a control asserts it shares no code path | Value | ✓ Sound |
| `anno-overlap.test.ts` | STORE-02, STORE-03 | all | 0 | No | Value | ✗ **CERTIFIES A DEFECT** — `:592` and four `SEQUENCE` steps assert the CR-10 outcome as correct; the round-trip invariant's assertion is the wrong one for this class (decodability, not preservation) |
| `anno-durability.test.ts` | STORE-04 | all | 0 | No — the planting runs live in a subprocess | Behavioural | ✓ Sound, and among the strongest in the repo |
| `anno-store.test.ts` | STORE-04, STORE-05 | all | 0 (`# skipped 0` across the run) | No | Value / behavioural | ✓ Sound |
| `anno-seam.test.ts` | STORE-07 | all | 0 | No | Structural | ⚠️ Two evadable controls: WR-27 (commit spelling) and IN-11 (escape-count substring) |
| `anno-confinement.test.ts` | STORE-05 | all | 0 | No | Behavioural | ✓ Sound; the inside-pointing positive control discriminates |
| `block-class.test.ts` | STORE-01 | all | 0 | No | Value / structural | ✓ Sound |

**Disabled tests on requirements:** 0 (`# skipped 0` on the whole run).
**Circular patterns detected:** 0.
**Insufficient assertions:** 1 → **BLOCKER**, because it is the assertion that
would have caught CR-10: `anno-overlap.test.ts`'s round-trip invariant asserts
that a split row *decodes*, never that it decodes to *the same targets*.

### Requirements Coverage

| Requirement | Source plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| **STORE-01** | 28-01, 28-04, 28-19 | Labels, comments, per-range typing over the full 12-member vocabulary, scopes, project enums | ✓ **SATISFIED — row may move to `Complete`** | Round 5's blocking reason ("persists a typing it refuses at its own entry point and its own resolver cannot decode") is no longer true of any row: CR-09 is closed and every CR-10 row is re-acceptable and decodable. Vocabulary driven as exactly 12; labels, comments, scopes and enums all green. CR-10 attaches to STORE-03's partial-overwrite clause. |
| **STORE-02** | 28-02, 28-05, 28-19 | Ranges stored as ranges, never merged on adjacency, no splitter | ✓ SATISFIED | Driven adjacency; structural `coalesc`/`merg`/`splitter` scan clean; the union-retype and same-type-subrange shapes now pinned by value with the intent recorded (round 5's advisory cleared). |
| **STORE-03** | 28-02, 28-05, 28-19 | Narrowest-wins exact at 65,536 addresses; **tie-break, range ends, and the behaviour when a typed range is partially overwritten all pinned** | ✗ **BLOCKED — stays `Gaps Found`** | The first two clauses hold (oracle cross-validation, both ends, `$FFFF`, tie-break, length-1). The third does not: the partial-overwrite behaviour for the four split members is pinned to an outcome that discards every recorded target (`preserved 0/8` across five geometries). CR-10. |
| **STORE-04** | 28-06, 28-16, 28-17 | Survives restart; revert; ONE combined planted-violation test | ✓ SATISFIED | Both halves hold and I re-drove the revert half rather than carrying round 5's word: `anno-durability.test.ts` 5/5 with the live planting, and the CR-08 class refuses non-destructively (69632 → 69632, handle alive). The `Complete` row is correct. |
| **STORE-05** | 28-04, 28-06, 28-09 | Schema version, reserved uninterpreted `bank`, xref access kind, stale-base refusal | ✓ SATISFIED | DDL read directly; `bank` never read into a decision; cross-process refusal green (`ok 5`). |
| **STORE-07** | 28-01, 28-03 | `node:sqlite` through exactly one seam | ✓ SATISFIED | One code reference repo-wide (`anno-store.ts:132`); `files[]` scan green; mutator excluded. |

**Orphaned requirements:** none. All six IDs the ROADMAP maps to Phase 28 are
claimed by plans and accounted for above. STORE-06 correctly maps to Phase 29
and is out of scope here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` in any file this phase modified | — | **None found.** Scanned all eleven `anno-*` / `block-class` sources and tests plus the mutator; zero hits. The debt-marker gate does not fire. |
| `src/mcp/vice/anno-store.ts` | 1920-1932 | A comment stating a guarantee (`no one-way data decision taken silently on the caller's behalf`) that the same function does not provide on the even path | 🛑 Blocker | The CR-10 contradiction. Prohibitions 28-07 P3 and 28-21 P1. |
| `src/mcp/vice/anno-overlap.test.ts` | 592, 1170-1180, 1190 | A control that certifies the defect it exists to prevent | 🛑 Blocker | Why 210 green tests cannot see CR-10. |
| `src/mcp/vice/anno-store.ts` | 2166-2229 | A ~44-line contract block detached from the function it documents | ⚠️ Warning | WR-29. |
| `src/mcp/vice/anno-store.ts` | 1191 | Return type widened `void` → `boolean` with no documentation of the boolean | ⚠️ Warning | WR-30, in a module that documents everything. |
| `src/mcp/vice/anno-seam.test.ts` | 378-397, 639 | Two structural controls that read as enforcement but are evadable by an equivalent spelling | ⚠️ Warning | WR-27 (verified working), IN-11. |
| `src/mcp/vice/anno-store.ts` | 1123, 1610, 1722 | Three sites compute `rolledBack === false` and none marks the handle | ⚠️ Warning | WR-26; mitigated because two of the three throw with the remedy in the message. |
| `src/mcp/vice/anno-store.ts` | 2761-2812 | An additive verb with a permanent refusal and no inverse | ⚠️ Warning | WR-28. |

### Decision Coverage

No `28-CONTEXT.md` exists in the phase directory, so the decision-coverage gate
**skips cleanly**. `decision_coverage: { honored: 0, total: 0, not_honored: [] }`.
Non-blocking either way.

### Human Verification Required

This is an infrastructure/foundation phase with no user-facing surface, so the
infrastructure carve-out applies — **except** for the two evidence-gap items,
which the carve-out explicitly does not absorb. Both are carried forward
unchanged.

#### 1. The `integrity_check could not be run at all` arm

**Test:** Fault-inject so `pragma integrity_check` itself throws inside
`openStore` (filesystem- or SQLite-level), rather than returning a non-`ok` row.
**Expected:** `AnnoStoreCorruptError` naming the path, the connection closed,
nothing partial returned.
**Why human:** A defensive arm with no reachable input without fault injection.
Presence and wiring verified in source (`anno-store.ts:529-535` — `db.close()`
precedes the throw and the message names `resolved`); nothing exercises the
throw, and a 10-second spot-check cannot construct the precondition. Open since
round 4.

#### 2. The host-crash durability bound (`backstop`, abstained: `insufficient_spec`)

**Test:** Host-level crash or power-loss injection across the `stageSnapshot`
fsync → `publishSnapshot` rename → pointer-row commit sequence.
**Expected:** No surviving state in which a durable `anno_snapshot` pointer row
names an image whose bytes never reached disk; only a missing directory entry or
a durable one.
**Why human:** `fsync` has no in-process observable, so the only in-process
evidence is the source order of two calls — presence, not behaviour. 28-17 filed
this honestly as `backstop` and I carry it as an abstention rather than scoring
it either way.

### 4. Recommendation — a sixth round, tightly scoped

**A SIXTH GAP-CLOSURE ROUND IS WARRANTED. The phase should NOT seal with CR-10
as a stated residual.** My reasoning, with the counter-argument taken seriously
first.

**The counter-argument, and why it does not apply here.** This phase has a known
pathology: five rounds, a score that has moved 8/11 → 9/11 → 10/12 → 11/12 →
11/12 → 11/12, and a denominator that grows because must-haves get lifted out of
each round's own gap-closure frontmatter. If CR-10 were plan-derived scope, the
right call would be to seal. **It is not.** I kept the denominator at twelve,
declined to promote ~30 plan-level truths, and the one failing truth is the
ROADMAP's own criterion 3. CR-10 would be a gap under a denominator of nine. And
it was not found by scoring frontmatter — it was found by asking what criterion
3's purpose sentence means and driving it.

**Why it is not deferrable.**

1. **It is a silent data-corruption defect, not a missing control.** Five
   ordinary geometries, `preserved 0/8` recorded targets in every one, no
   report. The recovery cost is the one `anno-types.ts`'s own header names for
   orientation loss: hand re-annotation of every split table in every project
   file.
2. **It is strictly worse than the CR-09 this phase spent a full round on.** A
   refusal is recoverable; a plausible wrong answer is not.
3. **Phase 30's oracle cannot catch it.** Phase 30 criterion 1 settles every
   verdict by "a byte-diff against the input", and CR-10 changes no bytes. That
   is exactly the "it reassembles clean" assertion ROADMAP criterion 1 already
   rules out as a control for orientation. The milestone's strongest downstream
   check is structurally blind to this class, so deferring means it is not
   caught later — it is caught never.
4. **Phase 29 amplifies it.** It puts `set_data_type` and `list_ranges` on an
   agent-driven path where arguments arrive unvalidated, in front of an agent
   that will retype sub-ranges routinely.
5. **The test suite actively certifies it.** Sealing would freeze
   `anno-overlap.test.ts:592` as the recorded definition of correct
   split-and-preserve behaviour, and every future reader would treat it as
   settled.

**Scope the round to ONE plan, not four.** The fix is one condition in the gate
28-19 already built, reusing the error class it already added, plus the test
rewrites it forces. Concretely:

- **The code:** decide the split-row fragmentation rule (refuse outright, or
  return the re-interpreted tables as data — both defensible; see the `missing`
  list, and note that refusing makes split tables editable only wholesale, which
  the refusal message must say and offer a remedy for). Keep the parity check
  under either answer.
- **The tests, required under either answer:** rewrite `:592`, re-derive the four
  "both even" `SEQUENCE` steps and the `refusals >= 3` floor, and **add the
  target-set comparison** — `resolveSplitTargets()` before and after, asserting
  every surviving target was an original target. That assertion is the one thing
  no existing control does, and it is what makes the closure a class rather than
  an instance.
- **Fold in only what lives in the same edit:** WR-29 and WR-30 are comment
  moves in `anno-store.ts`; WR-26's one-line flag set and WR-27's/IN-11's regex
  are each a line. Everything else — WR-28, IN-09, IN-10 — should be
  **accepted with the reason recorded**, not fixed.
- **Do not open new record deliverables.** This report dispositions all nine
  round-6 ids, which greens `docs-review-disposition.test.ts` and
  `audit-integrity.test.ts` without a plan.

**A warning worth stating for the round's planner.** Round 5's must-haves were
written to CR-09's shape — *shape* — and the fix satisfies every one of them
exactly while CR-10 stands. Prohibition 28-19 P1 is HELD with the defect open.
The sixth round's must-haves must be written about **meaning**: the assertion to
plan against is *"every target a surviving split row reports is a target the
original table reported"*, not *"every row is re-acceptable"*.

### Gaps Summary

One gap, and it is the same clause of the same criterion that round 5 recorded,
at the same site, for a worse cause.

The fifth gap-closure round closed CR-09 properly and closed six other findings
with it; nothing it claimed failed to reproduce, and one round-5 advisory is
cleared outright. But its gate asks the only question `assertRangeShape` knows
how to ask — is the byte count even — and a split table's meaning is not a
function of its parity. It is a function of the row's start and its length. So
the gate refuses the one geometry that is loud and admits every geometry that is
silent. Five of them, `preserved 0/8` recorded targets each, `changed: true`,
`contradictedComments: []`.

All five ROADMAP success criteria hold in every **named clause**. Criterion 3's
**stated purpose** does not, and neither does the goal's *"owns the annotation
state ... per-range typing over the full 12-member vocabulary"* clause, for the
four split members. STORE-01 clears (its round-5 blocking reason is no longer
true of anything on disk); STORE-03 stays blocked on its third clause.
`11/12`, `gaps_found`, and one tightly scoped round to close it.

---

_Verified: 2026-08-28T22:23:24Z_
_Verifier: Claude (gsd-verifier), round 6_
