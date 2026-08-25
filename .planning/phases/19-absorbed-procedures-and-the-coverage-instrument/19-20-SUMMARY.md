---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 20
subsystem: testing
tags: [r2000, coverage-census, recursive-descent, disassembler, illegal-opcodes, source-derived-pins]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-15)
    provides: the FP3 fixture pair and the two census values this plan's regression table records
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-16)
    provides: functionBodyFromSource() — the ONE source reader this plan's four pins reuse
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-17)
    provides: the composed corpus, confirmed unaffected by this change rather than assumed to be
  - phase: 19-absorbed-procedures-and-the-coverage-instrument (plan 19-18)
    provides: the route-pin family (PINs 1–4) this plan's PINs 5–8 continue, and withoutComments()/countOccurrences()/scanBodyText()
provides:
  - "isDecodableAsInstruction() — the census module's one decodability predicate, read by the recursive descent, the linear sweep and isPlausibleEntryPoint()"
  - "The WR-03 inflation route closed: a 94%-garbage image reports 4 bytes of code, not 64"
  - "reachedAsInstruction <= linearSweepDecodable asserted as a general relation, so the report cannot contradict itself about its own bytes"
  - "PINs 5–8: the predicate's definition count, its three placed call sites, the decoder's illegal flag read at exactly one comment-stripped site, and the statement order that keeps an illegal byte unreached"
  - "A measured twelve-fixture + Phase 11 regression table proving the tightening moved no committed census number"
  - "Decision 6 — dated, with its rejected alternative, its residual sized at 93 stable undocumented opcodes, and a checkable reversal condition"
affects: [phase-20, coverage-report-consumers, r2000-census]

actuals:
  tokens: 11757
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "One predicate, N consumers — WR-14's extraction pattern applied to the census's decodability standard"
    - "Source-derived pins over the module's own text, with comments stripped and a non-vacuity guard firing before every comparison"
    - "Statement-ORDER assertion as a distinct pin, because counting pins cannot see order"

key-files:
  created: []
  modified:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-DECISIONS.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md

key-decisions:
  - "The recursive descent stops at an illegal opcode and does not claim its bytes; the census's three readers are brought to ONE predicate, and that predicate is the standard the linear sweep and isPlausibleEntryPoint() already used"
  - "The descent moved to the sweep's standard, never the reverse: loosening the sweep would redefine what linearSweepDecodable MEANS in a published report, which owes a COVERAGE_SCHEMA_VERSION bump this predicate-and-control round does not take"
  - "The residual is stated with a size rather than hedged: 105 of 256 opcode-table entries are flagged illegal, only 12 of them jam, so 93 stable undocumented instructions real C64 code uses will now stop a census and under-report it"
  - "The predicate is consulted BEFORE the class-zero marking loop, and that statement order is pinned separately because no counting pin can see it"
  - "requirements-completed is deliberately empty: this plan's own prohibition forbids ticking a REQUIREMENTS.md checkbox, and COV-01 stays open pending phase verification"

patterns-established:
  - "PIN family continuation: PINs 5–8 join 19-16's pairing-consultation pin and 19-18's PINs 1–4 as readers of functionBodyFromSource(), the one source reader in r2000-coverage.test.ts — no second extractor was written"
  - "A behaviour-preserving planted violation as the load-bearing demonstration: plant 28 changed no report number and no report-level control noticed, so only the source-derived pins caught it"

requirements-completed: []

