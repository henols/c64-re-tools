---
phase: 51-planning-vocabulary-out-of-the-shipped-server
plan: 06
subsystem: annotation-store-cli
tags: [planning-vocabulary, comment-budget, ratchet, anno-cli, anno-join, memmap-join, user-visible-output]

# Dependency graph
requires:
  - phase: none (wave 5, depends_on: ["51-05"])
    provides: "51-01's widened guard, RATCHET ledger, and finalized COMMENT_BUDGET_SLACK (1650). 51-02's CITATION-RESOLUTION.md tier ladder. 51-03/51-04/51-05's proof of the batch-scripted, exact-match rewrite pattern, including regenerated-artifact and structural-test-anchor repair."
provides:
  - "The annotation-store command line (anno-cli.ts, 164 citations) and four of its helpers (anno-join.ts 50, anno-symbols.ts 11, anno-index.ts 6, anno-details.ts 3 -- 234 total) all at zero, with all five RATCHET entries deleted."
  - "The first sweep in this phase to find and fix user-visible output that carries planning vocabulary: 18 of anno-cli.ts's sites sit in strings a person or an MCP caller reads, not only in comments."
affects: ["every later Phase 51 sweep plan touching a CLI or MCP-answer-composing module"]

# Actuals (#2632)
actuals:
  tokens: 21503
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-vs-comment split as its own first step before any edit. Every citation site in a file goes into one of two buckets: it lives in a comment, or it lives in a string literal a caller or reader sees. The two carry different risk. A comment edit is invisible to a consumer. A string edit changes what a person or an MCP client reads. The string bucket also needs a same-commit check for any test that pins the old text."
    - "Same batch-scripted exact-match rewrite discipline 51-03..51-05 established, applied per-site through the Edit tool rather than a Python batch script for this plan's smaller per-file citation counts (11-164 per file, versus the 300+ counts recent plans processed). Each Edit call is itself the uniqueness-verified replacement. The guard's own re-scan after each file substitutes for the count(old)==1 assertion those scripts made explicit."
    - "Post-edit structural-citation repair. A sweep that shrinks a file's line count can break another file's line-numbered citation into it. This plan checked directly: it grepped the whole tree for '<file>.ts:<digit>' patterns against the five swept files, rather than relying only on the automated gate to surface drift. That check found and fixed three drifted citations in module-classification.ts before the gate ran, and confirmed a fourth citation -- anno-provenance-ledger.ts's own reference to anno-join.ts:26 -- had not drifted."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-join.ts
    - src/mcp/vice/anno-symbols.ts
    - src/mcp/vice/anno-index.ts
    - src/mcp/vice/anno-details.ts
    - src/mcp/vice/skills-planning-vocabulary.test.ts
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "anno-cli.test.ts was read (per read_first) but needed no edit. No test in that file pins the exact string content of any of the 18 user-visible strings this plan rewrote. This was confirmed by grepping the test file for the citation substrings and for the rewritten replacement text, both before and after editing. The plan's own files_modified list named the file as a precaution its author could not rule out in advance, not as a prediction that came true."
  - "The plan's Task 2 action text describes anno-join.ts as 'the query that reports agreement AND disagreement between byte-derived facts and observed runtime facts' and asks for that asymmetry to survive as a complete explanation. Read in full, anno-join.ts contains no such comment and never did. It is the Phase 37 memmap/cross-reference join (AUTO-01..AUTO-07): it classifies each stored xref target against memmap.json, with bank-state resolution and a graphics write-back. It is not an agreement/disagreement reconciliation. That description matches evid-reconcile.ts's reconcileObservedExecution() join instead. 51-05 already swept that file and quoted its soundness-asymmetry comment in its own summary. Nothing was fabricated to satisfy the instruction. This discrepancy is disclosed here rather than silently worked around."

patterns-established: []

requirements-completed: [VOCAB-01, VOCAB-02, VOCAB-04, VOCAB-06]

