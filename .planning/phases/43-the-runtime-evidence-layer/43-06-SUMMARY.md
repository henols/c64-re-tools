---
phase: 43-the-runtime-evidence-layer
plan: 06
subsystem: annotation-store
tags: [evidence, reconciliation, disagreement, mcp-tool, cli, block-classifier]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 03)
    provides: "vice_memmap_zap -- the emulator-side half of the bracket reset this plan's anno_evid_reset completes with its own store-side half"
  - phase: 43-the-runtime-evidence-layer (plan 04)
    provides: "evid-reconcile.ts's reconcileObservedExecution() -- the pure join this plan's anno_evid_disagreements and evid-disagreements CLI verb both call, unmodified"
  - phase: 43-the-runtime-evidence-layer (plan 05)
    provides: "evid-ingest.ts's runIdentityFrom() (the one digest site anno_evid_reset reuses) and anno_evid_ingest's register-entry precedent"
provides:
  - "anno_evid_disagreements: read-only MCP verb answering where the byte-derived block table and the runtime evidence disagree, disagreements first, agreement as a count, with a never-observed count that never reads as data"
  - "anno_evid_runs: read-only MCP verb listing every run identity a store holds observations for, with its observation count and the shared denominator"
  - "anno_evid_reset: write verb clearing one run identity's observed-execution rows (the store-side half of a bracket reset), deriving its identity through runIdentityFrom() -- the same digest site anno_evid_ingest uses -- never a second hashing site"
  - "evid-disagreements: a fourth anno CLI verb rendering the same reconciliation as three distinguishable textual states (DISAGREEMENTS rows first, AGREEMENT as a count, NO OBSERVATION stating absence proves nothing), plus --json"
  - "a round-trip contract test walking every supported run class (the single implicit class on the project's own no-change branch, derived from anno-types.ts's exports rather than hand-typed) through the one run-identity path"
affects: [43-07]

# Actuals (#2632)
actuals:
  tokens: 18800
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A read verb fetches both sides of a pure join itself (listRanges/listExecObservations) and hands them to reconcileObservedExecution(), which never opens a store -- the same never-fetch discipline the join's own module header states"
    - "A lazy `await import(\"./anno-cli.ts\")` inside an MCP dispatch arm reuses a CLI-only helper (blocksFromStore) without pulling the CLI's own coverage/memmap-render/export-asm dependencies into the MCP server's static import graph"
    - "An optional, uncapped max_results (assertOptionalMaxResults) sits beside the file's existing REQUIRED max_results convention (assertMaxResults) as a second, narrower rule for exactly one verb, rather than loosening the shared one for everybody"
    - "A CLI verb's rendered report is a second, independent proof surface over the same pure join an MCP tool calls -- built so a planted test can compare three genuinely different pieces of TEXT, which a JSON answer can only be inspected structurally"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/anno-cli-invocations.test.ts
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/anno-register.ts
    - src/mcp/vice/module-classification.ts
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/lib/anno-cli-invocations.mjs
    - src/skills/c64-program-recon/references/tool-selection.md

key-decisions:
  - "anno_evid_disagreements's max_results is OPTIONAL, unlike every other list-returning anno_* verb (assertMaxResults's own REQUIRED-with-no-default convention). A sound store frequently disagrees nowhere at all, and forcing a ceiling on a legitimately-small or empty answer would buy nothing; a new assertOptionalMaxResults sits beside the existing function rather than loosening it for every other verb."
  - "The disagreement query's run-identity filter accepts argv_digest (an already-computed digest), not argv -- unlike anno_evid_ingest and anno_evid_reset, which both take argv and digest it themselves. A query's caller typically already holds the digest from anno_evid_runs's own answer, and requiring the raw argv again would be an ergonomic regression with no soundness benefit (a query cannot invent a bracket the way a write could)."
  - "The evid-disagreements CLI verb's mention was placed in ITS OWN new markdown table/section in tool-selection.md, never appended to the existing export-asm row -- that row's own 'withdrawn 2026-08-29, returned 2026-08-31' phrasing shares a blank-line-delimited paragraph with any addition placed there, and anno-verb-coverage.test.ts's withdrawal-status guard scans whole paragraphs: a verb mention sharing a paragraph with an unrelated 'withdrawn' claim, with no discharge marker of its own nearby, is reported as a false violation."
  - "The NO OBSERVATION report line was worded to avoid the literal word 'data' entirely ('proves NOTHING about what it is; absence is not evidence for or against any classification') rather than negating it in a sentence that still contains the word -- the planted silence-store test's negative grep checks for literal absence of the word, which a negated sentence containing it would still fail."

