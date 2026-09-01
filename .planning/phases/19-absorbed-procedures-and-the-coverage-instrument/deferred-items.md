# Phase 19 — deferred items (out of scope for the plan that found them)

## 1. `docs-review-disposition.test.ts` is red on 19-REVIEW.md (found by 19-06, deferred to 19-09)

**Found during:** plan 19-06's plan-level verification (`cd src/mcp/vice && npm test`).

**Condition:** the guard reports 17 findings in
`19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md` with no recorded
disposition: `CR-01`, `IN-01`…`IN-04`, `WR-01`…`WR-12`.

**Why deferred rather than fixed:** 19-06's own `<gap_closure_context>` assigns the
dispositions across the gap-closure run — "Every other WR-* item's disposition is recorded in
19-08 and 19-09". 19-06 discharges exactly two of them (`CR-01`, the originating code review,
and `WR-02`) and names both in `19-06-SUMMARY.md`, which is disposition source 1 of the
guard's five. The remaining 15 belong to plans 19-07, 19-08 and 19-09; recording them here
would be 19-06 claiming work it did not do.

**Clears when:** the last gap-closure plan (19-09) lands its SUMMARY. Not before — the guard
is red *correctly* while the run is in flight.

### Correction — 2026-08-25 (plan 19-13)

**The stated clearing condition was reached and the condition did NOT clear.** 19-09 landed its
SUMMARY at `6b6a34c` on 2026-08-25. The text above is left byte-unchanged as the record of what
was believed; this block is what actually happened.

**Why it did not clear.** Two things, both measured rather than quoted:

