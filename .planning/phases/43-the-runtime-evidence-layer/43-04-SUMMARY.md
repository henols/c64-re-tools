---
phase: 43-the-runtime-evidence-layer
plan: 04
subsystem: annotation-store
tags: [evidence, reconciliation, block-classifier, pure-function, tdd]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 02)
    provides: "SCHEMA_VERSION 4's anno_evid_exec table and its row types (EvidExecRow, EvidSourceBank, RuntimeExecClass) -- the runtime-observed side of this plan's join"
provides:
  - "evid-reconcile.ts: reconcileObservedExecution(), the ONE pure join of the byte-derived block table against the runtime evidence table, with disagreements reported first and agreement as a count only (EVID-03)"
  - "a structurally sound four-bucket accounting (disagreement, agreement, block-covered-never-observed, observed-outside-any-block/observed-at-undefined-block) that never derives `data` from absence and never omits a denominator (EVID-04)"
affects: [43-05, 43-06, 43-07]

# Actuals (#2632)
actuals:
  tokens: 10900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The injectable-classifier default pattern (`typeof opts.x === \"function\" ? opts.x : blockClassAt`) carried forward from anno-coverage.ts into a second, independent consumer -- proving the seam generalizes rather than being a one-off"
    - "A pure join module shaped exactly like an existing sibling (dxa-proof01-compare.ts): plain-data-in, no fetch, no mutation, an explicit denominator, named non-binary buckets instead of a boolean recovered/missed split"
    - "The substitutability proof (a BlockClassifier sharing no vocabulary string with either accepted production spelling, derived from anno-types.ts's DATA_TYPES) reused verbatim from anno-coverage.test.ts's own derivation, applied to a second consumer of the same seam"

key-files:
  created:
    - src/mcp/vice/evid-reconcile.ts
    - src/mcp/vice/evid-reconcile.test.ts
  modified:
    - src/mcp/vice/package.json
    - src/mcp/vice/anno-seam.test.ts

key-decisions:
  - "Two-walk algorithm: a first pass over every block-covered address buckets disagreement/agreement/block-covered-never-observed; a second pass over the observation map alone (addresses the first pass's classifier called null or undefined) buckets observed-outside-any-block/observed-at-undefined-block. This keeps the four block-covered-population counts summing exactly to `denominator` as an identity, with observedOutsideAnyBlockCount deliberately excluded from that sum (it counts addresses outside the block table's coverage, not a fraction of it)."
  - "The candidate address set (`denominator`) is derived purely geometrically from blocks' own start/end ranges, never by calling the classifier over the whole address space and never from a hardcoded 65536 -- so a vocabulary substitution can move which bucket a covered address falls into without ever moving the denominator itself."
  - "evid-reconcile.test.ts added to anno-seam.test.ts's declared TEST_FILES_NAMING_SQLITE list: its own structural assertion must spell the literal string \"node:sqlite\" to assert its absence from evid-reconcile.ts, the same unavoidable reason anno-derive.test.ts is already on that list."

requirements-completed: [EVID-03, EVID-04]