requirements-completed: [EVID-03, EVID-04, EVID-05]

coverage:
  - id: D1
    description: "anno_evid_disagreements answers a real store's disagreement, agreement and never-observed populations, disagreement-first, agreement as a count only, with the block table proven unwritten by the query"
    requirement: "EVID-03"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#tracer (EVID-03/EVID-04): a planted disagreement is written, ingested and asked for through anno_evid_disagreements ... the block table is proven unchanged by the query"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_disagreements: an observation inside a code-classified block is agreementCount only"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_disagreements and anno_evid_runs are read-only (T-43-29): both appear in READ_ONLY_ANNO_VERBS"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every count anno_evid_disagreements/anno_evid_runs report carries an explicit denominator, and max_results (optional, unlike every other list verb) bounds only the disagreements array"
    requirement: "EVID-04"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_disagreements: max_results is OPTIONAL ... and, when supplied, bounds only the disagreements array"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_runs: reports every run identity's observation count beside a denominator, never a percentage"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno_evid_reset clears exactly one run identity's rows, leaves every other identity and the block table untouched, and treats an empty bracket as changed:false rather than an error"
    requirement: "EVID-05"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_reset: reset of identity A leaves identity B's rows readable and unchanged"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_reset: resetting a run identity holding no observations reports changed:false and observationsRemoved:0"
        status: pass
      - kind: unit
        ref: "anno-tools.test.ts#anno_evid_reset: never touches the byte-derived block table -- listRanges is deep-equal before and after"
        status: pass
    human_judgment: false
  - id: D4
    description: "A contract test walks every supported run class through the single runIdentityFrom()/argvDigest() path, so a future singular assumption reintroduced elsewhere goes red"
    requirement: "EVID-05"
    verification:
      - kind: unit
        ref: "anno-tools.test.ts#contract: every evidence row round-trips through the ONE run-identity path (runIdentityFrom/argvDigest), for every supported run class"
        status: pass
    human_judgment: false
  - id: D5
    description: "The evid-disagreements CLI verb renders three genuinely distinguishable textual states -- disagreement, agreement, silence -- disagreement first, agreement as a count, silence stating plainly that absence proves nothing, with no percentage/rate anywhere"
    requirement: "EVID-03"
    verification:
      - kind: unit
        ref: "anno-cli.test.ts#evid-disagreements: three planted stores render three distinguishable states -- disagreement rows FIRST, agreement as a count only, silence stating plainly that absence proves nothing"
        status: pass
      - kind: unit
        ref: "anno-cli.test.ts#evid-disagreements: DISAGREEMENTS renders before AGREEMENT, which renders before NO OBSERVATION"
        status: pass
    human_judgment: false
  - id: D6
    description: "The three new verbs register through the existing ANNO_TOOL_DEFINITIONS array and single registration loop, gain no capability-registry.ts entry, and the disagreement query is structurally read-only (READ_ONLY_ANNO_VERBS, mustExist)"
    requirement: "EVID-03"
    verification:
      - kind: unit
        ref: "capability-registry.test.ts + stock-dispatch.test.ts (CR-07 exemption unchanged, full suite green)"
        status: pass
      - kind: other
        ref: "grep -c 'for (const annoDef of ANNO_TOOL_DEFINITIONS)' vice-proxy.ts == 1; grep -c 'anno_evid' capability-registry.ts == 0; grep -cE '^import .* from \"\\./anno-cli\\.ts\"' anno-tools.ts == 0"
        status: pass
    human_judgment: false

