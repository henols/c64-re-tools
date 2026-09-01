---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 17
subsystem: testing
tags: [6502, static-analysis, coverage, dispatch-gate, property-testing, generated-corpus, computed-oracle, node-test]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "hasDispatchContext()'s pairing parameter and branch-A proven push link (19-15); SplitOrientation.vectorLow and branch B's single membership test (19-16); the committed twin-pair fixture pattern and the class-3/class-4 gate structure (19-08..19-11)"
provides:
  - "src/mcp/vice/anno-coverage-grammar.test.ts — a composed corpus of 1000 indexed arrangements plus 1000 immediate twins, generated from a ten-fragment 6502 alphabet across 72 stratified families"
  - "expectedProvenLink() — one computed oracle of six numbered structural rules deciding every arrangement's expected verdict from its symbolic fragment list, with no hand-declared boolean anywhere in the corpus"
  - "the corpus-wide set equality: the set the instrument PROVES equals exactly the set the oracle says carries a proven data-flow link, asserted in both directions as one statement"
  - "the oracle-isolation source pin — a mechanical assertion that the oracle's own source span never names decode(), scanIndirectDispatch(), computeStructuralCensus() or provenDispatchTargets()"
  - "PINNED_IDIOMS — the nine named shapes this round's history turns on, present in the corpus by byte identity and agreeing with the computed oracle"
  - "the exact-equality census property: an unlinked arrangement reaches exactly its own prologue length, licensed by the one-terminator-last arrangement contract"
  - "19-VALIDATION.md planted-violation rows 19 and 20, each reporting the population of arrangements its loosening falsely proves"
affects: [19-18, 19-19, 19-20, phase-20-decomposition]

# Actuals (#2632)
actuals:
  tokens: 26909
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a corpus is COMPOSED from a fragment alphabet rather than enumerated by hand, so it reaches orderings, interleavings and gap placements nobody wrote down"
    - "the expectation is COMPUTED from composition by one rule set, not declared per payload, so a case nobody anticipated still has a correct expectation"
    - "the specification side reads the symbolic arrangement and the implementation side reads the bytes; they meet only at the final boolean, and that separation is pinned over the file's own source text"
    - "hand-declared regression members exist to check the ORACLE, never to supply the corpus with answers"
    - "a generative sampler's axes are drawn by an avalanche mix, because any linear rotation maps an arithmetic progression on the input to one on the output and silently correlates the axes"

key-files:
  created:
    - src/mcp/vice/anno-coverage-grammar.test.ts
  modified:
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md

key-decisions:
  - "MAX_FRAGMENTS is 8, not the planned 7: the largest declared attachment set is six fragments, which with the two loads is exactly eight, and that arrangement IS the unlinked push idiom the round turns on — a cap of seven would make that family and that pinned member unrepresentable"
  - "byte-distinctness is asserted over INDEXED members only: an immediate twin erases the index register, so two arrangements differing only in X-versus-Y have the same twin by definition, and the collapse is stated as a checked relation instead of suppressed"
  - "the unlinked census assertion at $0830 is `not code and not table-entry` rather than `unreached`: an indexed load's absolute operand marks its base referenced-as-data, which is a fourth, deliberately separate class — the plan's `unreached` would have been false for every indexed arrangement in the corpus"
  - "R3 (class-3 unavailability inside a claimed class-4 window) is implemented faithfully but is non-discriminating in this corpus, because the one-terminator-last contract forces every class-4 window to be the final five fragments; that is documented beside the rule rather than left for a reader to discover"
  - "the generative axes are drawn by a 32-bit avalanche mix seeded per family, after two linear-rotation orderings were each MEASURED to strand one of the two branches under demonstration"
  - "no requirement checkbox was ticked — the round is six plans long and re-checking a requirement box is re-verification's entitlement"

patterns-established:
  - "Composed corpus, computed oracle: generation and expectation are both mechanical, and the only hand-written statement is the rule set"
  - "Oracle isolation as a source pin: the claim that the specification does not call the implementation is asserted over the file's own text between two markers, not left as an intention"
  - "Anti-coupling by hand-declared anchors: a small set of human-read verdicts the computed oracle must agree with, so an oracle drifting into being a copy of the scan reds against the humans rather than passing with the machine"
  - "Falsely-proven POPULATION as the unit of a planted-violation demonstration: a hand-built corpus reports one template per loosening; a composed corpus reports how many arrangements the loosening actually admits"

