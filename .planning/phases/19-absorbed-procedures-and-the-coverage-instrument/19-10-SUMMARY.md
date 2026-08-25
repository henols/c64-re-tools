---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 10
subsystem: testing
tags: [r2000, coverage-instrument, dispatch-scan, 6502, control-fixtures, negative-controls]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-08's class-3 dispatch-context gate, the FP1/FP1b census false-positive pair, and the `provenDispatchTargets()` single seam this plan's predicate feeds"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-14's CR-02 disposition, which took the tree from red to green so this plan's full-suite gate is honest"
provides:
  - "A consumer-matched dispatch gate: a zero-page vector counts as dispatch context only when an indirect jump within reach names the LOWER of two store targets differing by exactly one. The bare-`0x6c`-within-reach branch is REMOVED, not kept alongside."
  - "`fp2-zeropage-data-pointer` — the dispatch gate's first INTERIOR control, generated and committed, asserted at report level through the shipped `buildCoverageReport()`"
  - "`fp2b-immediate-data-pointer` — its immediate twin, so FP2's census is compared against a MEASURED baseline rather than a remembered number"
  - "`DISPATCH_CONTEXT_SHAPES` — the exported, frozen list of shapes the predicate accepts, with the rule that a shape added without an interior control reds the suite by name"
  - "`reachesGateInterior()` + `GATE_INTERIOR_DECLARATIONS` — a witness and a declaration table that make each negative control's POSITION relative to the predicate a mechanically-checked fact, plus a source-derived assertion tying the declared shape count to the predicate's own true-returning site count"
  - "Report idempotency asserted over every committed fixture rather than one hand-picked case"
affects: [phase-20 decomposition sweep, phase-21 hazard report, 19-11 class-4 tightening]

actuals:
  tokens: 41000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Interior negative control: a control must reach INSIDE the predicate it constrains, and the claim is checked by a witness that decodes the payload rather than accepted from a table"
    - "Source-derived count pin: read the predicate's body from the module source, brace-matched, count its true-returning sites, assert equality with the frozen declaration — the enumerated-site discipline of `r2000-spawn-seam.test.ts` applied to a boolean predicate"
    - "Generator invariants as checked negatives: `assertDispatchesNowhere()` throws on any `$6c`/`$48` byte anywhere in a fixture image, so 'this program dispatches nowhere' is a checked property rather than a comment"
    - "Concatenated fixture payloads: prologue + own data literal, never laid into a pre-sized array, so a prologue edit changes the LENGTH instead of being silently absorbed"

key-files:
  created:
    - src/mcp/vice/fixtures/coverage/fp2-zeropage-data-pointer/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp2-zeropage-data-pointer/store.json
    - src/mcp/vice/fixtures/coverage/fp2b-immediate-data-pointer/project.regen2000proj
    - src/mcp/vice/fixtures/coverage/fp2b-immediate-data-pointer/store.json
  modified:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - src/mcp/vice/fixtures/coverage/README.md

key-decisions:
  - "CR-04 is recorded FIXED, not accepted — the bare-`0x6c`-within-reach branch was removed rather than kept alongside the new match, because an indirect jump through some OTHER vector near two indexed loads is not evidence that those loads feed it"
  - "Deviated from the plan's literal instruction to share one `withZeroPageVectorData()` data region between the FP2 pair: a shared region makes the identical-tail throw true by construction, which the generator's own FP1 header already records as worthless, and would have made the plan's own planted-violation criterion unperformable. Each payload carries its own written-out literal, as FP1/FP1b do."
  - "The 64-byte payload invariant was initially unreachable — a fixed-size array absorbs any prologue edit — so payloads are now CONCATENATED from prologue plus data. Discovered by the plan's own planted-violation demonstration failing to fire."
  - "`STACK_RETURN` is declared as the `stack-return-push-idiom` shape's interior control: it reaches that shape's interior and class 3 must still decline it because class 4 claims the window first. Without it that shape would be an unclaimed sufficient shape."
  - "`SPLIT_TABLE_WINDOW` exported so the gate-interior witness asks its question over the same window the predicate rules on, rather than a number typed into a test that could drift"