coverage:
  - id: D1
    description: "WR-03 closed: the recursive descent stops at an illegal opcode instead of walking through it and claiming its bytes. A 64-byte image at $0810 holding `lda #$01 : ldx #$00` then sixty $02 bytes reports reachedAsInstruction=4 and unreached=60, where it previously reported 64 and 0 while its sibling figure said 4."
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03: the descent stops at an illegal opcode instead of claiming it -- four code bytes are four, not sixty-four"
        status: pass
    human_judgment: false
  - id: D2
    description: "The tightening discriminates rather than refuses: the byte-identical twin whose sixty filler bytes are $ea still reports reachedAsInstruction=64, unreached=0 and linearSweepDecodable=64, and the pair is asserted to differ at exactly the sixty filler offsets."
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03 both directions: the same payload filled with `nop` still reports every one of its sixty-four bytes reached"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03: the two members of the pair are the same length and differ at exactly the sixty filler offsets"
        status: pass
    human_judgment: false
  - id: D3
    description: "The report can no longer contradict itself: reachedAsInstruction <= linearSweepDecodable is asserted as the general anti-contradiction relation over four payloads, not as a fact about one, because the descent and the sweep are now decided by one predicate."
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03: reachedAsInstruction never exceeds linearSweepDecodable -- the report cannot contradict itself about its own bytes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03: the four byte classes still sum to rangeBytes for both members -- the byte the descent stopped claiming became unreached"
        status: pass
    human_judgment: false
  - id: D4
    description: "One decodability predicate with exactly three consumers — the descent, the linear sweep and isPlausibleEntryPoint() — held in place by four source-derived pins over r2000-coverage.ts's own comment-stripped text, including the statement-order assertion the counting pins cannot make."
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#PIN 5: the decodability predicate is DECLARED exactly once and CALLED from exactly three sites"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#PIN 6: the three call sites are the descent, the linear sweep and the entry-point gate -- and nothing else"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#PIN 7: the decoder's illegal flag is READ at exactly one site in the module, inside the predicate"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#PIN 8: the descent consults the predicate BEFORE the loop that marks class zero"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zero blast radius, measured per fixture: all twelve committed coverage fixtures and the previously-unseen Phase 11 fixture report the same reachedAsInstruction as before (7, 7, 17, 17, 15, 15, 30 six times, and 68), and the recorded table is asserted set-equal to the fixture directory listing in both directions."
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03 regression: every committed coverage fixture reports the SAME reached count it did before the tightening"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-03 regression: the previously-unseen Phase 11 fixture's census is unchanged at 68 of 100"
        status: pass
    human_judgment: false
  - id: D6
    description: "The sealed reproducibility answer still holds with ANSWER.md, ANSWER.sha256 and QUESTION.md byte-unchanged, and plan 19-17's composed corpus is unaffected — both confirmed by running them rather than by assuming the change could not reach them."
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts (22 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Three planted violations recorded in 19-VALIDATION.md, all working-tree-only and restored byte-exact: the predicate loosened, the descent reverted alone (reproducing 64/0/4 exactly), and a behaviour-preserving inline restatement that changed no report number and that only the source-derived pins caught."
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md#The gate watched FAIL — three planted violations (plants 26, 27, 28)"
        status: pass
    human_judgment: true
    rationale: "The demonstrations are one-time working-tree experiments whose record is a document, not a re-runnable assertion. A reader must judge whether the recorded reds are the right reds — in particular whether plant 26 failing to reproduce linearSweepDecodable=4 is the design working (as argued) or a gap."
  - id: D8
    description: "Decision 6 in 19-DECISIONS.md: dated, with the measured contradiction, the rejected alternative and why it was rejected, the residual sized at 93 stable undocumented opcodes out of 105 illegal-flagged entries, and a named checkable reversal condition."
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test docs-r2000-decisions.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts audit-integrity.test.ts (63 pass, 0 fail)"
        status: pass
    human_judgment: true
    rationale: "The guards prove the decision record is well-formed and consistent with the rest of the phase's documents. Whether the tradeoff itself is the right one for a C64 reverse-engineering instrument — under-reporting a census when a program executes a `lax` — is a judgment about the domain that no test asserts."

# Metrics
duration: 29 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 20: The Census Stops Claiming Garbage Summary

**One decodability predicate read by the recursive descent, the linear sweep and the entry-point gate — closing WR-03, the second inflation route on `reachedAsInstruction`, so a 94%-garbage image reports four bytes of code instead of sixty-four while its legal twin still reports all sixty-four.**

## Performance

- **Duration:** ~29 min
- **Started:** ~2026-08-25T13:24:00Z (reconstructed, bounded below by plan 19-18's final commit at 13:23:42Z and above by this plan's first commit at 13:31:07Z)
- **Completed:** ~2026-08-25T13:53:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **WR-03 is closed, and it was a different mechanism from everything else in this round.** Every other plan here guards `provenDispatchTargets()` and what may seed a recursive descent. This one is the census's own classification: the descent walked straight THROUGH an illegal opcode and claimed its bytes as executed code, while the linear sweep eight lines below it in the same function refused to count them. Measured before: `reachedAsInstruction=64`, `unreached=0`, `linearSweepDecodable=4` on a 64-byte image whose only real code is four bytes. Measured after: `4`, `60`, `4`.
- **The root cause was WR-14's pattern one level over, and the fix is the same extraction.** Three places in `r2000-coverage.ts` answer "is this byte an instruction a program executes". The linear sweep asked. `isPlausibleEntryPoint()` asked. The recursive descent — the one producing the headline number — never did. `isDecodableAsInstruction()` is now the one definition, and the descent, the sweep and the entry-point gate are its three consumers.
- **The tightening discriminates rather than refuses.** `NOP_FILLED_IMAGE` is byte-identical to `JAM_FILLED_IMAGE` except that its sixty filler bytes are `$ea`, and it still reports all sixty-four bytes reached. The pair is built by one function from one filler byte, and "the only difference is the filler" is itself an assertion (same length, differing at exactly sixty of sixty-four offsets) rather than a comment.
- **The report can no longer contradict itself, stated as a general relation.** `reachedAsInstruction <= linearSweepDecodable` is asserted over four payloads as the anti-contradiction property, not as a fact about `$02`. Once both figures read one predicate, a byte the sweep refuses is a byte the descent cannot have walked through.
- **Four source-derived pins keep the three readers on one predicate**, continuing 19-18's route-pin family and reusing `functionBodyFromSource()` rather than writing a second extractor. PIN 8 is the one the others cannot make: it asserts the predicate is consulted BEFORE the class-zero marking loop, which is the difference between leaving an illegal byte `unreached` and claiming it and then abandoning it.
- **Zero blast radius, measured rather than hoped.** All twelve committed coverage fixtures and the previously-unseen Phase 11 fixture report the same `reachedAsInstruction` as before — asserted per fixture, with the recorded table set-equal to the directory listing in both directions so a fixture added without a number reds. The sealed reproducibility answer still holds with its three files byte-unchanged, and 19-17's composed corpus stayed 22 pass / 0 fail.
- **Decision 6 records the price with a number.** `disasm-opcodes.ts` flags 105 of 256 entries illegal, of which only 12 are `jam`. The other 93 are stable undocumented instructions real C64 code uses, and a program executing one will now have its census stop there and under-report.

## Task Commits

1. **Task 1 (RED): the WR-03 minimal pair** — `c0677e6` (test) — 2 failures reproducing 64 / 0 / 4
2. **Task 1 (GREEN): one predicate, three consumers** — `751face` (feat)
3. **Task 2: PINs 5–8 and three planted violations** — `8ddfb04` (test)
4. **Task 3: Decision 6** — `ded3352` (docs)

_Task 1 carried `tdd="true"` and produced the RED/GREEN pair. No REFACTOR commit: the GREEN implementation is the extraction itself, and there was nothing left to clean up._

## Files Created/Modified

- `src/mcp/vice/r2000-coverage.ts` — `isDecodableAsInstruction()` added as a type-predicate at module level with the incident written into its doc comment; the descent's guard replaced (before the marking loop, with the reason for that placement written where a reorderer would read it); the linear sweep's two-line skip re-expressed through the predicate with its meaning explicitly unchanged; `isPlausibleEntryPoint()` composed from the predicate plus its in-image bound.
- `src/mcp/vice/r2000-coverage.test.ts` — section 3b (the WR-03 minimal pair, the anti-contradiction relation, and the twelve-fixture + Phase 11 regression statements); section 9c (PINs 5–8 with `CENSUS_SIGNATURE`, `PREDICATE_SIGNATURE`, `censusBodyText()`); `PHASE_11_FIXTURE_PATH` hoisted so two sections read one path spelling.
- `.planning/phases/…/19-DECISIONS.md` — Decision 6 plus its cross-reference row. 81 insertions, 0 deletions.
- `.planning/phases/…/19-VALIDATION.md` — the round-4 plan-19-20 section: the measured contradiction, the twelve-fixture before/after table, the four pins, the three planted violations, the Decision-6 residual, and the observed prohibitions. 170 insertions, 0 deletions across two appends (plus two in-place corrections to this plan's own new rows, which are why the net is still zero deletions only because they were made before the commit).

## Decisions Made

- **The descent moved to the sweep's standard, and not the reverse.** Loosening the sweep to walk through stable undocumented opcodes is arguably more faithful to the machine — a `jam` halts the processor and a `lax` does not — and it would avoid the under-report. It was rejected because it would change what `linearSweepDecodable` MEANS in a report Phase 20 consumes, which owes a `COVERAGE_SCHEMA_VERSION` bump and a consumer review. This round does not bump the schema; `COVERAGE_SCHEMA_VERSION` is still 2 and `COVERAGE_REPORT_KEYS` is unchanged.
- **`requirements-completed` is deliberately empty.** The plan's own prohibitions forbid ticking a REQUIREMENTS.md checkbox, so no requirement was marked complete and `requirements.mark-complete` was not run. COV-01 stays open pending phase verification. This is a documented plan constraint, not an omission.
- **The `CENSUS_SIGNATURE` anchor is the return-type tail, and that is forced.** `computeStructuralCensus()`'s parameter list ends `opts: StructuralCensusOptions = {}`, whose default-value braces would be the first `{` the shared reader met — it would brace-match them and extract an empty body. The reader throws on an empty extraction, so the wrong anchor fails loudly, but `): StructuralCensus {` is the anchor that lets the pins run. Its uniqueness in the module is asserted before anything is read through it.
- **The Phase 11 fixture path was hoisted into one constant** rather than spelled a second time in the new regression test. Two spellings of one path are two fixtures as far as a future rename is concerned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug in the plan's own prediction] Plant 26 does not reproduce `linearSweepDecodable=4`, and the record says so**

- **Found during:** Task 2 (the planted-violation demonstration)
- **Issue:** The plan prescribed removing the illegal test from the predicate — "the pre-fix behaviour, expressed as a one-word edit" — and predicted the WR-03 control would red reporting `reachedAsInstruction=64`, `unreached=0`, `linearSweepDecodable=4`. The measurement was **64 / 0 / 64**. Loosening the SHARED predicate necessarily loosens the sweep as well, so the two figures move together and the general `reachedAsInstruction <= linearSweepDecodable` relation does **not** red under that plant.
- **Fix:** Recorded the measurement as observed rather than reporting the predicted numbers, and explained why: it is the design working. Once both figures read one predicate, no edit expressible as a change to that predicate can make them contradict; only an edit that un-shares them can. Then ran **plant 27** — the descent's guard reverted alone, leaving the sweep strict — which is the literal pre-fix state and reproduced `64 / 0 / 4` exactly, with the general relation red and PINs 5, 6 and 8 red by name.
- **Files modified:** `19-VALIDATION.md` (record only; both plants were working-tree-only)
- **Verification:** `diff -q` against the byte-exact pre-plant copy (sha256 `9574ff73…4ea09`) after every restore; `git diff --quiet -- src/mcp/vice/r2000-coverage.ts` exits 0.
- **Committed in:** `8ddfb04`

**2. [Rule 2 — Missing critical] A third plant, because a behaviour-preserving drift was the untested case**

- **Found during:** Task 2
- **Issue:** Plants 26 and 27 both change behaviour, so both are caught by report-level controls as well as by the pins. Neither establishes that the pins catch the drift they were actually written for: a second inline standard that AGREES today. Without that demonstration the four pins would be asserted-but-unproven against their own threat.
- **Fix:** Added **plant 28** — the sweep restates the test inline (`if (insn.illegal) continue; if (insn.notes.includes("truncated")) continue;`) instead of reading the predicate. It is behaviour-identical: `JAM 4/60/4`, `NOP 64/0/64`, `tsc` exit 0, **not one report-level control moved**, and the composed corpus stayed 22 pass / 0 fail. PINs 5, 6 and 7 all red. That is the load-bearing demonstration of this plan.
- **Files modified:** `19-VALIDATION.md`
- **Verification:** restored byte-exact, re-run 107 pass / 0 fail.
- **Committed in:** `8ddfb04`

**3. [Rule 1 — Bug] The plan's FP3 census values were unstated; measured before use**

- **Found during:** Task 1
- **Issue:** The plan's acceptance criteria list ten known fixture values (7, 7, 17, 17, 30 × 6) and refer to "the two FP3 values from plan 19-15" without naming them. Recording an unmeasured number in a regression table would make the table a wish rather than a measurement.
- **Fix:** Measured both at HEAD before writing the table: **15 and 15**. The regression table records measured values throughout.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`, `19-VALIDATION.md`
- **Verification:** the per-fixture assertions pass, and the recorded table is asserted set-equal to `fixtureDirs()` in both directions.
- **Committed in:** `c0677e6`, `8ddfb04`

**4. [Rule 1 — Bug] Two figures in `19-VALIDATION.md` corrected to measured values before commit**

- **Found during:** Task 2 (self-check while writing the record)
- **Issue:** The pin table initially carried PIN 8's offsets copied from a *planted* run (1683 / 1695) rather than the green tree's, and claimed `functionBodyFromSource()` "now has nine readers" — a count that is 7 call sites.
- **Fix:** Re-measured the green tree's offsets (predicate at **1586**, marking loop at **1682**, sweep region at **2361**, sweep call at **2473**) and replaced the reader-count claim with the named pin families that read the helper.
- **Files modified:** `19-VALIDATION.md`
- **Verification:** offsets recomputed with the same strip-and-brace-match the pin performs; `git diff --numstat` on `19-VALIDATION.md` still shows insertions and ZERO deletions.
- **Committed in:** `8ddfb04`

---

**Total deviations:** 4 auto-fixed (3 × Rule 1 bug, 1 × Rule 2 missing critical)
**Impact on plan:** No scope creep. Deviations 1 and 2 strengthen the demonstration the plan asked for; 3 and 4 replace unmeasured numbers with measured ones in a document whose entire value is that its numbers were observed. Nothing in the plan's fence was widened.

## Issues Encountered

**Plant 26's prediction was wrong, and the honest result is more interesting than the predicted one.** See deviation 1. The plan expected the one-word predicate edit to reproduce the pre-fix 64/0/4; it reproduces 64/0/64, because a shared predicate makes the two figures agree by construction even when both are wrong. Plant 27 was run to establish the pre-fix numbers the round-3 verification reported, and reproduced them exactly. The residual observation worth carrying: **the general `reachedAsInstruction <= linearSweepDecodable` relation cannot red under any edit to the shared predicate** — it can only red under an edit that un-shares the two readers, which is exactly what PINs 5, 6 and 8 exist to catch. The relation and the pins are therefore complementary, not redundant.

**Two pre-existing contention flakes did not appear.** `vice-proxy.test.ts`'s wall-clock budgets and `r2000-session.test.ts`'s 200 ms call timeout each stayed green across two full-suite runs (2589 pass and 2593 pass, both 0 fail). They remain in `deferred-items.md`; nothing about their shape changed and nothing was widened.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The number Phase 20 runs under is now honest on a garbage image.** `reachedAsInstruction` cannot exceed `linearSweepDecodable`, and both are decided by one predicate over the same bounded range.
- **`COVERAGE_SCHEMA_VERSION` is still 2 and `COVERAGE_REPORT_KEYS` is unchanged.** This plan changed what a number MEASURES, not the report's shape, so nothing downstream needs a migration.
- **One open question is handed forward deliberately, with a checkable trigger.** Decision 6's reversal condition: a real target program whose `linearSweepDecodable` minus `reachedAsInstruction` gap is explained by a stable undocumented opcode on a path it really executes. That is the moment to add a named census option and bump the schema, and Decision 6 says it should be taken together with Phase 20's own review of the `flat-three` shape rather than separately.
- **No requirement checkbox was ticked.** COV-01 and COV-02 remain open for the phase verifier, per this plan's own prohibitions.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*

## Self-Check: PASSED

- All five modified/created files exist on disk.
- All five commits (`c0677e6`, `751face`, `8ddfb04`, `ded3352`, `fd26f51`) exist in `git log --all`.
- `cd src/mcp/vice && node --test r2000-coverage.test.ts` — **107 pass, 0 fail**, exit 0.
- `cd src/mcp/vice && node --test r2000-coverage-grammar.test.ts` — **22 pass, 0 fail**.
- `cd src/mcp/vice && npx tsc --noEmit` — exit 0.
- `cd src/mcp/vice && node --test docs-r2000-decisions.test.ts docs-dangling-refs.test.ts docs-deferred-ledger.test.ts audit-integrity.test.ts comment-phase-pointers.test.ts` — **79 pass, 0 fail**.
- Full suite (`npm test`, not the `test:automated` subset) — **2593 pass, 0 fail, 40 skipped, 5 todo** over 24 suites.
- `grep -c 'COVERAGE_SCHEMA_VERSION = 2' src/mcp/vice/r2000-coverage.ts` → **1**.
- `git status --porcelain src/mcp/vice/fixtures/coverage` — empty.
- `git diff --name-only` lists none of `ANSWER.md`, `ANSWER.sha256`, `QUESTION.md`, `19-CONTEXT.md`, `19-REVIEW.md`, `.planning/REQUIREMENTS.md`.
- `19-DECISIONS.md` **81 insertions / 0 deletions**; `19-VALIDATION.md` **170 insertions / 0 deletions**.
- No scope-reduction vocabulary (`v1`, `for now`, `simplified`, `placeholder`, `future phase`) and no phase number in any new string literal in `r2000-coverage.ts`.

_Commit accounting for `actuals.commits: 8`: four task commits (`c0677e6`, `751face`, `8ddfb04`, `ded3352`), the SUMMARY (`fd26f51`), the self-check append (`5ad356d`), the STATE/ROADMAP metadata commit (`5c7ecef`), and this correction. `actuals.tokens` is `chars/4` over the realized `+` lines of the four task commits (47,027 chars), against a plan estimate of 40,000 — an overestimate of roughly 3.4x._
