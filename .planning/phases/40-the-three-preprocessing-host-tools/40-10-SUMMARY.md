---
phase: 40-the-three-preprocessing-host-tools
plan: 10
subsystem: docs
tags: [ghidra, documentation, gap-closure, census-gate, d-33]

requires:
  - phase: 40-the-three-preprocessing-host-tools
    provides: "GHIDRA_RUNS_HANDLE_NAME/TARGET, ghidraRunsRoot()/ghidraRunsRealRoot(), ensureGhidraRunsHandle() (plan 40-08); the broker minting the handle at startup (plan 40-09); the corrective measurement note .planning/notes/ghidra-dot-path-check-semantics.md"
provides:
  - "repo-root.ts's toolsDir() doc comment corrected: no longer claims the Ghidra runs root resolves through it, and states an exact, enumerated, test-gated census of the tool-written-root literal's non-comment occurrences (6 occurrences, 5 files) instead of the false 'exactly one'"
  - "repo-root.test.ts's census gate: reads the count and file list OUT of the comment, computes the real tree's occurrences with a NUL-tolerant, comment-stripping scan, and asserts agreement -- with a planted-violation control proving the comparison predicate actually fires"
  - "host-tool.mts's oracle scratch-dir comment states precisely which convention the Ghidra runs root follows (same physical location, reached through the alias handle rather than directly)"
  - "CLAUDE.md's D-33 bullet records no remaining exception -- names the getAbsolutePath()/getCanonicalPath() mechanism, the three simultaneous conditions the alias handle satisfies, the live guard, and the superseded method"
  - "docs/phase34-host-tool-seam-decisions.md's A-07 amended in place -- original claim kept visible, dated correction naming the candidate-set gap"
  - "Four historical records (34-03-PLAN.md, 34-03-SUMMARY.md, 40-01-SUMMARY.md) plus the completed consolidation todo's second addendum, each carrying a SUPERSEDED 2026-09-08 note citing the measured mechanism, with no original sentence deleted"
  - "40-UAT.md's two stale 'missing' sub-items (its own wording note, and 34-VERIFICATION.md) marked already-satisfied in place, with the grep -a evidence that settled 34-VERIFICATION.md needed no change; gap status/severity/truth fields untouched"
affects: ["40-11"]

actuals:
  tokens: 13775
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Return-don't-assert comparison predicate (docs-linerefs.test.ts's own shape) driving both the real census assertion and a planted-violation control over the SAME code path, applied to a doc-comment-vs-tree agreement check for the first time in this codebase"
    - "A doc comment states an exact, enumerated claim that a colocated test reads OUT of the comment (never duplicated by hand) and compares against a fresh measurement of the real tree -- the specific mechanism that turns a checkable-but-unchecked comment into a load-bearing one"
    - "Historical execution records corrected via a dated SUPERSEDED note placed at first encounter plus short inline pointers at every other site carrying the same claim, never a rewrite -- preserves the audit trail (verification: []/human_judgment: true on 40-01-SUMMARY.md's D5) that made the gap diagnosable"

key-files:
  created: []
  modified:
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/repo-root.test.ts
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - CLAUDE.md
    - docs/phase34-host-tool-seam-decisions.md
    - .planning/phases/34-the-host-tool-execution-seam/34-03-PLAN.md
    - .planning/phases/34-the-host-tool-execution-seam/34-03-SUMMARY.md
    - .planning/phases/40-the-three-preprocessing-host-tools/40-01-SUMMARY.md
    - .planning/phases/40-the-three-preprocessing-host-tools/40-UAT.md
    - .planning/todos/completed/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md