1. **A second review pass landed after 19-09.** Commit `80c544b` (2026-08-25, *"docs(19): add code
   review report"*) regenerated `19-REVIEW.md` — it is the file's second and only other commit,
   the first being `81d46d1` on 2026-08-24 — and declared **five new ids**: `CR-04`, `WR-13`,
   `WR-14`, `WR-15`, `IN-05`. Chronology confirmed with `git merge-base --is-ancestor`:
   `5c68473` → `6b6a34c` (19-09's SUMMARY) → `80c544b`. A condition phrased as "when plan N
   lands" cannot survive new findings arriving after plan N.
2. **`CR-02`'s only disposition was an accident, and the same commit erased it.** `CR-02` was never
   in the 17 ids listed above, because at the time it *was* dispositioned — by an incidental mention
   in the then-current `19-VERIFICATION.md`, the guard's source 2. Measured:
   `git show 5c68473:….../19-VERIFICATION.md | grep -c CR-02` = **1**; `grep -c CR-02` against the
   file today = **0**. `80c544b` rewrote that report and the mention went with it, leaving `CR-02`
   as the single undispositioned id. That is precisely the failure mode the phase's ledger now
   exists to end: a disposition that exists only because a report happened to quote an id evaporates
   the next time the report is rewritten, and records nothing about what was done.

**What the guard reports today** — measured at `1494ade` (this plan's Task 1), not quoted from
`19-VERIFICATION.md`:

```
cd src/mcp/vice && node --test docs-review-disposition.test.ts
# tests 7
# pass 7
# fail 0
exit 0
```

`CR-02` was discharged in wave 1 of the second gap-closure run by plan **19-14** (commit `c201da4`),
which filed `.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` — the
guard's source 3. That is the change that took the guard green.

**New clearing condition — phrased so it can actually be satisfied, and it is:**
`19-REVIEW-FIX.md` exists in the phase directory and dispositions **every** id `19-REVIEW.md`
declares, so the green does not depend on any other document continuing to mention any id, AND
`docs-review-disposition.test.ts` passes standalone. Both hold: the ledger was written at `1494ade`,
set equality against the 24 declared ids was demonstrated mechanically in both directions, and the
ledger **alone** — with every other disposition source excluded — covers all 24. The guard's exit
code is above.

**Status: CLEARED 2026-08-25.**

## 2. `audit-integrity.test.ts` D-12-02 cascades from item 1 (found by 19-06, same owner)

**Condition:** `no milestone audit declares a gated status while any docs guard is red
(D-12-02)` fails, naming SEVEN red docs guards. Only ONE of the seven is genuinely red:
`docs-review-disposition.test.ts` (item 1 above). The other six —
`docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`,
`docs-fork-decision`, `docs-linerefs`, `docs-anno-decisions` — each PASS when run
standalone (`node --test <guard>.test.ts` exits 0) and are the known cascade in
`audit-integrity`'s own guard runner.

**Clears when:** item 1 clears.

### Correction — 2026-08-25 (plan 19-13)

The dependency stated above is still the right one — this item only ever cascaded from item 1 — but
it was stated against a prediction that failed, so it inherited that failure. Item 1's correction
block records why. The text above is left byte-unchanged.

**The seven-guard cascade was re-checked standalone rather than assumed.** Every one of the seven
guards `audit-integrity.test.ts`'s D-12-02 message names was run individually at `1494ade`
(`cd src/mcp/vice && node --test <guard>.test.ts`), and every exit code was recorded:

| Guard | Exit | Observed | Status |
|---|---|---|---|
| `docs-review-disposition.test.ts` | 0 | 7 tests / 7 pass / 0 fail | resolved |
| `docs-core-value-decision.test.ts` | 0 | 6 tests / 6 pass / 0 fail | resolved |
| `docs-dangling-refs.test.ts` | 0 | 8 tests / 8 pass / 0 fail | resolved |
| `docs-deferred-ledger.test.ts` | 0 | 6 tests / 6 pass / 0 fail | resolved |
| `docs-fork-decision.test.ts` | 0 | 6 tests / 6 pass / 0 fail | resolved |
| `docs-linerefs.test.ts` | 0 | 3 tests / 3 pass / 0 fail | resolved |
| `docs-absorbed-decisions.test.ts` | 0 | 5 tests / 5 pass / 0 fail | resolved |

**Genuinely red today: zero of seven.** The claim above that six of the seven were only a cascade
artefact is confirmed by measurement, and the seventh — `docs-review-disposition.test.ts`, the one
that was genuinely red — is now green for a real reason (see item 1). `audit-integrity.test.ts`
itself was then run standalone: **exit 0, 44 tests / 44 pass / 0 fail**, so D-12-02 is demonstrated
resolved rather than inferred from an aggregate run.

**New clearing condition:** item 1's new clearing condition is satisfied AND
`audit-integrity.test.ts` passes standalone. Both hold, with the exit codes above.

**Status: CLEARED 2026-08-25.**

**Both conditions pre-date plan 19-06** and are provably untouched by it: `git diff
--name-only 5c68473..HEAD` after 19-06's two task commits lists only
`src/mcp/vice/anno-coverage.ts` and `src/mcp/vice/anno-coverage.test.ts`, and neither guard
reads either file.

## 3. `anno-session.test.ts`'s call-timeout stub test is load-sensitive (found by 19-11)

**Found during:** plan 19-11's plan-level verification (`cd src/mcp/vice && npm test`).

**Condition:** `stub: a child that answers nothing within the call timeout rejects with
AnnoTimeoutError, is killed, and the crash counter increases by 1` failed once in a full-suite
run (`# fail 1`), then passed on both a standalone run of `anno-session.test.ts`
(`# tests 25 / # pass 25 / # fail 0`) and an immediate re-run of the full suite
(`# tests 2578 / # pass 2533 / # fail 0`).

**Why deferred rather than fixed:** the test drives a real child process against a wall-clock
call timeout, so it is sensitive to machine load rather than to any code this plan touched.
19-11 modified only `src/mcp/vice/anno-coverage.ts` and
`src/mcp/vice/anno-coverage.test.ts`; `anno-session.test.ts` reads neither. Widening the
timeout would be a change to a file outside this plan's scope fence, made on one observation.

**Clears when:** a plan that owns `anno-session.ts` either widens the timeout or replaces the
wall-clock wait with an injected clock.

### Re-measured — 2026-08-25 (plan 19-13)

**The clearing condition above is unchanged and still correct** — plan 19-13's `files_modified`
fence covers only `.planning/` files, so widening that timeout is not available to it either, and
making a red gate green by rewriting a ledger is one of this plan's own prohibitions. What follows
is added evidence, not a restatement of the condition.

**The rate is no longer a single observation.** Across five full-suite runs on 2026-08-25 it has
been observed red **twice**: 19-11's first plan-level run (`# fail 1`), then green on 19-11's
immediate re-run, green on the orchestrator's wave-3 post-merge gate runs 1 and 2, and red on run 3
(`# tests 2580 / # pass 2534 / # fail 1`, `not ok 858`). Standalone it has never been observed red:
19-11 recorded 25/25, and this plan ran `node --test anno-session.test.ts` three consecutive times
at `1494ade` — **exit 0, 25 tests / 25 pass / 0 fail on all three.**

**The load-sensitivity diagnosis is now source-level rather than inferred.** The test drives a real
spawned child against a **200 ms** wall-clock budget (`anno-session.test.ts:622`,
`{ timeoutMs: 200 }`, test declared at `:616`). `node --test` runs test *files* concurrently — 12
cores on this host — so under a full suite the 200 ms budget competes with every other file's child
processes, while a standalone run has the machine to itself. That is the mechanism, and it explains
the exact split observed: red only ever under the full suite, never standalone.

**Nothing in either gap-closure run touched it, confirmed rather than assumed.**
`git log a756b17..HEAD -- src/mcp/vice/anno-session.ts src/mcp/vice/anno-session.test.ts` is
empty, and neither file imports anything from `anno-coverage.*`, the only module family this run
modified.

**Still open. Owner: a plan that owns `anno-session.ts`.** Recorded here rather than absorbed,
because a flake that only ever fires in CI's own gate is exactly the kind of item that gets
explained away once per run and never fixed.

**Sixth full-suite observation, same day:** 19-13's own phase gate ran
`cd src/mcp/vice && npm test` at `88d7de4` and came back **green** — `# tests 2580 / # pass 2535 /
# fail 0`, exit 0, `# duration_ms 102561`. The rate is therefore **2 red in 6 full-suite runs** on
2026-08-25, and **0 red in 4 standalone runs**. A green gate does not close this item: an
intermittent failure that happens not to fire is not a fixed one, and the clearing condition above
is unchanged.

---

## `vice-proxy.test.ts` — the same concurrency-flake mechanism, a second file (observed 2026-08-25 by 19-15)

- **Status:** acknowledged
  (v0.5.0 close, 2026-08-25 — real and unfixed; owner is a plan that owns
  `vice-proxy.ts`/`vice-proxy.test.ts`. Carried forward, not closed.)

**Out of scope for 19-15 and deliberately not fixed here.** Two full-suite runs during this plan's
verification came back `# tests 2585 / # pass 2539 / # fail 1` with these two subtests red:

- `vice-proxy.test.ts:1594` — `three states: each unreachable shape gets its own message and fix`
- `vice-proxy.test.ts:2260` — `ending path releases the lease: SIGINT`

Both fail identically: `timed out waiting for a proxy stdout message (stderr so far: )` at
`nextMessage` (`vice-proxy.test.ts:335`), after ~8 s. **Standalone the same file is green** —
`node --test vice-proxy.test.ts` → `# tests 123 / # pass 119 / # fail 0`, 4 skipped, 103 s.

**Same mechanism as item 3 above, a different file.** Each of these tests spawns a real proxy child
and waits on its stdout against a wall-clock budget; `node --test` runs the 24 suite files
concurrently across this host's cores, so under a full suite the budget competes with every other
file's children. Red only under the full suite, never standalone — the identical split.

**Not caused by this plan, confirmed rather than assumed.** 19-15 modified only
`anno-coverage.ts`, `anno-coverage.test.ts` and `fixtures/coverage/`. `vice-proxy.test.ts`
imports nothing from that module family, and the coverage module is read-only by construction
(asserted at source level) so it cannot affect a spawned proxy's stdout timing.

**Still open. Owner: a plan that owns `vice-proxy.ts` / `vice-proxy.test.ts`.** Do not widen a
timeout from a plan fenced out of that file. Recorded here rather than explained away, because item
3 exists precisely because this failure class gets re-explained once per run and never fixed.

---

## The same concurrency flake, observed in a SECOND file under plan 19-18

- **Status:** acknowledged
  (v0.5.0 close, 2026-08-25 — same mechanism as above; carried forward.)

`cd src/mcp/vice && npm test` at the close of plan 19-18: **2627 tests, 2581 pass, 1 fail, 40
skipped, 5 todo**, `duration_ms 155534`. The single red was

```
not ok 905 - stub: a child that answers nothing within the call timeout rejects with
             AnnoTimeoutError, is killed, and the crash counter increases by 1
```

in `anno-session.test.ts` — a file plan 19-18 did not touch. Standalone,
`node --test anno-session.test.ts` reports **25 pass, 0 fail**. The documented `vice-proxy.test.ts`
flake above did NOT reproduce on this run; this one took its place, which is itself the signature of
a wall-clock budget competing with 23 other suite files' children rather than of a defect in either
file.

The mechanism is the one already described above: the assertion measures a **200 ms call timeout**
against wall clock while `node --test` runs the suite files concurrently across this host's cores.

**Not caused by this plan, confirmed rather than assumed.** `git diff --name-only HEAD~3 HEAD` for
plan 19-18 lists exactly `anno-coverage.ts`, `anno-coverage.test.ts` and `19-VALIDATION.md`.
`anno-session.test.ts` imports nothing from the coverage module family, and the coverage module is
read-only by construction (asserted at source level).

**Still open. Owner: a plan that owns `anno-session.ts` / `anno-session.test.ts`.** Plan 19-18 was
explicitly fenced out of that file with a standing prohibition — *"`anno-session.ts`'s 200 ms call
timeout is not widened"* — so widening it here was never an option, and would have been the wrong
fix regardless: the budget is not too small, the measurement is wall-clock under contention.

---

## 4. WR-03 — the illegal-opcode inflation route, PROMOTED into round 4 and CLOSED by plan 19-20

**Status: CLOSED 2026-08-25.** Recorded here with its closing evidence rather than deleted: this
ledger is append-only, and a closed item that carries what closed it is what a later reader needs.

**What it was, measured.** A 64-byte image at `$0810` holding `lda #$01 : ldx #$00` followed by sixty
`$02` bytes reported `reachedAsInstruction=64`, `unreached=0` and `linearSweepDecodable=4`. One
hundred per cent structural completeness on a ninety-four-per-cent-garbage image, with the sibling
figure on the SAME report disagreeing **sixteen-fold**. The round-3 verification measured this and
filed it under Gap 1's `missing` list as a human call — promote it into the closure round, or record
that Phase 20's first use of the instrument accepts it with the contradiction as the tell.

**What it is now, measured** (plan 19-20's SUMMARY and its `19-VALIDATION.md` section): the same
image reports `reachedAsInstruction=4`, `unreached=60`, `linearSweepDecodable=4`. Its byte-identical
twin whose sixty filler bytes are `$ea` is **unchanged** at `64 / 0 / 64`, so the tightening
discriminates rather than refuses. All twelve committed coverage fixtures and the previously-unseen
Phase 11 fixture report the same `reachedAsInstruction` as before. `reachedAsInstruction <=
linearSweepDecodable` is now asserted as a general relation, so the report cannot contradict itself
about its own bytes.

**It is a DIFFERENT route from the dispatch gate, and that is why it was a separate decision.** Every
other gate this round added guards `provenDispatchTargets()` and what may seed a recursive descent.
This one is the census's **own classification** — the recursive descent walked straight through an
illegal opcode and claimed its bytes, while the linear sweep in the same function refused to count
them. The fix is one decodability predicate, `isDecodableAsInstruction()`, read by the descent, the
sweep and `isPlausibleEntryPoint()`, held in place by PINs 5–8.

**Authority for the promotion, and what was deliberately not edited.** `19-CONTEXT.md`'s `<deferred>`
section records WR-03 as deliberately NOT folded into round 4. That deferral was superseded by the
**orchestrator's decision** to promote it, on the grounds that an unfixed, measured inflation on the
number Phase 20 runs under risked a fourth `SC4 partial` and with it D-08's one-way edit.
`19-CONTEXT.md` was **deliberately left byte-unchanged**: a context document rewritten after the fact
to agree with what happened records nothing about what was decided. The promotion is recorded in
`19-VALIDATION.md`'s plan-19-20 section, in `19-DECISIONS.md` Decision 6, and here.

**The rejected alternative and the reversal condition are in `19-DECISIONS.md` Decision 6** (dated
2026-08-25), not restated here as an independent claim. In short: stopping only at the CPU-halting
opcodes and loosening the linear sweep to match was rejected because it would change what
`linearSweepDecodable` MEANS in a report Phase 20 consumes, which owes a `COVERAGE_SCHEMA_VERSION`
bump and a consumer review that this predicate-and-control round does not take.

**The residual, named rather than left for the closure to imply away.** 19-20's fix brings the census
to the linear sweep's **existing** standard. `disasm-opcodes.ts` flags 105 of 256 opcode-table entries
illegal, of which only 12 are `jam`; the other 93 are stable undocumented instructions real C64 code
uses. A program that legitimately executes one of those is now **under-reported by BOTH figures
instead of contradicted by them**. That is the safe direction for an instrument whose point is that
reachability must be PROVEN, and it is no longer silent, because the two figures now agree and the
relation between them is asserted. Its reversal condition is Decision 6's: a real target program
whose `linearSweepDecodable` minus `reachedAsInstruction` gap is explained by a stable undocumented
opcode on a path it really executes.

## 5. D-08 — the SC4 rescoping contingency, RECORDED and NOT ACTED ON

**Status: RECORDED. Not executed by any plan in this round, and not executable without explicit user
confirmation.**

**The contingency, as `19-CONTEXT.md` D-08 states it.** If round 4's verification returns
`SC4 partial` **again**, the conclusion is that the criterion is over-specified for what a heuristic
disassembler can prove, and the next action is to rescope SC4 to **advisory-not-gate** — NOT to run a
round 5. Record that verdict rather than planning another shape fix.

**Why it is written down here.** Three rounds have each ended by fixing the shape that had just been
found, and the fourth was planned the same way until D-06 replaced the loop with a property. Writing
the contingency into the ledger is what stops a fifth round being planned reflexively the moment a
fourth `SC4 partial` appears. It is a decision recorded in advance, not a prediction that the verdict
will be partial.

**It is ONE-WAY, and that rating is the reason it is not acted on here.** Rescoping SC4 edits a
ROADMAP success criterion **and** a REQUIREMENTS entry (COV-01) that **Phase 20's entry conditions
read**. It therefore changes a published contract between phases, which cannot be reversed by
reverting a commit once Phase 20 has planned against it. **It requires explicit user confirmation
before anyone acts on it.**

**What plan 19-19 did and did not do about it.** It wrote this entry. It did not edit `ROADMAP.md`, it
did not edit `.planning/REQUIREMENTS.md`, it did not touch any success criterion, and it ticked no
requirement checkbox — COV-01 and COV-02 remain the phase verifier's judgment, as every plan in this
round has recorded.

---

## 6. Round-4 full-suite observation — item 3 and the `vice-proxy.test.ts` flake, running tally (plan 19-19)

**Neither documented contention flake fired on this round's phase gate.**
`cd src/mcp/vice && npm test` at plan 19-19's close: `# tests 2638`, `# suites 24`, `# pass 2593`,
**`# fail 0`**, `# skipped 40`, `# todo 5`, `# duration_ms 116872.403001`, **exit 0**, with zero
`not ok` lines in the transcript.

**This does not close item 3 and does not close the `vice-proxy.test.ts` item.** A green run is the
absence of an observation, not evidence of a fix. Both clearing conditions are unchanged: item 3
clears when a plan that OWNS `anno-session.ts` either widens the 200 ms budget or replaces the
wall-clock wait with an injected clock; the `vice-proxy.test.ts` item clears the same way for the
file that owns it. Plan 19-19 modified only `.planning/` documents and was fenced out of both files
by a standing prohibition, so widening either budget was never available to it and would have been
the wrong fix regardless — the budget is not too small, the measurement is wall-clock under
contention.

**The round-4 tally, counted from the five plan SUMMARYs rather than from memory:**

| Plan | Full-suite runs | Observed | Which flake | Status |
|---|---|---|---|---|
| 19-15 | 2 | `# tests 2585 / # pass 2539 / # fail 1` on **both** | `vice-proxy.test.ts:1594` and `:2260` | resolved |
| 19-16 | 1 | `# tests 2589 / # pass 2544 / # fail 0` | none | resolved |
| 19-17 | 1 | `# tests 2611 / # pass 2566 / # fail 0` | none | resolved |
| 19-18 | 1 | `# tests 2627 / # pass 2581 / # fail 1` | `anno-session.test.ts` (item 3) | resolved |
| 19-20 | 2 | 2589 pass and 2593 pass, **both `# fail 0`** | none | resolved |
| 19-19 | 1 | `# tests 2638 / # pass 2593 / # fail 0` | none | resolved |

**Eight full-suite runs across round 4, three of them red, and every red was one of these two
files.** Standalone, neither has ever been observed red: 19-15 measured `vice-proxy.test.ts` at
`# tests 123 / # pass 119 / # fail 0` (4 skipped) and 19-18 measured `anno-session.test.ts` at
25 pass / 0 fail. That split — red only under the full suite, never standalone — is the signature the
mechanism predicts, and it is why a green gate is recorded here as an observation rather than as a
clearing event.
