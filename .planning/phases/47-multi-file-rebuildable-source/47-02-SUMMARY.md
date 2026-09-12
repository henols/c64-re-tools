---
phase: 47-multi-file-rebuildable-source
plan: 02
subsystem: build
tags: [acme, exportAsmTree, scopes, output-directory-contract, node-test]

requires:
  - phase: 47-multi-file-rebuildable-source
    provides: "plan 47-01's exportAsmTree(), ROOT_FILE_NAME/SYMBOLS_FILE_NAME/UNSCOPED_FILE_NAME/scopeFileName(), ExportBlock.lines, ExportAsmResult.headerLines/scopes -- the one-scope tree writer this plan generalizes"
provides:
  - "exportAsmTree() partitions across MANY scopes through one containment predicate (placeBlockInScope()), never a second copy of the containment question"
  - "A block inside no scope is emitted into unscoped.a -- losslessness holds under the partition"
  - "A range crossing a scope boundary refuses by name, naming both extents, before any file is written"
  - "The output-directory contract: a non-empty directory refuses without force; force replaces only names this export itself produces, and any other entry is a named refusal, never a deletion"
  - "A drift guard proving a re-export is a reviewable diff: two exports of an unchanged store are byte-identical file for file, both directions, with a non-vacuity control"
  - "Every adjacency, empty and ordering edge the phase owed (D47-B's file-name derivation, sourceOrder, degenerate zero-scope/zero-label/zero-range trees) is a named passing test"
affects: [47-04-branch-symbolization, 47-05-cli-out-dir-promotion, 47-06-branch-symbolization-continuation]

actuals:
  tokens: 10900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One containment predicate, applied once: placeBlockInScope() is the single place a block's file destination is decided -- wholly-contained scope, the unscoped marker, or a thrown refusal -- so the tree writer's answer can never drift from a second copy of the question."
    - "Compute-then-check output-directory contract: the full set of names an export WILL write is computed before the directory is touched, then compared against the directory's actual entries -- the same 'missing/unexpected exact-set' idiom build.ts already uses for its own artifact set, applied to a destination instead of an emission."
    - "Two-direction drift guard: resources-sync.test.ts's walk-and-compare-both-directions shape, applied to a generated tree instead of a committed one, with a planted-corruption non-vacuity control."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "placeBlockInScope() is a NEW module-private function (not a widened inline .find()) because the containment answer and the boundary-crossing refusal are one question with three answers, and a second call site checking overlap separately would be exactly the drift hazard the plan's key_links guard against."
  - "The output-directory contract's mkdirSync moved to AFTER the refusal checks (previously it ran unconditionally at the top of exportAsmTree(), inherited from plan 47-01's simpler one-scope-directory case) -- directory creation is itself part of rule one's 'create it when missing' clause, not a precondition to checking it."
  - "ExportAsmTreeOptions.force -- already declared by plan 47-01 with a placeholder comment reserving it for a DIFFERENT future guard (a per-data-file overwrite refusal) -- is the field this plan's directory contract actually implements. Its doc comment was rewritten to describe the two-rule contract now in force rather than leaving the stale placeholder beside working code; see Deviations below."
  - "The zero-scope degenerate-tree test and the zero-range refusal test both assert exact, pre-existing wording/behavior rather than re-deriving it, per the plan's own instruction that these edges must not silently weaken what already exists."

requirements-completed: []
# BUILD-01 is declared by three sibling plans in this phase (47-01, 47-02,
# 47-05); BUILD-03 is declared by three siblings too (47-02, 47-04, 47-06).
# Per the shared-ID gate, neither is marked complete here -- only once every
# plan declaring it has its own SUMMARY. requirements.ready-ids was run
# during state updates and reported both as not-ready (their sibling plans
# have no SUMMARY yet), so nothing was marked in REQUIREMENTS.md by this
# plan.