key-decisions:
  - "Census 'occurrence' is defined as a non-comment source LINE containing the double-quoted literal \".c64-re-tools\" (matching the original comment's own 'the line below' framing), not a per-regex-match count -- so vice-broker.mts's one line using the literal twice (both ternary branches) counts as one FILE entry in the enumerated list while contributing 2 to the total occurrence count (6 total across 5 files)."
  - "34-03-PLAN.md's other three tools/ghidra-runs literal mentions (test-value/artifact-directory references at the plan-time build spec, not restatements of the 'only placement' justification) were left untouched -- the plan's own interface_context scoped the correction to :89-94 specifically, and correction_policy only requires a note where the CLAIM is restated, not everywhere the old path string appears as a historical build spec."
  - "34-VERIFICATION.md needed no change -- re-verified with grep -an -i ghidra: its eight Ghidra mentions carry no claim that the location is unavoidable; ':40' (\"the no-dot project-path refusal enforced in code\") is still true. Recorded in 40-UAT.md's own missing list as already-satisfied rather than edited to look busy."

requirements-completed: []  # PREP-05 is shared across 40-08/40-09/40-10/40-11 (shared-ID gate) -- not marked complete until every declaring plan has a SUMMARY

coverage:
  - id: D1
    description: "repo-root.ts's toolsDir() comment no longer claims the Ghidra runs root resolves through it, and states an exact enumerated census (6 occurrences, 5 files) that repo-root.test.ts mechanically compares against the real tree"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "repo-root.test.ts#census gate: toolsDir()'s doc comment claims the EXACT count and file list of \".c64-re-tools\" non-comment occurrences, and the real tree agrees"
        status: pass
      - kind: unit
        ref: "repo-root.test.ts#census gate planted-violation control: the SAME comparison predicate fires on a synthetic extra occurrence and a synthetic phantom file, and fires on NEITHER for the real comment/tree pair"
        status: pass
      - kind: unit
        ref: "repo-root.test.ts#census gate is NUL-tolerant: a NUL byte earlier in a source file's text does not hide a later occurrence, and anno-memmap-render.ts is scanned, not silently skipped"
        status: pass
      - kind: other
        ref: "grep -ac 'exactly one non-comment occurrence' repo-root.ts == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "host-tool.mts's oracle scratch-dir comment states precisely which convention the Ghidra runs root follows (same physical location, reached through the alias handle, not directly); resources/host-tool.mjs rebuilt and committed alongside its source"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "node --test resources-sync.test.ts -- resources/ byte-identical to a fresh build"
        status: pass
      - kind: other
        ref: "git show --name-only 3349c23c includes both host-tool.mts and resources/host-tool.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md's D-33 bullet records no remaining exception -- names the getAbsolutePath()/getCanonicalPath() mechanism, all three conditions the alias handle satisfies, the live guard, and the superseded method, with docs-linerefs.test.ts still green and the rewriteArguments() bullet untouched"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "grep -ac 'One documented exception' CLAUDE.md == 0; grep -ac getCanonicalPath CLAUDE.md >= 1"
        status: pass
      - kind: unit
        ref: "node --test docs-linerefs.test.ts -- 13/13 pass, fail 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/phase34-host-tool-seam-decisions.md's A-07 amended in place -- original claim kept visible, dated correction naming the candidate-set gap and citing the measured mechanism"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "grep -ac 'only placement satisfying' docs/phase34-host-tool-seam-decisions.md >= 1; grep -ac ghidra-dot-path-check-semantics CLAUDE.md docs/phase34-host-tool-seam-decisions.md -- both nonzero"
        status: pass
    human_judgment: false
  - id: D5
    description: "Four historical records plus the completed consolidation todo's second addendum each carry a SUPERSEDED 2026-09-08 note citing the measured mechanism, with no original sentence deleted; 40-UAT.md's two stale sub-items marked already-satisfied with gap status/severity/truth untouched"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "per-file grep for SUPERSEDED 2026-09-08 / G-40-1 / ghidra-dot-path-check-semantics / getCanonicalPath|getAbsolutePath across all four files -- all present"
        status: pass
      - kind: unit
        ref: "node --test docs-dangling-refs.test.ts docs-review-disposition.test.ts -- 15/15 pass, fail 0"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 10: Correcting the record on Ghidra's runs-root exception (gap G-40-1) Summary

