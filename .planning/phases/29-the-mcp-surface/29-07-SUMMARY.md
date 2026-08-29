---
phase: 29-the-mcp-surface
plan: 07
subsystem: infra
tags: [cli, annotation-store, coverage-census, removal-gate, guards, sqlite]

requires:
  - phase: 29-05
    provides: the renamed CLI (`anno-cli.ts`), its verb-parsing seam (`scripts/lib/anno-cli-verbs.mjs`), and the two allow-list entries re-pointed onto those paths and left citing this plan
  - phase: 29-06
    provides: the completed 19-verb `anno_*` surface over `anno-store.ts` / `anno-derive.ts`, whose read functions this plan's census adapter calls
provides:
  - a two-verb CLI (`render-memmap`, `coverage`) with no import of any module plan 29-10 deletes
  - a coverage census reading the Phase 28 annotation store through four named adapter functions, with the block-type vocabulary agreement measured rather than assumed
  - the removal gate's two CLI allow-list entries discharged by deletion — nothing cites 29-07 any longer
  - a dated withdrawal note in PROJECT.md for the `R2000-14` / `R2000-15` symbol round trip
affects: [29-09, 29-10, 29-12, phase-30]

actuals:
  tokens: 49000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Store-to-census adapter: four named caller-side functions map store rows onto a pure instrument's declared input shapes, so re-pointing the data source touches no measurement code"
    - "A by-name expectation table whose key set is asserted equal to the frozen vocabulary it describes — hand-written for precision, derived for totality, so it cannot become a second drifting home"
    - "A floor lowered because its SUBJECT changed is recorded as a replacement, naming the previous value and the event that raises it next"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/block-class.ts
    - src/mcp/vice/block-class.test.ts
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/docs-dangling-refs.test.ts
    - src/mcp/vice/anno-tools.ts
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-no-regenerator2000.mjs
    - .planning/PROJECT.md

key-decisions:
  - "The transitional capitalised block-type arm SURVIVES its own trigger. Its producer is gone, but every committed coverage fixture is still spelled in that vocabulary, so deleting the arm would silently reclassify every fixture block as `data`. New removal trigger: the fixtures being re-spelled. Carried as a Phase 32 guard-fate item."
  - "The `coverage` verb takes TWO paths — `<project>` for the payload bytes and a REQUIRED `--store` for the annotations — because the Phase 28 store holds annotations and never bytes. Deriving one path from the other would be exactly the auto-pick D-02 forbids."
  - "Both allow-list entries were DELETED rather than re-cited to 29-10: the pair re-measured at exactly zero occurrences, and an entry pinning a count of zero is an exemption with room in it."
  - "The per-address cross-reference loop moved INTO a named adapter (`crossReferencesFromStore`) and became an in-process derivation over the whole population; the 512-lookup round-trip ceiling was deleted rather than carried."

patterns-established:
  - "Equivalence-by-replay: a data-source re-point is proven by replaying every committed control fixture through the new source and asserting the verdict each fixture records, not by asserting the columns look right"
  - "Consumer citations are DELETED when the consumer goes, never stripped of their line numbers — a citation whose line is dropped stops being checked while still asserting a relationship that no longer exists"

requirements-completed: [STORE-06, MCP-05]

