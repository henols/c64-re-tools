---
phase: 28-the-store-core
verified: 2026-08-29T00:44:57Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: # round 7, after the sixth gap-closure round (28-23, one plan, scoped to CR-10 alone)
  previous_status: gaps_found
  previous_score: 11/12 # round 6; round 5 11/12, round 4 11/12, round 3 10/12, round 2 9/11, round 1 8/11
  gaps_closed:
    - >-
      CR-10 IS CLOSED FOR THE THING IT WAS FILED AS — THE SILENCE — and the closure is re-driven here
      through production entry points only (`openStore` -> `setDataType` -> `listRanges` on a fresh
      confined store; no hand-edited store, no test-only export). All FIVE geometries the round-6
      report drove now return `reinterpretedSplitTables.length === 1` on the SUCCESSFUL result,
      carrying `rowId`, the row's span, `entryCountBefore: 8`, all eight `entryPairsBefore` couples,
      every survivor's span and its own couples, a COMPUTED `preservedEntryPairs`, and a `summary`
      that says in the store's own voice: *"0 of 8 entry-address pairs are preserved. The surviving
      row(s) are still legal and still decode -- they decode to DIFFERENT 16-bit values than the ones
      recorded here."* The full cover correctly returns `[]` (nothing survives, so nothing is owed),
      and the identical repeat returns `changed: false` with `[]` (a second disclosure of a
      fragmentation that already happened would be a false report).
    - >-
      THE PAIRING LOSS ITSELF IS NOT CLAIMED CLOSED AND I DO NOT SCORE IT AS CLOSED. `preserved 0/8`
      still holds in all five geometries — I re-measured it. That is not a defect a boundary rule
      could fix: a surviving fragment of `m` entries pairs its own byte `j` with its own byte `m + j`,
      which matches an original `(i, n + i)` only when `m == n`, i.e. only when the fragment IS the
      whole row. So the only two honest answers were REFUSE or DISCLOSE, and the round-6 report named
      both as sanctioned. 28-23 took (b), DISCLOSE. I score criterion 3 on that basis, which is the
      basis round 6 itself set, and not on a claim nobody made.
    - >-
      THE ROUND-6 `✗ NOT WIRED` KEY LINK IS WIRED, structurally rather than by a second copy.
      `splitPartnerOffsets()` (`anno-types.ts:1431`) is the only place in the repo that computes an
      entry's partner; `resolveSplitTargets()` consumes it, and so does the new exported
      `splitEntryAddressPairs()` (`:1477`) that the writer-side gate calls. A resolver and a writer
      that each kept their own copy could disagree silently — that was CR-10's whole class — and now
      they cannot.
    - >-
      THE TESTS THAT CERTIFIED THE DEFECT NO LONGER DO. The case round 6 named
      (`anno-overlap.test.ts:592`, "the LEGAL remainder case") is rewritten at `:675`: it keeps the
      (correct) row assertions and adds the disclosure BY VALUE with hand-derived couples, plus a
      `resolveSplitTargets()` before/after comparison asserting the two target sets are DISJOINT. The
      `SEQUENCE` "both even" notes are re-derived to say "accepted AND reported", `SPLIT_CASES` grew
      from 8 to 10 entries to cover the midpoint and same-type-subrange geometries, and the round-6
      verifier's own five drives are re-run verbatim at `:1322`.
    - >-
      THE CLASS-LEVEL ASSERTION IS REAL AND I PROVED IT WITH MY OWN PLANTING, not on the executor's
      word. `anno-overlap.test.ts`'s round-trip invariant now carries: *no split entry pair that
      vanishes outside the caller's own range goes unnamed by that write's own report.* I planted
      `entryPairsBefore: []` in `splitReinterpretation`'s return (record present, content suppressed)
      and observed `not ok 34` naming EIGHT real couples — `($1000,$1008) … ($1007,$100f)` — as
      `lost-and-unreported`. Suppressing the whole record reds NINE tests. Tree restored afterwards:
      `git diff --stat -- src/mcp/vice` is EMPTY.
  gaps_remaining: []
  regressions:
    - >-
      NONE in the phase-scoped surface, re-measured in this process: `node --test anno-types.test.ts
      anno-index.test.ts anno-overlap.test.ts anno-store.test.ts anno-seam.test.ts
      anno-durability.test.ts anno-confinement.test.ts block-class.test.ts` -> `# tests 218 / # pass
      218 / # fail 0 / # skipped 0`, REAL exit code 0, 13.7 s (round 6 recorded 210).
      `./node_modules/.bin/tsc --noEmit` exits 0.
    - >-
      Regression gate outside the phase: 7 failures, all attributed, NONE a phase-28 code regression.
      Five are `r2000-session.test.ts` plan-18-06 cases failing `R2000SpawnError` — I confirmed
      `command -v regenerator2000` is EMPTY on this host, so the cause is a genuinely absent external
      binary, environmental and pre-existing (the same five as rounds 5 and 6). The other two are the
      docs guards reddened by the round-7 code-review commit `413eda1`:
      `docs-review-disposition.test.ts` (AUDIT-01) is 6/7 and I ran it MYSELF — its failure message
      names EXACTLY five ids and nothing else, `IN-12, IN-13, IN-14, WR-31, WR-32` — and
      `audit-integrity.test.ts` (D-12-02) cascades from it. Both go green when the five are
      dispositioned; this report is a recognised disposition source
      (`docs-review-disposition.test.ts:280-284` accepts a phase's own `*-VERIFICATION.md`) and
      dispositions all five below.
gaps: []
deferred: []
behavior_unverified_items:
  - truth: >-
      `openStore`'s `integrity_check could not be run at all` arm refuses in-family (now
      `anno-store.ts:534-539`; round 6 cited `:529-535`, round 5 `:465-468`, round 4 `:432` — the arm
      moves every round and is unchanged in substance). CARRIED FORWARD UNCHANGED for a FOURTH round —
      recorded still-open by 28-22 and by 28-23, and claimed closed by nothing in either.
    test: >-
      Fault-inject so `pragma integrity_check` itself THROWS rather than returning a non-`ok` row (the
      non-`ok` row path at `:541-543` is already covered by the truncated-mid-file test in
      `anno-store.test.ts`)
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      The arm is defensive and has no reachable input without filesystem- or SQLite-level fault
      injection. Presence and wiring re-verified in source this round (`db.close()` precedes the throw
      and the message names `resolved`); no test exercises the throw, and a 10-second spot-check cannot
      construct the precondition.
  - truth: >-
      28-17's `backstop`-tagged truth: after an interruption between `vacuum into` and the pointer row's
      commit, the reachable outcomes are bounded to two, both non-destructive — a missing directory entry
      (an orphan ROW, made inert by 28-13) or an entry whose contents ARE durable. ABSTAINED again, per
      the backstop-abstention contract: `insufficient_spec`.
    test: >-
      Host-level crash or power-loss injection (or an equivalent fs-level fault harness) across the
      `stageSnapshot` fsync / `publishSnapshot` rename / pointer-row commit sequence, confirming no
      surviving pointer row names a file whose bytes did not reach disk
    expected: "No reachable post-crash state in which a durable pointer row names a non-durable image"
    why_human: >-
      An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two
      `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop`.
      Presence + wiring never qualify as behavioural evidence for a durability claim.
coincidental_reliance_items:
  - truth: >-
      Truth 4's CLASS-level completeness — that EVERY fragmenting write discloses, not merely the seven
      geometries I drove.
    reason: undeclared-precondition
    harden: >-
      The completeness argument rests on `retype()` being the ONLY writer of `anno_range`: `insertRange`
      has exactly three call sites (`anno-store.ts:2157`, `:2160`, `:2164`), all inside `retype()`, and
      `delete from anno_range` exactly one (`:2155`). That is true today and I measured it, but NOTHING
      DECLARES OR ENFORCES IT — no control pins the `insertRange` call sites the way `anno-seam.test.ts`
      already pins the `node:sqlite` seam and the single commit site. A fourth `insertRange` call added
      outside `retype()` would bypass the gate and re-open CR-10's class silently, and 218 green tests
      would not notice. Promote the single-writer property into a structural control in the file that
      already owns that pattern. ADVISORY ONLY — no effect on status or score.