coverage:
  - id: D1
    description: "reconcileObservedExecution() returns disagreements FIRST (both declared and returned as the object's first key), with agreement exposed only as agreementCount -- no agreement row array anywhere in the result (EVID-03)"
    requirement: "EVID-03"
    verification:
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 1: one planted disagreement travels from two plain inputs to a disagreement-first answer"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 2: an observation inside a code-classified block is agreementCount only -- no agreement row array anywhere"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 3: disagreements is the FIRST key of the returned object"
        status: pass
    human_judgment: false
  - id: D2
    description: "A third bucket (block-covered, never observed) and a fourth population (observed outside any block / observed at an explicitly undefined block) are kept distinct from agreement and disagreement and are never folded into either -- absence proves nothing"
    requirement: "EVID-04"
    verification:
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 6: a block covered by no observation at all is entirely blockCoveredNeverObservedCount"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 7: an observation outside any block increments observedOutsideAnyBlockCount only"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 8: an observation at an explicitly undefined block increments observedAtUndefinedBlockCount only"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 9: the block-covered bucket counts sum to denominator, derived from the inputs rather than pinned by hand"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every summary object carries an explicit denominator field and no percentage/rate/ratio/score field exists anywhere in the result -- a recursive banned-key walk proves it, non-vacuously"
    requirement: "EVID-04"
    verification:
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 4: no key anywhere in the result matches a percentage/rate/ratio/score vocabulary"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 11: a recursive key walk over the whole result finds no key matching the banned summary vocabulary"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 12: every object carrying a *Count key also carries denominator"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 10: an empty blocks array returns denominator 0 without throwing, with every block-covered count 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both range ends inclusive, 0x0000/0xffff handled as ordinary addresses, deterministic across identical and shuffled-order calls, and the two classifiers proven independent through a substituted BlockClassifier driven through the real injectable seam"
    requirement: "EVID-03"
    verification:
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 13: end_address is covered; end_address + 1 is covered ONLY by its own block, never by adjacency"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 14: 0x0000 and 0xffff are ordinary addresses, including as a block's own start/end"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 15: an unobserved-by-any-block 0x0000 is observedOutsideAnyBlockCount only -- the zero address is not a falsy hole"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 16: determinism -- two identical calls, and a call over shuffled input order, return deep-equal results"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 17: a substituted BlockClassifier moves the block-side bucket while leaving the geometry-derived counts unchanged, proving classifier independence"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 18: frozen inputs -- a mutation of either input would throw at the mutation site rather than surface as a silent diff"
        status: pass
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 19: a null hole inside blocks and a non-array blocks value are both handled without a TypeError escaping this module"
        status: pass
    human_judgment: false
  - id: D5
    description: "The module is import-pure (no store, transport, filesystem or child-process specifier) and never compares a store block-type string itself -- proven by a structural source assertion and the substitutability proof"
    verification:
      - kind: unit
        ref: "evid-reconcile.test.ts#Behavior 5: structural source assertion -- no filesystem, child-process, node:sqlite or toFixed"
        status: pass
      - kind: unit
        ref: "node --test anno-seam.test.ts shipped-modules.test.ts capture-seam.test.ts block-class.test.ts (64/64 pass)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 4: The Runtime Evidence Reconciliation Join Summary

**`evid-reconcile.ts`'s `reconcileObservedExecution()` -- a pure, four-bucket join of the byte-derived block table against `anno_evid_exec`'s runtime evidence that reports disagreements first, agreement as a count, and carries an explicit denominator on every count so absence can never be read as `data`.**

## Performance

- **Duration:** ~55 min
- **Started:** unresumed exact time not separately captured; continuation-style single session
- **Completed:** 2026-09-10T10:12:25Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `src/mcp/vice/evid-reconcile.ts` (new): `reconcileObservedExecution(input: EvidReconcileInput): EvidReconciliation` joins `BlockEntry[]` (byte-derived, plan 43's block table) against `EvidExecRow[]` (runtime-observed, plan 43-02's `anno_evid_exec`) into four named populations -- `disagreements` (rows, FIRST key), `agreementCount` (a number only, no row array), `blockCoveredNeverObservedCount`, `observedOutsideAnyBlockCount`, `observedAtUndefinedBlockCount` -- plus `denominator`, `positiveClass: "code"` and `tier: "runtime-observed"`.
- The classifier is injectable (`classifier?: BlockClassifier`, defaulting to `blockClassAt` through the exact `typeof opts.x === "function" ? opts.x : blockClassAt` guard `anno-coverage.ts` already established), so this module never reads `BlockEntry.type` itself -- it borrows `block-class.ts`'s vocabulary interpretation rather than re-implementing it.
- The candidate address set (`denominator`) is derived purely from the geometric union of blocks' own inclusive `[start_address, end_address]` ranges -- never from a hardcoded 65536, and never from calling the classifier over the whole address space.
- A two-walk algorithm keeps the four block-covered-population counts (`disagreementCount` + `agreementCount` + `blockCoveredNeverObservedCount` + `observedAtUndefinedBlockCount`) summing exactly to `denominator` as a provable identity, with `observedOutsideAnyBlockCount` deliberately excluded (it is evidence about addresses the block table does not cover at all).
- 19 behaviors across 20 tests in `evid-reconcile.test.ts`, hermetic (every `BlockEntry`/`EvidExecRow` a hand-built object literal), covering: the disagreement-first contract, the no-row-array agreement bucket, the third and fourth buckets and their independence from agreement/disagreement, a banned-key recursive walk (percent/pct/rate/ratio/fraction/exhaustive/complete/aggregate/etc.) with non-vacuity, both inclusive range ends, the two address-space extremes, determinism under identical and shuffled-order calls, a load-bearing classifier-substitutability proof derived from `anno-types.ts`'s `DATA_TYPES`, frozen-input immutability, and defensive handling of a null hole / non-array `blocks` value.
- `evid-reconcile.ts` added to `package.json`'s `files[]`, beside `block-class.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: One planted disagreement travels from two plain inputs to a disagreement-first answer** - `5ddfaac3` (feat)
2. **Task 2: The third and fourth buckets, and the denominator that makes them honest** - `5ff2be68` (test)
3. **Task 3: Boundaries, determinism, and the independence the disagreement signal rests on** - `6ff3314a` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