requirements-completed: [COV-01, COV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A deterministic, stratified corpus of 1000 composed arrangements plus 1000 immediate twins, across all 72 (core combo x attachment set) families, with order, interleaving, gap placement and length as generative dimensions"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the composed corpus is bounded, stratified across every family, and large enough to be a population"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#every family contributed at least MIN_PER_FAMILY members, so the corpus cap is not a prefix of one family"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the corpus reaches every generative dimension: order, interleaving, gap placement and length"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#building the corpus twice yields byte-identical payloads in identical order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every structural invariant of the generator is a throw naming the arrangement: one terminator and it is last, exact payload size, intact data tail, distinct indexed renderings, no JAM opcode at any offset, absolute_y never zeropage_y"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#every payload is exactly 64 bytes with an intact data tail, and no two indexed arrangements are byte-identical"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#no generated payload contains the JAM opcode at any offset"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#every arrangement carries exactly one terminator and it is the last fragment"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#every y-indexed load the alphabet emits renders to the absolute_y opcode and never the zeropage_y one"
        status: pass
    human_judgment: false
  - id: D3
    description: "One computed oracle of six numbered rules decides every arrangement's expectation from its symbolic fragment list, and its isolation from the instrument is a mechanical fact over the file's own source text"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the oracle never reaches the instrument: no decode, no scan, no census inside the oracle section"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the oracle's SCOPE is honest: no corpus payload reaches classes 1 or 2, so the oracle may be silent about them"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "The nine hand-declared pinned verdicts are present in the corpus by byte identity and AGREE with the computed oracle — the anti-coupling check on an oracle drifting toward the implementation"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#all nine pinned regression members are present in the corpus by byte identity"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the computed oracle AGREES with all nine hand-declared pinned verdicts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven data-flow link — one assertion, both directions, over 2000 composed payloads"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the set of arrangements the instrument PROVES equals exactly the set the oracle says carries a proven link"
        status: pass
    human_judgment: false
  - id: D6
    description: "An unlinked arrangement moves not one byte into the seed set or the table-entry class, reaches exactly its own prologue length, and reports the same census as its immediate twin; a LINKED arrangement reaches strictly more than its twin"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#an arrangement the oracle says is unlinked moves not one byte into the seed set or the table-entry class"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#an unlinked arrangement's census reaches exactly its own prologue and classifies no table byte as code"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#twins: an unlinked pair reports the same census, and a LINKED indexed member reaches strictly more than its twin"
        status: pass
    human_judgment: false
  - id: D7
    description: "Non-vacuity: at least twenty payloads are genuinely linked, each publishing a non-empty seed set and a census strictly exceeding its own prologue, so an instrument that had quietly stopped scanning cannot satisfy the properties above"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#the instrument is NOT quietly measuring nothing: the corpus carries a population of genuinely linked arrangements"
        status: pass
    human_judgment: false
  - id: D8
    description: "Degenerate inputs, ordering and idempotency: empty, single-instruction and shorter-than-window payloads produce empty dispatch collections and no throw; every published address list is strictly ascending and duplicate-free; scanning one payload twice is deep-equal"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#degenerate inputs produce empty dispatch collections and no throw"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage-grammar.test.ts#every address list the scan publishes is strictly ascending and free of duplicates, and scanning twice is stable"
        status: pass
    human_judgment: false
  - id: D9
    description: "The corpus-wide property has been WATCHED FAIL against the pre-fix form of each tightened branch, and each demonstration reports how large a population of generated arrangements that loosening falsely proves"
    requirement: COV-01
    verification:
      - kind: manual_procedural
        ref: "branch A reverted in the working tree; node --test anno-coverage-grammar.test.ts observed exit 1, 18 pass / 4 fail of 22, falsely-proven population 3. Branch B reverted; exit 1, 18 pass / 4 fail of 22, falsely-proven population 6. Both restored to 22 pass / 0 fail with git diff --quiet clean"
        status: pass
    human_judgment: true
    rationale: >-
      The planted-violation demonstrations are procedures run by hand in the working tree, not
      committed tests. Their evidence is the transcript recorded in 19-VALIDATION.md; whether that
      record is a faithful account of what was run is a judgment the phase verifier must make, not
      something the suite can assert about itself.

# Metrics
duration: 45 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 17: The Composed Corpus and the Computed Oracle Summary

**A thousand 6502 arrangements composed from a ten-fragment alphabet across 72 stratified families, each one's expected verdict COMPUTED by a six-rule oracle that never touches a byte, and one set equality asserting in both directions that the dispatch instrument proves exactly the arrangements that carry a proven data-flow link.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-25T11:59:00Z
- **Completed:** 2026-08-25T12:44:00Z
- **Tasks:** 3
- **Files modified:** 2 (1 created in `src/`, 1 planning record)

## Accomplishments

- **The loop that closed three rounds one shape at a time is replaced by a property.** Previous
  rounds each ended by committing one hand-built fixture for the shape that had just been found, so
  the suite always trailed the next shape by exactly one round. The corpus now COMPOSES arrangements
  by interleaving a fragment alphabet under a bounded budget — order, interleaving, gap placement and
  length are all generative — and reaches shapes nobody enumerated. Measured reach: load separations
  1 through 9 (past `SPLIT_TABLE_WINDOW`), thirteen distinct prologue lengths from 7 to 19 bytes,
  55 arrangements whose terminator falls outside the leading load's window, all four register
  pairings, both base orders, all three terminators and `nop` counts 0/1/2.

- **The expectation is COMPUTED, not declared.** `expectedProvenLink()` implements six numbered
  structural rules once and decides every arrangement's verdict from its fragment list. There is no
  hand-declared boolean anywhere in the 2000-payload corpus. On the first run, over every one of
  those payloads, the oracle and the instrument agreed — the property was green before a single
  assertion threshold was touched.

- **The oracle is a specification, and that is a mechanical fact.** It reads the SYMBOLIC arrangement;
  the instrument reads bytes. A source-text pin reads this file's own text between two section
  markers and fails if the oracle's span names `decode(`, `scanIndirectDispatch(`,
  `computeStructuralCensus(`, `provenDispatchTargets(`, the wiring helpers, or even `.bytes`. It also
  asserts the span is non-empty and still contains `expectedProvenLink()`, so the pin cannot pass over
  drifted markers.

- **The anti-coupling check holds.** The nine named shapes this round's history turns on are present
  in the corpus by byte identity — the same origin, the same 64-byte payload, the same tables — and
  the computed oracle agrees with all nine hand-declared verdicts (three linked, six unlinked). Both
  polarities are asserted present, so an oracle that answered one way for everything could not satisfy
  them.

- **The census property is an exact equality, not a bound.** The arrangement contract admits exactly
  one terminator and it is last, which is what makes an unlinked arrangement's
  `reachedAsInstruction` equal its own prologue length exactly. Under the branch-A plant the
  violation reported itself as `the census reached 31 bytes of a 15-byte program` — the round-3
  verification's own numbers for the blocker payload, reproduced by a corpus that was never told
  about it. Under the branch-B plant, `33 bytes of a 17-byte program` — 19-16's own pre-fix figures.

- **Both tightened branches were watched fail, and each reports a POPULATION.** Branch A reverted to
  its presence-only form: exit 1, 18 pass / 4 fail of 22, **3 arrangements falsely proven**. Branch B
  reverted to its pre-19-16 window-wide scan: exit 1, 18 pass / 4 fail of 22, **6 arrangements falsely
  proven**. **Seven of the nine are shapes nobody wrote.** A per-shape suite would have reported one
  template per loosening.

- **The suite is cheap.** 22 tests, `duration_ms` **449** against a 30-second asserted budget, over
  2000 payloads each decoded, scanned and censused. The full package suite moved 2589 → 2611 tests
  with **2566 pass, 0 fail**.

- **Nothing shipped changed.** `git diff --quiet -- src/mcp/vice/anno-coverage.ts` exits 0: this plan
  wrote no production code. The new suite is not in `package.json`'s `files[]`, so neither published
  tarball gained a byte, and `check-npm-packages.mjs` reports the same 75 / 34 file counts.

## Task Commits

Each task was committed atomically. Two additional `fix` commits carry deviations found by task 3's
own demonstrations, in the mechanism task 3 exists to exercise.

1. **Task 1: the fragment alphabet and the bounded, stratified arrangement enumerator** — `99b9f54` (test)
2. **Task 2: the computed oracle, and the corpus-wide set equality it makes possible** — `6ea7a49` (test)
3. **[Rule 1] the ORDER axis decorrelated from the terminator axis** — `c2449df` (fix)
4. **[Rule 1] the generative axes drawn by an avalanche mix seeded per family** — `a69e1f6` (fix)
5. **Task 3: the two planted-violation demonstrations and their falsely-proven populations** — `bed4e94` (docs)

**Plan metadata:** see the `docs(19-17): complete` commit at the end of this plan.

## Files Created/Modified

- `src/mcp/vice/anno-coverage-grammar.test.ts` (new, 2169 lines) — the module header stating why the
  file exists and four named things not to do; the geometry constants shared with every committed
  coverage fixture; `type Fragment` and its ten variants with `FRAGMENT_BYTES()`, `loadX()`,
  `loadY()`, `loadImm()`, `storeZp()`, `jmpInd()`, `ldaIndY()`, `PHA`/`TXA`/`TYA`/`NOP`/`RTS`;
  `CORE_COMBOS` (8), `ATTACHMENT_SETS` (9), `FAMILIES` (72), the stratified sampler with
  `mix32()`/`axisIndex()`, `enumerateArrangements()`, `renderArrangement()`, `immediateTwinOf()`,
  `buildCorpus()` and `CORPUS`; the generator throws; `PINNED_IDIOMS`; the wiring helpers
  `scanOfPayload()`, `censusOfPayload()`, `provenIds()`, `expectedIds()`; the oracle section
  (`pairingsOf()`, `classFourWindowsOf()`, `orientationOf()`, `dispatchLinkOf()`,
  `reconstructTargets()`, `everyTargetPlausible()`, `expectedProvenLink()`); and 22 tests.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — a round-4
  section for this plan: the corpus and oracle figures, eight executed-evidence rows, planted-violation
  rows 19 and 20 with their falsely-proven populations, and the sampling-defect finding with the three
  draw designs measured against it. 95 insertions, **0 deletions**.

## Decisions Made

- **`MAX_FRAGMENTS` is 8, not the planned 7.** The largest attachment set the plan itself declares
  (two pushes, a register transfer pair and two adjacent stores) is six fragments, which with the two
  loads is exactly eight — and that arrangement IS the unlinked push idiom, one of the nine members
  the plan requires present by byte identity. Seven would have made both the family and the pinned
  member unrepresentable. Recorded as a deviation below with the arithmetic.

- **Byte-distinctness is asserted over indexed members only.** An immediate twin erases the index
  register, so `lda $0830,x ...` and `lda $0830,y ...` have the same twin by definition. Rather than
  suppress the duplicate count, the collapse is asserted as a relation: two members share a twin only
  when their fragment lists are identical apart from the loads' `register` field.

- **The census claim at the table base is `not code and not table-entry`, not `unreached`.** The
  descent decodes `lda $0830,x`, whose absolute operand marks `$0830` `referenced-as-data` — a fourth,
  deliberately separate class that is reported beside the proven ones and never summed into them. The
  plan's `unreached` would have been false for every indexed arrangement in the corpus; what the plan
  is actually reaching for is that no table byte becomes CODE or a proven TABLE ENTRY, and that is
  what is asserted.

- **R6's plausibility rule states its own scope and throws outside it.** Deciding whether an arbitrary
  in-image byte is a legal entry point needs the decoder the oracle may not call. With the fixed
  `DATA_TAIL` every reconstruction is either inside the sixteen-byte `nop` run or far outside the
  image, so the rule reduces to a range test — and a value landing in between throws by name rather
  than being guessed at, so the reduction is a self-reporting fact rather than a silent assumption.

- **R3 is implemented faithfully and documented as non-discriminating.** A pairing whose leading load
  sits in a claimed class-4 window is unavailable to the class-3 route. In this corpus the rule never
  decides an outcome, because the one-terminator-last contract forces every class-4 window to be the
  final five fragments and no consumer store can then follow either load. That is written down beside
  the rule rather than left for a reader to rediscover.

- **The pinned members are seeded at the head of their own family's list, not appended to the corpus.**
  They are ordinary members of the round-robin take with ordinary ids. What their presence assertion
  states is that the alphabet and geometry genuinely REPRODUCE the historical shapes byte for byte,
  rather than that a corpus with a parallel layout happens to sit beside them.

- **No requirement checkbox was ticked.** `requirements.mark-complete` was deliberately not run, per
  this plan's own prohibition and the precedent 19-15 and 19-16 set. `requirements-completed` above is
  the verbatim copy of this plan's `requirements` field the summary template mandates, and is a
  statement of scope, not of closure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `MAX_FRAGMENTS` raised from 7 to 8**

- **Found during:** Task 1, while sizing the attachment sets
- **Issue:** The plan sets `MAX_FRAGMENTS` to 7 as the cap on non-terminator fragments, and in the
  same task declares an attachment set of six (`two pushes plus a transfer pair plus two adjacent
  stores`) and requires the unlinked push idiom
  (`lda $0830,x : sta $fb : lda $0838,x : sta $fc : pha : txa : pha : tya : rts` — eight
  non-terminator fragments) to be present in the corpus by byte identity. Two loads plus six
  attachment items is 8 > 7, so the family would have contributed zero members, failing
  `MIN_PER_FAMILY`, and the pinned member would have been unrepresentable.
- **Fix:** `MAX_FRAGMENTS` is 8, defined as the cap on the COMPOSED core (two loads plus the
  attachment multiset) with the `nop` LENGTH dimension bounded separately at two. The arithmetic and
  the reason are written into the constant's own doc comment.
- **Files modified:** `src/mcp/vice/anno-coverage-grammar.test.ts`
- **Verification:** All 72 families contribute 11–15 members; all nine pinned members are present.
- **Committed in:** `99b9f54` (Task 1 commit)

**2. [Rule 1 - Bug] Byte-distinctness over the whole corpus is false by construction**

- **Found during:** Task 1, on the generator's first run
- **Issue:** The plan's invariant "no two payloads in the corpus are byte-identical" threw
  immediately: 2000 payloads, 1261 distinct byte strings. An immediate twin replaces each indexed
  load with an immediate load plus a `nop`, which ERASES the index register — so the four register
  pairings of one arrangement collapse to one twin. That is what a twin means, not a generator defect.
- **Fix:** The throw and the assertion are scoped to INDEXED members, which are all distinct, and the
  collapse is stated as a checked relation instead: two members share a twin only when their fragment
  lists are identical apart from the loads' `register` field, and every twin is asserted to differ
  from its own indexed member.
- **Files modified:** `src/mcp/vice/anno-coverage-grammar.test.ts`
- **Verification:** 1000 distinct indexed byte strings asserted; the shared-twin relation asserted
  over every group.
- **Committed in:** `99b9f54` (Task 1 commit)

**3. [Rule 1 - Bug] `classAt($0830)` is `referenced-as-data`, not `unreached`**

- **Found during:** Task 2, measured against the instrument before the assertion was written
- **Issue:** The plan requires, for every unlinked arrangement, that `classAt()` be `unreached` at
  both `$0830` and `$0840`. Measured on the committed instrument, an unlinked indexed arrangement
  reports `$0830` as **`referenced-as-data`**: the descent decodes `lda $0830,x`, whose operand role
  is `absolute` and whose mnemonic is in `DATA_REF_MNEMONICS`, so the census marks that one byte class
  2. The plan's assertion would have been false for every indexed arrangement in the corpus and true
  only for twins.
- **Fix:** The assertion states the claim the plan is reaching for — no table byte may become CODE or
  a proven TABLE ENTRY — as `classAt($0830) ∈ {unreached, referenced-as-data}`, with the reasoning and
  the fourth class's separate status written beside it. `classAt($0840) === "unreached"` is asserted
  unchanged.
- **Files modified:** `src/mcp/vice/anno-coverage-grammar.test.ts`
- **Verification:** Green over all 1978 unlinked payloads; still red under both planted violations,
  which is the discrimination the assertion exists for.
- **Committed in:** `6ea7a49` (Task 2 commit)

**4. [Rule 1 - Bug] The generative axes were correlated with the terminator axis**

- **Found during:** Task 3, by the second planted-violation demonstration
- **Issue:** The first run of plant 20 red with a falsely-proven population of **1** — the pinned
  member alone. Removing that pinned member would have turned the demonstration green, which is the
  "the enumeration is not reaching arrangements that exercise the reverted condition" failure task 3's
  own clause warns about. Cause: the per-family draw indexed each generative axis by a linear rotation
  of the sample index scaled onto the axis length. Any scheme of that form maps an ARITHMETIC
  PROGRESSION in the sample index to one on the axis, and the stratum index is exactly such a
  progression since the terminator is `stratumIndex % 3`. Measured: in the four-store family every
  permutation whose two consumer stores were adjacent landed on the `rts` terminator and never on
  either indirect jump.
- **Fix, in two measured steps.** First the sample index was reordered draw-major
  (`r * STRATA_PER_FAMILY + stratumIndex`), which fixed plant 20 (1 → 5) and broke plant 19 (3 → 1) —
  reordering only moved which branch lost its coverage. The shipped fix replaces the linear rotation
  with a 32-bit avalanche mix of `(familyIndex, sample, axisSeed)`: still a pure function of three
  indices, so the corpus stays byte-reproducible, but a progression on the input is no longer a
  progression on the output. Seeding by FAMILY additionally stopped the eight core combos of one
  attachment set drawing identical permutations — seven eighths of the corpus's ORDER coverage had
  been duplicated.
- **Files modified:** `src/mcp/vice/anno-coverage-grammar.test.ts`
- **Verification:** Plant 19 falsely proves 3 (was 1), plant 20 falsely proves 6 (was 1); the
  determinism test still passes, all 72 families still contribute 11–15 members, and the corpus still
  reaches every generative dimension including load separations of 9. The three designs and their
  measured populations are tabulated in `19-VALIDATION.md`.
- **Committed in:** `c2449df` and `a69e1f6`

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bugs).
**Impact on plan:** All four were necessary for the plan's own deliverables to be true — the first
makes the required pinned member representable, the second and third replace assertions that were
false against the committed instrument, and the fourth was found by the demonstration task 3 mandates
and fixed generatively, exactly as that task's own clause directs. No scope creep: no production code
changed, no fixture was added or deleted, and the per-case suite is byte-unchanged.