**Five forward-looking documents (repo-root.ts, host-tool.mts, CLAUDE.md, docs/phase34-host-tool-seam-decisions.md, plus a new census gate) now say what is true; four historical records plus one addendum carry dated superseding notes instead of rewrites -- and the load-bearing "the literal has exactly one occurrence" claim can no longer go false silently.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-08T17:57:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `repo-root.ts`'s `toolsDir()` doc comment had two independently false load-bearing claims: (a) that the Ghidra runs directory resolved through it (it never did, and is unreachable from it -- `ghidra-project.mts` is host-bound), and (b) that the `.c64-re-tools` literal had "exactly one non-comment occurrence" (measured false: 6 occurrences across 5 files). Both replaced with an accurate writer/joiner breakdown (5 files call `toolsDir()`/`supervisorDir()` directly across 4 subdirectories; 4 files join the literal directly for module-cycle/host-bound reasons) and an exact, enumerated census.
- `repo-root.test.ts` gained a census gate: it parses the count and file-list bullets straight out of the comment's own prose (never a second hand-typed copy), independently walks the real tree with a comment-stripping, NUL-tolerant scan, and asserts agreement. A planted-violation control drives the same comparison predicate with a synthetic surplus occurrence and a synthetic phantom file, proving the predicate is not vacuous. A dedicated NUL-tolerance test proves an embedded NUL byte earlier in a file's text does not hide a later occurrence, and confirms `anno-memmap-render.ts` (which carries two real embedded NUL bytes) is scanned by name rather than silently skipped -- the exact failure mode a plain `grep` (no `-a`) would produce.
- `host-tool.mts`'s oracle scratch-dir comment now states precisely which convention the Ghidra runs root follows: the same physical `.c64-re-tools/runs/<subdir>` shape, but reached through the alias handle rather than directly, because Ghidra (unlike this project's own oracle spawn) refuses a dot-prefixed segment in the path it is handed.
- `CLAUDE.md`'s D-33 Configuration bullet no longer records any remaining exception. It names the mechanism (`ProjectLocator` calls `getAbsolutePath()`, never `getCanonicalPath()`), the three conditions the alias handle satisfies simultaneously (no dotted segment in the absolutized path; inside the bind-mounted workspace; a RELATIVE link target), points at the live guard `ghidra-live.test.ts`'s SYMLINK GUARD cases added, and names the superseded method (`hasDotPrefixedSegment()` run against a synthetic string, never against Ghidra). The `rewriteArguments()` Architecture bullet and its four `vice-proxy.ts` line citations were re-checked and found unchanged (`3056`/`2991`/`1529`/`1505` -- see "Line-citation re-check" below).
- `docs/phase34-host-tool-seam-decisions.md`'s A-07 row is amended in place, matching the dated-amendment style A-15/A-16 already use: the original "only placement satisfying..." Rationale text is kept visible, with a dated note explaining it was true of the candidate SET CONSIDERED (existing real directories) and false of the full option space (a symlinked handle was never a candidate), citing the measured mechanism. The Reversibility column's original cost estimate is confirmed accurate by a follow-up note.
- Four historical records -- `34-03-PLAN.md`'s inline A-07 assumption, `34-03-SUMMARY.md`'s `.gitignore` reasoning, `40-01-SUMMARY.md`'s D5/"hard external-tool constraint" claim, and the completed consolidation todo's first addendum -- each gained a `SUPERSEDED 2026-09-08` note citing gap `G-40-1` and `.planning/notes/ghidra-dot-path-check-semantics.md`, naming the `getAbsolutePath()`/`getCanonicalPath()` mechanism and the superseded method. No original sentence was deleted from any of them; short inline pointers were added at every OTHER site in the same file that restated the same claim, rather than duplicating the full note.
- `40-01-SUMMARY.md`'s note is the highest-value one: it states outright that the "hard external-tool constraint" claim was produced by running this project's own `hasDotPrefixedSegment()` against a synthetic string -- which observes this project and never observed Ghidra -- and that the SUMMARY's own D5 coverage entry already carried `verification: []` plus `human_judgment: true`, a contemporaneous admission the claim was never measured and the exact artefact that made this gap diagnosable. The one acceptance criterion it recorded as NOT met is recorded as now genuinely met, closed by plan `40-08` rather than waived.
- `40-UAT.md`'s substance was already correct (its `measured_this_session` block already stated the absolutize-but-not-resolve-symlinks framing correctly, refined during the diagnosis session before this plan ran). Only its `missing` list's two now-stale correction sub-items were marked already-satisfied in place, dated, with the `grep -a` evidence that settled each: its own wording note (already applied before this plan started) and `34-VERIFICATION.md` (re-verified needing no change -- see below). The gap's `status`/`severity`/`truth` fields are byte-identical to the previous commit, per the plan's own instruction not to disturb the fields `/gsd-verify-work` reconciles from.