patterns-established:
  - "Gate-interior declaration: every negative control for a boolean predicate declares which SIDE of the predicate it is on, and the declaration is checked mechanically in both directions"
  - "Witness throws on an unknown key: returning a bare boolean for an unrecognised shape id would let a coverage test pass vacuously for any newly minted id, so throwing is the only behaviour that makes minting an id without a predicate a test failure"

requirements-completed: [COV-02, COV-01]

coverage:
  - id: D1
    description: "A zero-page vector counts as dispatch context only when an indirect jump within reach dispatches THROUGH the vector that was built — the `0x6c` operand value must equal the LOWER of two zero-page store targets differing by exactly one"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#dispatch class 3 DECLINES an ordinary two-table indexed read loop"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate has an INTERIOR control committed as a generated fixture and asserted at report level through the shipped `buildCoverageReport()`: `splitTables === []`, `provenDispatchTargets() === []`, `tableEntryAddresses === []`, `classAt($0840) === \"unreached\"`"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it"
        status: pass
      - kind: other
        ref: "observed RED against the unfixed gate before the fix and green after — values recorded in ## Fail-First Record below"
        status: pass
    human_judgment: false
  - id: D3
    description: "The interior control is proven to BE interior, mechanically — a witness shows the payload satisfies the pre-fix sufficient shape while carrying no `0x6c` and no `pha` anywhere in the image"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#every gate-interior declaration is mechanically TRUE, not a claim in a table"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control"
        status: pass
      - kind: other
        ref: "node fixtures/coverage/make-coverage-fixtures.mjs — assertDispatchesNowhere() throws on any $6c/$48 byte; planted-violation message recorded below"
        status: pass
    human_judgment: false
  - id: D4
    description: "The census baseline is MEASURED, not remembered: the immediate twin is committed at the same origin and length, byte-identical from the end of its 17-byte prologue onward, and the two report the SAME `structural.reachedAsInstruction`"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#FP2b earns its place: without a committed twin, the interior control's census could only be compared against a remembered number"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gate does not become a machine that declines everything — `SPLIT_TABLE` is still PROVEN with `splitTables.length === 1` and its target still reaching `provenDispatchTargets()`"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it"
        status: pass
    human_judgment: false
  - id: D6
    description: "A sufficient shape added to the predicate without an interior control reds the suite BY NAME, and the declared shape count is tied to the predicate's own source text"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#every shape the dispatch predicate accepts is claimed by an interior declaration"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#minting a dispatch shape id without an interior predicate THROWS, naming the id"
        status: pass
      - kind: other
        ref: "planted a third true-returning branch and a synthetic shape id, both observed failing by name, both restored — messages recorded below"
        status: pass
    human_judgment: false
  - id: D7
    description: "COV-01 idempotency — `buildCoverageReport()` over each committed fixture is `deepEqual` to itself, and re-running the generator twice leaves `git status --porcelain src/mcp/vice/fixtures/coverage` empty"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs (twice) && test -z \"$(git status --porcelain fixtures/coverage)\""
        status: pass
    human_judgment: false
  - id: D8
    description: "COV-02 ordering and adjacency/empty edge cases — every address list is strictly ascending and deduped for every committed fixture including the two new ones"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#ordering: every offending-address list in every fixture's report is in ascending numeric order"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#every reported count is a count of the deduped list printed beside it"
        status: pass
    human_judgment: false

# Metrics
duration: 26 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 10: Consumer-Matched Dispatch Gate and the Gate's First Interior Control Summary