## Issues Encountered

None. The full package suite (`cd src/mcp/vice && npm test`) came back **2611 tests / 2566 pass /
0 fail / 40 skipped / 5 todo**. The `vice-proxy.test.ts` full-suite concurrency flake carried in this
phase's `deferred-items.md` did **not** reproduce, for the second run in a row; it stays in the ledger
as a carried item rather than being declared fixed on the strength of two green runs.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && node --test anno-coverage-grammar.test.ts` | **22 pass, 0 fail**, `duration_ms 449` (30 000 budget, asserted in-suite) |
| `cd src/mcp/vice && node --test anno-coverage.test.ts` | **80 pass, 0 fail** — unchanged; the grammar suite JOINS the per-case controls |
| `cd src/mcp/vice && npx tsc --noEmit` | exit 0 |
| `cd src/mcp/vice && node --test ci-suite-coverage.test.ts` | 10 pass, 0 fail — no CI wiring change |
| `node scripts/check-npm-packages.mjs` | exit 0 — 75 / 34 files, unchanged |
| `grep -c 'anno-coverage-grammar' src/mcp/vice/package.json` | **0** — not in `files[]` |
| `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | 24 pass, 0 fail |
| `cd src/mcp/vice && node --test docs-linerefs.test.ts` | 3 pass, 0 fail |
| Full suite `cd src/mcp/vice && npm test` | 2611 tests, **2566 pass, 0 fail**, 40 skipped, 5 todo |
| Corpus | 1000 indexed + 1000 twins, 72 families, **11–15 members per family**, 22 linked / 1978 unlinked |
| Generative reach | separations 1–9, prologue lengths 7–19, 55 terminators outside the window, all registers / base orders / terminators / nop counts |
| Planted violation 19 (branch A presence-only) | exit 1, 18 pass / 4 fail of 22, **3 falsely proven**; restored to 22 pass / 0 fail, source diff clean |
| Planted violation 20 (branch B window-wide) | exit 1, 18 pass / 4 fail of 22, **6 falsely proven**; restored to 22 pass / 0 fail, source diff clean |
| `git diff --quiet -- src/mcp/vice/anno-coverage.ts` | exit 0 — no production code changed, neither revert survived |
| `git diff --numstat` on `19-VALIDATION.md` | 95 insertions, **0 deletions** |