coverage:
  - id: D1
    description: "`blockClassAt()`'s mapping is total over the frozen twelve `DATA_TYPES`, and the class each of the twelve resolves to is pinned BY NAME — 29-RESEARCH assumption A3 closed as measured rather than carried"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#by-name pin: each of the store's twelve data types resolves to the class the census expects (29-RESEARCH A3, measured)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/block-class.test.ts#derived TOTAL cross-check: every member of the store's frozen block vocabulary maps to the right neutral class"
        status: pass
    human_judgment: false
  - id: D2
    description: "The CLI's dispatch switch parses to exactly the two surviving verbs, `render-memmap` and `coverage`, and neither is `default`; the six removed verbs are rejected with a message naming the two that exist"
    requirement: MCP-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#real-source parse: anno-cli.ts's dispatch switch yields exactly the 2 known verbs, never 'default'"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#each of the six removed verbs is rejected, and the rejection names the two verbs that exist"
        status: pass
    human_judgment: false
  - id: D3
    description: "The coverage census reads its four input shapes from the store (labels, comments, ranges, derived cross-references) and produces the SAME verdicts a committed fixture records — the re-point proven equivalent, not merely compiling"
    requirement: STORE-06
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#census re-point equivalence: control ... still produces a ... result when its facts come from a real store (12 fixtures, all pass)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-cli.test.ts#coverage end to end: the verb runs against a real store and prints all three named measures, exiting 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The round-trip lookup cap is removed rather than left as a silent truncation — the cross-reference answer covers the whole non-System label population"
    requirement: STORE-06
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#the cross-reference adapter answers over the WHOLE population, with no ceiling and no truncation note"
        status: pass
    human_judgment: false
  - id: D5
    description: "The CLI verb floor is a replacement over a new subject (8 -> 2) with its own raise-never-lower record, and the guard's planted-violation and comment-hygiene controls still bite"
    requirement: MCP-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#planted violation: an extra, genuinely new case is parsed and reported missing, while a real, documented verb is not"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#comment hygiene: a case hidden in a block comment or a line comment is never parsed as a verb"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs (exit 0; 'r2000 CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved')"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both removal-gate allow-list entries citing this plan are discharged, and the gate is green at every commit this plan made"
    requirement: MCP-05
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs (exit 0; 40 entries, no 29-07 citation)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The withdrawal of the `R2000-14` / `R2000-15` symbol round trip is recorded in PROJECT.md's shipped-capability list, dated, with Phase 30 named as its return condition"
    verification: []
    human_judgment: true
    rationale: "Whether a prose withdrawal note is genuinely findable by a reader checking whether the capability works is an editorial judgment no test asserts. The note's PRESENCE is mechanically checkable; its adequacy as a warning is not."

duration: 46 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 07: Narrow the CLI, Re-point the Census Summary

**The `r2000` CLI drops from eight verbs to two, and its `coverage` verb now reads labels, comments, ranges and derived cross-references out of the Phase 28 SQLite annotation store — proven verdict-for-verdict identical against all twelve committed coverage fixtures, with the 512-lookup round-trip ceiling deleted rather than carried.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-08-29T17:01Z (approx., first task commit at 17:26Z)
- **Completed:** 2026-08-29T17:47Z
- **Tasks:** 3 of 3
- **Files modified:** 12

## Accomplishments

- **The one flagged-unverified assumption is closed as measured.** `29-RESEARCH.md`'s assumption A3 — that `blockClassAt()` is total over the frozen twelve `DATA_TYPES` and that each resolves to the class the census expects — is now a committed by-name table whose key set is asserted equal to `DATA_TYPES` itself. **The measured mapping, in the schema's own order:** `code` → `code`; `byte`, `word`, `address`, `petscii`, `screencode`, `lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`, `external_file` → `data` (ten members); `undefined` → `undefined`. Both non-`data` classes are reachable from the store's own lowercase vocabulary, so the census does not depend on the transitional arm for either.
- **Six verbs deleted, not disabled.** `bootstrap`, `export-asm`, `verify`, `gen-enums`, `export-lbl` and `import-lbl` are gone from the dispatch switch, from `VERB_OPTIONS`, from USAGE and from the file's header, together with their implementations, their parsers and the four imports of modules plan 29-10 deletes (`r2000-launch.ts`, `r2000-project.ts`, `r2000-verify.ts`, `r2000-tools.ts`). `anno-cli.ts` fell from 1,511 lines to 883.
- **The census re-point is a caller-side change, and it is proven equivalent.** `anno-coverage.ts` was not touched. Four named adapters in the CLI (`symbolsFromStore`, `commentsFromStore`, `blocksFromStore`, `crossReferencesFromStore`) map the store's rows onto the instrument's three declared input shapes plus the derived fourth. All twelve committed control fixtures are replayed through a REAL populated store and reach the verdict each fixture records.
- **The truncation is gone.** The 512-lookup ceiling that bounded the per-label transport round trips is deleted. Over an in-process derivation it would truncate a complete answer and call the remainder a floor — strictly worse than the bound it used to express.
- **The gate entries this plan was cited to discharge are discharged by deletion.** Both files re-measured at exactly **zero** occurrences of the subject, so the fallback (lower the count, re-cite to 29-10) was not needed.
- **The verb floor is recorded as a replacement, not a lowering,** with the previous value, the reason holding it would have asserted a fact about verbs that no longer exist, and Phase 30 named as the event that raises it next.

## Task Commits

1. **Task 1: Establish the block-type vocabulary agreement** — `cd6e2e0` (test)
2. **Task 2: Narrow the CLI to two verbs and re-point the coverage census onto the store** — `d15ea45` (refactor)
3. **Task 3: Replace the CLI verb floor over its new subject** — `4e491a6` (refactor)