duration: ~3h
completed: 2026-09-10T11:33:09Z
status: complete
---

# Phase 43 Plan 6: The Askable Evidence Layer Summary

**Three new `anno_evid_*` MCP verbs (`disagreements`, `runs`, `reset`) plus a fourth `anno` CLI verb render the byte-derived block table against real observed-execution evidence as three distinguishable states -- disagreement first, agreement as a count, silence stating plainly that absence proves nothing -- with every count carrying its denominator and a bracket now resettable from the store side.**

## Performance

- **Duration:** ~3h
- **Started:** 2026-09-10 (continuation session)
- **Completed:** 2026-09-10T11:33:09Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- `anno_evid_disagreements` (read-only): joins `listRanges()`/`listExecObservations()` through `evid-reconcile.ts`'s `reconcileObservedExecution()`, returning `disagreements` (rows, first key), `disagreementCount`, `agreementCount` (a number, never rows), `blockCoveredNeverObservedCount`, `observedOutsideAnyBlockCount`, `observedAtUndefinedBlockCount`, `denominator`, plus `returned`/`matched`/`truncated` for an OPTIONAL `max_results` that bounds only the disagreements array. Reaches `blocksFromStore()` (the one `RangeRow`→`BlockEntry` mapping) via a lazy `await import("./anno-cli.ts")`, keeping a static import of the CLI (and its coverage/memmap-render/export-asm dependencies) out of `anno-tools.ts` entirely.
- `anno_evid_runs` (read-only): surfaces `listObservedRuns()`'s per-run-identity observation counts and shared denominator unchanged.
- `anno_evid_reset` (write): derives the run identity through `evid-ingest.ts`'s `runIdentityFrom()` -- the same single digest site `anno_evid_ingest` uses -- and calls `deleteExecObservationsForRun()` once, reporting `observationsRemoved` from a pre-delete count. Not added to `READ_ONLY_ANNO_VERBS`; takes the existence-check-plus-inode-guard write route every other write verb takes.
- A contract test (`anno-tools.test.ts`) derives the run-class vocabulary from `anno-types.ts`'s own exports (there is no `RUN_CLASSES` array -- the project's own live A/B selected the `no-change` branch, so there is exactly one implicit run class) and walks every member through `runIdentityFrom()`/`argvDigest()`, asserting the walked length equals the vocabulary length so a silent no-op walk cannot pass.
- `anno-cli.ts` gains its fourth verb, `evid-disagreements --store FILE [--json]`, calling the same `reconcileObservedExecution()` join directly (a static import here -- this module IS the CLI, not a startup-cost-sensitive server entry) and rendering it as `DISAGREEMENTS` (rows, first), `AGREEMENT` (count only), `NO OBSERVATION` (count, worded to state absence proves nothing WITHOUT using the literal word "data"), `OBSERVED OUTSIDE ANY BLOCK` and `OBSERVED AT UNDEFINED BLOCK`. `--json` prints the raw answer. No percentage/rate/`toFixed` site added.
- A planted three-store test (`anno-cli.test.ts`) proves the disagreement, agreement and silence states render as pairwise-unequal text, with a negative grep confirming the silence store's report never contains the literal word the disagreement report's own byte-derived column prints.
- Register entries added to `anno-register.ts` for all three new MCP verbs, citing `EVID-03`/`EVID-04`/`EVID-05` -- required by `anno-register.test.ts`'s completeness scan, and explicitly flagged by this plan's own project gotchas as a likely miss.

## Task Commits

