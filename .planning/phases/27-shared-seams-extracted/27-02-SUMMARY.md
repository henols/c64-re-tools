---
phase: 27-shared-seams-extracted
plan: 02
subsystem: testing
tags: [typescript, seam-extraction, coverage-census, annotation-store, block-vocabulary, substitutability]

# Dependency graph
requires:
  - phase: 19-coverage-instrument
    provides: "r2000-coverage.ts — the byte census, its bytes-versus-store independence axis, and the independence test this plan had to keep green across the new boundary"
  - phase: 27-shared-seams-extracted
    provides: "plan 27-01's precedent for a same-wave seam extraction on a disjoint file set (acme-gate.ts); no file overlap with this plan"
provides:
  - "src/mcp/vice/block-class.ts — the ONE boundary translating an annotation store's block-type vocabulary into a neutral three-valued block class (BlockClass, BlockEntry, BlockClassifier, blockClassAt)"
  - "A coverage census whose entire contact with the annotation store is one import: no upstream block-type literal, no store-shape type declaration, no local block lookup survives in r2000-coverage.ts"
  - "A committed substitutability proof: a second, zero-overlap block vocabulary substituted through the boundary holds every census byte count and classRuns exactly while moving only the divergence sub-report"
  - "An observed left-behind-site probe: restoring one raw-string comparison at the divergence loop turns the proof RED"
  - "Correction C-7, discovered while executing: a module reachable from vice-proxy.ts's relative-import closure must be in package.json files[] — the closure walk grew from 58 to 59 modules once the census imported the adapter"
affects: [phase-28-store-substitution, r2000-coverage, r2000-cli, npm-packaging]

actuals:
  tokens: 8480
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Boundary-is-the-module: the one production implementation lives in its own file; a later phase swaps the module, never an argument threaded through a caller"
    - "Loudness placed by scope: the classifier is REQUIRED with no default on internal shapes (an omission is a typecheck error) and OPTIONAL defaulting to the real adapter at the public entry (a forgetful caller gets correct behaviour, never a raw store vocabulary)"
    - "Zero-overlap substitution as the detector: the substituted vocabulary shares no string with the production one, so a comparison site left behind anywhere in the census moves a measured number instead of hiding"

key-files:
  created:
    - src/mcp/vice/block-class.ts
    - src/mcp/vice/block-class.test.ts
    - .planning/phases/27-shared-seams-extracted/deferred-items.md
  modified:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts
    - src/mcp/vice/r2000-cli.ts
    - src/mcp/vice/package.json

key-decisions:
  - "Adapter named block-class.ts, not annotation-blocks.ts: naming a translation module after the data model it translates invites the reading that it owns the blocks"
  - "Neutral classes are lowercase (code/data/undefined) precisely because the store's spellings are capitalised — a left-behind comparison must be observable, not accidentally compatible"
  - "R2000BlockEntry moved and renamed BlockEntry; R2000Symbol, R2000Comment and R2000CrossReference deliberately stayed — only the block shape's doc comment documented the store vocabulary"
  - "r2000-cli.ts's type-only import was SPLIT, not rewritten: both coverage imports survive, so the diff reads as an addition"
  - "The store-side half of the independence claim needed its own test on an UNGRADED comment set: measured that classFromStore() answers from the confidence grade and returns before consulting the block class on this fixture"
  - "The census module keeps its filename this phase (D-12): no criterion required the rename, and renaming a 2,292-line module would obscure the move in the diff"

patterns-established:
  - "Import purity asserted from source, not stated in a header: block-class.test.ts reads the module's own text and asserts its import list is empty, because the failure mode is that the sibling independence test keeps passing while the claim it protects becomes void"
  - "Structural literal-absence checks are labelled in-code as the SUPPLEMENT, never the proof — absence of a string demonstrates absence of a string"
  - "Every non-vacuity half is written as an assertion, not implied: each substitutability claim is paired with a proof that the thing it holds constant CAN move"

requirements-completed: [SEAM-03]