**Plan metadata:** see the `docs(29-07)` commit following this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` — narrowed to two verbs (1,511 → 883 lines); new store-to-census adapter section; `coverage` re-pointed onto `openStore`/`listLabels`/`listComments`/`listRanges`/`crossReferencesTo` with `storePathWithinWorkspace()` confining both caller-supplied paths.
- `src/mcp/vice/anno-cli.test.ts` — rewritten (1,651 → 970 lines) around the two surviving verbs, the narrowing itself, the IN-06 option contract, the WR-09 structural write guard, and the twelve-fixture equivalence proof.
- `src/mcp/vice/block-class.ts` — the transitional capitalised arm's comment rewritten as a dated decision with a new removal trigger and a Phase 32 fate.
- `src/mcp/vice/block-class.test.ts` — added `STORE_BLOCK_CLASS_BY_NAME` and its totality-plus-per-member test.
- `src/mcp/vice/anno-verb-coverage.test.ts` — `REAL_VERBS` narrowed to two; planted-violation negative control re-pointed onto `render-memmap`; comment-hygiene fixture given names that are synthetic by construction.
- `scripts/lib/anno-cli-verbs.mjs` — `ANNO_CLI_VERB_FLOOR` 8 → 2, with the replacement-not-a-lowering record.
- `scripts/check-skill-tool-coverage.mjs` — a dated note on `VERB_REQUIREMENT`'s three now-inert keys. **Its `render-memmap` generated-artifact non-vacuity check and its `extractedR2000.size >= 10` tool-name floor are byte-identical** (`git diff` touches neither).
- `scripts/check-no-regenerator2000.mjs` — the two 29-07 allow-list entries deleted, with the measurement recorded in their place.
- `.planning/PROJECT.md` — the dated `R2000-14`/`R2000-15` withdrawal note, and the constraints paragraph updated to name `anno-symbols.ts` and to state that its ROUTE, not its knowledge, is what left.
- `src/mcp/vice/module-classification.ts` — six now-false consumer citations deleted, two drifted line numbers re-pointed, the contested `r2000-verify.ts` note corrected.
- `src/mcp/vice/docs-dangling-refs.test.ts` — positive control re-pointed off the deleted `.vsf` refusal literal.
- `src/mcp/vice/anno-tools.ts` — the dangling `anno-cli.ts:483-506` citation removed.

## Decisions Made

- **The `coverage` verb gained a required `--store` option.** The plan's action text said to "open the store once for the whole verb" while `buildCoverageReport()` still reads its payload bytes from a project file. Those are two different files in the Phase 28 architecture — the store holds annotations and never bytes (`anno-store.ts`'s DDL has no payload table) — so the verb has to name both. `--store` is required rather than defaulted from `<project>`: deriving one caller-supplied path from another is exactly the silent auto-pick D-02 forbids. Both paths go through the single confinement seam.
- **Both allow-list entries were deleted, not re-cited.** Measured with the gate's own exported `subjectHits()` predicate: `anno-cli.ts` **13 → 0**, `anno-cli.test.ts` **14 → 0** (27 → 0 in total, matching the 27 the gate reported against plan 29-07). An entry pinning a count of zero would be an exemption with room in it, which the gate's own header forbids.
- **The reachability check was still performed and is recorded, even though the fallback was not used.** `29-10-PLAN.md`'s `files_modified` was read directly: it carries `scripts/check-no-regenerator2000.mjs`, `src/mcp/vice/anno-cli.ts` **and** `src/mcp/vice/anno-cli.test.ts`. Had either entry needed re-citing to 29-10, that citation would have been reachable.
- **The transitional capitalised block-type arm is KEPT** — see key-decisions above. This is the explicit fate decision Task 1 asked for rather than an omission.
- **The analyser-gated `render-memmap` happy-path test was dropped from `anno-cli.test.ts`.** It drove the retired binary through `synthesizeProject()` and `runR2000Tool()`, both of which plan 29-10 deletes, and D-17 makes plan 29-12 the owner of rebuilding that verb and its test. Keeping it would have carried two imports of deleted modules into a file whose whole point in this commit was to stop importing them. The verb's argument-level refusals are still covered here; its rendering behaviour is covered by `anno-memmap-render.test.ts`, which 29-12 owns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Six now-false consumer citations and two drifted line numbers in `module-classification.ts`**
- **Found during:** Task 2
- **Issue:** `module-classification.test.ts`'s Direction 9 asserts that every `basis.consumers[].line` citation resolves to a line CONTAINING the cited symbol, and Direction 9b does the same for `path:NN` citations in the module's own prose. Removing the six verbs deleted six import lines from `anno-cli.ts` and moved the two that survive, turning eight structured citations and one prose citation red.
- **Fix:** The two surviving citations (`renderMemoryMap` :66 → :63, `buildCoverageReport` :79 → :68) and the prose citation (`checkAcceptedOptions` :330 → :169) were re-pointed. The six citations naming consumers that no longer exist were **deleted**, not stripped of their `line` field — a citation whose line is dropped stops being checked by Direction 9 while still asserting a consumer relationship that is false, which reads as a maintained record. A dated `note` on the `anno-cli.ts` entry records all six by name and why. The contested `r2000-verify.ts` note's own claim ("the CLI records the same fact twice, at anno-cli.ts:91 and :631") was rewritten, since both sites went with the verb.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` — 20/20 pass.
- **Committed in:** `d15ea45`