coverage:
  - id: D1
    description: "anno-cli.ts, anno-join.ts, anno-symbols.ts, anno-index.ts and anno-details.ts all scan clean under the guard's own predicate and their RATCHET entries are gone"
    requirement: "VOCAB-01"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#no shipped file carries planning vocabulary beyond its pinned ratchet allowance"
        status: pass
      - kind: other
        ref: "grep -ac '\\.planning' and grep -aE -c 'docs/phase[0-9]' against all five sources, every one prints 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every one of anno-cli.ts's 18 user-visible strings (11 in printed --help text, 7 in runtime refusal/status messages) states its rule in plain words instead of an internal reference, and no test that pinned the old text broke"
    requirement: "VOCAB-06"
    verification:
      - kind: unit
        ref: "anno-cli.test.ts (full suite, 33 tests covering render-memmap/coverage/export-asm/evid-disagreements/hazard-report) -- all pass unmodified"
        status: pass
    human_judgment: true
    rationale: "Whether a rewritten help or refusal string still reads as a complete, useful instruction to an operator is a judgment call, beyond the guard's mechanical 'not shorter' measure. The quoted before/after pairs in this summary are the evidence a human reviewer should read against the original."
  - id: D3
    description: "No comment explaining the pre-spawn label-import gate, the paint-index resolution rule, the composed-address-details disclosure contract, or the memmap-join's bank-state machinery is shorter in substance than before. The comment-byte budget stays inside its slack for all five files."
    requirement: "VOCAB-02"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#comment volume lost per file stays inside the citation characters removed"
        status: pass
    human_judgment: true
    rationale: "The mechanical budget check does not by itself prove no reason was shortened away. A human should spot-check a sample of the before/after comment rewrites in this summary against the original prose."
  - id: D4
    description: "The full automated gate (npm run test:automated) is green, apart from one pre-existing environment condition unrelated to this plan's edits"
    verification:
      - kind: integration
        ref: "npm run test:automated"
        status: pass
    human_judgment: true
    rationale: "The gate reported one failure on both full runs: anno-verb-coverage.test.ts's shipped-skill-tree byte-identity check. This traces to the dev environment's installer/skills/ mirror being out of sync, a gitignored, generated directory this plan's five files never touch. See Issues Encountered for the full trace, including a second, non-reproducing test that self-resolved on rerun."

duration: 95min
completed: 2026-09-14
status: complete
---

# Phase 51 Plan 06: Annotation-store CLI and its join/symbol/index/detail helpers Summary

**All 234 planning-vocabulary citations across `anno-cli.ts`, `anno-join.ts`, `anno-symbols.ts`, `anno-index.ts` and `anno-details.ts` rewritten into the reasons they stood for -- including, for the first time in this phase, 18 sites in `anno-cli.ts` that live inside printed `--help` text and runtime refusal/status strings rather than in comments, each reworded to state its rule in plain words a reader with no `.planning/` tree can act on.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 2
- **Files modified:** 7 (5 sources, 1 guard ledger, 1 structural-citation repair)

## Accomplishments