coverage:
  - id: D1
    description: "block-class.ts exists as the one store-block-vocabulary boundary with exactly four exports, an empty import list, no module-level mutable binding, and inclusive-range first-match-wins semantics byte-identical to the scan it replaced"
    requirement: SEAM-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts (11 tests: inclusive ends, one step either side, empty listing, total data fallthrough, hole-skip, first-match-wins, import purity, no mutable binding, files[] inclusion)"
        status: pass
      - kind: other
        ref: "grep -cE '^export (type|interface|const|function) (BlockClass|BlockEntry|BlockClassifier|blockClassAt)' src/mcp/vice/block-class.ts => 4"
        status: pass
      - kind: other
        ref: "grep -cE 'from \"\\./(r2000-|disasm-|stock-|vice|hostpath|containerpath)' src/mcp/vice/block-class.ts => 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The census's entire store contact is one import: no upstream block-type literal, no moved store-shape type, and no local lookup survive in r2000-coverage.ts, and all three comparison regions plus both lookup sites speak the neutral vocabulary with unchanged arithmetic and counter names"
    requirement: SEAM-03
    verification:
      - kind: other
        ref: "grep -cE '\"(Code|Undefined|Byte)\"' src/mcp/vice/r2000-coverage.ts => 0; grep -c 'R2000BlockEntry' => 0; grep -c 'storeBlockTypeAt' => 0; grep -c 'from \"./block-class.ts\"' => 1"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test r2000-coverage.test.ts r2000-coverage-grammar.test.ts r2000-cli.test.ts (0 failures)"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck (tsc --noEmit, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The boundary is proven SUBSTITUTABLE, not merely present: a second zero-overlap block vocabulary through the adapter holds all six structural byte counts and classRuns exactly and holds every reproducibility fromBytes, while moving divergence.censusCodeStoreNotCode from 0 to non-zero and (on an ungraded comment set) every fromStore value"
    requirement: SEAM-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter leaves every census byte count exact and moves only the divergence sub-report"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds -- the sharpest form of the bytes-versus-store claim"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#idempotency: building the coverage report twice over the same fixture through the adapter yields deep-equal reports"
        status: pass
      - kind: other
        ref: "left-behind-site probe: raw-string comparison restored at the divergence loop => the non-vacuity assertion goes RED (observed, then restored; r2000-coverage.ts byte-identical to d5b7e3c)"
        status: pass
    human_judgment: false
  - id: D4
    description: "block-class.ts ships: package.json files[] gains one entry and the tarball validator's transitive closure from vice-proxy.ts stays clean (Correction C-7, discovered while executing)"
    requirement: SEAM-03
    verification:
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs => 'transitive closure from vice-proxy.ts -- 59 modules, clean' / 'check-npm-packages: OK'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#block-class.ts IS present in package.json's files[] array"
        status: pass
    human_judgment: false
  - id: D5
    description: "The census module's two long-standing header statements claiming the store listing entered at exactly one call site (naming computeDivergence()) are corrected, while both bytes-versus-store invariants survive"
    requirement: SEAM-03
    verification:
      - kind: other
        ref: "sed -n '1,140p' r2000-coverage.ts | grep -c 'computeDivergence()' => 0; grep -c 'NEVER derive any measure from the store' => 1; grep -c 'Neither side reads the other' => 1; grep -c 'block-class.ts' => 7"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts assumption-label-discipline.test.ts docs-linerefs.test.ts (0 failures)"
        status: pass
    human_judgment: false

duration: 40 min
completed: 2026-08-27
status: complete
---

# Phase 27 Plan 02: Store Block Vocabulary Behind One Boundary Summary

**The coverage census's four inline comparisons against a rented analyser's `Display` strings are now one import of `block-class.ts`, and a zero-overlap second vocabulary substituted through that boundary holds every census byte count exact while moving only the divergence sub-report.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-27T05:52Z
- **Completed:** 2026-08-27T06:32Z
- **Tasks:** 3
- **Files modified:** 7 (2 source created, 1 test created, 3 source modified, 1 manifest modified; plus one planning ledger)

## Accomplishments