round_7_review_dispositions: # every id opened by 28-REVIEW.md round 7, judged on my own evidence
  - id: WR-31
    severity_reviewer: WARNING
    my_verdict: CONFIRMED, reproduced independently — and WARNING is the CORRECT severity
    disposition: accept
    reason: >-
      REPRODUCED AT HEAD. I planted the exact row CR-09 documented (`$1005..$100f lo_hi_address`, 11
      bytes) into a store created by `openStore`, then drove `setDataType($1009..$1009, byte)` through
      the production entry point: it throws a bare `AnnoRangeShapeError` naming `4101..4111` — a span the
      caller never mentioned — with `rowId` and `side` both `undefined` and no "nothing was written"
      sentence. The regression is real: I read the pre-28-23 gate at `b681488` and it contains ONLY the
      two `remainderRefusal` calls, so both remainders of that row ($1005..$1008 = 4 bytes, $100a..$100f
      = 6 bytes) are even and the same write was ACCEPTED there, repairing the illegal row.
      THE QUESTION I WAS ASKED, ANSWERED IN THREE PARTS. (1) Is it a regression in the ability to REPAIR
      a legacy-corrupt store? PARTIALLY — the PARTIAL route is gone, but I drove the full cover
      (`setDataType($1005..$100f, byte)`) on the same store and it is still ACCEPTED and still repairs
      the row. The state is recoverable through a route I EXECUTED, not one I argued. (2) Does it touch
      the goal's REVERTIBLE clause? NO — it never reaches `revertTo`, and I re-drove revert separately
      in both directions (truth 12). (3) Does it falsify any ROADMAP criterion? NO — no criterion, and
      no STORE requirement, covers "a row a superseded build wrote must stay PARTIALLY repairable". The
      refusal is in-family (`AnnoRangeShapeError extends ViceError`), atomic (rows deep-equal, revision
      1 -> 1) and destroys nothing. WARNING is correct and I decline to escalate it.
      WHAT I DO NOT LET PASS: the two comments (`anno-store.ts:2131-2139` and `:1918-1922`) assert a
      protection the code does not provide — the THIRD instance in this phase of exactly that (28-07 P3,
      28-21 P1). Recorded as a judgment-tier prohibition violation below, non-authoritative. The
      correction should ride the first future edit to `retype()`; it is a comment change with no
      behaviour and does not justify a seventh round on its own.
  - id: WR-32
    severity_reviewer: WARNING
    my_verdict: CONFIRMED to the digit — and it does NOT make the class invariant vacuous
    disposition: accept
    reason: >-
      I REPLAYED `SEQUENCE` MYSELF against the production entry points and my numbers match the
      reviewer's exactly: `dropContained` removes ZERO keys on the lost side and ZERO on the reported
      side across all twelve steps. The geometry that would exercise it is reachable and accepted — I
      drove `setDataType($1000..$100f, lo_hi_address)` then `setDataType($1000..$1009, byte)` and got one
      record with survivor `$100a..$100f` and two wholly-contained pairs — and it appears in neither
      `SEQUENCE` nor `SPLIT_CASES`. The control-coverage hole is real.
      THE QUESTION I WAS ASKED, ANSWERED — and I proved it rather than reasoned it. NO, the must-have is
      NOT vacuous and criterion 3 is NOT unproven again. The invariant's substance is
      `deepEqual(lost, reported)` over two sets computed from DIFFERENT sources: `lost` from
      `splitPairsOf()`, an independent oracle hand-written from the layout rule that deliberately does
      not import the production pairing function, and `reported` from the store's own record. Those sets
      are NON-EMPTY on five accepted steps (8, 8, 8, 8 and 10 pairs — I measured each), and I observed
      the assertion go RED with eight real couples named when I planted an emptied report. The invariant
      is carried by that non-empty by-value comparison, independently of the carve-out.
      A FINDING OF MY OWN THAT NARROWS WR-32: because the carve-out is applied SYMMETRICALLY, adding the
      missing geometry would still NOT red an inverted-but-symmetric `dropContained` (lost 2 == reported
      2 there, so it stays green). Only a ONE-SIDED variant reds — which is exactly what planting T3-B
      tested and reverted. So the hole is "the symmetric form has no green case", not "the symmetry is
      unproven". Worth closing in Phase 29's test pass; not worth a seventh round.
  - id: IN-12
    severity_reviewer: WARNING (informational tier)
    my_verdict: CONFIRMED
    disposition: accept
    reason: >-
      `preservedEntryPairs` is provably constant-empty by the module's own DECISION 1 arithmetic (a
      fragment of `m` entries matches an original pair only when `m == n`), and every one of my seven
      drives returned `preservedEntryPairs: 0`. Replacing the computation with a literal `[]` keeps the
      suite green, so the recorded decision ("computed, never hardcoded") is not falsifiable by anything
      in the tree. The future-proofing argument is sound and is written down; the claim and its evidence
      should simply not be confused. Take the reviewer's fix — state the constancy where the field is
      declared — on the next edit.
  - id: IN-13
    severity_reviewer: WARNING (informational tier)
    my_verdict: CONFIRMED on inspection; same root as WR-31, one tier lower
    disposition: accept
    reason: >-
      `splitReinterpretation` narrows with `isSplitDataType` (a PREFIX test over `SPLIT_PREFIXES`,
      `anno-types.ts:211-213`) and then calls `splitEntryAddressPairs`, whose `assertSplitLayout`
      (`:1446`) is EXACT membership over the frozen four. The two disagree on any `data_type` starting
      `lo_hi_` / `hi_lo_` that is not one of the four, and `anno_range.data_type` carries no CHECK
      constraint. Requires a hand-built or foreign store, produces a refusal rather than a corruption,
      and the write stays atomic. Informational tier is right. The reviewer's one-line fix (narrow with
      the consumer's own predicate) also removes the redundant cast at `:1937`.
  - id: IN-14
    severity_reviewer: WARNING (informational tier)
    my_verdict: CONFIRMED — I read the sentence in my own driven output
    disposition: accept
    reason: >-
      The `summary` string the store hands a caller contains the prose sentence *"A split table pairs
      byte i with byte n + i"* (`anno-store.ts:1979`) — a copy of the rule 28-23 reduced to one
      definition, outside the `n + i` grep that was scoped to `anno-types.ts`. It is TRUE today and no
      control compares it against the layout. The two test copies are deliberate independent oracles and
      are asserted against; this one is neither. Cosmetic while the rule is stable; derive it from
      `before.entryCount` on the next edit, as the reviewer proposes.
round_6_ids_carried_forward: # the eight 28-23 was deliberately not scoped to; round 7 re-checked each and found all unchanged
  - id: WR-26
    disposition: accept
    reason: >-
      One setter for `transactionStateUnknown` (`anno-store.ts:1787`), four observers; the three sites
      computing `rolledBack === false` (`:1123`, `:1606`, `:1722`) still do not set it. Unchanged from
      round 6, including round 6's moderating fact: two of the three THROW an in-family error whose prose
      and whose `data.rolledBack` both say CLOSE IT AND REOPEN, so prohibition 28-20 P1 is held on its
      letter. The residual is a caller that catches and continues.
  - id: WR-27
    disposition: accept
    reason: >-
      `commitStatements()` (`anno-seam.test.ts:405-414`) still matches only inside `exec()` literals, so
      `prepare("commit").run()` counts 0. Round 6 verified against `node:sqlite` that that spelling
      really commits. Control-completeness gap, not a live defect — the module has exactly one commit
      site today and the control is green for the right reason.
  - id: WR-28
    disposition: accept
    reason: >-
      `addScope`'s overlap refusal still has no inverse; `delete from anno_` is exactly two hits
      (`:1255` `anno_snapshot`, `:2155` `anno_range`). Safe-direction and reversible inside the
      32-revision ring. Carry to Phase 29, which puts `addScope` on an agent-driven surface where a
      mistyped span is likelier.
  - id: WR-29
    disposition: accept
    reason: >-
      `revertTo`'s ~44-line contract block is still detached from `revertTo` (`:2428`) by
      `assertRevisionArgument`'s own doc and body. The contract is not false, it is displaced. A comment
      move with no behaviour; fold into the first future edit to that function.
  - id: WR-30
    disposition: accept
    reason: >-
      `pruneSnapshots(handle): boolean` (`:1196`) still documents the bound, the transaction and the
      latency and says nothing about what the boolean means. One doc line; same treatment as WR-29.
  - id: IN-09
    disposition: accept
    reason: >-
      `AnnoSplitRemainderError`'s inherited `start`/`endInclusive` still carry the REMAINDER where every
      other family member carries the caller's range (`anno-types.ts:645`, bound at
      `anno-store.ts:1888-1889`). Cosmetic while the dedicated fields exist alongside — and my own WR-31
      drive shows the same confusion arriving at a sibling site through a different class.
  - id: IN-10
    disposition: accept
    reason: >-
      `remainderRefusal`'s "nearest legal boundary" advice is still computed from the single row it was
      called about while the gate loops over every overlapping row. Low impact: the whole retype is
      refused either way and the caller re-drives.
  - id: IN-11
    disposition: accept
    reason: >-
      `ESCAPE_AT_A_CALL_SITE` is still an exact substring counted by `split().length - 1`
      (`anno-seam.test.ts:639`, `:661`). The repo has no formatter config, so a fifth escape spelled
      without the space keeps the count at 4. The cross-module scan is spelling-independent, so only
      additional sites INSIDE the seam can evade.