**`hasDispatchContext()` now requires the dispatch CONSUMER rather than the construction — an indirect jump whose operand equals the lower of two adjacent zero-page store targets — held down by `fp2-zeropage-data-pointer`, the gate's first interior control, plus a witness-checked declaration table that reds the suite by name when a sufficient shape has no interior control.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-25T07:17:53Z
- **Completed:** 2026-08-25T07:43:30Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **CR-04 FIXED.** The class-3 dispatch gate accepted "two stores into consecutive zero-page addresses within reach" as proof of dispatch — which is how every 16-bit pointer on a 6502 is built, including the ones read through with `lda ($fb),y`. The predicate never looked at what *consumed* the vector it saw being built, so every ordinary pointer setup promoted its data to headline `reachedAsInstruction`.
- **The bare-`0x6c` branch is REMOVED, not kept alongside.** Indirect-jump operand values are now collected and matched against the vector that was built. An indirect jump through some *other* vector near two indexed loads is not evidence that those loads feed it. Checked: the only positive class-3 assertion in the suite is `SPLIT_TABLE`, whose `jmp ($00fb)` operand `0xfb` equals its own `sta $fb` target, so it survives — and it is asserted to survive in the same test as the tightening.
- **The gate has an interior control for the first time.** FP1/FP1b carry no zero-page store at all and `SPLIT_TABLE` carries a real `jmp ($00fb)`; both bracket the predicate from the *outside*. `fp2-zeropage-data-pointer` satisfies every pre-fix condition — two indexed loads through one register, two consecutive zero-page stores inside the window, a resolvable orientation, eight decodable reconstructed targets — while dispatching nowhere. It was observed RED before the fix.
- **The census baseline is measured.** `fp2b-immediate-data-pointer` is committed, byte-identical from offset 17 onward, and the pair's relationship is asserted over the COMMITTED bytes via `payloadOf()` rather than over the generator's constants.
- **The root cause is now unrepeatable.** `DISPATCH_CONTEXT_SHAPES` is exported and frozen; `GATE_INTERIOR_DECLARATIONS` records each negative control's position; `reachesGateInterior()` checks every declaration by decoding the payload and *throws* on an unknown shape id; and the declared shape count is asserted against the number of true-returning sites in `hasDispatchContext()`'s own source text.

## Task Commits

1. **Task 1 (tracer): require the dispatch consumer, commit the interior control** — `7f0499a` (fix)
2. **Task 2: commit the immediate twin as a measured census baseline** — `40530b7` (test)
3. **Task 3: declare which side of the predicate each negative control is on** — `3a9cd40` (test)
4. **Rule 2 deviation: assert idempotency over every committed fixture** — `7581931` (test)

## Files Created/Modified