coverage:
  - id: D1
    description: "A three-range, two-scope store partitions into exactly two scope files holding exactly their own blocks, and a fourth range inside neither scope lands in unscoped.a -- losslessness survives the multi-scope partition, proven against real ACME through runHostTool()"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree: a three-range, two-scope store writes exactly two scope files, each holding exactly the blocks that scope contains"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree: a block inside no scope lands in unscoped.a, and `files` grows by exactly that one name"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#ROUND TRIP: a multi-scope-plus-unscoped tree assembles through runHostTool() at exitStatus 0 and produces bytes deepEqual to expectedBytes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree adjacency: a range whose last byte is exactly the scope's last byte is wholly contained and lands in that scope's file"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree adjacency: a range starting exactly one byte past a scope's last byte belongs to a second scope starting there, or to unscoped.a with none"
        status: pass
    human_judgment: false
  - id: D2
    description: "A range crossing a scope boundary makes exportAsmTree() refuse by name -- naming both extents, stating the single-block bracket reason splitting is not offered, and writing nothing to the output directory before the throw"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#a range crossing a scope boundary makes exportAsmTree() refuse by name, naming both extents, and writes nothing"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#BOUNDARY CROSSING: the refusal message contains no byte value drawn from the image and no store comment text"
        status: pass
    human_judgment: false
  - id: D3
    description: "The output-directory contract: an export creates a missing directory, writes into an empty one, refuses a non-empty one without force naming the directory, and with force replaces only its own names while refusing (never deleting) any other entry -- root.a still written last and atomically"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree output-directory contract: a non-existent output directory is created and the tree is written"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree output-directory contract: a non-empty output directory WITHOUT `force` refuses, naming the directory and the overwrite, and writes nothing"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree output-directory contract: `force: true` re-writes a directory holding a PREVIOUS export of the same store, byte-identical to the first export"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree output-directory contract: `force: true` still refuses a directory holding one file this export would NOT write, naming it, and leaves it byte-unchanged"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#exportAsmTree output-directory contract: root.a's modification time is >= every other written file's -- the interruption guard, not a cosmetic choice"
        status: pass
      - kind: other
        ref: "grep -a -v -E '^\\s*(//|\\*|/\\*)' src/mcp/vice/anno-export-asm.ts | grep -acE 'rmSync|unlinkSync|rmdirSync' == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "A re-export is proven to be a reviewable diff, not full-tree churn: two exports of an unchanged store are byte-identical file for file in both directions, with a non-vacuity control, plus every adjacency/empty/ordering edge the phase owed"
    requirement: "BUILD-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree determinism: exporting one unchanged store twice into two different directories yields identical sorted file-name lists and byte-identical files, checked in BOTH directions"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree determinism: non-vacuity -- corrupting one byte of one file in the second directory makes the two-direction comparison report a difference naming that file"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree ordering: the !source sequence parsed from root.a's own text equals result.sourceOrder"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree empty: a store with zero scopes writes exactly root.a, symbols.a and unscoped.a, and that tree assembles to the expected bytes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-export-asm.test.ts#tree empty: a store with zero ranges still raises the pre-existing zero-ranges refusal, unchanged, through the tree path"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 2: Multi-Scope Partition, Boundary Refusal, Output-Directory Contract and Drift Guard Summary