- **`src/mcp/vice/block-class.ts` created** (130 lines) — exactly four exports (`BlockClass`, `BlockEntry`, `BlockClassifier`, `blockClassAt`), an **empty import list**, no module-level mutable binding, and the moved scan body byte-identical in its `if (!block) continue` hole-skip and its inclusive `address >= block.start_address && address <= block.end_address` range test. Its `WHAT NOT TO DO` list names the independence-axis collapse as the specific trap, and `block-class.test.ts` (11 tests) asserts the prohibition from the module's own source rather than trusting the header.
- **`r2000-coverage.ts`'s store contact reduced to one import.** `storeBlockTypeAt()` deleted (not wrapped), `R2000BlockEntry` deleted and replaced by an import of `BlockEntry`, `classFromStore()` retyped to take `BlockClass | null`, and **all three comparison regions** (`classFromStore`'s two literals, the divergence loop's two) plus **both lookup sites** (the reproducibility comparison and the divergence loop) rewritten in the neutral vocabulary with counter names and arithmetic unchanged. `grep -cE '"(Code|Undefined|Byte)"'` on the census returns **0**.
- **Two stale header statements corrected in the same commit.** Both `:22` and the invariant-1 block claimed the store listing entered the file at exactly one call site, naming `computeDivergence()` — already false, because it also entered at the reproducibility comparison. Restated as "only through `block-class.ts`". Both bytes-versus-store invariants survive verbatim, and the independence paragraph gained one sentence noting the store side's vocabulary now lives behind the named boundary.
- **Substitutability proven, and the proof proven able to fail.** A second complete `BlockClassifier` whose three spellings (`EXECUTABLE_EXTENT` / `UNCLASSIFIED_EXTENT` / `OPAQUE_EXTENT`) collide with nothing in the production vocabulary — with the disjointness itself asserted rather than eyeballed. Substituted through the documented seam it holds all six structural byte counts and `classRuns` exactly, holds every `reproducibility.comparisons[].fromBytes`, and moves `divergence.censusCodeStoreNotCode` from `0` to non-zero. Idempotency asserted. The literal-absence grep is committed as a labelled **SUPPLEMENT**, never the proof.
- **Correction C-7 confirmed empirically, not just predicted.** `block-class.ts` had to be added to `package.json`'s `files[]`; the tarball validator's closure walk from `vice-proxy.ts` grew from **58 to 59 modules** the moment the census imported the adapter, which is the direct measurement that the entry was mandatory rather than tidy.
- **Zero `r2000` modules deleted or renamed.** `git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts | grep -c r2000` is `0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create block-class.ts and its unit tests, and add it to the shipped module list** — `b730032` (feat)
2. **Task 2: Route all three comparison sites and both lookup sites through the adapter, and correct the census header's stale one-call-site claim** — `d5b7e3c` (refactor)
3. **Task 3: Prove the boundary substitutable with a second, zero-overlap block vocabulary** — `f4bb4e1` (test)

_Task 1 carried `tdd="true"`: the `files[]` inclusion test was observed RED (10 pass / 1 fail) before `package.json` was edited, then green (11 pass)._

## Files Created/Modified

- `src/mcp/vice/block-class.ts` **(new, 130 lines)** — the ONE boundary translating a store block entry into a neutral block class. Four exports, zero imports.
- `src/mcp/vice/block-class.test.ts` **(new, 177 lines)** — 11 tests: inclusive range ends, one step either side, uncovered address, empty listing, the vocabulary mapping including the total data fallthrough, the `null`/`undefined` hole-skip, first-match-wins on overlap, import purity, no module-level mutable binding, and `files[]` inclusion.
- `src/mcp/vice/r2000-coverage.ts` — store contact reduced to one import; `storeBlockTypeAt` and `R2000BlockEntry` removed; `classFromStore` retyped; `blockClassifier` threaded (required on `ReproducibilityInput` and `computeDivergence`, optional-with-the-real-default on `CoverageOptions`); two header statements corrected; the divergence section header and two `DivergenceReport` doc comments re-expressed in the neutral vocabulary.
- `src/mcp/vice/r2000-coverage.test.ts` — import repointed; `reportFor()` extended to forward an optional classifier with existing defaults untouched; five `computeReproducibility()` call sites supplied the now-required field; **203 lines added** carrying the substitutability section.
- `src/mcp/vice/r2000-cli.ts` — the type-only coverage import **split** (both coverage imports survive) with `BlockEntry` taken from the boundary; two uses repointed.
- `src/mcp/vice/package.json` — exactly one added line (`"block-class.ts"` in `files[]`); `dependencies` and `devDependencies` byte-identical.
- `.planning/phases/27-shared-seams-extracted/deferred-items.md` **(new)** — two out-of-scope discoveries from the whole-glob run.

## Decisions Made

- **Adapter named `block-class.ts`.** Chosen over `annotation-blocks.ts`: "annotation blocks" is the store's own vocabulary a later phase owns, and naming a translation module after the data model it translates invites the reading that it owns the blocks.
- **`blockClassAt` declared as `export const blockClassAt: BlockClassifier = …`** rather than a `function`. The plan asked for it "typed as a `BlockClassifier`"; a `const` with the explicit annotation makes conformance structural rather than incidental, and a `const` is not a mutable binding.
- **Loudness placed by scope, per the plan's own design note.** `ReproducibilityInput.blockClassifier` and `computeDivergence`'s third parameter are **required with no default** — and this immediately paid off: five test call sites failed typecheck the moment the field landed, which is exactly the "an internal site that forgets it is a typecheck error" behaviour D-10 asked for. `CoverageOptions.blockClassifier` is **optional, defaulting to the real adapter**, so a forgetful production caller gets correct behaviour rather than a raw store vocabulary. `grep -c 'blockClassifier'` reports `0` for `r2000-cli.ts`, `r2000-tools.ts` and `vice-proxy.ts`.
- **Two `DivergenceReport` doc comments and the divergence section header were also neutralised.** They carried the store's code spelling in backticks (`` `Code` ``), which the quote-delimited acceptance grep does not see. Left alone they would have been the same stale-record defect this plan exists to correct, one comment layer down. The two remaining backticked mentions at `:9` and `:13` are deliberately kept: they narrate the *external analyser's own* `analyzer.rs` behaviour and are the founding rationale for the whole module.
- **The census module keeps its filename** (D-12). No criterion required the rename, and renaming a 2,292-line module with a 4,315-line test file would have made criterion 4's "demonstrably a move" far harder to read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's Test 3 (`fromStore` moves) was not achievable as specified, and would have shipped as a false claim**

- **Found during:** Task 3.
- **Issue:** The plan called Test 3 "the sharpest form of the independence claim, **available for free**" — every `fromBytes` unchanged while at least one `fromStore` differs, asserted inside the main substitutability test on the well-documented fixture. It went RED: `no fromStore value moved`. Root cause, measured: every one of that fixture's four line comments carries a `[confirmed-code]`/`[probable-code]` grade, and `classFromStore()` answers from the **grade** and returns before it ever consults the block class. So a block-vocabulary substitution provably cannot move `fromStore` on that comment set — not because the boundary failed to reach the store side, but because the store side had already answered from a **second store surface** (the confidence grades) that this plan deliberately does not move. Asserting it there was not merely unachievable, it was the wrong claim.
- **Fix:** Split the claim into its own test, `substitutability: on an UNGRADED comment set every fromStore value moves while every fromBytes value holds`. It re-grades every fixture comment to `[unknown]` while preserving the rest of each comment verbatim (so the labels stay non-vacuous and therefore stay sampled), which puts the block class on the answering path. Every `fromStore` then moves and every `fromBytes` holds — the claim in its true, stronger form. The main substitutability test keeps the `fromBytes` half plus a forward reference to the split. The measurement and the reason are recorded in the test's own comment so a later reader does not "simplify" it back.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
- **Verification:** `node --test r2000-coverage.test.ts` — 112 tests, 112 pass, 0 fail. Both substitutability tests pass by title.
- **Committed in:** `f4bb4e1` (Task 3 commit)

**2. [Rule 3 - Blocking] `assert.deepEqual(specifiers, [])` narrowed the array to `never[]`, breaking a later read**

- **Found during:** Task 1.
- **Issue:** `npm run typecheck` failed with `block-class.test.ts(146,32): error TS2339: Property 'startsWith' does not exist on type 'never'`. `assert.deepEqual` from `node:assert/strict` is a type-narrowing assertion, so expecting an empty array narrows `specifiers` to `never[]` and every subsequent read of it becomes a typecheck error.
- **Fix:** Reordered — the per-family check runs first, the emptiness check last. Ordering, not a cast: a cast would have suppressed the diagnostic without preserving either assertion's meaning. The reason is recorded in a comment at the site.
- **Files modified:** `src/mcp/vice/block-class.test.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `b730032` (Task 1 commit)

