---
phase: 45-decomposition-to-closure-disagreement-first
plan: 01
subsystem: annotation-store
tags: [anno-cli, decomp-completeness, evid-reconcile, dxa, ghidra, vice-broker, routine-queue-walker]

requires:
  - phase: 43
    provides: "evid-reconcile.ts's four-bucket disagreement join, anno_evid_ingest/anno_evid_disagreements/anno_evid_runs"
  - phase: 37
    provides: "the dxa+Ghidra derive-first import route (anno_import_ghidra_export, setDataType)"
provides:
  - "The fifth anno CLI verb, decomp-completeness -- the ONLY data path from a real store into the decomposition-completeness report"
  - "The frozen survivor prefix set, decided against a real measured label population"
  - "A committed nine-fixture execution manifest (D-13) naming which fixtures were run and why the rest were not"
  - "The routine-queue-walker completeness-report skill script, D-09's structural anti-vacuity gate proven live"
affects: [45-02, 45-03, 45-04, 45-05, 45-06, 45-07, 45-08, 45-09, 45-10]

actuals:
  tokens: 19688
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Task-scoped VICE broker: spawned as a plain child process for the exact lifetime of one script, never setsid/detached, torn down in the same run -- mirrors text-monitor-live.test.ts's own harness rather than the standing systemd unit"
    - "A CLI verb's --json envelope may carry a field alongside the spread reconciliation (runIdentity) without renaming or restructuring the reconciliation type itself"

key-files:
  created:
    - src/skills/routine-queue-walker/scripts/completeness-report.mjs
    - src/skills/routine-queue-walker/scripts/completeness-report.test.mjs
    - src/mcp/vice/fixtures/decomp-execution-manifest.json
    - docs/phase45-wave0-measurements.md
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/anno-verb-coverage.test.ts
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/lib/anno-cli-invocations.mjs
    - src/skills/routine-queue-walker/SKILL.md

key-decisions:
  - "The disagreement input's anti-vacuity check (D-09 mechanism 2) needed a run identity to validate against the store's own evid-runs table, which EvidReconciliation does not carry -- evid-disagreements --json now also prints runIdentity alongside the spread reconciliation fields, additive and never renaming the shipped type (Rule 2)."
  - "dxa's own listing ranges (runDxaDisassemble()'s .map.ranges, class code/data) feed setDataType(), not partitionByteDerived() -- that Phase 35 ground-truth classifier never assigns code by design, which would leave the store with no code range for the disagreement query to compare against evidence at all."
  - "The frozen survivor prefix set is AUTO_NAME_PREFIX_RE's eleven prefixes plus three defensive anchored cases (l_XXXX, FUN_XXXX/LAB_XXXX, dxa's real lNNNN), decided from a real measurement that returned zero labels -- confirming, not contradicting, RESEARCH.md's own prediction."
  - "Ghidra's cross-reference import for dxa/tracer.prg genuinely writes zero xrefs (REFERENCE_COUNT 0, DECOMPILE_ZERO_FUNCTIONS true) -- a real, disclosed finding about this fixture's own trivial shape (no JSR/JMP, no seeded entry point for auto-analysis), not a derivation defect."

requirements-completed: [DECOMP-01, DECOMP-02]

