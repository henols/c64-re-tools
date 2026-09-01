---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 18
subsystem: testing
tags: [6502, static-analysis, coverage, dispatch-gate, source-derived-pins, anti-regression, node-test]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "hasDispatchContext()'s pairing parameter and branch-A proven push link (19-15); SplitOrientation.vectorLow, branch B's single membership test and functionBodyFromSource() promoted as the one source reader (19-16); the composed corpus and computed oracle that independently cover this plan's declaration layer (19-17); GATE_INTERIOR_DECLARATIONS, polarity and reachesGateInterior() (19-08..19-11)"
provides:
  - "src/mcp/vice/anno-coverage.ts — DISPATCH_GATE_ROUTES, a frozen exported array of frozen route records (id, consultsSharedGate, publishesInto) declaring the complete set of gates that may publish a shape-gated proven finding"
  - "src/mcp/vice/anno-coverage.ts — PROVEN_TARGET_SOURCES, the frozen exported set of the four scan collections provenDispatchTargets() reads, with the advisory collection deliberately absent"
  - "reachesGateInterior(bytes, origin, shapeId, route) — a four-argument witness with ONE predicate per (shape, route) pair and NO disjunction, throwing on an unknown shape, an undeclared route, and an unreachable pair"
  - "GateInteriorDeclaration.route — the second half of a control target's identity, null only on an OUTSIDE row"
  - "GATE_ROUTE_REACHABILITY — the full cross product of shapes and routes with a reachability verdict per pair, set-equal to the cross product in both directions"
  - "the (shape x route) coverage assertion, replacing its shape-keyed predecessor, with per-route decline measured through that route's own publishesInto collection"
  - "four source-derived pins over anno-coverage.ts's own text: the shared gate's call sites, each route's publication site, the seam's source set, and the ordering that separates the two gates"
  - "19-VALIDATION.md rows 21-25 and 25b — five planted-violation demonstrations, including one against this mechanism's own dodge and one measuring a 972-of-2000 falsely-proven population"
affects: [19-19, 19-20, phase-20-decomposition]

# Actuals (#2632)
actuals:
  tokens: 18276
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a control target is a (shape, route) PAIR, never a shape: a shape ruled on by two gates owes a negative control per gate, and a disjunction between routes lets one gate's control vouch for the other's"
    - "a route's verdict is measured through the collection THAT ROUTE publishes into, never through the aggregate seam, so one payload can be a decline on one route and an acceptance on another"
    - "reachability is DERIVED wherever it can be: a pair on a gate-consulting route cannot be declared unreachable while its shape is still declared, which closes the dodge of marking a pair unreachable to stop owing it a control"
    - "an unanswerable pair makes the witness THROW rather than answer, so it cannot become a place to file a control nothing contradicts"
    - "an enumeration meant to constrain future edits is pinned to the module's own source text -- call sites, publication sites, source sets and ORDERING -- with comments stripped, so no pin is satisfiable by editing a comment"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md

key-decisions:
  - "PUSH_IDIOM_WINDOW_EDGE is declared where the witness actually places it -- interior to (zeropage-vector-jumped-through, class-3-pass) -- and not as OUTSIDE as the plan's row list stated: its payload is FP3's prologue plus one nop, so it still carries FP3's two consecutive zero-page stores, and an OUTSIDE row would have been a false declaration the mechanical-truth check catches"
  - "SPLIT_TABLE_CLEAN and SPLIT_TABLE_INTERPOSED stay POSITIVE: the plan's blanket 'the rest of the interior rows as negative' would have mis-declared two controls the instrument genuinely accepts, and the new route-scoped measurement reds on exactly that mis-declaration"
  - "which pairs the witness can answer is stated ONCE, in GATE_INTERIOR_PREDICATE_PAIRS, and read by both the witness's throw and the declaration checks -- a second list would drift from the dispatch it describes"
  - "positive-control acceptance is measured through routePublications(scan, route) rather than provenDispatchTargets(), which is what makes STACK_RETURN's dual role expressible at all"
  - "the advisory-source plant did NOT red the composed-corpus property, and that is recorded as the observed fact with its cause (an advisory record carries targets: []) rather than reported as the expected second red; a stronger variant was then run to measure what the corpus does catch once the leak is real -- 972 falsely-proven of 2000"
  - "no requirement checkbox was ticked: the round is still open and re-checking a requirement box is re-verification's entitlement, not an executor's"