prohibition_flags: # judgment-tier; NON-AUTHORITATIVE LLM-judge verdicts — human review recommended
  - statement: "28-23 P — MUST NOT round the caller's range outward to an entry boundary."
    verdict: held
    flagged: true
    reason: >-
      HELD, driven. In all seven accepted geometries the caller's own boundaries appear verbatim in the
      resulting row set — e.g. `$1004..$1007` is exactly the row inserted, and the survivors are exactly
      `$1000..$1003` and `$1008..$100f`. Nothing is rounded.
  - statement: "28-23 P — MUST NOT demote a remainder to the vocabulary's `undefined` member."
    verdict: held
    flagged: true
    reason: >-
      HELD, driven. Every survivor in every drive carries the row's own `lo_hi_address` forward;
      `undefined` appears in no row set I produced.
  - statement: "28-23 P — MUST NOT remove or weaken the byte-count parity check in the remainder gate (CR-09's control)."
    verdict: held
    flagged: true
    reason: >-
      HELD, driven. `setDataType($1004..$1004, byte)` over a 16-byte `lo_hi_address` table still throws
      `AnnoSplitRemainderError` naming the 11-byte tail, the side and both nearest legal boundaries —
      and the refusal still costs nothing: 1 row before, 1 row after, revision 1 -> 1.
  - statement: "28-19 P1 — MUST NOT let the store persist, by ANY writer, a range row it would refuse at its own entry point."
    verdict: held
    flagged: true
    reason: >-
      HELD. Every row my seven drives produced is re-acceptable at `setDataType`, and the round-trip
      invariant states it class-wide over the twelve-step sequence. Round 6 recorded this prohibition as
      HELD WHILE CR-10 WAS OPEN, because it is a rule about SHAPE and CR-10 was about MEANING; the new
      class invariant over ENTRY PAIRS is the rule about meaning that was missing, and it is now present.
  - statement: "28-19 P2 — MUST NOT resolve the remainder question by silently substituting a type, a boundary or a default."
    verdict: held
    flagged: true
    reason: >-
      HELD — and this is a CHANGE from round 6, which judged it VIOLATED. Nothing is substituted, and the
      extent change is no longer silent: the write returns both entry-pair sets and a summary naming the
      row, both spans, the counts and the consequence. The prohibition's operative word was `silently`,
      and the silence is gone.
  - statement: "28-21 P1 — MUST NOT leave two contradictory readings of the same rule in the tree."
    verdict: violated
    flagged: true
    reason: >-
      ROUND 6's INSTANCE IS CLOSED: `retype()`'s DECISION 1 comment now states BOTH outcomes — the odd
      remainder is REFUSED, the even remainder is ACCEPTED WITH A REPORT — and the code below it does
      exactly that. I read both. But a NEW and milder instance is open at WR-31's two comments: the
      gate's ordering comment (`:2131-2139`) and `splitReinterpretation`'s doc (`:1918-1922`) both assert
      that the parity checks above protect the computation, and my drive shows they do not — they cover
      the REMAINDER, never the ROW. Judgment-tier and non-authoritative: a human may reasonably read both
      sentences as scoped to the remainder and therefore literally true.
  - statement: "28-07 P3 — MUST NOT leave in place, or introduce, a comment or a user-facing message that asserts a guarantee the code does not provide."
    verdict: violated
    flagged: true
    reason: >-
      Same two comments as the entry above, recorded separately because they are different prohibitions
      from different plans landing on the same site. Round 6's instance (DECISION 1 on the even path) is
      CLOSED. WR-29's displaced `revertTo` contract and IN-14's prose copy of the pairing rule inside a
      user-facing string are two further, milder instances. Judgment-tier and non-authoritative.
  - statement: "28-10 P4 — MUST NOT change the meaning of an on-disk column or of the on-disk directory layout without a schema version bump that makes the older shape refuse BY NAME."
    verdict: held
    flagged: true
    reason: >-
      HELD, and it is the reason the disclosure is a RETURN CHANNEL rather than a column recording the
      table's original extent. `SCHEMA_VERSION` is still 2 (driven), the DDL is unchanged, and the
      round's diff contains no `create table` / `alter table` / `create index`.
  - statement: "28-11 P5 / 28-19 P-carried — MUST NOT convert a committed write into a caller-visible failure."
    verdict: held
    flagged: true
    reason: >-
      HELD. Every refusal I drove — the odd fragment, and WR-31's legacy-row throw — is raised BEFORE the
      first `delete`: rows deep-equal and the revision unmoved in both. The gate is two separate `for`
      loops (`:2141-2152` then `:2154-2162`), the whole first one running before the second begins.
  - statement: "28-08 P2 — MUST NOT report a conflict without both of the numbers that conflicted."
    verdict: held
    flagged: true
    reason: >-
      HELD, and this round is where it does the most work: the two "numbers" are two SETS, and the record
      carries both — the eight `entryPairsBefore` couples and each survivor's own couples — plus their
      computed intersection and a summary reading `0 of 8`.
      ONE EXCEPTION, RECORDED HONESTLY: WR-31's `AnnoRangeShapeError` names only the row's span and not
      the caller's, which is the same gap IN-09 reports at the sibling site.
  - statement: "28-18 P2 — MUST NOT move a requirement's status on an executor's own judgement of its own work."
    verdict: held
    flagged: true
    reason: >-
      HELD. `.planning/REQUIREMENTS.md:246` quotes the round-6 verifier's authorising sentence verbatim
      for STORE-01's move and its blocking sentence for STORE-03 staying put, and `:250` states in its
      own words that "This round is EXECUTED, not VERIFIED, and `STORE-03` moves only when a verification
      pass says so." That verification pass is THIS report, and my authorising sentence for STORE-03 is
      in §Requirements Coverage below.
  - statement: "28-18 P3 — MUST NOT close, silently drop, or re-file as done a carried-forward `behavior_unverified` item."
    verdict: held
    flagged: true
    reason: >-
      HELD. Both are recorded STILL OPEN at `.planning/REQUIREMENTS.md:252-257` with their reasons
      unchanged and an explicit "Nothing in 28-23 touches …" note each, no plan in the round claims
      either, and I have carried both forward again.
  - statement: "28-22 P1 — MUST NOT premise a task, or an acceptance criterion, on a guard being RED."
    verdict: held
    flagged: true
    reason: >-
      HELD. Both docs guards were green at 28-23's plan time; they are red NOW only because the round-7
      code-review commit `413eda1` landed five new ids minutes before this run, which is the guard
      working as designed. This report dispositions all five.
  - statement: "28-17 P4 — MUST NOT let a test report a PASS for a precondition it could not construct."
    verdict: held
    flagged: true
    reason: >-
      HELD on regression: my own 218-test run reports `# skipped 0`, and no `SKIPPED as root` string
      appears in any anno test.
human_verification:
  - test: >-
      Fault-inject so `pragma integrity_check` itself throws inside `openStore` (filesystem- or
      SQLite-level), rather than returning a non-`ok` row
    expected: "`AnnoStoreCorruptError` naming the path, connection closed, nothing partial returned"
    why_human: >-
      Defensive arm with no reachable input without fault injection; presence and wiring re-verified in
      source (`anno-store.ts:534-539`), but nothing exercises the throw. Open since round 4.
  - test: >-
      Host-level crash / power-loss injection across the `stageSnapshot` fsync -> `publishSnapshot`
      rename -> pointer-row commit sequence
    expected: >-
      No surviving state in which a durable `anno_snapshot` pointer row names a snapshot image whose
      bytes never reached disk; the only reachable outcomes are a missing directory entry or a durable one
    why_human: >-
      `fsync` has no in-process observable, so the only in-process evidence is the source order of two
      calls. Filed by 28-17 as a `backstop` truth; the abstention (`insufficient_spec`) is recorded
      rather than scored.
  - test: >-
      Human review of the FOURTEEN judgment-tier prohibition verdicts above, and in particular the TWO
      recorded `violated` (28-21 P1 and 28-07 P3, both at WR-31's two comments,
      `anno-store.ts:2131-2139` and `:1918-1922`)
    expected: >-
      A decision on whether a comment scoped in its own words to *the remainder*, which a reader will
      take as covering *the row*, is a false guarantee — and whether the correction rides the first
      future edit to `retype()` (my recommendation) or needs its own commit
    why_human: >-
      All fourteen are declared `verification: judgment` by 28-23's own frontmatter. My verdicts are
      NON-AUTHORITATIVE LLM-judge readings and must not be absorbed into a silent pass.