**`exportAsmTree()` now partitions any number of scopes through one containment predicate, refuses a boundary-straddling range by name instead of guessing, refuses to scribble into or delete from a caller's output directory, and a two-direction drift guard proves a re-export is a reviewable diff rather than full-tree churn.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `placeBlockInScope()` is the ONE containment predicate a block's placement is decided by: wholly contained by a scope, contained by none (the unscoped group, D47-D), or overlapping a scope without containment (a thrown refusal, D47-C). `exportAsmTree()`'s placement loop calls it once per block and runs to completion before any file is written.
- The boundary-crossing refusal names both the range's extent and the scope's extent in `$XXXX..$YYYY` form, states the mechanical reason splitting is not offered (`emitBlock()`'s single `* =`/`!if * != ...` bracket pair has no second extent to assert), and states the fix belongs to the user. A dedicated test proves the message echoes no image byte and no store comment text.
- The output-directory contract: `exportAsmTree()` computes the full set of names it is about to write BEFORE touching the directory. Without `force`, any pre-existing entry refuses by name. With `force`, only entries in that computed set may be overwritten; any other entry is a named refusal, never a deletion -- no `rmSync`/`unlinkSync`/`rmdirSync` exists anywhere in the module (filtered grep: 0).
- A two-direction drift guard (modelled on `resources-sync.test.ts`'s own walk-and-compare) proves two exports of an unchanged store are byte-identical file for file, with a planted-corruption non-vacuity control that names the corrupted file.
- Every adjacency, empty and ordering edge the phase owed is a named, passing test: exact-end and one-past-the-end adjacency; a zero-scope degenerate tree that still assembles; an empty scope producing no file and no `!source` line; a zero-label store still sourcing `symbols.a` first; a zero-range store still raising the pre-existing refusal through the tree path; and the multi-scope partition round-trip invariant (every block's `lines` group appears exactly once across the tree).

## Task Commits

Each task was committed atomically:

1. **Task 1: Partition across many scopes, place the unscoped remainder, refuse the ambiguous range** - `36a32ee6` (feat)
2. **Task 2: The output directory contract -- refuse rather than scribble, and never delete what you did not write** - `4927ad6e` (feat)
3. **Task 3: The drift guard, and every empty and ordering edge this phase owes** - `a11c8676` (test)

_Note: all three tasks carried `tdd="true"`; tests and implementation were written and verified together per task rather than as separate RED/GREEN commits, since `MVP_MODE=false`/`TDD_MODE=false` for this run and the plan's own `type: execute` frontmatter does not invoke the plan-level RED/GREEN/REFACTOR gate -- the same disclosed approach plan 47-01 already took, for consistency within this phase._

## Files Created/Modified

- `src/mcp/vice/anno-export-asm.ts` - `placeBlockInScope()` (the containment predicate and its boundary-crossing refusal), the output-directory contract inside `exportAsmTree()` (`namesToWrite` computed up front, the two refusal rules, `mkdirSync` moved after them), `ExportAsmTreeOptions.force`'s rewritten doc comment, new `existsSync`/`readdirSync` imports
- `src/mcp/vice/anno-export-asm.test.ts` - multi-scope partition tests, the unscoped-remainder test, a multi-scope-plus-unscoped real-ACME round trip, the boundary-crossing refusal tests (message content and no-write-before-throw), two `tree adjacency:` tests, six output-directory-contract tests, and ten `tree determinism:`/`tree ordering:`/`tree empty:` tests

## Decisions Made

- `placeBlockInScope()` is a new module-private function rather than widening the existing inline `.find()`, because the containment answer and the boundary-crossing refusal are one question with three possible answers (contained / unscoped / refuse) and a second call site checking overlap separately would be exactly the drift hazard the plan's own `key_links` guard against.
- The unconditional `mkdirSync(outDir, { recursive: true })` that plan 47-01 ran at the very top of `exportAsmTree()` was moved to run AFTER the two directory-contract refusal checks -- directory creation is itself rule one's own "create it when missing" clause, not a precondition for evaluating the rules.
- `ExportAsmTreeOptions.force` was already declared by plan 47-01 with a placeholder comment reserving it for a different, still-unbuilt guard ("never silently overwrite a human-edited data file", P-02). This plan's Task 2 is the field's first real implementation, so its doc comment was rewritten to describe the two-rule directory contract now in force rather than leaving a stale, now-inaccurate placeholder beside working code (see Deviations).
- The zero-scope degenerate-tree test and the zero-range refusal test both assert the EXACT pre-existing wording/behavior (the same message `exportAsm()` itself raises) rather than re-deriving it, so a future change that routed the tree path around either would fail loudly here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 category -- plan-verify discrepancy, disclosed rather than silently worked around] `ExportAsmTreeOptions.force` already existed before this plan touched the file**
- **Found during:** Task 2, reading `ExportAsmTreeOptions` per the task's own `<read_first>` instruction
- **Issue:** Task 2's `<action>` says "Add `force?: boolean` to `ExportAsmTreeOptions`", but plan 47-01 had already added the field, with a doc comment reserving it for a DIFFERENT future plan's guard ("never silently overwrite a human-edited data file", P-02) that this plan's tasks do not implement. The field could not be "added" a second time without a duplicate-property compile error.
- **Fix:** Reused the existing field and rewrote its doc comment to describe the two-rule output-directory contract Task 2 actually implements (what the caller is asking for, never "remove whatever is in my way"), rather than leaving the stale 47-01 placeholder beside code that now gives the field real behavior. No new field, no interface change beyond the comment.
- **Files modified:** `src/mcp/vice/anno-export-asm.ts` (doc comment only)
- **Verification:** `npm run typecheck` clean; every `force`-gated test in `anno-export-asm.test.ts` passes.
- **Committed in:** `4927ad6e` (Task 2 commit)

**2. [Rule 1 category -- plan-verify discrepancy, inherited and reconfirmed unchanged] `grep -ac 'openStore(' anno-export-asm.ts` still returns 3, not the plan's stated 1**
- **Found during:** Task 1, re-running the task's own verify gate
- **Issue:** This is the SAME pre-existing discrepancy plan 47-01's SUMMARY already disclosed (the file's own doc comments contain the literal text `openStore(` twice, independent of any code this plan or 47-01 added). This plan's own new comments were written to avoid repeating that literal string, so the count is unchanged at 3 -- the property the criterion actually protects ("still exactly one store handle opened") holds: there is exactly one real `openStore(...)` call site in `exportAsm()`, unchanged.
- **Fix:** No code or comment change was needed beyond what 47-01 already did; this entry exists so a reader of this plan's own verify output is not surprised by the same already-explained number.
- **Files modified:** none (no new occurrence introduced)
- **Verification:** `grep -ac 'openStore(' src/mcp/vice/anno-export-asm.ts` returns `3`, identical to the count measured at `HEAD` before this plan's first commit.
- **Committed in:** n/a (no change to commit)

---

**Total deviations:** 2 disclosed (both plan-verify-script/doc discrepancies, neither a behavior change)
**Impact on plan:** No code behavior changed by either deviation. Both are wording/bookkeeping choices made so this plan's own (partially miscalibrated, in the `force`/`openStore(` cases) verify text does not read as a regression. The properties the acceptance criteria actually protect -- one store handle for the whole export, and a `force` field with real, documented two-rule behavior -- are intact and independently confirmed by passing tests.

## Issues Encountered

None that blocked the plan. Test file growth is reflected in the full-suite numbers: `npm run test:automated` now reports `tests 4142 / pass 4127 / fail 6 / skipped 9` (up from the `4119/4104/6/9` baseline recorded after 47-01, an increase of exactly the 23 net new tests this plan added), with the failing test NAME set unchanged and identical to the six names recorded in `47-01-PLAN.md`'s measured baseline (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`) -- none of them this plan's regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `exportAsmTree()` is now general across any number of scopes, safe to point at a directory a caller already used, and its stability across re-exports is proven rather than assumed -- plan 47-05 (the CLI's `--out` promotion to a directory) can call it directly with confidence that its `force` semantics and refusal messages are final.
- BUILD-01 stays `Pending` in `REQUIREMENTS.md` until 47-05 also lands its own SUMMARY (shared-ID gate: 47-01, 47-02, 47-05 all declare it). BUILD-03 stays `Pending` until 47-04 and 47-06 also land theirs (same gate, different sibling set: 47-02, 47-04, 47-06). No action needed here, just noting why neither is checked off yet.
- No blockers. This plan's own tasks (`depends_on: [47-01]`, already satisfied) are complete; the next plan in this phase's wave order is clear to begin.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-export-asm.ts`
- FOUND: `src/mcp/vice/anno-export-asm.test.ts`
- FOUND: `.planning/phases/47-multi-file-rebuildable-source/47-02-SUMMARY.md`
- FOUND commit `36a32ee6` (Task 1)
- FOUND commit `4927ad6e` (Task 2)
- FOUND commit `a11c8676` (Task 3)
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `anno-export-asm.test.ts` 160/160 pass, 0 skipped; `check-npm-packages.mjs` exit 0; `npm run test:automated` failing-name set is exactly the 6 documented baseline names (tests 4142, pass 4127, fail 6, skipped 9 -- up from 47-01's 4119/4104/6/9 by exactly this plan's 23 net new tests, same 6 failing names).