## Task Commits

Each task was committed atomically:

1. **Task 1: The two source comments, and a gate under the census claim so it cannot go false again** - `3349c23c` (docs)
2. **Task 2: The two forward-looking documents a future planner will actually read** - `7211713a` (docs)
3. **Task 3: Four historical records and one addendum, superseded with dated notes rather than rewritten** - `3cb52763` (docs)

**Plan metadata:** (this commit)

_Note: this plan's `type` frontmatter is `execute`, not `tdd` -- no plan-level TDD gate applies._

## Files Created/Modified

- `src/mcp/vice/repo-root.ts` - `toolsDir()`'s doc comment corrected: writer/joiner breakdown, exact enumerated census (6 occurrences, 5 files), alias-handle mechanism.
- `src/mcp/vice/repo-root.test.ts` - census gate: real-comment-vs-tree agreement, planted-violation control, NUL-tolerance test (3 new tests, 9 total in file).
- `src/mcp/vice/host-tool.mts` - oracle scratch-dir comment corrected to name the alias-handle indirection precisely.
- `src/mcp/vice/resources/host-tool.mjs` - rebuilt committed artifact (`npm run build`).
- `CLAUDE.md` - D-33 bullet: no remaining exception, mechanism, three conditions, live guard, superseded method.
- `docs/phase34-host-tool-seam-decisions.md` - A-07 row amended in place (Decision, Rationale, Reversibility columns).
- `.planning/phases/34-the-host-tool-execution-seam/34-03-PLAN.md` - A-07 assumption superseded with a dated note.
- `.planning/phases/34-the-host-tool-execution-seam/34-03-SUMMARY.md` - `.gitignore` reasoning superseded (doubly: location moved, and the "tracked-tooling" justification was already false when written -- confirmed via `git log --diff-filter=A -- 'tools/*.mjs'` returning nothing).
- `.planning/phases/40-the-three-preprocessing-host-tools/40-01-SUMMARY.md` - highest-value note: names the superseded method, the D5 verification-gap admission, and the now-closed acceptance criterion.
- `.planning/phases/40-the-three-preprocessing-host-tools/40-UAT.md` - two stale `missing` sub-items marked already-satisfied in place.
- `.planning/todos/completed/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md` - second dated addendum: the alias-handle reunification its first addendum floated has landed.

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

None - plan executed exactly as written. One self-correction during execution: an early draft of the todo file's "one exception" sentence in the `## Resolution` section reworded a couple of words while appending the corrective pointer; caught before committing and reverted to the exact original wording with the pointer appended after it instead, to strictly honor `<correction_policy>`'s "do not delete any original sentence" (word-level rewording of an existing sentence is not the same as deletion, but the safer reading -- preserve verbatim, append only -- was applied throughout).