**2. [Rule 3 - Blocker] `docs-dangling-refs.test.ts`'s positive control named a literal this plan deletes**
- **Found during:** Task 2
- **Issue:** The control asserts the string-literal scanner captures `.vsf input is not supported` from `anno-cli.ts` — the anti-blindness proof that the extractor sees `+`-concatenated plain literals, not only the USAGE template. That refusal belonged to `bootstrap`.
- **Fix:** Re-pointed onto `refusing to overwrite the existing file`, a `+`-concatenated refusal the surviving surface still has, with a comment recording the move and that the PROPERTY under test is unchanged. Not dropped — a guard that loses its non-vacuity control is a guard that can pass by seeing nothing.
- **Files modified:** `src/mcp/vice/docs-dangling-refs.test.ts`
- **Verification:** `node --test docs-dangling-refs.test.ts` — 8/8 pass.
- **Committed in:** `d15ea45`

**3. [Rule 1 - Bug] `anno-tools.ts` cited a line range this plan deletes**
- **Found during:** Task 2
- **Issue:** `anno-tools.ts:1720` says its image-loader branch order "is copied from `anno-cli.ts:483-506`". That range was `bootstrapProject()`'s extension-first dispatch, now deleted, leaving a dangling citation in a file no plan in this phase otherwise edits.
- **Fix:** Rewrote the comment to state that the CLI's copy is gone and that `anno-tools.ts` is now the only implementation of the order — keeping the WR-07 incident it encodes, dropping the citation.
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** typecheck clean; `anno-tools.test.ts` unaffected.
- **Committed in:** `d15ea45`

### Acceptance criteria met in substance but not in literal form

**Task 2, criterion:** *"The coverage verb … contains no per-address cross-reference loop and no round-trip lookup cap."*

The **verb body** contains neither: it makes one call to `crossReferencesFromStore(handle, bytes, origin, symbols)`, and the cap is deleted. The per-target invocation moved into that named adapter, where it iterates the label population once and calls `crossReferencesTo()` per target.