- `src/mcp/vice/r2000-coverage.ts` — `hasDispatchContext()` rewritten to require the consumer; `DISPATCH_CONTEXT_SHAPES` exported and frozen; `SPLIT_TABLE_WINDOW` exported for the witness; class-3 block comment condition (c) rewritten
- `src/mcp/vice/r2000-coverage.test.ts` — the report-level interior control, the FP2 twin comparison, `FP2b earns its place`, section 8c (witness + declaration table + five assertions), extended section-8b header, fixture-wide idempotency, `COMMITTED_CONTROL_FIXTURES` 8 → 10
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` — `FP2_INDEXED_PROLOGUE`, `FP2_IMMEDIATE_PROLOGUE`, `FP2_CODE_SIZE`, `withZeroPageVectorData()`, `ZEROPAGE_DATA_POINTER`, `IMMEDIATE_DATA_POINTER`, `assertDispatchesNowhere()`, five new invariant throws, two `FIXTURES` rows
- `src/mcp/vice/fixtures/coverage/README.md` — count 8 → 10, two new table rows, a third group in the opening list, a new section on the interior pair's two programs, and the sameness claims corrected in all three places that stated one
- `fp2-zeropage-data-pointer/` and `fp2b-immediate-data-pointer/` — generated project + store files

## The finding this plan discharges

**`19-REVIEW.md` CR-04 — FIXED in commit `7f0499a`.**

CR-04 must not be dispositioned as accepted: it is the defect SC4 / COV-02 turns on. The
census-inflation route it describes is now closed at its root — the predicate requires the
consumer, and the control that reaches the gate's interior is committed so the next tightening
cannot be verified the way this one was.

This plan does **not** name `CR-02`; that finding is 19-14's, and `19-REVIEW.md` is byte-unchanged
by this plan (verified: `git status --porcelain` on it is empty).

## Fail-First Record

The report-level interior control was written and run against the **UNFIXED** gate before the
predicate was touched. Observed, all five:

| Assertion | Pre-fix (observed RED) | Post-fix (observed green) |
|---|---|---|
| `report.dispatch.splitTables.length` | **1** — `{ at: $0812, loBase: $0830, hiBase: $0838, entries: 8, orientationResolved: true }` | **0** (`[]`) |
| `provenDispatchTargets(report.dispatch)` | **`$840, $841, $842, $843, $844, $845, $846, $847`** (eight values) | **`[]`** |
| `report.dispatch.tableEntryAddresses.length` | **16** | **0** (`[]`) |
| `classAt(report.structural, 0x0840)` | **`"reached-as-instruction"`** | **`"unreached"`** |
| `report.structural.reachedAsInstruction` | **33** against a declared `code_size` of **17** | **17** (equal to the declared code size, and equal to the twin's) |

Supporting census figures, same run: pre-fix `tableEntry=16`, `referencedAsData=0`, `unreached=15`,
`splitTableCandidates=0`. Post-fix `tableEntry=0`, `referencedAsData=2`, `unreached=45`,
`splitTableCandidates=1` — the pairing is still *reported* as advisory, which is the honest
outcome rather than the quiet one.

These reproduce the values `19-REVIEW.md` CR-04 recorded against `HEAD` exactly. A control that is
green before the fix is not a control; this one had teeth.

## Planted-Violation Demonstrations

All performed against the committed tree and restored; the tree is byte-clean afterwards.

**Plant A — one prologue byte removed, so the payload length is no longer `0x40`:**
```
Error: ZEROPAGE_DATA_POINTER must be exactly 64 bytes, got 63
```

**Plant B — a `0x6c` byte planted in the data region:**
```
Error: ZEROPAGE_DATA_POINTER must DISPATCH NOWHERE, but carries $6c at offset 42 ($83a) --
$6c is jmp (indirect) and $48 is pha, and either byte anywhere in the image makes this fixture
unable to hold down the property it exists for: that a zero-page vector nothing jumps through is
not dispatch context (CR-04)
```

**Plant C — one data byte altered in ONLY the indexed FP2 payload:**
```
Error: the interior control pair must be BYTE-IDENTICAL from offset 17 onward -- they differ at
offset 39 ($837): indexed has $99, immediate has $47. "Differing ONLY in addressing mode" is a
CHECKED property of these fixtures, not a claim in a comment
```

**Demonstration D — a third true-returning branch added to `hasDispatchContext()` without touching
`DISPATCH_CONTEXT_SHAPES`:**
```
hasDispatchContext() has 3 true-returning site(s) but DISPATCH_CONTEXT_SHAPES declares 2 shape(s):
a sufficient branch was added to the predicate without a matching declared shape (or a shape was
declared with no branch behind it). Every sufficient branch is a decision to treat something as
proof of code and owes the suite an interior control -- see CR-04.
```

**Demonstration E — a synthetic shape id appended to `DISPATCH_CONTEXT_SHAPES`** (3 tests failed):
```
dispatch shape "synthetic-shape-for-the-demonstration" is listed in DISPATCH_CONTEXT_SHAPES but NO
row of GATE_INTERIOR_DECLARATIONS claims its interior. A shape listed there is the decision to
treat it as proof of code; that decision needs a control that reaches INSIDE it, not one that
brackets it from the outside. Claimed shapes: ...
```
and, from the witness:
```
reachesGateInterior() has no interior predicate for shape id
"synthetic-shape-for-the-demonstration". A shape listed in DISPATCH_CONTEXT_SHAPES must have a
predicate here that says what its INTERIOR is, or a control could be declared as its interior
control without anything checking the claim.
```

## The exact shape ids in `DISPATCH_CONTEXT_SHAPES`

For plan 19-11, which extends the same treatment to class 4 — the vocabulary, verbatim and in
predicate-test order:

```ts
export const DISPATCH_CONTEXT_SHAPES: readonly string[] = Object.freeze([
  "stack-return-push-idiom",
  "zeropage-vector-jumped-through",
]);
```

`GATE_INTERIOR_DECLARATIONS`' positions, as populated:

| Control | Position |
|---|---|
| `ORDINARY_INDEXED_COPY` | `OUTSIDE-BRACKETING` |
| `fp1-indexed-copy-loop` | `OUTSIDE-BRACKETING` |
| `fp1b-immediate-copy-loop` | `OUTSIDE-BRACKETING` |
| `fp2b-immediate-data-pointer` | `OUTSIDE-BRACKETING` |
| `fp2-zeropage-data-pointer` | `zeropage-vector-jumped-through` |
| `STACK_RETURN` | `stack-return-push-idiom` |

The `OUTSIDE` sentinel is the string `"OUTSIDE-BRACKETING"` — deliberately not `null` or `""`, so
an omitted position cannot read as a deliberate one.

## Verification Results

| Check | Result |
|---|---|
| `ls -d src/mcp/vice/fixtures/coverage/*/ \| wc -l` | **10** |
| Generator run twice, then `git status --porcelain src/mcp/vice/fixtures/coverage` | **empty — DETERMINISTIC** |
| `cd src/mcp/vice && node --test r2000-coverage.test.ts` | `# tests 64 / # pass 64 / # fail 0` |
| `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | `# tests 2573 / # suites 24 / # pass 2528 / # fail 0 / # skipped 40 / # todo 5` |
| `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `node scripts/check-npm-packages.mjs` | exit 0 — neither tarball packs anything under `fixtures/` |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 |
| `git status --porcelain .planning/REQUIREMENTS.md` | empty — this plan ticks no box |
| `git status --porcelain .../19-REVIEW.md` | empty — byte-unchanged |
| Every commit subject carries `[skip release]` | 4 of 4 |

**On the full-suite scoping allowance.** `<execution_notes>` permitted exactly two known-red
assertions (naming `CR-02` and the D-12-02 cascade) while wave-1 sibling 19-14 was in flight. It
was **not needed**: 19-14 landed before this plan's Task 3 gate, and the observed result is an
unconditional **0 failures**. No failure was waved through, and no planning document was edited to
achieve green.

## Decisions Made

- **CR-04 recorded FIXED, not accepted.** It is the defect SC4 turns on.
- **The bare-`0x6c`-within-reach branch removed rather than kept.** A genuine and intended
  narrowing: an indirect jump through some other vector near two indexed loads is not evidence.
  No existing test relied on it — `SPLIT_TABLE`'s `jmp ($00fb)` operand equals its own `sta $fb`
  target, so the only positive class-3 assertion survives on the new, stricter rule.
- **`STACK_RETURN` declared as the push idiom's interior control.** Two shapes are declared, and
  test 2 requires every shape to be claimed. `STACK_RETURN` reaches that shape's interior and the
  suite already asserts class 3 declines it (class 4 claims the window first, WR-01), so the
  declaration is honest rather than a convenience.
- **`SPLIT_TABLE_WINDOW` exported.** The witness must ask its question over the same window the
  predicate rules on. `MAX_TABLE_ENTRIES` is already exported for the same reason, so this follows
  in-file precedent rather than opening a new surface style.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The FP2 pair's identical-tail invariant would have been true by construction**

- **Found during:** Task 2
- **Issue:** The plan instructed building `IMMEDIATE_DATA_POINTER` "from the same
  `withZeroPageVectorData()` helper so the 47 data bytes are identical by construction". With a
  single shared data region the identical-tail throw can never fire, and the plan's own Task 2
  acceptance criterion — "altering one data byte in **only one** of the two FP2 payloads makes the
  generator throw" — is unperformable. The generator's own FP1 header already records the rule:
  *"A shared constant would make the identical-tail invariant below true by construction and
  therefore worthless."* The plan's `values` prohibition forbids letting incidental text stand in
  for an enforced rule.
- **Fix:** `withZeroPageVectorData(prologue, data)` takes the data region as a parameter, and each
  payload passes its own written-out 47-byte literal, exactly as FP1/FP1b do. The throw is now a
  real check.
- **Files modified:** `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs`
- **Verification:** Plant C above — the throw fires, naming the invariant and offset 39 (`$837`).
- **Committed in:** `40530b7`

**2. [Rule 1 - Bug] The 64-byte payload invariant was structurally unreachable**

- **Found during:** Task 1, while performing the plan's own planted-violation demonstration (a)
- **Issue:** `withZeroPageVectorData()` originally allocated a fixed `new Uint8Array(0x40)` and
  filled it. A prologue edit therefore could not change the payload length — the filler absorbed
  it — so the `must be exactly 64 bytes` throw was unreachable and the plan's criterion (a) plant
  produced no error at all. The invariant was decoration.
- **Fix:** Payloads are CONCATENATED from prologue plus data (`Uint8Array.from([...prologue,
  ...data])`), so the length is the sum of the two parts rather than a constant the helper enforces.
- **Files modified:** `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs`
- **Verification:** Plant A above — `must be exactly 64 bytes, got 63`.
- **Committed in:** `7f0499a`

**3. [Rule 2 - Missing Critical] Idempotency was asserted over one fixture, not the new ones**

- **Found during:** final plan-level verification of the COV-01 idempotency `must_have`
- **Issue:** The `must_have` requires `buildCoverageReport()` over **each new fixture** to be
  `deepEqual` to itself, but the existing idempotency test compared only `nc5-well-documented`
  against itself. The two new fixtures — whose reports carry an advisory `splitTableCandidate` and
  a six-run class map the well-documented control does not — were never covered, so the truth was
  stated but unasserted.
- **Fix:** The assertion now loops `fixtureDirs()`, so every committed fixture is covered and a new
  directory joins automatically. `generatedAt` remains the only field permitted to differ.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
- **Verification:** `node --test r2000-coverage.test.ts` — 64/64 pass; the loop covers all 10 dirs.
- **Committed in:** `7581931`

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 bug)
**Impact on plan:** All three strengthen the plan's own stated properties rather than widening
scope. Two of them were surfaced *by* the plan's insistence on performing its planted-violation
demonstrations rather than describing them — which is the mechanism working as designed. No scope
creep: no new dependency, no schema change (`COVERAGE_SCHEMA_VERSION` stays 2), no shipped CLI flag.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema change. The
plan's own `T-19G-10-04` (a malformed origin/length pair driving the scan out of the 16-bit space)
remains a recorded hand-off to plan 19-12 (IN-05), not a silence — this plan did not touch
`scanIndirectDispatch()`'s bounds.

## Known Stubs

None. No hardcoded empty value flows to output, no placeholder text, no unwired data source. The
one skip-adjacent item is deliberate and pre-existing: `vice-sync.ts`'s checkpoint-wait functions
are documented as not unit-tested, and this plan does not touch them.

## Issues Encountered

The two generator invariants that turned out to be unreachable or vacuous (deviations 1 and 2) were
both found by *performing* the plan's planted-violation criteria rather than assuming them. Plant A
initially produced no error, which is what exposed the fixed-size-array absorption; the fix
(concatenation) then made the throw fire. This is the same defect class the plan exists to
remove — an invariant true by construction — appearing one level down in the fixture generator.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The dispatch gate is consumer-matched, with an interior control and a standing mechanism that
  reds the suite by name when a sufficient shape lacks one.
- **Plan 19-11 (wave 2)** can extend the same treatment to class 4 using the shape-id vocabulary
  recorded above verbatim; `GATE_INTERIOR_DECLARATIONS` and `reachesGateInterior()` are the two
  extension points, and the witness will THROW on any class-4 shape id until 19-11 writes its
  interior predicate — which is the intended forcing function.
- **Plan 19-12 (wave 3)** still owns `T-19G-10-04` / IN-05: bounding `scanIndirectDispatch()` at
  `$10000`.
- Full suite is unconditionally green (0 failures) and nothing is published — every commit carries
  `[skip release]`, and 19-07's condition for lifting the hold (a no-gaps Phase 19
  re-verification) has not yet been met.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