coverage:
  - id: D1
    description: "A real completeness report for dxa/tracer.prg renders end to end through the fifth anno CLI verb and the new skill script, from a real dxa+Ghidra-derived store, a real live VICE execution run, and a real anno_evid_disagreements answer -- no hand-written store rows anywhere on the path."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-wave0-measurements.md — Task 1 section, the full real derivation-to-render transcript"
        status: pass
    human_judgment: false
  - id: D2
    description: "Omitting --disagreements refuses by name with exit 1 and prints no report body; a fabricated or foreign run identity, and an unlisted fixture, are each refused by name."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "src/skills/routine-queue-walker/scripts/completeness-report.test.mjs#renderCompletenessReport() throws MissingDisagreementInputError naming --disagreements when disagreementInput is absent"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-wave0-measurements.md — captured refusal transcripts (omitted --disagreements, fabricated runIdentity, unlisted fixture)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The survivor regex is anchored and case-sensitive (l_0810 is a survivor, L_0810 is not), frozen only after the measured label population was recorded."
    requirement: DECOMP-02
    verification:
      - kind: unit
        ref: "src/skills/routine-queue-walker/scripts/completeness-report.test.mjs#isSurvivorName() is anchored and case-sensitive: l_0810 is a survivor, L_0810 is not"
        status: pass
    human_judgment: false
  - id: D4
    description: "ANNO_CLI_VERB_FLOOR reads 5, REAL_VERBS carries five entries, and 'anno decomp-completeness' appears in a skill file, all in the same commit as the dispatch case; the D-14 supersession is recorded in all three places."
    requirement: null
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts (all 10 tests, including the non-vacuity floor and positive-control tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The nine-fixture execution manifest is authored, parses as JSON, lists exactly six executed and three not-executed fixtures with non-empty reasons."
    requirement: null
    verification:
      - kind: unit
        ref: "manual JSON-schema check run during execution (python3 -c, asserted count/shape) -- not yet a committed automated test"
        status: pass
    human_judgment: true
    rationale: "The manifest's own structural check was run ad hoc during execution rather than committed as a standing test; a later plan in this phase should add one if the manifest's shape needs to stay guarded going forward."

# Metrics
duration: ~100min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 01: The Decomposition-Completeness Tracer Summary

**A real dxa+Ghidra-derived, really-executed dxa/tracer.prg store renders a real completeness report through a new fifth `anno` CLI verb and a new routine-queue-walker skill script, and omitting the disagreement input refuses by name instead of rendering an empty answer.**

## Performance

- **Duration:** ~100 min
- **Tasks:** 3 completed
- **Files modified:** 11 (4 created, 7 modified)
- **Commits:** 3

## Accomplishments

- The fifth `anno` CLI verb, `decomp-completeness` (D-07), reaches store
  data through three required, non-defaulted arguments and refuses by name
  when the disagreement input is absent, malformed, or carries an
  unmatched/foreign run identity, and when the fixture is absent from the
  execution manifest.
- `src/skills/routine-queue-walker/scripts/completeness-report.mjs` (D-04,
  D-06, D-08) renders the same report through the shipped resolution
  ladder, with `MissingDisagreementInputError` as the structural refusal
  D-09 mechanism 2 requires.
- The whole spine was run for real, once, on `dxa/tracer.prg`: dxa
  disassemble → `setDataType()` ranges → Ghidra flat64k analyze →
  `anno_import_ghidra_export` → a task-scoped VICE broker → `AUTOSTART` →
  an exec checkpoint at `$0815` → real `memmapshow` capture → real
  `anno_evid_ingest` → real `anno evid-disagreements` → the rendered
  report. No hand-written store row anywhere on the path.
- Two Wave 0 measurements are recorded as MEASURED facts: the real label
  population (zero, confirming RESEARCH.md's own prediction) and the suite
  failure baseline (5 named failures, broker confirmed stopped first).
- `ANNO_CLI_VERB_FLOOR`/`REAL_VERBS`/`SURVIVING_VERBS` and the shared
  invocation-checking tables all moved four → five together, in the same
  commit as the dispatch case, with the D-14 supersession recorded in every
  raised comment.

## Task Commits

1. **Task 1 (tracer) + Task 2 (freeze + measurements, combined into the CLI
   change)** - `f3795d13` (feat) — the fifth verb, guard raises, the skill
   script, the execution manifest, SKILL.md.
2. **Task 3 (tdd)** - `74a800d7` (test) — the report's Tier 1 unit test
   suite.
3. **Task 2's own artifact** - `6b50b0a6` (docs) — the Wave 0 measurements
   document.

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` - the fifth verb (`parseDecompCompletenessArgs`,
  `cmdDecompCompleteness`, `printDecompCompletenessReport`,
  `isSurvivorLabelName`, the frozen `SURVIVOR_EXTRA_RE`), plus
  `evid-disagreements --json`'s new `runIdentity` field
- `src/mcp/vice/anno-cli.test.ts`, `anno-cli-path-consumers.test.ts`,
  `anno-verb-coverage.test.ts` - frozen-registry raises (four → five)
- `scripts/lib/anno-cli-verbs.mjs`, `scripts/lib/anno-cli-invocations.mjs` -
  the shared floor/required-flags/flag-kinds tables, raised together
- `src/skills/routine-queue-walker/scripts/completeness-report.mjs` - the
  new report renderer
- `src/skills/routine-queue-walker/scripts/completeness-report.test.mjs` -
  its Tier 1 test suite
- `src/skills/routine-queue-walker/SKILL.md` - the new subsection naming
  the verb
- `src/mcp/vice/fixtures/decomp-execution-manifest.json` - the D-13
  execution manifest for all nine fixtures
- `docs/phase45-wave0-measurements.md` - both Wave 0 measurements plus the
  full real derivation-to-render transcript

## Decisions Made

- **`evid-disagreements --json` grew a `runIdentity` field** (Rule 2 —
  missing critical functionality). The shipped `EvidReconciliation` type
  carries no run-identity field, so `decomp-completeness`'s D-09
  anti-vacuity check had nothing to validate a supplied document against.
  Added as an envelope-level field (`{ store, runIdentity, ...reconciliation
  }`), computed from `listObservedRuns()` (`null` when the store holds zero
  or more than one distinct run). Never renames or restructures
  `EvidReconciliation` itself; `anno-cli.test.ts`'s own shape assertion for
  this verb's JSON output was checked and is unaffected (it asserts a
  subset of fields, not an exact shape).
- **dxa's own listing ranges feed `setDataType()`, not
  `partitionByteDerived()`.** The plan's own action text names
  `partitionByteDerived()`, but that Phase 35 function is a ground-truth-only
  classifier whose `certainCode` set is *always empty by design* — using it
  would leave the store's block table with no `code` range at all, making
  the disagreement query structurally vacuous for every fixture regardless
  of what actually executed. `runDxaDisassemble()`'s own `.map.ranges`
  (dxa's real listing-derived `code`/`data` classification) is the
  byte-derived source this phase's derive-first intent actually needs, and
  is what was written.
- **The frozen survivor prefix set** — decided in
  `docs/phase45-wave0-measurements.md` from the real (zero-label)
  measurement, per RESEARCH.md §2's own recommendation, and implemented
  identically (by necessity — see `completeness-report.mjs`'s own header)
  in both `anno-cli.ts` and `completeness-report.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `evid-disagreements --json` needed a run identity for D-09's anti-vacuity check**
- **Found during:** Task 1, while designing `cmdDecompCompleteness()`'s validation of the supplied `--disagreements` document
- **Issue:** The shipped `EvidReconciliation` type has no run-identity field, and the plan's own D-09 mechanism 2 requires validating the supplied document's run identity against the store's own `evid-runs` table — there was nothing to validate
- **Fix:** `cmdEvidDisagreements()`'s `--json` branch now additionally calls `listObservedRuns()` and includes `runIdentity` in the printed envelope (not part of `EvidReconciliation` itself)
- **Files modified:** `src/mcp/vice/anno-cli.ts`
- **Verification:** `node --test anno-cli.test.ts` (88/88 pass, including the pre-existing JSON-shape assertion for this verb, which asserts a subset of fields and is unaffected)
- **Committed in:** `f3795d13`

**2. [Rule 3 - Blocking] `anno-cli-path-consumers.test.ts` and `scripts/lib/anno-cli-invocations.mjs` were not in `files_modified` but red without an update**
- **Found during:** Task 1, running the plan's own verify commands after adding the verb
- **Issue:** Both files hand-declare per-verb inventories (`CLI_PATH_ARGUMENTS`, `REQUIRED_FLAGS`, `FLAG_KINDS`) that a new verb with new path-shaped flags must join, or the guards these files exist to be red by name
- **Fix:** Added `decomp-completeness`'s three path arguments to `CLI_PATH_ARGUMENTS` and raised `CLI_PATH_ARGUMENT_FLOOR` 10 → 13; added `decomp-completeness` entries to `REQUIRED_FLAGS`/`FLAG_KINDS`
- **Files modified:** `src/mcp/vice/anno-cli-path-consumers.test.ts`, `scripts/lib/anno-cli-invocations.mjs`
- **Verification:** both test files green, `node scripts/check-skill-cli-invocations.mjs` exits 0
- **Committed in:** `f3795d13`

**3. [Rule 3 - Blocking] `anno-cli.test.ts` had three hand-pinned "exactly four verbs" assertions**
- **Found during:** Task 1, running `node --test anno-cli.test.ts` after adding the verb
- **Issue:** `SURVIVING_VERBS`, a hard-coded verb count in the IN-06 agreement test, and the unknown-verb-refusal regex all still named four verbs
- **Fix:** Updated all three to name five verbs, including `decomp-completeness`
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** `node --test anno-cli.test.ts` (88/88 pass)
- **Committed in:** `f3795d13`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking)
**Impact on plan:** All three were necessary for correctness of the shipped guards; none expands scope beyond what D-07's own raise already implies for every hand-maintained verb inventory in the tree.

### Interpretive deviation (not a numbered rule — a design decision within task 1's own latitude)

**dxa's listing ranges, not `partitionByteDerived()`, feed `setDataType()`.**
See "Decisions Made" above. Recorded here too because it is a literal
divergence from the plan's own action-text wording, even though it
satisfies the plan's stated intent (derive first, byte-derived block
classification, code/data) more soundly than the literal function name
would have.

