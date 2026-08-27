---
phase: 28-the-store-core
plan: 03
subsystem: testing
tags: [block-class, r2000-coverage, anno-types, vocabulary-boundary, derived-cross-check, seam-03]

requires:
  - phase: 28-the-store-core
    provides: "anno-types.ts's DATA_TYPES — the store's frozen twelve lowercase block types (plan 28-01)"
  - phase: 28-the-store-core
    provides: "anno-types.ts's LABEL_KINDS — the store's frozen four capitalised label kinds (plan 28-04)"
  - phase: 27-shared-seams-extracted
    provides: "block-class.ts — the ONE store-vocabulary boundary, and r2000-coverage.test.ts's substitutability proof (SEAM-03)"
provides:
  - "blockClassAt accepts BOTH vocabularies: the store's lowercase code/undefined and the external analyser's capitalised Code/Undefined, with the transitional arm labelled and its removal condition stated as CUT-01"
  - "A derived TOTAL cross-check over all twelve DATA_TYPES members, with four non-vacuity assertions, replacing the header rationale that became false"
  - "A derived label-kind agreement check partitioning LABEL_KINDS by measurement into the three the census compares explicitly and the one it infers, with a behavioural half"
  - "The lowercase-label-kind collapse of labels.kindRatio.user is a named failing assertion rather than an unmeasured hazard"
  - "PRODUCTION_BLOCK_SPELLINGS is the derived, de-duplicated union of both accepted vocabularies, keeping the zero-overlap disjointness assertion a measurement"