**3. [Rule 2 - Missing Critical] Five `computeReproducibility()` test call sites had to supply the newly-required field**

- **Found during:** Task 2.
- **Issue:** Making `blockClassifier` required with no default (the plan's own instruction, and the point of the design) broke five existing `computeReproducibility()` call sites in `r2000-coverage.test.ts` at typecheck.
- **Fix:** Each supplied `blockClassifier: blockClassAt` — the real adapter, so no existing assertion changes meaning. Recorded here rather than passed over silently because the breakage **is** the mechanism working: it is the loud failure D-10 asked for, observed.
- **Files modified:** `src/mcp/vice/r2000-coverage.test.ts`
- **Verification:** `npm run typecheck` exits 0; `node --test r2000-coverage.test.ts` 0 failures.
- **Committed in:** `d5b7e3c` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical).
**Impact on plan:** No scope change and no file outside `files_modified` touched. Deviation 1 is the substantive one — it replaced a claim the plan believed free with the true, stronger claim plus the measurement that explains why the free version could not hold, and it surfaced a fact worth carrying forward: the confidence grades are a **second store surface** that answers ahead of the block class, and SEAM-03 moved only one of the two.

## Issues Encountered

**The whole-glob `npm test` run: 2337 pass, 44 fail — all 44 pre-existing and outside this plan.**

