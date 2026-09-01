---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 16
subsystem: testing
tags: [6502, static-analysis, coverage, dispatch-gate, source-derived-pin, control-fixtures, node-test]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "SplitOrientation, DispatchPairing and hasDispatchContext()'s pairing parameter (19-15); DISPATCH_CONTEXT_SHAPES, GATE_INTERIOR_DECLARATIONS and the source-derived branch-count assertion (19-10, 19-11)"
provides:
  - "SplitOrientation.vectorLow — the pairing's own vector address, derived once in resolveSplitOrientation() and read by hasDispatchContext() branch B"
  - "hasDispatchContext() branch B is one membership test against the pairing's own vector; the window-wide zpStores scan and its nested pair loop are deleted"
  - "ZP_VECTOR_FOREIGN_JUMP / ZP_VECTOR_OWN_JUMP — the ownership interior control and its one-operand-byte-different proven twin, both declared in GATE_INTERIOR_DECLARATIONS"
  - "functionBodyFromSource() — the shared brace-matching source reader, throwing on every failed extraction; plan 19-18's four pins read it"
  - "trueReturnGuardChains() — depth-1 guard-chain extraction with comment stripping and parenthesis-depth tracking"
  - "the pairing-consultation pin — D-02 as an assertion over hasDispatchContext()'s own source text"
  - "19-VALIDATION.md planted-violation rows 16, 17 and 18"
affects: [19-17, 19-18, 19-19, 19-20, phase-20-decomposition]

# Actuals (#2632)
actuals:
  tokens: 11000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a derived quantity travels on the object that justified it, so the two cannot disagree (vectorLow rides SplitOrientation)"
    - "an invariant that constrains code nobody has written yet is asserted over the predicate's own source text, not over declarations its author also writes"
    - "a source-text pin strips comments before reading a guard, so a branch cannot satisfy the pin by describing itself"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md

key-decisions:
  - "vectorLow is a third field on SplitOrientation rather than a fourth parameter or a second scan: it comes out of the same two consumer stores that decided the lo/hi roles, so the vector address and the orientation that justified it cannot drift apart"
  - "branch B's window-wide zpStores collection and its nested b - a === 1 loop were DELETED rather than kept beside the new test — all three existed only to re-derive, from the whole window and without reference to the pairing, a quantity the orientation already knows"
  - "the CR-04 rationale in the doc comment was EXTENDED, not replaced: it is still true and still the reason the branch demands a consumer; the second half added is that a consumer of some OTHER vector is not evidence about this pairing either"
  - "the pairing-consultation pin takes the DEPTH-1 guard chain, never the nearest preceding boundary — branch A's return true sits inside a loop whose immediate condition tests only an opcode"
  - "the guard-chain extraction strips comments and tracks parenthesis depth; both are load-bearing, not tidiness"
  - "no requirement checkbox was ticked — the round is six plans long and re-checking a requirement box is re-verification's entitlement"

patterns-established:
  - "Derived-once, carried-with: a predicate reads a quantity off the object that justified it rather than re-deriving it from the window"
  - "Source-text shape contract: a pin reads the predicate's own body and asserts a property of every branch, including branches nobody has written, and states the convention it imposes beside itself so a future author conforms rather than deleting it"
  - "Extraction defects found by a planted-violation demonstration are fixed, not accepted: a demonstration that reds with the wrong text is a finding"