patterns-established:
  - "(shape x route) keying: the identity of a control target includes which gate rules on it, so a new gate forces a new control rather than inheriting an old one"
  - "Derived-where-derivable reachability: a declaration that could be used to dodge an obligation is asserted against a derivation wherever the derivation exists, and the dodge is watched failing"
  - "Route-scoped verdict measurement: a gate's decline is read in the gate's own publication collection, because an aggregate read makes a two-route payload's two verdicts collapse into one"
  - "Ordering as a source pin: 'this gate runs before that one consults the shared predicate' is asserted as a byte offset between two CODE anchors, turning a reachability claim into a source-level fact"
  - "Honest plant reporting: a demonstration that produces fewer reds than the plan predicted is recorded with its measured cause and followed by a stronger variant, rather than being written up as the predicted result"

requirements-completed: [COV-01, COV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A control's declared position is a (shape, route) pair: reachesGateInterior() takes the route, the disjunction is gone, and the class-4-only control provably does not claim the class-3 route"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the class-4-only control does NOT claim the class-3 route: the disjunction is gone"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#FP3 is interior to the class-3 route and OUTSIDE the class-4 one, so the two routes are genuinely distinguished"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every gate-interior declaration is mechanically TRUE, not a claim in a table"
        status: pass
    human_judgment: false
  - id: D2
    description: "The witness throws on an unknown shape, an undeclared route and an unreachable (shape, route) pair, and is pure over its four arguments"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#asking the witness about an UNREACHABLE (shape, route) pair THROWS, naming both"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#minting a ROUTE nobody declared THROWS, naming the route"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the witness is PURE over its four arguments: two calls on one payload return the same answer"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every REACHABLE (shape x route) pair has a negative control that reaches inside it and whose DECLINE is measured through that route's own publication collection; STACK_RETURN's dual role is expressed as two rows"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every REACHABLE (shape, route) pair is claimed by a negative interior declaration"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every REACHABLE pair's negative controls are confirmed INSIDE it by the witness"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every REACHABLE pair's verdicts are measured in THAT ROUTE'S own collection, never through the aggregate seam"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a control DECLARED as positive is actually ACCEPTED by the instrument"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full cross product of shapes and routes is declared with a reachability verdict per pair, reachability on a gate-consulting route is derived rather than declared, and every unreachable pair makes the witness throw"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the reachability matrix is exactly the cross product of the declared shapes and the declared routes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#reachability on a route that CONSULTS the shared gate is DERIVED, not declared"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every UNREACHABLE (shape, route) pair makes the witness THROW, naming the pair"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#NON-VACUITY per route: each reachable pair has a payload inside it AND a payload outside it"
        status: pass
    human_judgment: false
  - id: D5
    description: "The route set, its call sites, its publication sites, the seam's own source set and the two gates' ordering are all derived from anno-coverage.ts's own text"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#PIN 1: the number of hasDispatchContext() CALL SITES equals the number of routes that consult the shared gate"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#PIN 2: each route publishes from exactly ONE site inside scanIndirectDispatch(), and the sites total the route count"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#PIN 3: the seam's own sources are exactly PROVEN_TARGET_SOURCES, and every route publishes into one of them"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#PIN 4: the class-4 publication site PRECEDES the shared gate's only call site, and no call precedes it"
        status: pass
    human_judgment: false
  - id: D6
    description: "Five planted violations observed red and restored green, recorded in 19-VALIDATION.md with verbatim messages, counts and exit codes -- including the one that tests this mechanism's own dodge"
    requirement: COV-01
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md#The gate watched FAIL — three planted violations"
        status: pass
      - kind: manual_procedural
        ref: ".planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md#The pins watched FAIL — two planted violations"
        status: pass
      - kind: unit
        ref: "git diff --quiet -- src/mcp/vice/anno-coverage.ts && git diff --quiet -- src/mcp/vice/anno-coverage.test.ts (no plant survived)"
        status: pass
    human_judgment: true
    rationale: "The demonstrations are working-tree edits that cannot be re-run from a committed artifact; the record is the evidence, and a reader has to judge whether each recorded red is the red the guard was supposed to produce."

# Metrics
duration: 26 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 18: (Shape × Route) Control Targets and the Source-Derived Route Set Summary

**The anti-regression mechanism's own hole is closed: a control target is now a (shape, route) pair, the disjunction that let a class-4-only control vouch for the class-3 route is deleted, and the route set — its call sites, publication sites, seam sources and gate ordering — is read from `anno-coverage.ts`'s own text rather than mirrored by hand.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-25T12:52:50Z
- **Completed:** 2026-08-25T13:18:56Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **The leak is closed rather than moved, and one assertion proves it.** `reachesGateInterior(STACK_RETURN_MIXED_REGISTERS, $c000, "stack-return-push-idiom", "class-3-pass")` is `false` and with `"class-4-pass"` is `true`. Before the re-key, one call answered for both routes and the class-4 answer stood in for the class-3 one — which is how three declared negative controls covered a route none of them had ever entered.
- **`STACK_RETURN`'s dual role is expressible for the first time and is expressed as two rows.** Measured through `provenDispatchTargets()` the payload looks accepted; measured through `splitTables` it is correctly a class-3 decline; measured through `stackReturnDispatch` it is correctly a class-4 acceptance. Route-scoped measurement is what makes those three facts coexist.
- **The obvious dodge is watched.** Flipping a genuinely reachable pair to `reachable: false` reds three independent checks — the derived-reachability equality, the unreachable-pairs throw check, and the coverage assertion's stale-row half.
- **Four source-derived pins** hold the route enumeration down against the module's own text: 1 call site = 1 gate-consulting route; 1 publication site per route, total 2; the seam's four `scan.` fields set-equal to `PROVEN_TARGET_SOURCES` in both directions; and `stackReturnDispatch.push(` at body offset 4474 preceding `hasDispatchContext(` at 5750 with no gate call before it.
- **Five planted violations observed red and restored green**, each with verbatim failure text, counts and exit codes in `19-VALIDATION.md` — plus a sixth measurement (25b) taken because plant 25 produced fewer reds than predicted.

## Task Commits

1. **Task 1 RED: failing tests for the (shape, route) control target** — `17cfdb5` (test) — 5 of 6 red against the three-argument witness
2. **Task 1 GREEN: re-key control identity from shape to (shape, route)** — `8a0cd66` (feat)
3. **Task 2: the reachability matrix and the (shape × route) coverage assertion** — `381a728` (test)
4. **Task 3: derive the route set from source — four pins** — `93f57e5` (test)
5. **Deferred: the anno-session concurrency flake, recorded not absorbed** — `0caa412` (docs)

**Plan metadata:** see the `docs(19-18)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/anno-coverage.ts` — `DispatchGateRoute`, `DISPATCH_GATE_ROUTES` and `PROVEN_TARGET_SOURCES`, exported and frozen. Two declarations of what the module already does; no behaviour changed, and `git diff --quiet` on this file passes at the end of every task.
- `src/mcp/vice/anno-coverage.test.ts` — the four-argument witness with one predicate per pair and no OR; `GATE_INTERIOR_PREDICATE_PAIRS`; `GateInteriorDeclaration.route`; 18 declaration rows (was 15); `routePublications()`; `GATE_ROUTE_REACHABILITY`; the pair-keyed coverage assertion and its four mechanical checks; per-route non-vacuity; the four source-derived pins. 80 → 96 tests.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — the round-4 plan-19-18 section: the evidence table, the three-way `STACK_RETURN` measurement, planted violations 21–25 and 25b, the four-pin table, and the prohibitions record.
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — the `anno-session.test.ts` full-suite concurrency flake, recorded with its confirmation that this plan did not cause it.

## Decisions Made

- **`PUSH_IDIOM_WINDOW_EDGE` is declared interior to (`zeropage-vector-jumped-through`, `class-3-pass`), not `OUTSIDE`.** The plan's row list assigned it `OUTSIDE`/`null`. That is false: the payload is FP3's prologue with one `nop` inserted, so it still carries FP3's two consecutive zero-page stores inside the pairing window and the witness places it inside that shape. An `OUTSIDE` row would have been caught by the mechanical-truth check on the very commit that added it. Its window-edge job — being the JUST-outside half of the push-idiom route's witness pair — is discharged by the non-vacuity statements, exactly as the plan directs, and does not require a row.
- **`SPLIT_TABLE_CLEAN` and `SPLIT_TABLE_INTERPOSED` remain `positive`.** The plan's sentence "declare `PUSH_IDIOM_LINKED` and `ZP_VECTOR_OWN_JUMP` as positive and the rest of the interior rows as negative" would have re-labelled two controls the instrument genuinely accepts; the new route-scoped measurement reds on exactly that mis-declaration, and the plan's own prohibition against deleting or degrading existing rows points the same way.
- **Which pairs the witness can answer is stated once.** `GATE_INTERIOR_PREDICATE_PAIRS` is read by the witness's own throw and by the declaration checks, so "which pairs are answerable" cannot drift from the dispatch it describes.
- **The advisory-source plant's outcome is reported as observed.** It reds pin 3 and leaves the composed corpus green, because an advisory record is built with `targets: []` and therefore leaks nothing. Rather than writing that up as the predicted double red, the observation and its cause are recorded and a stronger variant (25b) was run to measure what the corpus catches once the leak is real: 972 falsely-proven arrangements of 2000.
- **No requirement checkbox was ticked.** Prohibited by the plan and consistent with plans 19-15 through 19-17: the round is open and the verdict is re-verification's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `PUSH_IDIOM_WINDOW_EDGE` declared where the witness places it, not `OUTSIDE`**
- **Found during:** Task 1 (adding the `route` field to every declaration row)
- **Issue:** The plan directs `null`/`OUTSIDE` for `PUSH_IDIOM_WINDOW_EDGE`, "which [is] outside". The payload is derived from FP3's committed prologue by inserting one `nop` before the `rts`, so it retains FP3's `sta $fb` / `sta $fc` pair inside the pairing window. It is outside the push-idiom shape (asserted, and load-bearing) but genuinely INTERIOR to the zero-page-vector shape, and an `OUTSIDE` row asserts falsity for every answerable pair.
- **Fix:** Declared `position: "zeropage-vector-jumped-through"`, `route: "class-3-pass"`, `polarity: "negative"`, with a note stating exactly why the name-suggested position would have been false. Its class-3 push-idiom "just-outside" role is carried by the non-vacuity statements as the plan specifies.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** `node --test anno-coverage.test.ts` — 96 pass, 0 fail; the row is confirmed interior by the mechanical-truth check and its decline confirmed empty in `splitTables`.
- **Committed in:** `8a0cd66`

**2. [Rule 1 - Bug] Two existing `positive` rows kept positive**
- **Found during:** Task 1 (applying the plan's polarity list)
- **Issue:** The plan's "the rest of the interior rows as negative" would have flipped `SPLIT_TABLE_CLEAN` and `SPLIT_TABLE_INTERPOSED` — both genuine acceptances the WR-15 pair exists to prove — to `negative`.
- **Fix:** Left both `positive`. Only the two rows the plan names as positive plus `STACK_RETURN`'s new class-4 row carry that polarity by this plan's hand.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** The route-scoped measurement asserts each positive row's own route publishes non-empty; flipping either to `negative` would red it.
- **Committed in:** `8a0cd66`

**3. [Rule 3 - Blocking] Plant restoration switched from `git checkout --` to byte-exact file copies**
- **Found during:** Task 2 (first planted violation)
- **Issue:** The plants operate on files with uncommitted task work in the tree. `git checkout -- <file>` would have discarded the task's own uncommitted assertions along with the plant. The first attempt failed on a path error, which is the only reason it did not.
- **Fix:** Every plant is preceded by a byte-exact copy of the file into scratch and followed by restoration from that copy plus a `diff -q` identity check. `git diff --quiet` against `HEAD` is then used only as the post-commit confirmation the plan asks for.
- **Files modified:** none (process change)
- **Verification:** `diff -q` reported IDENTICAL after every restoration; `git diff --quiet` on both source files passes at the end of every task.
- **Committed in:** n/a (process)

**4. [Rule 2 - Missing critical] A stronger second variant of the advisory-source plant**
- **Found during:** Task 3 (second planted violation)
- **Issue:** The plan predicts the advisory-source plant also reds the composed-corpus property. It does not, and the reason is structural: an advisory record is constructed with `targets: []`, so adding it to the seam leaks nothing and the report does not move. Recording only "the grammar suite stayed green" would leave a reader unable to tell an inert plant from a blind corpus.
- **Fix:** Ran plant 25b — the same seam edit plus the advisory record carrying its reconstructed targets — and recorded the measurement: 972 falsely-proven arrangements of 2000, 13 per-case controls red, pin 3 red. Both mechanisms are shown to cover different halves of the threat.
- **Files modified:** `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md`
- **Verification:** Both suites restored to 96/0 and 22/0; `git diff --quiet -- src/mcp/vice/anno-coverage.ts` exits 0.
- **Committed in:** `93f57e5`

**5. [Rule 1 - Bug] One number in this plan's own validation row corrected in place**
- **Found during:** Task 3 (after the pins landed)
- **Issue:** The task-2 evidence row stated the per-case suite total as **98** — written while task 3 was still unwritten. The observed total is **96**. A wrong number in a validation record is worse than a numstat with one deletion in it.
- **Fix:** Corrected in place, and the correction is itself recorded in the section's own prohibitions list. This is the single deletion in this plan's `19-VALIDATION.md` diff; no row from any earlier round was altered, deleted or renumbered.
- **Files modified:** `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md`
- **Verification:** the deletion appears only in the task-3 commit's own diff. Across the whole plan, `git diff --numstat HEAD~5 HEAD -- 19-VALIDATION.md` is **129 insertions, 0 deletions** — because the corrected line was one this plan had added two commits earlier, so no line that existed before plan 19-18 was touched.
- **Committed in:** `93f57e5`

---

**Total deviations:** 5 auto-fixed (3 bugs, 1 missing critical, 1 blocking).
**Impact on plan:** Two of the plan's declaration-row assignments were factually wrong and would have red the suite on the commit that added them; both were corrected to what the witness and the instrument actually say. One process change was required to keep the plants from destroying uncommitted work. One demonstration produced fewer reds than predicted and was reported as observed, then strengthened. No scope creep: every change is inside `anno-coverage.ts`, `anno-coverage.test.ts` and the two phase records the plan names.

## Issues Encountered

**One full-suite failure, out of this plan's fence and recorded rather than absorbed.** `cd src/mcp/vice && npm test` reports 2627 tests, 2581 pass, **1 fail**, 40 skipped, 5 todo. The red is `stub: a child that answers nothing within the call timeout rejects with AnnoTimeoutError…` in `anno-session.test.ts`, a file this plan never touched (`git diff --name-only HEAD~5 HEAD` lists only the four files above). Standalone, `node --test anno-session.test.ts` reports 25 pass / 0 fail — the same wall-clock-under-contention signature as the documented `vice-proxy.test.ts` flake, which did not reproduce on this run. The plan carries a standing prohibition against widening that timeout, and widening it would be the wrong fix regardless. Appended to `deferred-items.md` with its confirmation of non-causation.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced; the scope-reduction vocabulary (`v1`, `for now`, `simplified`, `placeholder`, `future phase`, `TODO`, `FIXME`) does not appear in any line this plan added to `src/mcp/vice/`.

## Threat Flags

None. The plan's threat register is unchanged by execution: `T-19-18-01` and `T-19-18-02` are both mitigated and both demonstrated failing (plants 21–23 and 24–25b respectively); `T-19-18-03` is still true by construction — the read-only-by-construction assertion passes with the two new exported constants present; `T-19-18-SC` never engaged, as no package was installed and no dependency changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DISPATCH_GATE_ROUTES` and `PROVEN_TARGET_SOURCES` are exported and available to any later plan that needs to reason about which gate published a finding. `COVERAGE_SCHEMA_VERSION` is still `2` and `COVERAGE_REPORT_KEYS` is unchanged, so no report consumer is affected.
- **A residual this plan does not close, stated rather than left to be discovered.** Three checks fire on the reachability dodge, but all three read the declaration layer. A coordinated three-edit change — flip the row, delete the witness's predicate for that pair, delete that pair's declaration rows — produces a self-consistent declaration layer and every check in this section goes green. What covers it is independent of every table here: plan 19-16's pairing-consultation pin, which reads `hasDispatchContext()`'s own guard text, and plan 19-17's composed-corpus property, whose oracle is computed rather than declared.
- **One measured fact worth carrying to 19-20.** An advisory split-table record is built with `targets: []`, so the advisory collection cannot leak addresses into the seed set today even if it were added to the seam. Pin 3 is therefore the only guard that fires on the *declaration* of that source; the corpus fires only once the record also carries targets, and then at a population of 972 of 2000.
- Blocker: none. `anno-session.test.ts`'s full-suite flake is open and owned by a plan that owns that file.

## Self-Check: PASSED

- `src/mcp/vice/anno-coverage.ts` — FOUND
- `src/mcp/vice/anno-coverage.test.ts` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-VALIDATION.md` — FOUND
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — FOUND
- Commits `17cfdb5`, `8a0cd66`, `381a728`, `93f57e5`, `0caa412` — all FOUND in `git log --oneline --all`
- Plan `<verification>` block re-run at close: `node --test anno-coverage.test.ts` **96/0**; `node --test anno-coverage-grammar.test.ts` **22/0**; `npx tsc --noEmit` **exit 0**; `node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` **24/0**; `git status --porcelain src/mcp/vice/fixtures/coverage` **empty**.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*