Each task was committed atomically, with Tasks 1 and 2 landing together (see Deviations):

1. **Tasks 1+2: anno_evid_disagreements, anno_evid_runs and anno_evid_reset, plus the round-trip contract test** - `0cb2ec1f` (feat)
2. **Task 3: The evid-disagreements CLI verb rendering three distinguishable states** - `11dab55c` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/mcp/vice/anno-tools.ts` - three new `ANNO_TOOL_DEFINITIONS` entries, `assertOptionalMaxResults`, three assertion functions, three dispatch arms, `READ_ONLY_ANNO_VERBS` extended
- `src/mcp/vice/anno-tools.test.ts` - the tracer end-to-end disagreement test, agreement/max_results/filter tests, `anno_evid_runs` test, the round-trip contract test, three `anno_evid_reset` behaviour tests, an `argvDigest(` call-site census
- `src/mcp/vice/anno-cli.ts` - the fourth verb `evid-disagreements`, its parser, its report renderer, USAGE/VERB_OPTIONS/dispatch updates, header comment updated to FOUR VERBS
- `src/mcp/vice/anno-cli.test.ts` - `SURVIVING_VERBS`/`BOOLEAN_OPTIONS` extended, the verb-count assertion raised to 4, seven `evid-disagreements` tests including the planted three-state proof
- `src/mcp/vice/anno-cli-path-consumers.test.ts` - `CLI_PATH_ARGUMENTS`/`NON_PATH_OPTIONS` extended, `CLI_PATH_ARGUMENT_FLOOR` raised 9→10
- `src/mcp/vice/anno-cli-invocations.test.ts` - the "checker reads the CLI's own option set" test's positional-assumption fixed for a verb with none
- `src/mcp/vice/anno-verb-coverage.test.ts` - `REAL_VERBS` extended, `ANNO_CLI_VERB_FLOOR` assertion raised 3→4
- `src/mcp/vice/anno-register.ts` - three new register entries (`anno_evid_disagreements`, `anno_evid_runs`, `anno_evid_reset`)
- `src/mcp/vice/module-classification.ts` - two `anno-cli.ts` line citations and its own `checkAcceptedOptions` citation re-pointed after this plan's insertions shifted every later line
- `scripts/lib/anno-cli-verbs.mjs` - `ANNO_CLI_VERB_FLOOR` raised 3→4 with its own raise paragraph
- `scripts/lib/anno-cli-invocations.mjs` - `POSITIONAL_KINDS` documented as deliberately absent for a no-positional verb, `REQUIRED_FLAGS`/`FLAG_KINDS` gained `evid-disagreements` entries
- `src/skills/c64-program-recon/references/tool-selection.md` - a new standalone section documenting `anno evid-disagreements` (mirrored into the gitignored `installer/skills/` tree via `sync-skills.mjs`)

## Decisions Made
- **`max_results` is optional on `anno_evid_disagreements`**, breaking the file's own "REQUIRED with no default" convention for every other list verb, because an empty or small disagreement report is the ordinary, sound case and forcing a ceiling would add nothing. A dedicated `assertOptionalMaxResults` sits beside `assertMaxResults` rather than loosening it globally.
- **The disagreement query's run-identity filter takes `argv_digest`, not `argv`** -- unlike the two write verbs, which both digest a raw `argv` themselves. A query's caller already holds the digest (from `anno_evid_runs`'s own answer), and a query cannot invent a bracket the way a write could, so re-deriving the digest buys no soundness here.
- **The CLI verb's documentation was placed in its own new section**, not appended to the existing `export-asm` table row, because that row's "withdrawn ... returned" phrasing shares a blank-line-delimited paragraph with anything appended to it, and `anno-verb-coverage.test.ts`'s withdrawal-status guard scans whole paragraphs -- a new verb mention sharing that paragraph, with no discharge marker of its own, is reported as a false "documented as withdrawn" violation. This was discovered live (see Deviations).
- **The NO OBSERVATION report line avoids the literal word "data" entirely**, rather than negating it in a sentence that still contains it, because the planted silence-store test's negative grep checks for the word's literal absence -- a negated sentence containing it would still fail that check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three pre-existing structural guards required new entries for the three new MCP verbs**
- **Found during:** Task 2's own full-suite verification pass
- **Issue:** `anno-register.test.ts`'s completeness scan requires every `ANNO_TOOL_DEFINITIONS` entry to have a register entry citing a real consumer path and a declared requirement id -- `anno_evid_disagreements`/`anno_evid_runs`/`anno_evid_reset` had none, which would have made the pre-existing baseline failures list look worse in a way that reads as a new regression (this plan's own project gotchas named this exact risk in advance).
- **Fix:** Added three register entries citing `EVID-03`/`EVID-04` (disagreements), `EVID-04` (runs), and `EVID-05` (reset).
- **Files modified:** `src/mcp/vice/anno-register.ts`
- **Verification:** `node --test anno-register.test.ts` settles back to the documented 2-failure baseline for this file, none naming the three new verbs.
- **Committed in:** `0cb2ec1f` (Task 1+2 commit)

**2. [Rule 3 - Blocking] Adding a fourth `anno` CLI verb tripped six structural guards across two `scripts/lib/` modules and their tests**
- **Found during:** Task 3's own full-suite verification pass
- **Issue:** `anno-cli.test.ts`'s `SURVIVING_VERBS`/`BOOLEAN_OPTIONS`/verb-count assertion, `anno-cli-path-consumers.test.ts`'s `CLI_PATH_ARGUMENTS`/`NON_PATH_OPTIONS`/`CLI_PATH_ARGUMENT_FLOOR`, `anno-verb-coverage.test.ts`'s `REAL_VERBS`/`ANNO_CLI_VERB_FLOOR`, `scripts/lib/anno-cli-verbs.mjs`'s own floor, and `scripts/lib/anno-cli-invocations.mjs`'s `POSITIONAL_KINDS`/`REQUIRED_FLAGS`/`FLAG_KINDS` (plus a genuine bug in `anno-cli-invocations.test.ts`'s own harness, which hard-assumed every verb has at least one positional -- untrue for `evid-disagreements`) all needed updating for the CLI to genuinely grow a fourth verb without regressing any of these deliberately-maintained, raise-never-lower registries.
- **Fix:** Updated all of the above, each with its own "raised N→N+1" paragraph following the existing convention in each file.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`, `anno-cli-path-consumers.test.ts`, `anno-cli-invocations.test.ts`, `anno-verb-coverage.test.ts`, `scripts/lib/anno-cli-verbs.mjs`, `scripts/lib/anno-cli-invocations.mjs`.
- **Verification:** Each affected test file green individually; full `npm run test:automated` settles at the documented 3-failure floor.
- **Committed in:** `11dab55c` (Task 3 commit)

**3. [Rule 1 - Bug] `check-skill-tool-coverage.mjs`'s CLI-verb documentation gate, and `module-classification.ts`'s own line citations, both broke and needed fixing before the suite could be trusted**
- **Found during:** Task 3's own full-suite verification pass
- **Issue:** (a) `anno-verb-coverage.test.ts`'s "positive control" and the live CI script both require every dispatched CLI verb to be named `anno <verb>` in at least one real skill file -- `evid-disagreements` had no such mention. (b) Once documented in `tool-selection.md`'s existing `export-asm` row, the withdrawal-status guard (which scans whole blank-line-delimited paragraphs) falsely reported `evid-disagreements` as "documented as withdrawn," because that row's own historical "withdrawn ... returned" phrasing shares its paragraph with anything appended to it. (c) Inserting the new USAGE block, imports and header prose into `anno-cli.ts` shifted every line after it, breaking `module-classification.ts`'s two hardcoded line citations into that file (`buildCoverageReport` at line 132→136, `renderMemoryMap` at line 119→123) plus its own prose citation for `checkAcceptedOptions` (315→345).
- **Fix:** Added a new, standalone section to `tool-selection.md` documenting the verb (avoiding the poisoned paragraph and avoiding the literal `anno_evid_exec` table-name substring, which the tool-name extractor also mis-parses as an MCP tool name); re-pointed all three `module-classification.ts` citations to their new correct lines; synced `installer/skills/` via `node installer/scripts/sync-skills.mjs`.
- **Files modified:** `src/skills/c64-program-recon/references/tool-selection.md`, `src/mcp/vice/module-classification.ts`, `installer/skills/c64-program-recon/references/tool-selection.md` (gitignored mirror, regenerated not committed).
- **Verification:** `node scripts/check-skill-tool-coverage.mjs` exits 0 with "OK"; `node --test anno-verb-coverage.test.ts module-classification.test.ts` green.
- **Committed in:** `11dab55c` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 - blocking structural-guard maintenance, 1 Rule 1 - bug fix spanning a documentation gate and stale line citations). All were necessary to keep pre-existing, deliberately-maintained guards meaningful and green; none changed the three new verbs' or the CLI verb's designed behaviour.