_Note: this plan is `type: tdd` with `tdd="true"` on all three tasks, but its actual shape is closer to "implement, then extend tests across three tasks" than a strict per-task RED/GREEN/REFACTOR cycle -- Task 1 wrote both the full initial implementation and its first five tests together (the plan's own `<action>` for Task 1 specifies building the whole module, not a minimal stub), and Tasks 2-3 are test-only extensions with no corresponding implementation commits (the doc comments the plan asked for were already written in Task 1). See "TDD Gate Compliance" below._

## Files Created/Modified
- `src/mcp/vice/evid-reconcile.ts` - the pure reconciliation join, `reconcileObservedExecution()`, `EvidReconcileInput`/`EvidDisagreement`/`EvidReconciliation`
- `src/mcp/vice/evid-reconcile.test.ts` - 20 tests across the 19 numbered behaviors (Behavior 17 has a companion non-vacuity test for its substituted-vocabulary derivation)
- `src/mcp/vice/package.json` - `evid-reconcile.ts` added to `files[]`
- `src/mcp/vice/anno-seam.test.ts` - `evid-reconcile.test.ts` added to the declared `TEST_FILES_NAMING_SQLITE` list

## Decisions Made
- **Two-walk algorithm**, not a single pass: block-covered addresses are classified and bucketed in one walk; the observation map is walked a second time, separately, to attribute observed addresses the first walk could not resolve to code/data (outside any block, or at an explicitly `undefined` block). This is what keeps the four block-covered counts summing exactly to `denominator` without `observedOutsideAnyBlockCount` polluting that identity.
- **Geometric, vocabulary-independent coverage.** Whether an address is "covered" by the block table is computed from `start_address`/`end_address` alone, never from what a classifier calls it -- so substituting the classifier can move which bucket a covered address falls into without ever moving `denominator` itself. Proven directly in Behavior 17.
- **`evid-reconcile.test.ts` added to `anno-seam.test.ts`'s declared `TEST_FILES_NAMING_SQLITE` list.** Behavior 5's own structural assertion must spell the literal string `"node:sqlite"` as a banned substring to prove `evid-reconcile.ts` never names it -- the same unavoidable reason `anno-derive.test.ts` is already on that list (asserting an absence requires spelling the thing that must be absent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `evid-reconcile.test.ts` tripped `anno-seam.test.ts`'s node:sqlite test-tree confinement guard**
- **Found during:** Task 1, first full-suite verification run (`node --test evid-reconcile.test.ts anno-seam.test.ts shipped-modules.test.ts capture-seam.test.ts`)
- **Issue:** Behavior 5's structural source assertion bans the literal substring `"node:sqlite"` in `evid-reconcile.ts`'s own source, which requires spelling that substring as a string literal inside `evid-reconcile.test.ts`. `anno-seam.test.ts`'s own STORE-07 confinement extends into the test tree via a DECLARED list (`TEST_FILES_NAMING_SQLITE`) of test files permitted to name the specifier; `evid-reconcile.test.ts` was not on it, so the guard failed by design (a new, unreviewed test file naming the specifier).
- **Fix:** Added `evid-reconcile.test.ts` to `TEST_FILES_NAMING_SQLITE` in `anno-seam.test.ts`, with a doc-comment paragraph explaining why (mirroring the existing paragraph for `anno-derive.test.ts`, which is on the list for the identical reason: asserting an absence requires spelling the banned thing).
- **Files modified:** `src/mcp/vice/anno-seam.test.ts`
- **Verification:** `node --test anno-seam.test.ts` passes (53/53 in the combined run); the guard now treats the addition as reviewed rather than a silent leak.
- **Committed in:** `5ddfaac3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The fix was necessary to keep a pre-existing structural guard meaningful and green (the guard is designed to require exactly this kind of reviewed addition, not to be worked around). No scope creep -- no code behavior changed, only a declared test-file list.

## TDD Gate Compliance

This plan carries `type: tdd` frontmatter and `tdd="true"` on all three tasks, but its actual execution does not follow a literal RED-then-GREEN-then-REFACTOR commit sequence per task:

- **Task 1's commit (`5ddfaac3`, typed `feat`)** contains BOTH the full initial implementation of `evid-reconcile.ts` (all four buckets, the injectable classifier, the doc comments Task 2's own `<action>` asked for) AND its first five tests, in one commit. There is no separate `test(...)`-then-`feat(...)` pair for Task 1 -- the plan's own Task 1 `<action>` text describes building the whole module in one step ("Create `src/mcp/vice/evid-reconcile.ts` with a header...", "Export these shapes...", "The function builds one `Map`...") rather than a minimal RED stub, and the `<behavior>` list for Task 1 already exercises the third/fourth-bucket doc-comment discipline implicitly through the module's own correctness. Task 1's test file, at the point of its first run, exercised REAL implemented behavior rather than a deliberately-failing stub -- i.e., there was no observed RED state for Task 1 specifically.
- **Tasks 2 and 3 (`5ff2be68`, `6ff3314a`, both typed `test`)** are pure test-file extensions with no paired implementation commit, because the plan's own Task 2 `<action>` states the doc-comment additions it asks for were "added" as part of completing the four buckets -- which Task 1's implementation already carried, since the four-bucket logic (including the never-observed, outside-any-block and undefined-block buckets) had to exist for Task 1's own Behavior 1/2 tests to pass in the first place. No GREEN-producing implementation change was needed in Task 2 or Task 3.

This is a deviation from the literal RED/GREEN/REFACTOR gate sequence, disclosed here per this plan's own governance rather than silently treated as compliant. The underlying reason: `<design_emphasis>` for this plan required both EVID-03 and EVID-04's structural properties to be settled together in one pure module, and the plan's own task decomposition (write the whole join first, then progressively deepen its test coverage across two more tasks) reflects that the module's four buckets are not separable into independently-committable increments without producing an intermediate module that violates the very soundness properties (e.g., an intermediate state that folds "never observed" into "agreement") this plan exists to prevent.

## Issues Encountered
- `npm run test:automated` showed 4-5 failures across three runs during this session, one extra beyond the documented 3-failure floor each time, all four/five anchored at the SAME already-known intermittent race: `audit-root-args.test.ts:982` ("check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted"). A third run settled back to exactly the documented 3-failure floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`). This matches 43-02's own recorded self-check pattern for the identical file/line and the project's own documented `zz-scratch`-adjacent ENOENT race, unrelated to this plan's changes (this plan touches no scratch directories, no CLI argument parsing, and no skill-fork detection). Final verified state: exactly the documented floor, nothing outside it.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `reconcileObservedExecution()` is ready for whatever later plan wires it behind an MCP verb or a rendering surface (plans 43-05 through 43-07) -- it takes `blocks: readonly BlockEntry[]` (from `listRanges()`) and `observations: readonly EvidExecRow[]` (from `listExecObservations()`), both already-fetched plain data, and returns the disagreement-first, denominator-carrying answer this phase's EVID-03/EVID-04 requirements need.
- The injectable `classifier` parameter means a future test (or a future vocabulary migration) can substitute a different `BlockClassifier` without touching this module's join logic at all.
- No stubs, no skipped tests, no unrun `<verify>` commands from this plan.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `src/mcp/vice/evid-reconcile.ts` and `src/mcp/vice/evid-reconcile.test.ts` confirmed present on disk with `[ -f ]`.
- All three task commit hashes (`5ddfaac3`, `5ff2be68`, `6ff3314a`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (clean), `node --test evid-reconcile.test.ts` (20/20, no skips), the census (`grep -vE '^\s*[/*]' evid-reconcile.ts | grep -cE 'toFixed|node:|from "\./anno-store|from "\./dxa-'` = 0), `Object.keys(result)[0] === "disagreements"` (asserted in Behavior 3), the banned-key walk (Behavior 4 and Behavior 11, both non-vacuous), `node --test anno-seam.test.ts shipped-modules.test.ts capture-seam.test.ts block-class.test.ts` (64/64 pass), and `npm run test:automated` (settled at the documented 3-failure floor on its third run, after ruling out the intermittent `audit-root-args.test.ts:982` race).
- `pgrep -x x64sc` empty -- no live VICE broker was started or left running during this plan (pure module + tests, no live emulator interaction needed).