- Swept `anno-cli.ts`'s 164 citations to zero. This is the densest file this phase has processed for one specific risk: it is the first file in the phase whose citations sit partly in printed output. Every site was split into two buckets before any edit -- **146 comment sites**, **18 string sites**. 11 of the string sites sit inside the `USAGE` template literal that `--help` prints verbatim. 7 sit inside runtime `console.error`/`console.log` calls in `validateDisagreementDocumentShape()`, `cmdDecompCompleteness()` and `printDecompCompletenessReport()`. Every string rewrite states the refused-or-reported fact in the sentence itself, rather than naming an internal id. None became shorter or vaguer than the version it replaced.
- Confirmed, by grepping `anno-cli.test.ts` for both the removed citation substrings and the rewritten replacement text, that no test in that file pins the exact wording of any of the 18 rewritten strings. The file was read per the plan's own `read_first` instruction but needed no edit. All 33 of that file's tests pass unmodified against the rewritten strings.
- Swept `anno-join.ts` (50), `anno-symbols.ts` (11), `anno-index.ts` (6) and `anno-details.ts` (3) to zero. One of `anno-details.ts`'s three sites -- the `D-07` site inside `composeAddressDetails()`'s `reason:` string -- is itself user-visible: it is returned verbatim to an MCP caller, not merely commented. All four files are comment-dominant. The tier ladder resolved almost every site as tier 1: a bare parenthetical beside prose that already states the reason. This codebase's own house style states the WHY in full sentences beside almost every id, so dropping the id loses no fact anywhere in these five files. No genuinely dangling (tier-4) site turned up in any of the five files. Every `D-NN`/`CR-NN`/`WR-NN`/`AUTO-NN`/`STORE-NN`/`COV-NN`/`MCP-NN` id removed had its reason already stated in the same sentence or the sentence right around it.
- Deleted all five `RATCHET` entries. Left the five `COMMENT_BUDGET_BASELINE` rows in place, per 51-01/51-04/51-05's own convention.
- Found and fixed a real defect this sweep's own edits caused, before the automated gate could surface it. `module-classification.ts` carries three structured/prose line citations into `anno-cli.ts`: `checkAcceptedOptions`, `buildCoverageReport`, `renderMemoryMap`. Task 1's header and body rewrites shifted the file's net line count by -2, drifting all three citations by exactly that amount. This plan fixed all three (447->445, 143->141, 130->128) in Task 2's own commit. It separately confirmed a fourth cross-file citation did not drift: `anno-provenance-ledger.ts`'s own reference to `anno-join.ts:26`. The net line-count change above that particular line in `anno-join.ts` happened to be zero.
- `npm run typecheck` exits 0 after both tasks. `npm run test:automated` reports one failure, traced to a pre-existing, unrelated environment condition (see Issues Encountered) rather than to this plan's edits. A second, non-reproducing failure on the first full run self-resolved on rerun and was independently confirmed to pass standalone.

## Task Commits

1. **Task 1: Sweep anno-cli.ts to zero, separating comments from user-visible output** - `45875e10` (feat)
2. **Task 2: Sweep anno-join.ts, anno-symbols.ts, anno-index.ts and anno-details.ts to zero** - `041e2926` (feat)