requirements-completed: [COV-01, COV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "hasDispatchContext() branch B returns true only when the indirect jump names the vector the pairing's OWN two consumer stores built, so a payload that jumps through a foreign vector in the same window reports zero proven dispatch targets"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "The tightening is a DISCRIMINATION, not a refusal — the one-operand-byte-different twin whose jump names the pairing's own vector is still PROVEN, with the eight targets $0840..$0847 and a strictly larger census"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the tightened zero-page-vector branch is LIVE: the one-byte-different twin whose jump names the pairing's OWN vector is still PROVEN"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pre-existing dispatch control keeps its verdict: SPLIT_TABLE, SPLIT_TABLE_CLEAN and SPLIT_TABLE_INTERPOSED still prove, FP2 still declines, and plan 19-15's FP3 pair is unweakened"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a jump through a vector the pairing's own two loads never wrote to is not dispatch context, and the census does not inflate on it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a push idiom that pushes bytes the two paired loads never supplied is not dispatch context, and the census does not inflate on it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both new payloads are mechanically witnessed INSIDE the zeropage-vector-jumped-through interior, one declared negative and one positive, and the positive row is proved accepted"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every gate-interior declaration is mechanically TRUE, not a claim in a table"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a control DECLARED as positive is actually ACCEPTED by the instrument"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-02 is ENFORCED: a source-derived pin extracts every return true site in hasDispatchContext()'s body and asserts each site's own depth-1 guard chain names the pairing parameter, with non-vacuity tied to DISPATCH_CONTEXT_SHAPES.length"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#EVERY true-returning site of hasDispatchContext() consults the PAIRING under test, not merely the window"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#functionBodyFromSource() THROWS naming the signature when the function it is asked for does not exist"
        status: pass
    human_judgment: false
  - id: D6
    description: "The branch-B gate and the pairing-consultation pin have each been WATCHED FAIL under a planted violation and green after restoration — the pin twice, once per true-returning site — recorded in 19-VALIDATION.md as additions only"
    requirement: COV-01
    verification:
      - kind: manual_procedural
        ref: "branch B reverted in the working tree; node --test anno-coverage.test.ts observed exit 1, 76 pass / 2 fail of 78; branch A reverted, 78 pass / 2 fail of 80; branch B reverted again, 77 pass / 3 fail of 80; all three restored to 80 pass / 0 fail with a clean source diff"
        status: pass
    human_judgment: true
    rationale: >-
      The planted-violation demonstrations are procedures run by hand in the working tree, not
      committed tests. Their evidence is the transcript recorded in 19-VALIDATION.md; whether that
      record is a faithful account of what was run is a judgment the phase verifier must make, not
      something the suite can assert about itself.

# Metrics
duration: 14 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 16: The Pairing's Own Vector, and D-02 as an Assertion Summary

**`hasDispatchContext()`'s second true-returning site now compares the indirect jump's operand against the vector the pairing's own two stores built, and a source-derived pin asserts that BOTH branches consult the pairing — so a presence-only branch reds the suite by name instead of satisfying declarations its own author writes.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-25T11:39:17Z
- **Completed:** 2026-08-25T11:53:39Z
- **Tasks:** 3
- **Files modified:** 3 (0 created, 2 in `src/`, plus 1 planning record)

## Accomplishments

- **The defect class is closed in the branch round 3 believed it had fixed.** Branch B already
  demanded a CONSUMER — CR-04's own fix — but went looking for one by scanning the whole window for
  any two consecutive zero-page store targets with a jump naming the lower. It now reads
  `pairing.oriented.vectorLow`, the address the pairing's own two consumer stores built. The
  window-wide `zpStores` array, its collection in the window loop and the nested `b - a === 1`
  double loop are all deleted; `grep -c 'zpStores' src/mcp/vice/anno-coverage.ts` is 0.
- **The defect was worse than the plan anticipated, and the measurement says so.** Under the
  pre-fix predicate `ZP_VECTOR_FOREIGN_JUMP` and `ZP_VECTOR_OWN_JUMP` — payloads that differ at
  exactly one operand byte, one jumping through a foreign vector and one through its own — were
  **byte-for-byte identical in the report**: both `splitTables=1`, both sixteen table-entry
  addresses, both the eight targets `$0840`…`$0847`, both `reached=33`, both
  `classAt($0840)="reached-as-instruction"`. The one byte that is the entire subject of the control
  had no observable effect at all. Post-fix: `0 / 0 / [] / 17 / unreached` against `1 / 16 /
  $0840…$0847 / 33 / reached-as-instruction`.
- **D-02 is an assertion over the predicate's own source text.** The pairing-consultation pin
  extracts every `return true` site in `hasDispatchContext()`'s body, takes each site's DEPTH-1
  guard chain with comments stripped, and asserts each chain names the `pairing` identifier. Its
  non-vacuity is guarded twice — a non-zero site count AND equality with
  `DISPATCH_CONTEXT_SHAPES.length` — so a site the extraction misses cannot hide behind a passing
  pin. Every other guard this round builds is satisfiable by the same author who writes a loose
  branch; this one is not.
- **The pin passes against branch A exactly as 19-15 committed it,** where the `return true` sits
  inside a `for` whose immediate condition reads only `insns[k]!.opcode === 0x60` and the `pairing`
  reference lives in the enclosing `if`. That is the confirmation that the extraction takes the
  depth-1 statement and not the nearest preceding boundary — the failure mode the plan named in
  advance.
- **Three gates watched fail, and one extraction defect found by watching.** Branch B reverted →
  `exit 1`, 76/2 of 78. The pin against branch A's presence-only form → `exit 1`, 78/2 of 80. The
  pin against branch B's presence-only form → `exit 1`, 77/3 of 80. All three restored to 80 pass /
  0 fail with `git diff --quiet -- src/mcp/vice/anno-coverage.ts` clean.
- **`COVERAGE_SCHEMA_VERSION` is still 2 and `COVERAGE_REPORT_KEYS` is unchanged** — a predicate and
  control change, not a report-shape change. No fixture directory was added; both new payloads are
  in-suite constants and `git status --porcelain src/mcp/vice/fixtures/coverage` is empty.

## Task Commits

Each task was committed atomically. Task 1 is a `tdd="true"` task and therefore carries the RED and
GREEN commits separately.

1. **Task 1 (RED): the foreign-jump control and its proven twin, observed failing** — `9e0bbbd` (test)
2. **Task 1 (GREEN): branch B compares the pairing's OWN vector** — `c41ddee` (feat)
3. **Task 2: the branch-B planted-violation record** — `7a68033` (docs)
4. **Task 3: the pairing-consultation pin, and both demonstrations** — `3f13101` (test)

**Plan metadata:** see the `docs(19-16): complete` commit at the end of this plan.

### TDD Gate Compliance

| Gate | Commit | Observed |
|---|---|---|
| RED | `9e0bbbd` `test(19-16)` | `not ok 62 - a jump through a vector the pairing's own two loads never wrote to …` and `not ok 63 - the tightened zero-page-vector branch is LIVE …`, 76 pass / 2 fail of 78 |
| GREEN | `c41ddee` `feat(19-16)` | 78 pass / 0 fail, `npx tsc --noEmit` exit 0 |
| REFACTOR | — | none needed; branch B is now a single membership test and the interface field is three lines |

Gate sequence is present and in order.

## Files Created/Modified

- `src/mcp/vice/anno-coverage.ts` — `SplitOrientation.vectorLow` with the doc comment stating why
  it rides the orientation; `resolveSplitOrientation()` sets it in both arms from
  `Math.min(firstZp, secondZp)`; `hasDispatchContext()` branch B rewritten to one membership test
  against `pairing.oriented.vectorLow`; the `zpStores` array, its collection and the nested pair
  loop deleted; the branch's doc comment gains the second half of the CR-04 rule, naming the shape
  that defeated the previous form.
- `src/mcp/vice/anno-coverage.test.ts` — `ZP_VECTOR_FOREIGN_PROLOGUE`,
  `ZP_VECTOR_JUMP_OPERAND_INDEX`, `withZpVectorData()`, `ZP_VECTOR_FOREIGN_JUMP`,
  `ZP_VECTOR_OWN_JUMP`, `ZP_VECTOR_FOREIGN_JUMP_CODE_BYTES`; two new report-level tests; two new
  `GATE_INTERIOR_DECLARATIONS` rows (one negative, one positive); `COVERAGE_SIGNATURE`,
  `coverageSource()`, `functionBodyFromSource()`, `withoutComments()`, `trueReturnGuardChains()`;
  the branch-count assertion re-pointed at the helper without changing what it asserts; the
  pairing-consultation pin; `functionBodyFromSource()`'s own throw test.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — a
  round-4 section for this plan: executed evidence, planted-violation rows 16, 17 and 18, the
  both-directions evidence, and the extraction-defect finding. 88 insertions across two appends,
  **0 deletions**.

## Decisions Made

- **`vectorLow` rides the orientation.** It could have been a fourth parameter to
  `hasDispatchContext()` or a second scan inside branch B. It is a field on `SplitOrientation`
  because it comes out of the SAME two consumer stores that decided which base holds the low byte:
  the vector address and the orientation that justified it travel together and structurally cannot
  disagree. `resolveSplitOrientation()` needed no new scan — it already had both addresses.
- **The old scan was deleted, not kept beside the new test.** Keeping a window-wide re-derivation
  next to the authoritative value invites a future edit to consult the wrong one. All three pieces
  went.
- **The CR-04 rationale was EXTENDED, not replaced.** Unlike 19-15's branch A, where the stated
  rationale was falsified and had to go, branch B's existing reasoning is still true and still the
  reason the branch demands a consumer. What it was missing is the mirror-image sentence, and that
  is what was added.
- **The pin reads the predicate, not the declarations.** Stated explicitly in the pin's own comment
  and in its failure message, because the message has to survive being read by someone who has just
  added a shape id, a declaration row and a negative control and wants to know why the suite is
  still red.
- **The shape contract the pin imposes is documented beside it.** A branch that computes its
  verdict into a local in an earlier sibling statement and then tests the bare local defeats the
  extraction. That is the one convention this pin imposes, and it is written down plainly so a
  future author conforms rather than deleting the pin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The guard-chain extraction cut `for`-header semicolons**

- **Found during:** Task 3, by the first planted-violation demonstration
- **Issue:** The backward scan that finds the start of a depth-1 statement treated ANY `;` as a
  statement boundary. A `for (init; cond; step)` header carries two semicolons inside its
  parentheses, so the extracted chain for branch A's presence-only form was quoted as
  `k++) { … }` — the header scanned away. The demonstration red for the right reason but printed
  the wrong text, and the latent form of the same bug is worse: a CORRECT branch written as a
  depth-1 `for` whose header names `pairing` would have had that name cut off and would have red.
  That is precisely the "whoever hit that red would be tempted to weaken the pin" failure the plan
  warned about, reached by a route the plan did not anticipate.
- **Fix:** The backward scan now tracks parenthesis depth and accepts `;`, `}` or `{` as a boundary
  only at paren depth 0. The reasoning is written into the code as a comment naming the failure it
  prevents.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** Plant 17 re-run after the fix quoted the full header
  `for (let k = start; k < end; k++) { if (insns[k]!.opcode === 0x48) sawPha++; if (insns[k]!.opcode === 0x60 && sawPha >= 2)`;
  the pin is green against the committed predicate and red against both presence-only forms.
- **Committed in:** `3f13101` (part of the Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix is inside the mechanism task 3 exists to build, found by the
demonstration task 3 mandates, and is the clause of that task's action that says to fix the
extraction rather than accept a demonstration that showed the wrong thing. No scope creep.

## Issues Encountered

None. The full suite (`cd src/mcp/vice && npm test`) came back **2589 tests / 2544 pass / 0 fail /
40 skipped / 5 todo**. Notably the `vice-proxy.test.ts` full-suite concurrency flake that 19-15
recorded in `deferred-items.md` did **not** reproduce in this run — its shape is unchanged
(intermittent, timing-dependent), and it stays in the ledger as a carried item rather than being
declared fixed on the strength of one green run.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && node --test anno-coverage.test.ts` | **80 pass, 0 fail** (baseline 76 — strictly greater, as required) |
| `cd src/mcp/vice && npx tsc --noEmit` | exit 0 |
| `cd src/mcp/vice && node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts` | 27 pass, 0 fail |
| Full suite `cd src/mcp/vice && npm test` | 2589 tests, **2544 pass, 0 fail**, 40 skipped, 5 todo |
| `node scripts/check-npm-packages.mjs` | exit 0 |
| `git status --porcelain src/mcp/vice/fixtures/coverage` | **empty** — no fixture change |
| `grep -c 'vectorLow' src/mcp/vice/anno-coverage.ts` | **7** (interface field, both return arms, branch B's read, plus doc-comment mentions) — at least 4 required |
| `grep -c 'zpStores' src/mcp/vice/anno-coverage.ts` | **0** |
| `grep -c 'COVERAGE_SCHEMA_VERSION = 2' src/mcp/vice/anno-coverage.ts` | **1** |
| `ZP_VECTOR_FOREIGN_JUMP` report | `splitTables=[]`, `provenDispatchTargets=[]`, `tableEntryAddresses=[]`, `splitTableCandidates=1`, `reachedAsInstruction=17`, `classAt($0840)="unreached"` |
| `ZP_VECTOR_OWN_JUMP` report | `splitTables.length=1`, `provenDispatchTargets` deep-equal `[$0840…$0847]`, `reachedAsInstruction=33` |
| The two payloads differ at exactly one byte offset | asserted in the suite against `ZP_VECTOR_JUMP_OPERAND_INDEX` |
| `reportFor("fp3-unlinked-push-idiom")` | still `reachedAsInstruction === 15` with empty `splitTables` — 19-15's control unweakened |
| `reportFor("fp2-zeropage-data-pointer")` | still `dispatch.splitTables === []` |
| Pin extracted site count | **2**, equal to `DISPATCH_CONTEXT_SHAPES.length`, both chains naming `pairing` |
| `git diff --numstat` on `19-VALIDATION.md` | 54 + 34 = **88 insertions, 0 deletions** |
| Planted violations 16 / 17 / 18 | exit 1 with 76/2, 78/2, 77/3; restored to 80 pass / 0 fail; source diff clean after each |

## Prohibitions Observed

- `19-REVIEW.md` is byte-unchanged; `git diff --name-only` never listed it.
- `.planning/REQUIREMENTS.md` is byte-unchanged and **no requirement checkbox was ticked**.
  `requirements.mark-complete` was deliberately NOT run. `requirements-completed` above is the
  verbatim copy of this plan's `requirements` field that the summary template mandates, and is a
  statement of scope, not of closure: COV-01 remains open, this plan is one of six in the round,
  and re-checking a requirement box is re-verification's entitlement.
- `COVERAGE_SCHEMA_VERSION` not bumped; `COVERAGE_REPORT_KEYS` unchanged.
- The both-directions rule held in the same commit: the RED commit carries the payload that must be
  declined AND the payload that must still be accepted, and the GREEN commit turned the first red
  and left the second green.
- Neither new control was declared interior on a claim: both carry the class-3 pairing precondition
  and a consecutive zero-page construction inside the window, which is that shape's declared
  interior, and the declaration is checked mechanically by `reachesGateInterior()`.
- No scope-reduction language (`v1`, `for now`, `simplified`, `placeholder`, `future phase`) and no
  phase-number pointer in any comment or assertion message this plan wrote — grep over the plan's
  own additions returned nothing, and the three documentation guards pass.
- No new string or template literal in `src/mcp/vice/anno-coverage.ts` names a phase number; this
  plan's additions there are comments and one field.
- WR-03 not touched and not absorbed. `anno-session.ts`'s 200 ms timeout not widened.
- No runtime dependency added to either published package.

## Known Stubs

None. Every line this plan wrote to the predicate is exercised in both directions by a committed
test — branch B is asserted to DECLINE `ZP_VECTOR_FOREIGN_JUMP` and to ACCEPT `ZP_VECTOR_OWN_JUMP`,
`SPLIT_TABLE`, `SPLIT_TABLE_CLEAN` and `SPLIT_TABLE_INTERPOSED` — and every helper the pin is built
on has its own failure mode asserted rather than assumed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `functionBodyFromSource()` is in place as the single source reader, with its throw proved, which
  is what plan 19-18's four source-derived pins read.
- Both true-returning sites of `hasDispatchContext()` now have the same shape, so 19-18's re-key of
  `position` to `{shape, route}` has two symmetric branches to describe rather than two asymmetric
  ones.
- `ZP_VECTOR_FOREIGN_JUMP` / `ZP_VECTOR_OWN_JUMP` is a third instance of the indexed-payload /
  minimal-pair-twin grammar 19-17 generalises into a generated-payload property, and the first one
  whose distinguishing edit is a single operand byte rather than a relocation.
- **Open:** COV-01 is not closed by this plan alone. The property assertion (19-17), the
  route-keyed controls (19-18) and WR-03 (19-20) are still ahead, and 19-19 runs the phase gate
  last.
- **Carried:** the `vice-proxy.test.ts` full-suite flake in `deferred-items.md`, which did not
  reproduce this run.

## Self-Check: PASSED

- `src/mcp/vice/anno-coverage.ts` — FOUND
- `src/mcp/vice/anno-coverage.test.ts` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — FOUND
- Commits `9e0bbbd`, `c41ddee`, `7a68033`, `3f13101` — all FOUND in `git log --all`
- All plan `<acceptance_criteria>` re-run and passing; plan `<verification>` re-run in full with no
  exceptions.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