## TDD Gate Compliance

Task 3 carried `tdd="true"`. The RED phase (a failing test observed against
a not-yet-existing implementation) was **not observed**: `completeness-
report.mjs` was authored and functionally proven during Task 1's live
end-to-end derivation run, before Task 3's test tier was written, because
the tracer's own live pipeline (dxa → Ghidra → VICE → evid-ingest →
evid-disagreements → the new verb) needed to work end to end before the
report renderer's contract could be pinned with any confidence. Task 3's
seven tests were confirmed green on first run. This is disclosed rather
than presented as a RED→GREEN cycle that did not happen. The tests
themselves are non-vacuous (hand-written synthetic fixtures, not derived
from the module under test) and the live/planted-RED tier this task's own
scope defers to plan 45-04 is unaffected.

## Issues Encountered

None beyond the deviations recorded above.

## Known Stubs

None. Every deliverable this plan claims (the verb, the script, the
manifest, the frozen regex, both Wave 0 measurements) is backed by a real,
executed, measured artifact — no placeholder value, no empty default
standing in for unimplemented behavior.

## User Setup Required

None — no external service configuration required. All required host tools
(x64sc, dxa, Ghidra, ACME) were already present on this host and were only
detected, never installed.

## Next Phase Readiness

- The fifth verb, the report script, the frozen survivor regex, and the
  nine-fixture execution manifest are all in place for plans 45-02 through
  45-10 to build on.
- `docs/phase45-wave0-measurements.md` carries the real suite-failure
  baseline every later plan in this phase should diff its own suite runs
  against (compare the named set, never the count).
- No blockers. The manifest's own JSON-shape check (coverage item D5) was
  run ad hoc, not committed as a standing test — a later plan may want one
  if the manifest's shape needs a durable guard.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