## Prohibitions Observed

- The oracle is never a hand-declared boolean per payload: the only hand declarations in the file are
  the nine `PINNED_IDIOMS`, and they are read only by the anti-coupling check, never by the headline
  property.
- The corpus is not a fixed table with a mode cross-product bolted on: composition, interleaving, gap
  placement and ordering are the generative dimensions, and each is asserted reached.
- The corpus-wide claim is not weakened to a one-directional bound — the equality is ONE assertion
  printing both halves of the symmetric difference, with the reason for not splitting it written into
  the test.
- The corpus cap is reached by round-robin across all 72 families; every family contributes at least
  `MIN_PER_FAMILY` and the assertion names the family.
- No payload contains the JAM opcode at any offset — a generator throw plus a runtime assertion over
  the payload BYTES, never a source grep (the throw's own code necessarily writes the byte value).
- The grammar suite JOINS the per-shape controls: no fixture, payload constant or gate-interior
  declaration was deleted, and `git status --porcelain src/mcp/vice/fixtures/coverage` is empty.
- The file is not in `src/mcp/vice/package.json`'s `files[]`; neither published tarball changed.
- `19-REVIEW.md` is byte-unchanged and `.planning/REQUIREMENTS.md` is byte-unchanged — no requirement
  checkbox was ticked, and `git diff --name-only` never listed either.
- No scope-reduction language (`v1`, `for now`, `simplified`, `placeholder`, `future phase`) and no
  phase-number hand-off in any comment or assertion message this plan wrote; the three documentation
  guards pass.
- `anno-session.ts`'s 200 ms call timeout was not widened; no runtime dependency was added to either
  published package; `COVERAGE_SCHEMA_VERSION` was not touched.

## Known Stubs

None. Every rule the oracle states is exercised in both directions by the corpus: R1 by arrangements
whose loads sit more than `SPLIT_TABLE_WINDOW` apart, R2 by three published class-4 windows and by
windows claimed whose reconstruction is implausible, R4 by the non-adjacent store pairs the alphabet
composes, R5 by both link routes and by the arrangements that carry neither, and R6 by both base
orders. R3 is implemented and correct but does not DECIDE any outcome in this corpus — the
one-terminator-last contract forces every class-4 window to be the final five fragments, after which
no consumer store can follow either load. That is not a stub: the rule is required for the oracle to
model the instrument faithfully, and its inertness under the current contract is documented beside it
so a future alphabet change that makes it live is recognised as such.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The property is in place and green, so 19-18's route-keyed controls and 19-20's WR-03 census
  controls both land beside a corpus-wide statement rather than beside a table of shapes. A new gate
  added to `hasDispatchContext()` without a corresponding oracle rule will red the set equality by
  name, printing the offending arrangements' fragment spellings.
- The fragment alphabet deliberately contains no illegal opcode and asserts the absence of the JAM
  byte at every offset, so the undecodable-byte surface stays cleanly separated from this file's
  verdict and cannot be laundered through it.
- **Open:** COV-01 is not closed by this plan alone. The route-keyed controls (19-18) and the
  undecodable-byte census controls (19-20) are still ahead, and 19-19 runs the phase gate last.
- **Carried:** the `vice-proxy.test.ts` full-suite flake in `deferred-items.md`, which did not
  reproduce this run.

## Self-Check: PASSED

- `src/mcp/vice/anno-coverage-grammar.test.ts` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — FOUND
- Commits `99b9f54`, `6ea7a49`, `c2449df`, `a69e1f6`, `bed4e94` — all FOUND in `git log --all`
- All three tasks' `<acceptance_criteria>` re-run and passing; the plan's `<verification>` block
  re-run in full with no exceptions.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