It could not become a single shared derivation pass without one of two things this plan may not do: editing `anno-derive.ts` to add a bulk `crossReferenceMap()` sibling (outside this plan's `files_modified`, and a wave-4 edit to a wave-3 deliverable), or writing a second derivation of "what references this address" inside the CLI — which is precisely the second answer the store boundary exists to prevent. What the criterion was protecting is fully delivered: **no transport round trips, no ceiling, no truncation, complete over the whole non-System label population**, asserted by a test that drives 600 labels through the adapter (deliberately above the retired 512 ceiling) and requires 600 answers. The residual cost is N in-process decodes rather than one shared pass; a bulk sibling in `anno-derive.ts` is the natural improvement and belongs to whichever plan owns that module next.

---

**Total deviations:** 3 auto-fixed (2 × Rule 3 blocker, 1 × Rule 1 bug) + 1 criterion met in substance rather than literal form.
**Impact on plan:** All three auto-fixes are guards that this plan's own change turned red; each was repaired in the same commit as the change that broke it, so no commit in this plan leaves a red guard behind. No scope creep — every touched file outside the plan's manifest was touched because it carried a now-false statement about `anno-cli.ts`.

## Issues Encountered

**The `29-07` plan's Task 2 `read_first` describes `render-memmap`'s module as having "zero local imports" and "no store call site". That is false** — `anno-memmap-render.ts:69` imports `runR2000Tool` from `r2000-tools.ts` and uses it at `:106` inside its own `queryR2000Json()`. This is exactly the NUL-byte grep blindness `29-BASELINE.md` documents and D-17 records; 29-10's own plan already carries the correction and assigns the rebuild to plan 29-12 at wave 6. **No action taken here** beyond leaving `render-memmap` untouched as instructed — pre-empting 29-12's rebuild is explicitly out of scope. `anno-cli.ts` itself imports nothing 29-10 deletes; the surviving dependency is one level down, in the verb's module.

**Test baseline: unchanged, verified against the SET not a count.** `npm run test:automated` finishes at **5 failures**, all in `r2000-session.test.ts` (the four `plan 18-06` FIFO-queue tests plus the timing-sensitive `R2000TimeoutError` stub). That is the recorded baseline file, load-sensitive as documented. `audit-integrity.test.ts` is absent from the failing set, which is the improvement 29-05 recorded and explained. **No new file entered the set.** Broker confirmed down before the run (`systemctl --user status vice-broker` → unit not found; no `x64sc`/`vice-broker` processes), so the BACK-05 phantom failure is not in play.

**Wave-4 coupling with plan 29-08 (this plan writes the gate 29-08 reads).** Not observable from here whether 29-08 ran before or after this plan's gate commit — no 29-08 artifacts exist on the tree at close, and its `files_modified` (`anno-register.ts`, `anno-register.test.ts`, `anno-derivation.test.ts`, `hostpath-consumers.test.ts`, `package.json`) shows no overlap with this plan's twelve files. The obligation was met regardless: `node scripts/check-no-regenerator2000.mjs` was run and observed at **exit 0** before Task 2's commit, immediately after it, and again after Task 3, so there is no window in which the gate was red. This plan also added and deleted **zero** `src/mcp/vice/anno-*.ts` files (`git diff --diff-filter=AD 41dac67..HEAD -- 'src/mcp/vice/anno-*.ts'` is empty), so 29-08's hand-typed `ANNO_MODULE_FLOOR` is unaffected.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && npm run test:automated` | 2811 tests, 2778 pass, **5 fail** — all `r2000-session.test.ts`, the recorded baseline set. No new failing file. |
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 — `r2000 CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved` |
| `node scripts/check-npm-packages.mjs` | exit 0 — `@henols/vice-mcp` 83 files |
| `node scripts/check-no-regenerator2000.mjs` | exit 0 — 40 entries, **no 29-07 citation** |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 |
| `node scripts/audit-gate.mjs` | exit 0 |
| `node --test anno-cli.test.ts anno-coverage.test.ts anno-coverage-grammar.test.ts anno-memmap-render.test.ts block-class.test.ts` | 218 tests, 215 pass, 0 fail |

**Removal-gate measurement, before and after (the gate's own `subjectHits()` predicate, path + content, one entry per occurrence):**

| File | Before | After | Disposition |
|---|---|---|---|
| `src/mcp/vice/anno-cli.ts` | 13 | **0** | entry DELETED |
| `src/mcp/vice/anno-cli.test.ts` | 14 | **0** | entry DELETED |
| Gate total (temporary allow-list) | 263 across 42 entries | 236 across 40 entries | −27, exactly the 27 attributed to 29-07 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 29-09 (wave 5)** inherits a two-verb CLI whose verbs are both already named by real skill files, so `check-skill-tool-coverage.mjs` reports `2/2 resolved` with no skill edit required as a precondition. Its own `files_modified` includes `scripts/lib/anno-cli-verbs.mjs` and `scripts/check-skill-tool-coverage.mjs`; both are green at this plan's close, and the `anno <verb>` invocation rename is 29-09's to make.
- **Plan 29-10 (wave 7)** inherits `anno-cli.ts` and `anno-cli.test.ts` free of the retired subject and free of every import it deletes. Its remaining work on that pair is nil for the removal gate; the entries are gone rather than re-cited, so 29-11's emptiness assertion is one pair closer.
- **Plan 29-12 (wave 6)** still owns the `render-memmap` rebuild. The verb, its CLI dispatch case, its argument refusals and its allow-list entry are all left exactly as found; its module's live import of the retired runner is untouched and remains D-17's subject.
- **Phase 30** carries a named, dated debt: `R2000-14` / `R2000-15`'s symbol round trip has no route, and `gen-enums`, `export-lbl` and `import-lbl` each raise `ANNO_CLI_VERB_FLOOR` when they return. `check-skill-tool-coverage.mjs`'s `VERB_REQUIREMENT` map was deliberately kept with all three keys so the failure message is right again the day the first one lands.
- **Phase 32** gains one guard-fate item: `block-class.ts`'s transitional capitalised arm, whose removal trigger is now the coverage fixtures being re-spelled.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

All modified files verified present on disk; all three task commits verified present in `git log --oneline --all` (`cd6e2e0`, `d15ea45`, `4e491a6`). Every task's `<acceptance_criteria>` was re-run at close; the one criterion not met in literal form is documented above under "Acceptance criteria met in substance but not in literal form" rather than silently skipped.