---

# Phase 28: The Store Core Verification Report

**Phase Goal:** This project owns the annotation state — labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, and reachable through exactly one persistence seam. The milestone's one irreversible decision lands here.
**Verified:** 2026-08-29T00:44:57Z (HEAD `413eda1`)
**Status:** human_needed
**Re-verification:** Yes — round 7, after the sixth gap-closure round (28-23, one plan, scoped by design to CR-10 alone)

## Goal Achievement

**THE PHASE GOAL IS ACHIEVED. 12/12, and the six-round blocker chain — CR-05,
CR-06/07, CR-08, CR-09, CR-10 — is closed.** The verdict is `human_needed` rather
than `passed` for one reason only: two carried evidence-gap items that no verifier
can construct (a defensive `integrity_check` throw arm needing SQLite fault
injection, and 28-17's `backstop`-tagged host-crash durability bound), plus the
fourteen judgment-tier prohibition verdicts that belong to a human. **There are no
gaps.**

**I started from the hypothesis that 28-23 missed, and I could not sustain it.**
Every claim below was re-driven in this process through production entry points —
`openStore` → `setDataType` → `listRanges` / `revertTo` on fresh confined stores,
no hand-edited store and no test-only export — and the one place I did construct a
precondition by hand (WR-31's legacy row) is named as such.

**What actually changed, measured rather than read off the SUMMARY.** All five of
round 6's geometries now return a full re-interpretation record on the successful
result. Here is one, verbatim from my own drive:

```
mid EVEN fragment: ACCEPTED changed=true contradicted=0
  rows=3  targets after: $0200 $0301 $0c08 $0d09 $0e0a $0f0b   preserved 0/8
  reinterpretedSplitTables.length=1
    rowId=1 span=4096..4111 type=lo_hi_address entryCountBefore=8
    pairsBefore=(1000,1008) (1001,1009) (1002,100a) (1003,100b) (1004,100c) (1005,100d) (1006,100e) (1007,100f)
    survivor 1000..1003 n=2 pairs=(1000,1002) (1001,1003)
    survivor 1008..100f n=4 pairs=(1008,100c) (1009,100d) (100a,100e) (100b,100f)
    preservedEntryPairs=0
    summary: ... 0 of 8 entry-address pairs are preserved. The surviving row(s) are still legal
             and still decode -- they decode to DIFFERENT 16-bit values than the ones recorded here.
```

`preserved 0/8` is **unchanged and is claimed closed by nobody.** The pairing loss
is an arithmetic property, not a bug: a fragment of `m` entries pairs its byte `j`
with its byte `m + j`, which matches an original `(i, n + i)` only when `m == n` —
only when the fragment IS the whole row. Round 6 said exactly this and offered two
sanctioned answers, refuse or disclose. 28-23 took disclose. **I score criterion 3
on that basis, which is the basis round 6 itself set, and not on a claim nobody
made.**

## 1. The FIVE ROADMAP Success Criteria — scored FIRST, because they are the contract

| # | Criterion | Named clauses | Stated purpose | Verdict |
|---|-----------|---------------|----------------|---------|
| SC-1 | Full 12-member vocabulary, four split layouts first-class, proven by a differing-resolved-target-set control with a collapse planting | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle; tie-break/ends/`$FFFF`/length-1 pinned; never merged on adjacency | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-3 | A partial overwrite splits and preserves; contradicted comments as data; **silently** un-documenting is the failure the store exists to prevent | ✓ HOLD (all three) | ✓ **HOLD — the silence is gone** | **VERIFIED** (was FALSIFIED in round 6) |
| SC-4 | ONE combined `SIGKILL` durability+revert test with its planting observed; truncated file refused | ✓ HOLD | ✓ HOLD | **VERIFIED** |
| SC-5 | Schema version, reserved uninterpreted `bank`, xref access kind, cross-process stale-base refusal, one `node:sqlite` seam | ✓ HOLD | ✓ HOLD | **VERIFIED** |

**Goal-text clauses, separately.** *durable across a `SIGKILL`* — TRUE
(`anno-durability.test.ts` `ok 1`, with `ok 2` the live planting in a real
subprocess). *revertible* — TRUE, **re-driven this round in both directions rather
than carried** (truth 12). *reachable through exactly one persistence seam* — TRUE
(one code reference to `node:sqlite` repo-wide). *the milestone's one irreversible
decision lands here* — TRUE (`SCHEMA_VERSION = 2`, unchanged by this round).
*scopes and project enums* — held, with WR-28 as a recoverability warning. ***owns
the annotation state — per-range typing over the full 12-member vocabulary*** —
**TRUE, including for the four split members**: the store no longer leaves a region
annotated with a meaning it does not have *without saying so*.

## 2. Why SC-3's stated purpose is now satisfied — argued against myself first

The strongest counter-argument, and it is a real one: *the report is a return value
from a function with zero production callers. Is a disclosure nobody reads "not
silent"?*

Three things answer it, and I checked each rather than asserting it.

1. **Criterion 3's own blessed remedy has exactly the same property.** Its text is
   *"A retype that contradicts an existing comment returns the contradicted comments
   **as data**."* I grepped: `contradictedComments` is also a return value with no
   production consumer today. The criterion accepts that pattern as satisfying
   itself. The new field rides beside it, on a SUCCESSFUL result, never as a refusal.
2. **The criterion's operative failure word is `silently`, not `preserve`.** The
   clause names the failure as *silent* un-documenting. Preservation is
   arithmetically impossible for any proper fragment, and round 6 established that
   itself. Disclosure removes the named failure.
3. **The disclosure is complete at the CLASS level, not merely at the instances I
   drove.** `retype()` is the only writer of `anno_range`: `insertRange` has exactly
   three call sites (`:2157`, `:2160`, `:2164`), all inside `retype()`, and one
   `delete from anno_range` (`:2155`). The gate's `hasHead`/`hasTail` predicates are
   byte-identical to the mutation loop's, so a record is produced exactly when a
   remainder is written. (That single-writer property is undeclared and unenforced —
   filed as the one `coincidental_reliance` advisory, which affects neither status
   nor score.)

**The residual, stated plainly and carried to Phase 29 rather than hidden:** the
disclosure must be SURFACED when Phase 29 puts `set_data_type` on the MCP tool path,
or the human never sees it. Phase 29's criterion 5 already requires that an
unsupported or ambiguous request *"refuses by name … rather than a plausible-looking
zero"*, which is the same instinct applied one layer up. That is a Phase 29
obligation, not a Phase 28 gap.

### Observable Truths

The truth set is **carried forward unchanged from rounds 5 and 6 — twelve truths,
deliberately not grown on 28-23's own frontmatter.** 28-23 declares sixteen
plan-level truths; every one is a closure claim for verifier truth 4 or a named
`gaps[0].missing` line, and I verify them as *"did the round deliver what it
claimed"* (§Round-6 Delivery) rather than promoting them to phase must-haves. This
is the third round running the denominator has not moved.

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Full 12-member vocabulary, four split layouts first-class | **ROADMAP** SC-1 | ✓ VERIFIED | Driven: `setDataType(..., "table")` throws `AnnoTypeError` listing all 12 with `validTypes.length === 12`. Orientation observable: the same 8 bytes resolve `$0810 $1234 $c000 $cfff` under `lo_hi_address` and `$1008 $3412 $00c0 $ffcf` under `hi_lo_address`. |
| 2 | Narrowest-wins exact at all 65,536 addresses vs an independent oracle | **ROADMAP** SC-2 | ✓ VERIFIED | `anno-index.test.ts` 13/13 run on its own: oracle cross-validation, the "oracle shares no code path" control, the equal-length tie-break, `$FFFF`, length-1. |
| 3 | Ranges stored as ranges, never merged on adjacency, no splitter primitive | **ROADMAP** SC-2 | ✓ VERIFIED | Re-driven: two adjacent `byte` ranges from two calls stay two rows with distinct ids (`id 1 $2000-$2007`, `id 2 $2008-$200f`). Structural `coalesc`/`merg`/`splitter` scan green in the 218 run. |
| 4 | **A partial overwrite splits and preserves — and NEVER un-documents a previously annotated region silently** | **ROADMAP** SC-3 | ✓ **VERIFIED** (round 6: ✗ FAILED) | Behavioural, not presence. Seven geometries driven; the five fragmenting ones each return one full record with both entry-pair sets and a `0 of 8` summary; the full cover returns `[]`; the identical repeat returns `changed:false` + `[]`; the odd fragment still refuses. The class-level assertion is proven load-bearing by MY OWN planting (`not ok 34`, eight couples named `lost-and-unreported`). Total typed bytes unchanged (16 → 4+4+8). |
| 5 | Combined SIGKILL durability+revert test, and removing the commit reddens it | **ROADMAP** SC-4 | ✓ VERIFIED | `anno-durability.test.ts` 5/5 on its own; `ok 1` is the combined test, `ok 2` the live subprocess planting asserting `readBackByValue === false` AND `revertReturnsPriorValue === false`. |
| 6 | A truncated/zero-length store FILE is refused at open, never returned partial | **ROADMAP** SC-4 | ✓ VERIFIED | `openStore` checks `anno_meta`, `schema_version` and `pragma integrity_check` (`anno-store.ts:492-543`); refusal tests green. Independently: my planted 0-byte `r1.db` is refused through the same path, quoted in truth 12. |
| 7 | Schema version + reserved uninterpreted `bank` + xref access kind | **ROADMAP** SC-5 | ✓ VERIFIED | Driven: `SCHEMA_VERSION` is 2; `bank` is `null` on every row I wrote and is read only by `listRanges` — never into a decision. DDL unchanged this round (the round-7 diff scan found no `create table` / `alter table`). |
| 8 | Stale-base write refused, observed from a second OS process | **ROADMAP** SC-5 | ✓ VERIFIED | `anno-durability.test.ts` `ok 5` — a separate OS process holding a real read transaction, the commit refusing in-family, revision unchanged, write lock released. |
| 9 | `node:sqlite` reachable from exactly one shipped module | **ROADMAP** SC-5, STORE-07 | ✓ VERIFIED | Repo-wide grep over `.ts`/`.mts`/`.mjs` excluding tests: the only CODE reference is `anno-store.ts:132`; the other seven hits are comments. `anno-durability-mutator.mjs` is absent from `package.json` `files[]`, which I read directly. |
| 10 | The census boundary accepts the store's lowercase vocabulary | **PLAN-derived** (28-03) | ✓ VERIFIED | `block-class.test.ts` green in the 218 run, including the module-level-mutable-binding and `files[]` structural pins (`ok 217`, `ok 218`). |
| 11 | An accepted write and its housekeeping cannot leave the connection in an open transaction, and everything thrown stays in the ViceError family | **PLAN-derived** (28-11/28-14/28-17) | ✓ VERIFIED | Regression: `anno-store.test.ts` green in the 218 run. The `rollbackFailed` production path (`:1234` → `:1787` → `:1506`) is intact. WR-26 is a completeness residual on three sites that throw rather than return. |
| 12 | **At the goal level the store is REVERTIBLE — a revert can return prior state and can never destroy it** | **ROADMAP** goal text | ✓ VERIFIED | **Re-driven this round, both directions.** Happy path: rev 3 → `revertTo(h, 2)` → rev 2 with the third range gone and the first two intact. Destructive-input path: 0-byte `r1.db` planted → `retainedRevisions()` drops to `[0]` → `revertTo(h, 1)` throws `AnnoStoreError` naming BOTH paths and quoting the reason → live store **69632 → 69632** → same handle still answers rev 2 with 2 rows. |

**Score: 12/12 truths verified.** Two evidence-gap items are reported separately
and counted neither way (the `integrity_check` throw arm,
present-behaviour-unverified; and 28-17's host-crash durability bound, abstained as
`insufficient_spec`).

### 3. The denominator, and the ROADMAP-versus-PLAN split — stated because this phase's failure mode is scope growth

| Kind | Count | Which |
|------|-------|-------|
| **ROADMAP** success criteria | **9** | truths 1 (SC-1), 2 and 3 (SC-2), 4 (SC-3), 5 and 6 (SC-4), 7, 8 and 9 (SC-5) |
| **ROADMAP** goal text, not a numbered SC | **1** | truth 12 (the "revertible" clause) |
| **PLAN-derived**, carried since earlier rounds | **2** | truth 10 (28-03's census boundary), truth 11 (the transaction/error-family invariant) |

**Ten of the twelve are ROADMAP-derived and all ten pass, so the verdict does not
lean on a plan-derived truth in either direction.** Both plan-derived truths also
pass. **Both of this round's new WARNINGs (WR-31, WR-32) are PLAN-DERIVED residuals
at 28-23's own new sites, and neither reaches a ROADMAP criterion or a STORE
requirement** — I checked each against all five criteria and all six requirement
IDs before dispositioning. That distinction is what makes this round terminal rather
than the seventh in a series: rounds 4, 5 and 6 each failed on the ROADMAP's own
criterion 3, found by attacking its purpose sentence. That sentence is now true of
the store's behaviour, driven.

### Round-6 Delivery — did the round do what it claimed?

Verified independently; SUMMARY claims were not the evidence. 28-23 recorded three
plan-letter deviations and all three are honest.

| Claim | Status | Evidence |
|---|---|---|
| `splitPartnerOffsets()` is the ONE definition, consumed by both the resolver and the writer | ✓ DELIVERED | `anno-types.ts:1431`; `resolveSplitTargets()` (`:1392`) and `splitEntryAddressPairs()` (`:1477`) both call it. My drives show resolver and writer agreeing entry-for-entry. |
| The gate builds one record per fragmented split row, after the parity refusals and before the first `delete` | ✓ DELIVERED | Two separate `for (const row of overlapping)` loops (`:2141-2152` gate, `:2154-2162` mutation). Driven: both refusals I produced leave rows deep-equal and the revision unmoved. |
| `SetDataTypeResult.reinterpretedSplitTables` is ALWAYS PRESENT, often empty | ✓ DELIVERED | `retype()` has two returns, both carrying it; threaded unconditionally at `:2318-2325`. Driven: `[]` on the full cover, on the identical repeat, and on non-split retypes; never `undefined`. |
| `preservedEntryPairs` is COMPUTED, not hardcoded | ✓ DELIVERED, with IN-12's caveat | The `Set`-intersection at `:1968-1971` is real; the value is nonetheless provably constant-empty and no control could tell the two apart. |
| `anno-overlap.test.ts:592` rewritten so it no longer certifies the defect | ✓ DELIVERED | Now `:675`. The row assertions are kept (they were always right); the disclosure is asserted by value with hand-derived couples; a disjoint target-set comparison is added. |
| All five geometries carry a before/after target-set comparison | ✓ DELIVERED | `:1272` (the comparison over every accepted geometry) and `:1322` (the round-6 verifier's five drives re-run verbatim). `SPLIT_CASES` grew from 8 to 10 entries. |
| The class invariant over ENTRY PAIRS, carve-out applied symmetrically | ✓ DELIVERED and PROVEN LOAD-BEARING BY MY OWN PLANTING | `:1848-1880`. My planting of an emptied `entryPairsBefore` reds it naming eight real couples. The symmetric carve-out itself is inert in the committed suite — WR-32, dispositioned. |
| DECISION 1's comment made true of the even path | ✓ DELIVERED | Read in source (`:2016-2069`): it now states BOTH outcomes and matches the code. Round 6's contradiction is closed. WR-31 opens a new, milder one two comments away. |
| One added `SEQUENCE` step spanning TWO split rows, so record ORDER has something to assert | ✓ DELIVERED | Step 11 (`$120e..$1301`); my replay confirms it produces **2 records, 10 vanished, 10 reported**. |
| `.planning/REQUIREMENTS.md`: STORE-01 → `Complete` on the round-6 verifier's quoted sentence, STORE-03 held with CR-10 as the reason, both open items carried | ✓ DELIVERED and HONEST | `:216` `Complete`; `:246` quotes the round-6 verdict verbatim; `:248` corrects the reason from CR-09 to CR-10; `:250` says in its own words "This round is EXECUTED, not VERIFIED"; `:252-257` carry both open items with "Nothing in 28-23 touches …" each. |
| Closing gate above the 210 baseline at a real exit code | ✓ DELIVERED | Re-measured here: **218 pass / 0 fail / 0 skipped, exit 0**, 13.7 s. `tsc --noEmit` exit 0. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-types.ts` | The one partner-rule definition, `splitEntryAddressPairs()`, the disclosure shapes, the frozen 12-member vocabulary | ✓ VERIFIED | `splitPartnerOffsets` `:1431`, `assertSplitLayout` `:1446`, `splitEntryAddressPairs` `:1477`, `SCHEMA_VERSION = 2` `:154`. Imported and used by `anno-store.ts`; data flows. |
| `src/mcp/vice/anno-store.ts` | The single `node:sqlite` seam; `retype()`'s gate computing the reinterpretation; `SetDataTypeResult.reinterpretedSplitTables`; DECISION 1 made true | ✓ **VERIFIED** (round 6: ⚠️ HOLLOW) | `splitReinterpretation` `:1912-1990`, gate `:2141-2152`, result field `:2282` and `:2325`. The gate is reached on every retype and its output reaches the caller — driven seven ways. |
| `src/mcp/vice/anno-index.ts` | The pure narrowest-wins index | ✓ VERIFIED | Unchanged this round; 13/13. |
| `src/mcp/vice/block-class.ts` | The census boundary accepting the store's lowercase vocabulary | ✓ VERIFIED | Green; present in `files[]`. |
| `src/mcp/vice/anno-overlap.test.ts` | Proof of criterion 3 across the split geometries, without certifying the defect | ✓ **VERIFIED** (round 6: ✗ CERTIFIES THE DEFECT) | 36 tests. The rewritten case at `:675`, the target-set comparison at `:1272`, the verifier's five drives at `:1322`, and the class invariant at `:1848`. My planting reds nine of them. Residual: `dropContained` is inert (WR-32). |
| `src/mcp/vice/anno-types.test.ts` | The pairing function's hand-derived pins and the shared-definition planting | ✓ VERIFIED | Green in the 218 run; the `n + i` worked-arithmetic pin at `:171` is an independent oracle that does not import the production function. |
| `src/mcp/vice/anno-seam.test.ts` | Single-seam and single-commit-site structural controls, the WR-25 escape pin | ⚠️ WIRED, two known holes | WR-27 (`prepare("commit").run()` invisible to `commitStatements()`) and IN-11 (escape count is an exact substring). Both dispositioned `accept`. |
| `src/mcp/vice/anno-durability.test.ts` | The ONE combined SIGKILL test + its planting | ✓ VERIFIED | 5/5 run on its own; `ok 2` is the live planting. |
| `src/mcp/vice/anno-confinement.test.ts` | Confinement refusals with a discriminating positive control | ✓ VERIFIED | Green in the 218 run; every confined `openStore({ workspaceRoot })` in my seven drives succeeded, so the default was not bought by broadening. |
| `.planning/REQUIREMENTS.md` | STORE-01 moved on a quoted verifier sentence; STORE-03 held; both open items carried | ✓ VERIFIED | `:216`, `:246`, `:248`, `:250`, `:252-257`. |
| `.planning/phases/28-the-store-core/28-REVIEW.md` | The round-7 findings, additive, with rounds 1-6 preserved | ✓ VERIFIED | `## Round 7 Findings` at `:2004`; earlier rounds byte-preserved above it. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `retype()`'s remainder writer | the split layout's PAIRING rule | `splitEntryAddressPairs()` → `splitPartnerOffsets()` | ✓ **WIRED** | **Round 6's one `✗ NOT WIRED` link — closed.** The writer and the resolver read the same single definition, so they cannot disagree about what an entry IS. |
| `retype()`'s remainder writer | `assertRangeShape()` | `remainderRefusal()`, pre-delete | ✓ WIRED (unchanged) | CR-09's gate still runs first; the odd fragment still refuses, and the refusal still costs nothing. |
| `setDataType()`'s result | the caller | `reinterpretedSplitTables`, beside `contradictedComments` | ✓ WIRED | Driven: present on every return path — populated when a split row fragments, `[]` otherwise, never absent. |
| `listRanges()` output | `resolveSplitTargets()` | the target-set comparison | ✓ **WIRED** (round 6: ⚠️ WIRED BUT INSUFFICIENT) | It no longer merely asserts the resolver does not throw; `:1272` compares the target sets and asserts they are disjoint across every accepted geometry. |
| `splitPairsOf()` (independent oracle) | the store's own report | the class invariant's `deepEqual(lost, reported)` | ✓ WIRED and NON-VACUOUS | Two non-empty sets from different sources; reds under my planting with eight couples named. |
| `reconcileSnapshotRing().rollbackFailed` | `runWriteSequence`'s refusal | `pruneSnapshots` → `handle.transactionStateUnknown` | ✓ WIRED | `:1234` → `:1787` → `:1506`, throwing in-family. |
| `revertTo`'s `revision` argument | `assertRevisionArgument` | first statement | ✓ WIRED | `:2410` defined, called first in `revertTo` (`:2428`). |
| `openStore` | the confinement guard | first statement, before `resolve()` and `new DatabaseSync` | ✓ WIRED | `:425-433`, default-on; every confined open in my drives succeeded. |
| `snapshotOpenFailure` | `retainedRevisions` / `revertTo` | the single openability witness | ✓ WIRED | Re-driven: `[0,1,2]` → `[0]` after the 0-byte plant, and the refusal names both paths. |
| `splitReinterpretation` | the OVERLAPPED ROW's own span validation | — | ⚠️ **NOT VALIDATED** | **WR-31.** `remainderRefusal()` asks about head and tail, never about the row. Legacy-only input; refusal is atomic and in-family; recoverable via a full cover I drove; dispositioned `accept`. |

### Data-Flow Trace (Level 4)

| Artifact | Data value | Source | Produces real data | Status |
|---|---|---|---|---|
| `listRanges()` | range rows | `select … from anno_range` on the live connection | Yes — driven, values match what was written | ✓ FLOWING |
| `setDataType()` `reinterpretedSplitTables` | the fragmentation report | `splitReinterpretation()` over the row's and each survivor's real spans, via the shared partner rule | **Yes — non-empty, correct, and by-value verified across five geometries** | ✓ **FLOWING** (round 6: ⚠️ STATIC — "always `[]`, no producer exists") |
| `setDataType()` `contradictedComments` | the contradiction report | `contradictedCommentsFor` query | Yes | ✓ FLOWING |
| `setDataType()` `changed` | the row-set-changed signal | computed in `retype()` from the actual row mutation | Yes — `false` on the identical repeat, `true` otherwise | ✓ FLOWING |
| `record.preservedEntryPairs` | the intersection | `Set` arithmetic over `entryPairKey` | Computed, but constant-empty for every reachable input | ⚠️ **CONSTANT** — IN-12, accepted with the reason recorded |
| `retainedRevisions()` | the advertised revision list | `anno_snapshot` rows filtered by `snapshotOpenFailure()` | Yes — `[0,1,2]` → `[0]` after the plant | ✓ FLOWING |
| `handle.transactionStateUnknown` | the poisoned-handle flag | `pruneSnapshots` → `reconcileSnapshotRing().rollbackFailed` | Yes — reaches a production throw | ✓ FLOWING (set at 1 of 4 observing sites — WR-26) |

### Behavioural Spot-Checks

Every command below was executed in this process; the results are the real output.

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Phase-scoped suite green at a REAL exit code | `node --test anno-*.test.ts block-class.test.ts` (8 files) | **218 pass / 0 fail / 0 skipped, exit 0**, 13.7 s | ✓ PASS |
| Typecheck clean | `./node_modules/.bin/tsc --noEmit` | exit 0, no output | ✓ PASS |
| Vocabulary is exactly twelve | drive `setDataType(..., "table")` | `AnnoTypeError` listing all 12, `validTypes.length === 12` | ✓ PASS |
| Orientation is observable (SC-1's real control) | `resolveSplitTargets` over the same 8 bytes, both orientations | `$0810 $1234 $c000 $cfff` vs `$1008 $3412 $00c0 $ffcf` | ✓ PASS |
| CR-09 still closed (odd fragment refused, costs nothing) | drive `$1000..$100f lo_hi` then `$1004..$1004 byte` | `AnnoSplitRemainderError` naming the 11-byte tail and both nearest boundaries; 1 row → 1 row, rev 1 → 1 | ✓ PASS |
| **CR-10's silence closed — five geometries** | drive mid-even / head / tail / midpoint / same-type-subrange | **ACCEPTED in all five, each with ONE full record: `entryCountBefore: 8`, 8 `entryPairsBefore`, every survivor's pairs, `preserved 0/8`, and a summary naming both spans** | ✓ **PASS** |
| Full cover discloses nothing (nothing survives) | drive `$1000..$100f byte` | `reinterpretedSplitTables.length === 0` | ✓ PASS |
| Identical repeat manufactures no second disclosure | drive the same fragmenting write twice | `changed: false`, `[]` | ✓ PASS |
| The class invariant is LOAD-BEARING (my planting) | plant `entryPairsBefore: []`, run `anno-overlap.test.ts` | `not ok 34` naming 8 couples `lost-and-unreported`; 9 tests red in total | ✓ PASS |
| Tree restored after both plantings | `git diff --stat -- src/mcp/vice` | **empty** | ✓ PASS |
| Adjacency: two calls, two rows | drive `$2000..$2007` then `$2008..$200f`, both `byte` | two rows, ids 1 and 2 | ✓ PASS |
| Revert returns prior state | rev 3 → `revertTo(h, 2)` | rev 2, third range gone, first two intact | ✓ PASS |
| Revert refuses an unopenable image without destroying | plant a 0-byte `r1.db`, `revertTo(h, 1)` | in-family refusal naming both paths; 69632 → 69632; handle alive at rev 2 | ✓ PASS |
| Combined SIGKILL durability+revert and its planting | `node --test anno-durability.test.ts` | 5/5, `ok 1` combined, `ok 2` live subprocess planting | ✓ PASS |
| **WR-31 reproduction** | plant CR-09's 11-byte row, drive `setDataType($1009..$1009, byte)` | **THROWS bare `AnnoRangeShapeError` naming `4101..4111`, `rowId` undefined; rows unchanged, rev 1 → 1** | ✗ **FAIL (confirms the WARNING)** |
| WR-31 recoverability | drive the full cover `setDataType($1005..$100f, byte)` over the same store | **ACCEPTED, changed: true, the illegal row is repaired** | ✓ PASS (this is what holds WR-31 to a WARNING) |
| **WR-32 measurement** | replay `SEQUENCE` and count `dropContained` removals per step | **lost 0 / reported 0 on all twelve steps** — matches the reviewer digit for digit | ✗ **FAIL (confirms the WARNING)** |
| WR-32 non-vacuity check | same replay, recording `vanished` / `reported` sizes | **8, 8, 8, 8 and 10 on the five fragmenting steps** — the invariant compares non-empty sets | ✓ PASS (this is what keeps the must-have non-vacuous) |
| WR-32's missing geometry is reachable | drive `$1000..$1009 byte` over the 16-byte table | ACCEPTED, one record, survivor `$100a..$100f`, two wholly-contained pairs | ✓ PASS (confirms the coverage gap is real) |
| `regenerator2000` present on PATH | `command -v regenerator2000` | empty | ✓ PASS (confirms the 5 regression failures are environmental) |
| Docs guard names exactly the 5 new ids | `node --test docs-review-disposition.test.ts` | 6/7; message names `IN-12, IN-13, IN-14, WR-31, WR-32` and nothing else | ✓ PASS (confirms the attribution) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` is declared by any Phase 28 plan and none exists
for this phase. Step 7c is **N/A** — the phase's runnable gate is the scoped
`node --test` command above, executed in this process with its real exit code.

### Test Quality Audit

| Test file | Linked req | Active | Skipped | Circular | Assertion level | Verdict |
|---|---|---|---|---|---|---|
| `anno-types.test.ts` | STORE-01 | all | 0 | No — the `n + i` pin is hand-written, not imported | Value / behavioural | ✓ Sound |
| `anno-index.test.ts` | STORE-03 | all | 0 | No — a control asserts the oracle shares no code path | Value | ✓ Sound |
| `anno-overlap.test.ts` | STORE-02, STORE-03 | all (36) | 0 | No — `splitPairsOf` and every `SPLIT_CASES` couple are hand-derived and do not import the production pairing function | Value + class invariant | ✓ **Sound** (round 6: ✗ CERTIFIES A DEFECT). Residual: `dropContained` inert (WR-32). |
| `anno-durability.test.ts` | STORE-04 | all | 0 | No — the planting runs live in a subprocess | Behavioural | ✓ Sound, among the strongest in the repo |
| `anno-store.test.ts` | STORE-04, STORE-05 | all | 0 | No | Value / behavioural | ✓ Sound |
| `anno-seam.test.ts` | STORE-07 | all | 0 | No | Structural | ⚠️ Two evadable controls: WR-27, IN-11 |
| `anno-confinement.test.ts` | STORE-05 | all | 0 | No — the inside-pointing positive control discriminates | Behavioural | ✓ Sound |
| `block-class.test.ts` | STORE-01 | all | 0 | No | Value / structural | ✓ Sound |

**Disabled tests on requirements:** 0 (`# skipped 0` across my whole run).
**Circular patterns detected:** 0.
**Insufficient assertions:** 1 → **WARNING** (was BLOCKER in round 6). The assertion
round 6 said was missing — a pair-set comparison rather than a decodability check —
now exists and is load-bearing, which I proved by planting. What remains is
`dropContained`'s missing green case (WR-32), which does not carry the invariant.

### Requirements Coverage

| Requirement | Source plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| **STORE-01** | 28-01, 28-04, 28-19, 28-23 | Labels, comments, per-range typing over the full 12-member vocabulary, scopes, project enums | ✓ SATISFIED — `Complete` is correct, unchanged | Vocabulary driven as exactly 12 with the orientation control observable; labels, comments, scopes and enums green. Moved to `Complete` in round 6 on that round's authorising sentence; nothing this round disturbs it. |
| **STORE-02** | 28-02, 28-05, 28-19 | Ranges stored as ranges, never merged on adjacency, no splitter | ✓ SATISFIED — `Complete` is correct | Driven adjacency (two calls, two rows, distinct ids); structural `coalesc`/`merg`/`splitter` scan green; the union-retype and same-type-subrange shapes pinned by value with DECISION 2 recording the collapse as intended. |
| **STORE-03** | 28-02, 28-05, 28-19, 28-23 | Narrowest-wins exact at 65,536 addresses; **tie-break, range ends, and the behaviour when a typed range is partially overwritten all pinned** | ✓ **SATISFIED — row may move to `Complete`** | See the authorising sentence below. |
| **STORE-04** | 28-06, 28-16, 28-17 | Survives restart; revert; ONE combined planted-violation test | ✓ SATISFIED — `Complete` is correct | Both halves re-driven: `anno-durability.test.ts` 5/5 with the live subprocess planting, and revert re-driven in both directions (returns prior state; refuses an unusable image non-destructively at 69632 → 69632 with the handle alive). |
| **STORE-05** | 28-04, 28-06, 28-09 | Schema version, reserved uninterpreted `bank`, xref access kind, stale-base refusal | ✓ SATISFIED — `Complete` is correct | `SCHEMA_VERSION = 2` driven; `bank` present and never read into a decision; cross-process refusal green (`ok 5`). |
| **STORE-07** | 28-01, 28-03 | `node:sqlite` through exactly one seam | ✓ SATISFIED — `Complete` is correct | One CODE reference repo-wide (`anno-store.ts:132`); `files[]` read directly; the mutator excluded. |

**THE AUTHORISING SENTENCE FOR STORE-03, written to be quoted.** Round 6 blocked
STORE-03 on its third clause with the stated reason *"the partial-overwrite
behaviour for the four split members is pinned to an outcome that discards every
recorded target (`preserved 0/8` across five geometries). CR-10."* The discarding is
unchanged and is arithmetically unavoidable, but that was never the clause: the
clause is that the behaviour is **PINNED**, and criterion 3's own text names the
failure it exists to prevent as **SILENT** un-documenting. **The behaviour is now
pinned to an outcome that is fully disclosed to the caller in the same call that
causes it — both entry-pair sets, every survivor's span, a computed intersection and
a summary naming the cost — and pinned BY VALUE across all five accepted geometries
plus a class-level invariant over entry pairs that I observed going red on my own
planting. STORE-03's third clause is SATISFIED; its first two clauses (65,536-address
oracle cross-validation, the tie-break, both range ends, `$FFFF`, length-1) were
never in doubt and are green. STORE-03 IS SATISFIED and its row may move to
`Complete`; this is the authorising verdict.** Per prohibition 28-18 P2 a row moves
only on a verification verdict — this is that verdict, and this paragraph is the
authorising sentence.

**No other row moves, and no row is demoted.** STORE-01, STORE-02, STORE-04,
STORE-05 and STORE-07 are all already `Complete` and stay there on the evidence
above. I found no gap, so no demotion is warranted anywhere.

**Orphaned requirements:** none. All six IDs the ROADMAP maps to Phase 28 are
claimed by plans and accounted for above. STORE-06 correctly maps to Phase 29 and is
out of scope here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` in any file this phase modified | — | **None found.** Scanned all twelve `anno-*` / `block-class` sources and tests plus the mutator; zero hits. The debt-marker gate does not fire. |
| `src/mcp/vice/anno-store.ts` | 2131-2139, 1918-1922 | Two comments asserting a protection the code does not provide — the THIRD instance in this phase (28-07 P3, 28-21 P1) | ⚠️ Warning | WR-31. Legacy-only input; refusal is atomic and in-family; recoverable via a full cover I drove. |
| `src/mcp/vice/anno-overlap.test.ts` | 1723-1755, used at 1872-1873 | A control the round calls load-bearing that removes zero keys in the committed suite | ⚠️ Warning | WR-32. Does NOT make the class invariant vacuous — proven by planting. |
| `src/mcp/vice/anno-store.ts` | 1968-1971 | A computed field that can only ever answer one value, indistinguishable from a literal | ⚠️ Warning (info tier) | IN-12. |
| `src/mcp/vice/anno-store.ts` | 1932-1943 | A prefix predicate narrowing for a consumer that re-validates by exact membership | ⚠️ Warning (info tier) | IN-13. |
| `src/mcp/vice/anno-store.ts` | 1979 | A prose copy of the partner rule inside a user-facing string, outside the round's own grep | ⚠️ Warning (info tier) | IN-14. |
| `src/mcp/vice/anno-store.ts` | 2410-2428 | A ~44-line contract block detached from the function it documents | ⚠️ Warning | WR-29, carried. |
| `src/mcp/vice/anno-store.ts` | 1196 | Return type widened `void` → `boolean` with no documentation of the boolean | ⚠️ Warning | WR-30, carried. |
| `src/mcp/vice/anno-seam.test.ts` | 405-414, 639 | Two structural controls evadable by an equivalent spelling | ⚠️ Warning | WR-27, IN-11, carried. |
| `src/mcp/vice/anno-store.ts` | 1123, 1606, 1722 | Three sites compute `rolledBack === false` and none marks the handle | ⚠️ Warning | WR-26, carried; two of the three throw with the remedy in the message. |
| `src/mcp/vice/anno-store.ts` | 2942, 2993 | An additive verb with a permanent refusal and no inverse | ⚠️ Warning | WR-28, carried. |
| `src/mcp/vice/anno-store.ts` | 2157, 2160, 2164 | The single-writer property that makes the disclosure complete is undeclared and unenforced by any control | ⚠️ Warning (advisory) | The `coincidental_reliance` item. |

**No blockers.** Every row above is a WARNING — thirteen in total, none of which
falsifies a truth, a criterion or a requirement.

### Decision Coverage

No `28-CONTEXT.md` exists in the phase directory, so the decision-coverage gate
**skips cleanly**. `decision_coverage: { honored: 0, total: 0, not_honored: [] }`.
Non-blocking either way.

### Human Verification Required

This is an infrastructure/foundation phase with no user-facing surface, so the
infrastructure carve-out applies — **except** for the two evidence-gap items and the
judgment-tier prohibition set, which the carve-out does not absorb.

#### 1. The `integrity_check could not be run at all` arm

**Test:** Fault-inject so `pragma integrity_check` itself throws inside `openStore`
(filesystem- or SQLite-level), rather than returning a non-`ok` row.
**Expected:** `AnnoStoreCorruptError` naming the path, the connection closed,
nothing partial returned.
**Why human:** A defensive arm with no reachable input without fault injection.
Presence and wiring re-verified in source this round (`anno-store.ts:534-539` —
`db.close()` precedes the throw and the message names `resolved`); nothing exercises
the throw, and a 10-second spot-check cannot construct the precondition. Open since
round 4, carried unchanged for a fourth time.

#### 2. The host-crash durability bound (`backstop`, abstained: `insufficient_spec`)

**Test:** Host-level crash or power-loss injection across the `stageSnapshot` fsync
→ `publishSnapshot` rename → pointer-row commit sequence.
**Expected:** No surviving state in which a durable `anno_snapshot` pointer row names
an image whose bytes never reached disk; only a missing directory entry or a durable
one.
**Why human:** `fsync` has no in-process observable, so the only in-process evidence
is the source order of two calls — presence, not behaviour. 28-17 filed this honestly
as `backstop`; I carry it as an abstention rather than scoring it either way.

#### 3. The fourteen judgment-tier prohibition verdicts, and the two `violated`

**Test:** Read `prohibition_flags` above and decide whether WR-31's two comments
(`anno-store.ts:2131-2139` and `:1918-1922`), which are scoped in their own words to
*the remainder* but which a reader will take as covering *the row*, constitute a
false guarantee under 28-21 P1 and 28-07 P3.
**Expected:** A decision on whether the correction rides the first future edit to
`retype()` (my recommendation) or needs its own commit.
**Why human:** All fourteen are declared `verification: judgment` by 28-23's own
frontmatter. My verdicts are **NON-AUTHORITATIVE LLM-judge readings** and must not be
absorbed into a silent pass.

### 4. Recommendation — SEAL. No seventh gap-closure round.

**Do not open a seventh round.** My reasoning, with the counter-argument taken
seriously first.

**The counter-argument.** Thirteen WARNINGs are open, two of them new at the very
site the round just edited, and the phase's history says a residual left standing
becomes the next round's blocker. Rounds 4, 5 and 6 each closed one blocker and
opened another at the same function.

**Why it does not apply this time, and the difference is structural.** In every one
of rounds 4-6 the new blocker was found by attacking a ROADMAP criterion's own
purpose sentence and it FALSIFIED that criterion. Round 7's reviewer, for the first
time in three rounds, minted no new CRITICAL — and I checked both new WARNINGs
against all five criteria and all six requirement IDs myself before accepting that.
Neither reaches one:

- **WR-31** needs a store an already-superseded build wrote, refuses atomically and
  in-family, destroys nothing, and I drove the recovery route (a full cover) rather
  than arguing it. No criterion covers legacy-row repairability.
- **WR-32** is a hole in ONE helper's coverage. I measured it (0 drops, all twelve
  steps) AND measured what it does not touch: the invariant it belongs to compares
  two non-empty sets, 8/8/8/8/10, and reds under my planting. And I found something
  the finding does not say — because the carve-out is symmetric, even the missing
  geometry would not red an inverted-but-symmetric implementation, so the hole is
  narrower than reported.

**The root cause of CR-10 is fixed, not the five instances.** The partner rule has
one definition that the writer and the resolver both consume, so the class of defect
where a writer and a resolver silently disagree about what an entry IS cannot recur
by that mechanism. And the assertion that would catch a recurrence — a pair-set
comparison against an independent oracle — now exists at both the instance and the
class level. That is what makes this a closure rather than a patch.

**What to carry into Phase 29 instead of a round.** WR-31's two comments and WR-32's
missing geometry are each one edit; fold them into the first Phase 29 change that
touches `retype()` or `anno-overlap.test.ts`. Surface `reinterpretedSplitTables` on
the MCP tool result when `set_data_type` is published, or the disclosure never
reaches a human. And promote the single-writer property (`insertRange` only inside
`retype()`) into a structural control in `anno-seam.test.ts`, which already owns that
pattern — it is the one undeclared assumption holding up truth 4's class-level
completeness.

### Gaps Summary

**There are none, and this is the first round in seven where that sentence is true.**

The sixth gap-closure round did exactly one thing and did it. It answered CR-10 with
the option round 6 itself sanctioned — accept the fragmentation, disclose what it
cost — and it did so at the root rather than at the five instances: the partner rule
now has one definition that the writer and the resolver both read, so the two can
never silently disagree about what an entry IS. The tests that certified the defect
now assert the disclosure by value, and the class-level assertion that was missing
for six rounds — *no split entry pair vanishes outside the caller's own range without
being named by that write's own report* — exists, compares two non-empty sets from
genuinely different sources, and goes red when I suppress the report.

**On why gaps kept appearing, since the user asked directly.** The honest answer is
not denominator inflation: the denominator has been twelve for three rounds and did
not move this round either — 28-23 declares sixteen plan-level truths and I promoted
none of them. The failing truth in rounds 4, 5 and 6 was in each case the ROADMAP's
own criterion 3, found by asking what its purpose sentence means and driving it. That
sentence is now true of the store's behaviour. **Both of this round's new findings
are plan-derived residuals at 28-23's own new sites, and a plan-derived warning is not
a phase goal that fails.**

All five ROADMAP success criteria hold in every named clause AND in their stated
purposes. All six requirement IDs are satisfied, with STORE-03 clearing on the
authorising sentence above. The goal's four clauses — *durable across a `SIGKILL`*,
*revertible*, *one persistence seam*, *the one irreversible decision* — are each
re-driven and true. **12/12, `human_needed` on two fault-injection items and one
judgment-tier review, and the phase should proceed to Phase 29.**

---

_Verified: 2026-08-29T00:44:57Z_
_Verifier: Claude (gsd-verifier), round 7_