Per the project's own environment rule the full suite was run rather than `npm run test:automated`. It also needed two attempts: the first was wrapped in `timeout 900`, which SIGTERM'd the run at 900s (exit 143) — that is a wrapper artefact, not a test failure. Re-run unwrapped and to completion, the 44 failures decompose cleanly:

- **39 in `vice-proxy.test.ts`** — the second entry of `test-gate.mjs`'s frozen nine-file `MANUAL_ONLY_TESTS` list, dispositioned there precisely because it needs a reachable host/broker. No broker was running, and starting one would deterministically redden `BACK-05`. Expected.
- **5 in `r2000-session.test.ts`** (the plan-18-06 queue tests) — all `R2000SpawnError: regenerator2000 was not found on PATH`. A genuine pre-existing gap, not a missing binary: every *other* regenerator2000-dependent test in that file is wrapped by `skipReasonFor(...)` and SKIPs cleanly, while these five spawn a real child with no gate. The file was last modified in phase 18 and is untouched by phase 27; the failures reproduce in isolation.

Both are logged in `deferred-items.md` and deliberately **not** fixed — each lies outside this plan's `files_modified`, and the second belongs to the r2000 session/spawn family plan 27-04 owns.

**Consequence for reading a whole-glob result:** `npm test`'s bare glob does not consult `MANUAL_ONLY_TESTS`, so its raw pass/fail total cannot be read as a verdict — the dispositioned nine must be subtracted by hand. This plan's own gate, which excludes them, is clean: **402 tests, 395 pass, 7 skip, 0 fail.**

## Verification Evidence

Exact commands and results, from `src/mcp/vice` unless noted.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 (`tsc --noEmit -p tsconfig.json`) |
| `node --test block-class.test.ts` | 11 tests, 11 pass, 0 fail |
| `node --test r2000-coverage.test.ts` | 112 tests, 112 pass, 0 fail |
| plan gate: `node --test block-class.test.ts r2000-coverage.test.ts r2000-coverage-grammar.test.ts r2000-cli.test.ts docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts assumption-label-discipline.test.ts r2000-spawn-seam.test.ts stock-dispatch.test.ts hostpath-consumers.test.ts` | 402 tests, **395 pass, 7 skip, 0 fail** |
| `node scripts/check-npm-packages.mjs` (repo root) | `check-npm-packages: transitive closure from vice-proxy.ts -- 59 modules, clean` then `check-npm-packages: OK` — `@henols/vice-mcp` 76 files |
| `test "$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts \| grep -c r2000)" = "0"` | exit 0 — no `r2000` module deleted |
| whole-glob `node --test '*.test.*'` | 2337 pass / 44 fail — all 44 in `vice-proxy.test.ts` (MANUAL_ONLY, needs a live host) and `r2000-session.test.ts` (pre-existing ungated spawn), see Issues Encountered |

**Closure-walk output line, verbatim** (the C-7 evidence):

```
check-npm-packages: transitive closure from vice-proxy.ts -- 59 modules, clean
```

Before the census imported the adapter this line read **58 modules**. The count moving with the import is the direct measurement that `files[]` had to grow — Correction C-7 was a finding this plan produced, not a given it inherited.