## Process Note (commit granularity)

Task 1 (`anno_evid_disagreements`/`anno_evid_runs`) and Task 2 (`anno_evid_reset` plus the round-trip contract test) landed in one commit (`0cb2ec1f`) rather than two: both touch the same `ANNO_TOOL_DEFINITIONS` array, the same `assertVerbArgs`/`dispatch` chains and the same `READ_ONLY_ANNO_VERBS` list in adjacent, naturally-interleaved regions of `anno-tools.ts`, and were drafted in one editing pass while that context was live -- the same commit-granularity deviation plan 43-05's own SUMMARY disclosed for the identical reason. Task 3 (the CLI verb) is a genuinely separate commit, touching a different file family entirely.

## Issues Encountered
None beyond the three auto-fixed deviations above, all discovered live by this plan's own full-suite verification passes rather than left for a later phase to find.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `anno_evid_disagreements`, `anno_evid_runs`, `anno_evid_reset` and `evid-disagreements` are complete, tested, and registered; a future plan can build a rendering surface, a report, or an automation layer on top of any of them without re-deriving the reconciliation join or the run-identity discipline.
- Plan 43-07's own scope (per `ROADMAP.md`) is the two properties no single verb here proves alone: a derived key walk refusing a rate and demanding a denominator across every answer, plus the concurrent two-run-identity SIGKILL planting for `anno_evid_reset`'s own durability. Neither this plan's verbs nor its tests need to change for that plan to proceed.
- No stubs, no skipped tests, no unrun `<verify>` commands from this plan. `npm run test:automated` settles at exactly the documented 3-failure floor (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`), none outside it, confirmed on the final run of this session.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All key-files (modified) confirmed present on disk with `[ -f ]`.
- Both commit hashes (`0cb2ec1f`, `11dab55c`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (clean), `node --test anno-tools.test.ts anno-store.test.ts` (green), the census (`grep -cE '^import .* from "\./anno-cli\.ts"' anno-tools.ts` == 0, no `argvDigest(` call site in `anno-tools.ts`), `capability-registry.ts` naming `anno_evid` == 0 times, `vice-proxy.ts`'s anno registration loop count == 1, `node --test capability-registry.test.ts stock-dispatch.test.ts` (CR-07 exemption unchanged), `node --test anno-cli.test.ts anno-cli-path-consumers.test.ts` (green, three rendered outputs pairwise unequal), and `npm run test:automated` (settled at the documented 3-failure floor on the final run, none outside it).
- `pgrep -x x64sc` empty and `systemctl --user is-active vice-broker` reports `inactive` -- no live VICE broker or emulator was started during this plan.