affects: [28-05, CUT-01, the coverage census's published figure, any later store-vocabulary migration]

actuals:
  tokens: 71770
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Dual-vocabulary acceptance at a boundary during a transition, with the transitional arm labelled by requirement id rather than by phase number"
    - "Derived TOTAL cross-check in the TEST (which may import both sides) when the production module's import list is asserted empty"
    - "Partition-by-measurement instead of a hand-written expectation table, so drift in either direction moves a count"
    - "Recording a rationale reversal beside the comment it reverses, keeping both forms, rather than deleting the contradicted justification"

key-files:
  created: []
  modified:
    - src/mcp/vice/block-class.ts
    - src/mcp/vice/block-class.test.ts
    - src/mcp/vice/r2000-coverage.test.ts

key-decisions:
  - "The boundary accepts BOTH vocabularies rather than flipping to lowercase, because the live census input and all six committed coverage fixtures still carry the analyser's capitalised spellings — a flip would silently reclassify every one of them as data"
  - "The false header rationale is REPLACED with the honest one naming the two guards that actually protect the mapping, and the lost protection is recorded rather than softened"
  - "block-class.test.ts's hand-written constants are KEPT (renamed to name the analyser) beside the new derived loop; the rationale reversal is recorded, not resolved by deleting either form"
  - "The label-kind literal check partitions LABEL_KINDS BY MEASUREMENT rather than asserting all four appear — measured this session, the census never spells \"Auto\" because it infers auto from its else branch"
  - "The absence supplement iterates a derived subset (CENSUS_FORBIDDEN_BLOCK_LITERALS) exempting exactly the two store members byte-identical to a neutral BlockClass token, with the exemption's own size asserted so it cannot widen unnoticed"

patterns-established:
  - "Derived cross-check over a frozen vocabulary + explicit non-vacuity assertions on the resulting counts, so a collapsed or re-spelt vocabulary cannot satisfy the loop trivially"
  - "Planted-violation reds observed from a copy-aside restore (cp x x.orig), never from git checkout, while surrounding work is uncommitted"

requirements-completed: [STORE-01]

coverage:
  - id: D1
    description: "blockClassAt maps the store's lowercase code/undefined AND the analyser's capitalised Code/Undefined to their neutral classes; everything else falls through to data"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#derived TOTAL cross-check: every member of the store's frozen block vocabulary maps to the right neutral class"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#the analyser arm survives the store arm being added -- its four spellings still map as before"
        status: pass
    human_judgment: false
  - id: D2
    description: "The derived total cross-check is non-vacuous: exactly twelve members iterated, exactly one to code, exactly one to undefined, ten to data — observed reddening against a misspelt literal and a one-member vocabulary"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#derived TOTAL cross-check (non-vacuity assertions)"
        status: pass
      - kind: other
        ref: "planted red: block-class.ts lowercase code literal misspelt to \"cdoe\" -> not ok 7 on the derived cross-check, all spot checks green"
        status: pass
      - kind: other
        ref: "planted red: DATA_TYPES reduced to one member -> 'the iterated vocabulary has 1 members, not the twelve this cross-check is total over'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mapping is proven not to be case-insensitive or whitespace-trimming: eight spellings belonging to neither vocabulary read as data"
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#the two arms are two vocabularies, NOT one vocabulary compared case-insensitively"
        status: pass
    human_judgment: false
  - id: D4
    description: "A lowercase label kind collapses labels.kindRatio.user to zero with no error — made a named failing assertion, with the fixture's non-emptiness asserted before the rewrite"
    requirement: "STORE-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/r2000-coverage.test.ts#a lowercase label kind collapses the user tally to zero with no error -- the silent zero, made loud"
        status: pass
    human_judgment: false
  - id: D5
    description: "The store's label-kind vocabulary and the census's four inline comparisons are pinned to each other by a derived, measurement-partitioned agreement check with a behavioural half"
    requirement: "STORE-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/r2000-coverage.test.ts#derived agreement: every member of the store's label-kind vocabulary appears as a literal in the census's source"
        status: pass
      - kind: other
        ref: "planted red: LABEL_KINDS reduced to three members -> 'the label-kind vocabulary has 3 members, not the four this agreement check is total over'"
        status: pass
      - kind: other
        ref: "planted red: LABEL_KINDS member re-spelt \"User\"->\"user\" -> '2 label kinds are absent from the census's source ([\"user\",\"Auto\"]) -- exactly one is expected'"
        status: pass
    human_judgment: false
  - id: D6
    description: "PRODUCTION_BLOCK_SPELLINGS is the derived, de-duplicated union of both accepted vocabularies, so the zero-overlap disjointness assertion stays a measurement"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the production block-spelling list is the DERIVED union of BOTH accepted vocabularies, with no duplicates"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#substitutability: the substituted vocabulary shares no string with EITHER accepted production vocabulary"
        status: pass
    human_judgment: false
  - id: D7
    description: "No measured census number, no fixture byte and no line of r2000-coverage.ts moved — the block-type change is additive acceptance, not a vocabulary migration"
    verification:
      - kind: other
        ref: "git diff --stat src/mcp/vice/fixtures/ src/mcp/vice/r2000-coverage.ts -> empty across all three task commits"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/r2000-coverage.test.ts (all four census byte-count assertions and both substitutability proofs, unchanged) -> 116/116 pass"
        status: pass
    human_judgment: false
  - id: D8
    description: "block-class.ts's false header rationale is replaced with the honest one naming the two replacement guards, and block-class.test.ts's contradicted justification is kept with the reversal recorded"
    verification: []
    human_judgment: true
    rationale: "Whether a replacement rationale is HONEST — states the loss plainly, names the guards that actually protect the mapping, and does not soften — is a judgment about prose that no assertion can make. The mechanical halves are pinned (grep -c \"store's vocabulary is\" == 1; grep -c \"cannot silently change its own test\" == 1), but the adequacy of the replacement text is for a human to weigh."

duration: 22 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 03: Dual-Vocabulary Block Boundary and the Label-Kind Pin Summary

**`blockClassAt` now accepts the store's lowercase twelve alongside the external analyser's capitalised four, with the false header rationale replaced and both vocabularies pinned by derived total cross-checks whose reddening was observed — no census number, fixture byte or line of `r2000-coverage.ts` moved.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-27T14:06:00Z (approx — first task commit at 14:18:25Z)
- **Completed:** 2026-08-27T14:28:43Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Closed the boundary Phase 27 left half-open in both halves without moving a single measured census number. `blockClassAt` maps `code`/`undefined` (this project's store) and `Code`/`Undefined` (the rented analyser) to their neutral classes; four `block.type ===` comparisons, two arms, explicitly not a case-insensitive test.
- Replaced the header rationale that the change makes measurably false. It claimed the neutral classes' lowercase-ness was itself a protection because the store's vocabulary was capitalised; two of the store's twelve members are now byte-identical to their neutral classes, so a left-behind raw comparison CAN accidentally agree. The loss is recorded and the two guards that actually defend the mapping are named.
- Added a derived TOTAL cross-check over all twelve `DATA_TYPES` members with four non-vacuity assertions, in the test (which may import both sides) because `block-class.ts`'s import list is asserted EMPTY and stays empty.
- Made the label-kind silent zero loud: rewriting every fixture symbol's `kind` to lowercase collapses `labels.kindRatio.user` from positive to exactly 0 and leaves `systemExcluded` at 0, with the message naming `:1869`'s `nameByAddress` and `:2180`'s `seeds` as the two further sites with the same failure.
- Widened `PRODUCTION_BLOCK_SPELLINGS` into the derived, de-duplicated union of both accepted vocabularies, so the zero-overlap disjointness assertion stays a measurement rather than becoming stale prose.
- **Five reds observed**, each named in its commit message and each reverted from a copy aside rather than from git.

## Task Commits

Each task was committed atomically:

1. **Task 1: Teach `blockClassAt` the store's lowercase vocabulary and replace the false header rationale** — `bc1fecd` (feat)
2. **Task 2: Derived TOTAL cross-check over all twelve store members, analyser constants renamed, rationale reversal recorded** — `c576367` (test)
3. **Task 3: Label-kind agreement pinned, silent zero made loud, `PRODUCTION_BLOCK_SPELLINGS` derived** — `9f8f583` (test)

**Plan metadata:** see the `docs(28-03)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/block-class.ts` — comparison block accepts both vocabularies with the transitional arm labelled (`CUT-01` as its removal condition); header rationale paragraph replaced; `BlockClass`'s doc comment corrected; `blockClassAt`'s "total by construction" paragraph extended to both vocabularies. Import list still empty, signature still two arguments, traps 1–4 unchanged.
- `src/mcp/vice/block-class.test.ts` — `STORE_*` constants renamed to `ANALYSER_*` (they always were the analyser's spellings); new section 2b with the derived total cross-check, its non-vacuity assertions and the recorded rationale reversal; analyser-arm pin; not-case-insensitive pin. New import: `DATA_TYPES` from `./anno-types.ts`.
- `src/mcp/vice/r2000-coverage.test.ts` — `PRODUCTION_BLOCK_SPELLINGS` becomes the derived union; new `ANALYSER_BLOCK_SPELLINGS` and `CENSUS_FORBIDDEN_BLOCK_LITERALS`; new section 2c with the silent-zero test and the derived label-kind agreement; derived-union assertions. New imports: `DATA_TYPES` and `LABEL_KINDS` from `./anno-types.ts`.

## Decisions Made

- **Dual acceptance, not a flip.** The live census input and all six committed coverage fixtures carry the analyser's capitalised spellings. A straight flip to lowercase would reclassify every one as `data` — silently, which is the exact failure this plan exists against — and would force a fixture migration no criterion asks for. The capitalised arm is labelled TRANSITIONAL with its removal condition stated as a requirement id (`CUT-01`), never a phase number.
- **The label-kind check partitions by measurement.** The plan specified "every member of `LABEL_KINDS` appears as a literal in `r2000-coverage.ts`". Measured: `"Auto"` does not, and correctly so — `computeLabelRatio` tests `System`/`Platform` then `User` and infers auto from neither matching, so it never needs to spell it. See Deviations.
- **The absence supplement's exemption is derived and its size is asserted.** `"code"` and `"undefined"` are byte-identical to two neutral `BlockClass` tokens the census legitimately holds, so their presence in `r2000-coverage.ts` proves nothing either way — which is precisely the protection `block-class.ts`'s header records as lost. Exempting exactly those two, with the exemption list's contents asserted, is the honest measurement; a wider exemption would be a lowered floor.
- **Both constant forms kept.** Hand-written is right for the analyser (external, no importable home in this tree); derived is right for the store (exactly one home, and divergence from it IS the failure). The reversal is recorded beside the comment it reverses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's Task 3 Test 3 premise was false against the tree: the census never spells `"Auto"`**

- **Found during:** Task 3
- **Issue:** The plan's behaviour spec said "every member of `LABEL_KINDS` appears as a literal in `r2000-coverage.ts`'s source read through `codeOnly(src, true)`". Written that way it failed immediately and correctly: `"User"`, `"System"` and `"Platform"` appear; `"Auto"` does not. `computeLabelRatio` tests `kind === "System" || kind === "Platform"` at `:1430` and `kind === "User"` at `:1432`, then infers auto from its `else` branch — so `"Auto"` is a first-class store member the census deliberately never spells. Asserting its presence would have forced either a pointless edit to the census (which the plan forbids) or a weakened assertion.
- **Fix:** The check now PARTITIONS `LABEL_KINDS` by measurement into the members the census compares explicitly and the one it infers, and asserts the partition sizes (3 and 1). A behavioural half then drives each spelled member through a real report (`User` → user tally, `System`/`Platform` → `systemExcluded`) and proves the unspelled one genuinely IS the fallthrough by landing in the auto tally — so "absent" cannot be confused with "drifted". This is strictly stronger than the specified form: a re-spelt store member moves out of `spelled`, a census that starts comparing the fallthrough explicitly moves it in, and either direction moves a count. Both planted reds were observed against it.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
- **Verification:** `node --test r2000-coverage.test.ts` → 116/116; both planted reds observed and reverted.
- **Committed in:** `9f8f583`

**2. [Rule 3 - Blocking] Widening `PRODUCTION_BLOCK_SPELLINGS` broke a second consumer the plan did not name**

- **Found during:** Task 3
- **Issue:** The plan named only the zero-overlap disjointness assertion at `:688-697` as a consumer of `PRODUCTION_BLOCK_SPELLINGS`. It has a second: the `SUPPLEMENT (not the proof)` test at `:818` iterates the same constant asserting `r2000-coverage.ts` contains no `"<spelling>"` literal. Measured before editing: `"code"` and `"undefined"` DO appear as literals in `r2000-coverage.ts` — they are the neutral `BlockClass` tokens the census legitimately holds — so the naive widening the plan specified would have turned that supplement red for a reason unrelated to its invariant.
- **Fix:** Split the two concerns. `PRODUCTION_BLOCK_SPELLINGS` is the full derived union (16 entries) and drives the disjointness assertion, as the plan requires. A new derived `CENSUS_FORBIDDEN_BLOCK_LITERALS` — the union minus the members byte-identical to a neutral `BlockClass` token — drives the absence supplement, with a comment recording that the subtraction IS the protection `block-class.ts`'s header just recorded as lost, and with `assert.deepEqual(..., ["code", "undefined"])` on the exemption so it cannot widen unnoticed. Neither guard's floor was lowered: the exempted pair is defended by the derived total cross-check and the substitutability proof, neither of which depends on a spelling being unspelled.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
- **Verification:** the supplement still runs over 14 spellings and passes; the exemption's exact contents are asserted.
- **Committed in:** `9f8f583`

**3. [Rule 2 - Missing Critical] `BlockClass`'s own doc comment restated the false header premise**

- **Found during:** Task 1
- **Issue:** The plan said "do not touch `BlockEntry`, `BlockClass` or `BlockClassifier`", meaning the declarations. But `BlockClass`'s doc comment carried the same claim the header rationale was being replaced for — "deliberately distinct from any store's own capitalised spelling … a left-behind comparison against a raw store string is meant to be observable, not accidentally compatible." Leaving it would have left a measurably-false rationale in the file, which the plan's own `T-28-staleguard` prohibition forbids.
- **Fix:** Rewrote that comment's rationale sentence to record that two of the store's twelve members now do collide and to point at the header for the loss and the replacement guards. The type declaration itself is byte-identical; no export added, removed or renamed.
- **Files modified:** `src/mcp/vice/block-class.ts`
- **Verification:** 162 tests green across `block-class`, `r2000-coverage`, `comment-phase-pointers`, `docs-dangling-refs` and `shipped-modules`.
- **Committed in:** `bc1fecd`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All three were necessary for correctness and each made the delivered guard stronger than the specified one. No scope creep: no new file, no install, no change to `r2000-coverage.ts`, no fixture touched.

## Verification

| Gate | Result |
|---|---|
| `node --test block-class.test.ts r2000-coverage.test.ts` | 131/131 pass (baseline was 125; +6 new tests) |
| `npm run test:automated`, VICE broker STOPPED | 2588 tests, 6 failures — **all six inside the named baseline**: the five `plan 18-06:` tests in `r2000-session.test.ts` (`regenerator2000` absent from `PATH`) plus the documented load-sensitive flake at `:615`. Zero failures outside the baseline. |
| `npm run typecheck` | clean |
| `git diff --stat src/mcp/vice/fixtures/ src/mcp/vice/r2000-coverage.ts` | empty |
| `grep -vE '^\s*//' block-class.ts \| grep -c 'block.type ==='` | 4 |
| `grep -c "store's vocabulary is" block-class.ts` | 1 |
| `grep -cE "STORE_(CODE\|UNDEFINED\|OTHER)" block-class.test.ts` | 0 |
| `grep -c "cannot silently change its own test" block-class.test.ts` | 1 |
| `grep -c 'from "./anno-types.ts"'` in both test files | 1 each |
| No assertion compares stderr to an empty string | confirmed in both test files |

### The five observed reds

1. **`block-class.ts`'s lowercase code literal misspelt to `"cdoe"`** → `not ok 7 - derived TOTAL cross-check`. Every spot check stayed green.
2. **Same experiment, second fact (the plan's fifth red):** that red landed on the DERIVED loop and on nothing else — a spot check over the analyser's four spellings would not have seen it at all. That is the whole reason the derived form was added.
3. **`DATA_TYPES` reduced to one member** → `the iterated vocabulary has 1 members, not the twelve this cross-check is total over`.
4. **`LABEL_KINDS` reduced to three members** → `the label-kind vocabulary has 3 members, not the four this agreement check is total over`.
5. **`LABEL_KINDS` member re-spelt `"User"` → `"user"`** → `2 label kinds are absent from the census's source (["user","Auto"]) -- exactly one is expected`.

Every planting was reverted from a `cp` copy aside, never from `git checkout --`, per the failure recorded in plan 28-04.

## Issues Encountered

- **`grep -c` counts lines, not occurrences, and the criteria are line-based.** Two acceptance criteria (`grep -c "store's vocabulary is"` and `grep -c "cannot silently change its own test"`) initially read 0 and 2 respectively because a phrase straddled a comment line wrap and because the rationale-reversal comment quoted the original verbatim. Both were resolved by reflowing prose and by paraphrasing the quotation instead of duplicating it — the original justification comment remains the unique occurrence, which is what the criterion is for.

## User Setup Required

None — no external service configuration required. Zero installs; every import added is a relative path inside `src/mcp/vice/`.

## Next Phase Readiness

- `STORE-01`'s twelve-member block vocabulary now has a total, derived cross-check against the one interpreter of it, so a later store-vocabulary change reddens rather than moving a published figure.
- **Open for `CUT-01`:** the transitional capitalised arm in `blockClassAt`, and the fixtures under `fixtures/coverage/` that require it. Its removal condition is stated in the module header — no capitalised-vocabulary producer remaining — and `block-class.test.ts`'s analyser-arm pin makes the removal a deliberate reddening edit.
- **Recorded, not delivered (available larger alternative):** the label-kind boundary is still four inline comparisons in `r2000-coverage.ts` (`:1430`, `:1432`, `:1869`, `:2180`). This plan pins the agreement and makes the failure loud; extracting a `labelKindClassAt` and repointing all four sites remains available and is recorded in the new section's comment.
- Wave 3 sibling `28-05` touches a disjoint file set (`anno-types.ts`, `anno-store.ts`, `anno-overlap.test.ts`); nothing here blocks it.

## Self-Check: PASSED

- `src/mcp/vice/block-class.ts` — FOUND
- `src/mcp/vice/block-class.test.ts` — FOUND
- `src/mcp/vice/r2000-coverage.test.ts` — FOUND
- `bc1fecd` — FOUND in git log
- `c576367` — FOUND in git log
- `9f8f583` — FOUND in git log
- All task `<acceptance_criteria>` re-run at close: pass (table above)
- Plan-level `## Verification` commands re-run at close: pass (table above)

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*