**Left-behind-site probe — RED, then restored.** One raw-string comparison was temporarily planted back at the divergence loop, reading the block entry's `type` directly instead of the classifier's result:

```
      const leftBehindRawType = blockList.find((b) => b && addr >= b.start_address && addr <= b.end_address)?.type ?? null;
      if (run.class === "reached-as-instruction" && leftBehindRawType !== "Code") censusCodeStoreNotCode++;
```

Observed with the probe planted (`node --test r2000-coverage.test.ts` → **110 pass, 2 fail**):

```
not ok 5 - substitutability: feeding the census a second, zero-overlap block vocabulary through the adapter ...
  error: 'the divergence sub-report did not move at all -- if a vocabulary substitution cannot move it, the
          substitutability assertions above are vacuous, and a comparison site left behind in the divergence
          loop would look exactly like this'
not ok 8 - SUPPLEMENT (not the proof): the census module's source carries no production block-type literal
```

The proof caught it on the non-vacuity assertion, and the structural supplement caught it independently — two detectors, and the primary one is the substitutability proof rather than the string grep. **Restored:** `git diff --stat -- r2000-coverage.ts` prints nothing against `d5b7e3c`, i.e. the file is byte-identical to its committed state; `node --test r2000-coverage.test.ts` back to 112/112.

## Estimate vs Actual (first calibration sample)

`27-02-PLAN.md` projected `estimate.tokens: 95000` with `sample_count: 0` and `confidence: low`, and its `<estimate_acknowledgement>` explicitly dispositioned the figure as uninformative rather than alarming.

| | Projected | Actual |
|---|---|---|
| `estimateTokens` (chars/4 over the realized diff) | 95,000 | **8,480** |
| Tasks | 3 | 3 |
| Commits | — | 3 |

**The projection overshot the realized diff by ~11×.** The honest reading is the one the plan already gave: with `sample_count: 0` the calibration factor was 1.0 and the number measured nothing about this project. The plan's own reasoning about what actually drove cost was sound and is worth carrying forward — **read volume, not written volume, was the real expense**, and it was bounded by the plan citing every region of the 2,292-line census and its 4,315-line test file to an exact line span (largest: 90 lines), so neither file was ever read whole. The line citations drifted by a few lines against the tree but every one landed inside its named region.

**Caveat for the next projection, so this sample is not over-read:** `actuals.tokens` measures the realized diff, whereas the 95,000 projection was trying to predict total execution cost including reads. They are not the same quantity, and the ratio above should not be applied as a blanket 0.09 correction factor. What this sample supports is narrower and still useful: *a 6-file, 3-task seam extraction with line-bounded reads produced an 8.5k-token diff*.

## Next Phase Readiness

**Ready.** The boundary Phase 28 needs is in place and proven substitutable rather than merely present: swapping the annotation store means editing `block-class.ts` alone, and the committed substitutability proof will fail loudly if the census ever regrows a direct path to a store vocabulary.

Facts worth carrying into 27-05 and Phase 28:

- **The confidence grades are a second, unmoved store surface.** `classFromStore()` answers from the grade token and returns before consulting the block class, so on a fully-graded store the block vocabulary is not on the answering path at all. SEAM-03 moved the block surface; `r2000-confidence.ts` still owns the grade vocabulary, and a store substitution that changes grade spellings is not covered by this plan's proof.
- **A whole-glob `npm test` result needs the nine `MANUAL_ONLY_TESTS` subtracted by hand** before it can be read as a verdict. 27-05 owns the phase-level whole-glob run; the two live gaps it will meet are already itemised in `deferred-items.md`.
- No blockers. `deferred-items.md` D-27-02-A (the five ungated queue tests) touches the r2000 session/spawn family plan 27-04 owns, and is the one item that could reasonably be picked up in-phase.

---
*Phase: 27-shared-seams-extracted*
*Completed: 2026-08-27*

## Self-Check: PASSED

All `key-files.created` exist on disk (`block-class.ts`, `block-class.test.ts`,
`27-02-SUMMARY.md`, `deferred-items.md`), and all four commit hashes
(`b730032`, `d5b7e3c`, `f4bb4e1`, `5d5aff0`) resolve in `git log --all`.
Every task `<acceptance_criteria>` and the plan-level `<verification>` gate were
re-run and are recorded above under Verification Evidence.