**Plan metadata:** commit follows this file.

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` -- all 164 citation sites rewritten (146 comment, 18 string); zero planning-vocabulary tokens remain
- `src/mcp/vice/anno-join.ts` -- all 50 citation sites rewritten; zero remain
- `src/mcp/vice/anno-symbols.ts` -- all 11 citation sites rewritten; zero remain
- `src/mcp/vice/anno-index.ts` -- all 6 citation sites rewritten; zero remain
- `src/mcp/vice/anno-details.ts` -- all 3 citation sites rewritten (2 comment, 1 string); zero remain
- `src/mcp/vice/skills-planning-vocabulary.test.ts` -- all five `RATCHET` entries for these files deleted; five `COMMENT_BUDGET_BASELINE` rows left in place
- `src/mcp/vice/module-classification.ts` -- three structural line citations into `anno-cli.ts` repointed after Task 1's edits shifted the target lines

## Every changed user-visible string in `anno-cli.ts`, quoted before and after

None is pinned by any test in `anno-cli.test.ts` (verified by grep for both the old and new text). All 33 of that file's tests pass unmodified.

**In the printed `USAGE` template (11 sites):**

1. Before: `validated provenance sidecar (D-24: the store is canonical, this output is a GENERATED VIEW -- never hand-edit it).`
   After: `validated provenance sidecar (the store is canonical; this output is a GENERATED VIEW -- never hand-edit it).`
2. Before: `Measures how far a program has actually been reverse-engineered (COV-01/COV-02), through anno-coverage.ts.`
   After: `Measures how far a program has actually been reverse-engineered through anno-coverage.ts.`
3. Before: `...refused BY NAME instead of falling through to the .prg parser (WR-07: a 4096-byte .raw once had its first two bytes read as a load address and reported a complete-looking measurement);`
   After: `...refused BY NAME instead of falling through to the .prg parser (a 4096-byte .raw once had its first two bytes read as a load address and reported a complete-looking measurement);`
4. Before: `...its only producer was deleted (D-14) and it is kept solely so an existing file on disk is not broken.`
   After: `...its only producer was deleted, and it is kept solely so an existing file on disk is not broken.`
5. Before: `...as inline comments (BUILD-05). It is OPTIONAL:`
   After: `...as inline comments. It is OPTIONAL:`
6. Before: `The decomposition-closure completeness answer for ONE per-fixture store (D-07).`
   After: `The decomposition-closure completeness answer for ONE per-fixture store.`
7. Before: `--manifest names the execution manifest (D-13) recording which committed fixtures were actually run.`
   After: `--manifest names the execution manifest recording which committed fixtures were actually run.`
8. Before: `...must never render the same report (D-09 mechanism 1).`
   After: `...must never render the same report.`
9. Before: `Never prints a percentage, rate or combined figure (D-05's own rule, applied here too).`
   After: `Never prints a percentage, rate or combined figure -- the same rule this CLI applies to every verb's own report.`
10. Before: `...this CLI never guesses (D-02).`
    After: `...this CLI never guesses.`

**In runtime refusal/status messages (7 sites):**

11. Before: `decomp-completeness: the --disagreements document is not a JSON object -- refusing to render (D-09)`
    After: `decomp-completeness: the --disagreements document is not a JSON object -- refusing to render`
12. Before: `this is not a real anno evid-disagreements --json answer, refusing to render (D-09)`
    After: `this is not a real anno evid-disagreements --json answer, refusing to render`
13. Before: `rendered as "no disagreements" (D-09 mechanism 2, RESEARCH.md Pitfall 9)`
    After: `rendered as "no disagreements"`
14. Before: `...must never render the same report as a real, empty answer (D-09).`
    After: `...must never render the same report as a real, empty answer.`
15. Before: `...never defaulted to "executed" (D-13).` (two occurrences: the `--manifest` missing-argument message, and the unlisted-fixture refusal)
    After: `...never defaulted to "executed".`
16. Before: `EXECUTED: this fixture was run under the reproducible-run protocol (REPRO-02).`
    After: `EXECUTED: this fixture was run under the reproducible-run protocol.`

## Decisions Made

See `key-decisions` in the frontmatter. The most consequential: this plan's Task 2 text describes a "soundness asymmetry" comment that does not exist in `anno-join.ts`. That description belongs to `evid-reconcile.ts`'s join, already swept in 51-05. This summary discloses the mismatch rather than inventing prose to satisfy an instruction that does not apply to this file's actual content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, caused by this task's own edit] Three structural line citations in module-classification.ts drifted after anno-cli.ts's line count shrank**