## Re-measured Non-Comment Occurrence Census (Task 1)

Measured against the post-40-09 tree with a `grep -a`-equivalent scan (double-quoted literal `".c64-re-tools"`, non-comment lines, non-test files):

| File | Line | Occurrences | Reason |
|---|---|---|---|
| `repo-root.ts` | 266 | 1 | `toolsDir()`'s own definition |
| `install-resources.ts` | 101 | 1 | `installTargetDir()`'s `bin` join |
| `vice-broker.mts` | 138 | 2 | `parseArgs()`'s state-dir fallback (both ternary branches, same line) |
| `ghidra-project.mts` | 132 | 1 | `GHIDRA_RUNS_HANDLE_TARGET`, the alias handle's relative symlink target |
| `host-tool.mts` | 2934 | 1 | `oracle.run`'s scratch-directory join |

**Total: 6 occurrences across 5 files.** `repo-root.test.ts`'s census gate reads this exact count and file list out of `repo-root.ts`'s own comment and compares both against a fresh measurement of the real tree; a planted-violation control proves the comparison predicate fires when they disagree.

## `34-VERIFICATION.md`: needed no change

Re-verified per the plan's own instruction, with `grep -an -i ghidra .planning/phases/34-the-host-tool-execution-seam/34-VERIFICATION.md`. Output: eight Ghidra mentions, none claiming the runs-root location is unavoidable. The closest candidate, line 40 ("Ghidra runs with one project directory per run id, `-deleteProject`, and the no-dot project-path refusal enforced in code"), is still TRUE -- the refusal is still enforced in code, unchanged by the location move. Recorded as already-satisfied in `40-UAT.md`'s `missing` list rather than edited.

## Line-Citation Re-Check (Task 2)

`CLAUDE.md`'s Architecture bullet cites four `vice-proxy.ts:<N>` line numbers for `rewriteArguments()`'s two call sites and their enclosing functions. Neither plan `40-08` nor `40-09` touched `vice-proxy.ts` (confirmed: `40-08` modified `ghidra-project.mts`/`ghidra-project.test.ts`/`ghidra-live.test.ts`/`host-tool.test.ts`/`.gitignore`; `40-09` modified `vice-broker.mts`/`vice-broker-supervision.test.ts`/`host-tool.test.ts`/`ghidra-live.test.ts`). Re-checked directly against the current file:

| Citation | Content at that line |
|---|---|
| `3056` | `const rewritten = rewriteArguments(args, name);` |
| `2991` | `async function forwardToVice(...)` (the citation's "starts at" claim) |
| `1529` | `const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, ...)` |
| `1505` | `async function gatherWedgeEvidence(...)` (the citation's "starts at" claim) |

**No delta.** All four numbers match exactly; this was checked, not assumed, and `docs-linerefs.test.ts` confirms it mechanically for the two `rewriteArguments()` call-site citations.

## Final Repo-Wide Sweep: `git grep -an 'hard external-tool constraint'`

```
.planning/debug/ghidra-run-dir-outside-one-root.md          -- the diagnosis itself (in scope, out of correction: "the record OF the correction")
.planning/phases/40-the-three-preprocessing-host-tools/40-01-SUMMARY.md   -- inside the historical claim, now followed by "(Superseded — see the note above `## Performance`.)"
.planning/phases/40-the-three-preprocessing-host-tools/40-08-PLAN.md      -- a PRIOR plan's own record of what it corrected (not in this plan's scope)
.planning/phases/40-the-three-preprocessing-host-tools/40-08-SUMMARY.md   -- a PRIOR plan's own record of what it corrected (not in this plan's scope)
.planning/phases/40-the-three-preprocessing-host-tools/40-10-PLAN.md      -- this plan's own instructions, describing the fix
.planning/phases/40-the-three-preprocessing-host-tools/40-UAT.md          -- inside measured_this_session/artifacts, already framed correctively ("is still OVERSTATED", "the overstated ... justification")
.planning/seeds/broker-owned-tool-output-paths.md            -- already-correct seed, explicitly out of scope, cites the phrase as historical narration
.planning/todos/completed/2026-09-07-...-c64-re-tools.md     -- inside the first (historical) addendum, now followed by the second addendum's correction
CLAUDE.md                                                    -- inside the corrected D-33 bullet's own retraction sentence ("The previous record here called the split location ... — an overstatement produced by...")
```

Every hit is inside a superseding note, a prior/historical record, the diagnosis, this plan's own instructions, or the already-correct seed. **No hit asserts the phrase as a live, unqualified claim.**

## `npm run test:automated` Numbers

Precondition honored throughout: no VICE broker running (`pgrep -af vice-broker`/`x64sc` confirmed empty before each run).

| Run | tests | pass | fail | Notes |
|---|---|---|---|---|
| 1 | 3603 | 3585 | 7 | +1 beyond the recorded 6-failure baseline: `check-skill-fork-honesty` (`audit-root-args.test.ts`) |
| 2 | 3603 | 3586 | 6 | Exactly the documented 6-failure baseline, no extras |
| isolated | 58 | 58 | 0 | `node --test audit-root-args.test.ts` alone -- confirms run 1's extra failure was that file's own documented intermittent scratch-file race, not a regression |

**The 6-failure baseline itemised by cause** (identical in both full runs' non-race failures; none caused by, or fixed by, this plan):

1. `anno-register.test.ts` -- `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id` (pre-existing floor, out of scope)
2. `anno-register.test.ts` -- `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id...` (same floor)
3. `anno-register.test.ts` -- `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates` (same floor)
4. `audit-integrity.test.ts` -- `no milestone audit declares a gated status while any docs guard is red (D-12-02)` (pre-existing, plan `40-11`'s territory)
5. `docs-deferred-ledger.test.ts` -- `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)` (the un-ledgered `2026-09-08-guard-ghidra-symlink-project-location` todo -- pre-existing, plan `40-11`'s territory)
6. `docs-deferred-ledger.test.ts` -- `planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither` (same cause as #5)

**`npm run test:automated` does not exceed the recorded baseline.** `typecheck` clean throughout; `repo-root.test.ts`/`resources-sync.test.ts`/`docs-linerefs.test.ts`/`docs-dangling-refs.test.ts`/`docs-review-disposition.test.ts` all at 39+15 = combined `fail 0` when run together, and individually as each task's own `<verify>` required.

## Issues Encountered

None beyond the self-corrected wording deviation documented above under "Deviations from Plan".

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Gap `G-40-1` is fully closed in the record: no forward-looking document states the split location as unavoidable, and the four historical records plus the addendum all carry dated corrections that preserve the original audit trail.
- `PREP-05` stays incomplete (shared across `40-08`/`40-09`/`40-10`/`40-11`) until every declaring plan has a SUMMARY -- expected, per the shared-ID gate.
- Plan `40-11` (pure bookkeeping, per the orchestrator's own framing) is unblocked. No blockers.

## Self-Check: PASSED

All key files (`repo-root.ts`, `repo-root.test.ts`, `host-tool.mts`, `resources/host-tool.mjs`, `CLAUDE.md`, `docs/phase34-host-tool-seam-decisions.md`, the four historical records, this SUMMARY) confirmed present on disk. All three task commits (`3349c23c`, `7211713a`, `3cb52763`) confirmed present in `git log`. All three tasks' `<verify>` blocks re-run and passing. `npm run typecheck` clean. `npm run test:automated` re-run twice: the documented 6-failure baseline reproduced exactly in run 2; run 1's extra failure confirmed as the pre-existing `audit-root-args.test.ts` scratch-file race by isolated re-run (58/58 pass). Repo-wide sweep for the retracted phrase confirmed no live claim survives.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*