- **Found during:** A proactive whole-tree grep for `<swept-file>.ts:<digit>` patterns, run before the automated gate, per this project's own documented lesson (51-04/51-05) that a citation-removing sweep can break another file's line-numbered pointer into the swept file.
- **Issue:** `module-classification.ts` cites three functions in `anno-cli.ts` by line number: `checkAcceptedOptions` at line 447, `buildCoverageReport` at line 143, `renderMemoryMap` at line 130. Task 1's header and body rewrites shrank `anno-cli.ts` by a net 2 lines above all three targets, moving them to 445, 141 and 128 respectively.
- **Fix:** Repointed all three citations to their new, verified line numbers.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` -- both `DIRECTION 9` (structured line-citation containment) and `DIRECTION 9b` (prose line-citation containment) pass.
- **Committed in:** `041e2926` (Task 2 commit, alongside the four remaining files' own sweep).

---

**Total deviations:** 1 auto-fixed (a cross-file citation break this task's own edits caused). No tier-4 (genuinely dangling) sites turned up in any of the five files. Every id removed had its reason already stated in the surrounding prose. **Impact:** The auto-fix restores a structural test this task's own edits broke, with no assertion-text change. No fact was lost anywhere in the five swept files.

## Issues Encountered

- **`anno-verb-coverage.test.ts`'s shipped-skill-tree byte-identity check fails, and is a pre-existing environment condition, not a regression from this plan.** `npm run test:automated` reported this failure on both full runs. The trace is direct: `installer/skills/` (gitignored, regenerated by `installer/scripts/sync-skills.mjs`) contains only `acme-build/` in this working tree. It is missing nine other skill directories the check expects to find byte-identical to `src/skills/`. None of the five files this plan modified touch `src/skills/`, `installer/`, or the sync script. A standalone rerun of the same test reproduces the identical failure with the identical missing-file list. This confirms the failure is deterministic and environment-caused, not caused by this plan's edits.
- **A second, non-reproducing failure on the first full-gate run: `anno-durability.test.ts`'s "EVID-05 concurrent planting" test.** This test kills a concurrent writer mid-ingest with a real `SIGKILL` and asserts on the surviving state. It failed once on the first full-gate run and passed on both a standalone rerun of the same test file and the second full-gate run. This is a timing-sensitive test unrelated to any file this plan touches (annotation-durability/concurrency, not the CLI or its helpers), and this plan did not modify its own file.
- Apart from the one pre-existing failure above, the second full `test:automated` run matched the orchestrator's stated baseline exactly: `tests 4432, pass 4422, fail 1, skipped 9` (skipped count identical to baseline; the one failure is the documented pre-existing condition, not a new one).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `anno-cli.ts`, `anno-join.ts`, `anno-symbols.ts`, `anno-index.ts` and `anno-details.ts` are all at zero, with clean `RATCHET` bookkeeping and their `COMMENT_BUDGET_BASELINE` rows still in place.
- The string-vs-comment split performed for `anno-cli.ts` is available as a worked example for any later sweep plan whose file reaches a CLI, an MCP tool's returned JSON, or any other consumer-visible surface. The risk is not unique to this file.
- `VOCAB-01`, `VOCAB-02`, `VOCAB-04`, `VOCAB-06` remain `Pending` in `REQUIREMENTS.md`, unless the `ready-ids` gate determines otherwise at this plan's own `update_requirements` step (shared-id gate: other sweep plans in this phase declare the same ids, and some have not yet finished).
- No blockers for the next sweep plan. This plan's whole-tree grep for cross-file line citations into a file about to be swept (demonstrated here against `module-classification.ts` and `anno-provenance-ledger.ts`) is a cheap, five-minute check. It is worth running before any further sweep plan's own automated gate, rather than relying on the gate alone to surface drift.

## Self-Check: PASSED

Key files exist on disk:
- `FOUND: src/mcp/vice/anno-cli.ts`
- `FOUND: src/mcp/vice/anno-join.ts`
- `FOUND: src/mcp/vice/anno-symbols.ts`
- `FOUND: src/mcp/vice/anno-index.ts`
- `FOUND: src/mcp/vice/anno-details.ts`

Both task commit hashes resolve in `git log --oneline --all`:
- `FOUND: 45875e10`
- `FOUND: 041e2926`

Every plan-level `<verification>` item was re-run live:
- `npm run typecheck` exits 0.
- `npm run test:automated` reports `tests 4432, pass 4422, fail 1, skipped 9` on the clean rerun. The one failure is the pre-existing, unrelated `anno-verb-coverage.test.ts` environment condition documented above, confirmed independent of this plan's edits.
- All five files scan clean (0 hits each) via the guard's own `scanForPlanningVocabulary()` and have no `RATCHET` entry.
- `grep -ac '\.planning'` and `grep -aE -c 'docs/phase[0-9]'` against all five sources print 0 in every case.
- `grep -ac 'anno-cli.ts\|anno-join.ts\|anno-symbols.ts\|anno-index.ts\|anno-details.ts' skills-planning-vocabulary.test.ts` prints 5: exactly the five `COMMENT_BUDGET_BASELINE` rows, at or below the plan's own `-le 5` threshold.

---
*Phase: 51-planning-vocabulary-out-of-the-shipped-server*
*Completed: 2026-09-14*
