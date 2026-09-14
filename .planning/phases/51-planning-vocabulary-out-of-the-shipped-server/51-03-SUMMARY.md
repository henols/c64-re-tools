---
phase: 51-planning-vocabulary-out-of-the-shipped-server
plan: 03
subsystem: host-tools
tags: [planning-vocabulary, comment-budget, ratchet, host-tool-seam, resources-sync]

# Dependency graph
requires:
  - phase: none (wave 2, depends_on: ["51-01", "51-02"])
    provides: "51-01's widened guard, RATCHET ledger, COMMENT_BUDGET_BASELINE and provisional COMMENT_BUDGET_SLACK; 51-02's CITATION-RESOLUTION.md and VOCAB-01..06 declarations"
provides:
  - "The densest file in the phase (host-tool.mts, 325 citations) at zero, with resources/host-tool.mjs regenerated and also at zero"
  - "COMMENT_BUDGET_SLACK finalized at 1650, derived from this file's own real diff -- the value every remaining sweep plan's comment-byte budget check is now held to"
affects: ["51-04", "51-05", "51-06", "every later Phase 51 sweep plan (the finalized COMMENT_BUDGET_SLACK is no longer provisional)"]

# Actuals (#2632)
actuals:
  tokens: 72467
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch-scripted rewrite with exact-match verification: rather than hundreds of individual Edit calls, each rewrite batch was a small Python script asserting `content.count(old) == 1` before replacing -- any mismatch (whitespace, a missing word) halted the batch with zero partial writes, so the file was never left mid-edit in an unverifiable state."
    - "Slack calibrated from the guard's own measurement function, never guessed: the final COMMENT_BUDGET_SLACK value came from running the actual `commentByteTotal()`/`scanForPlanningVocabulary()` pair against the real swept file, not from an estimate."

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/skills-planning-vocabulary.test.ts

key-decisions:
  - "Tasks 1 and 2 ran as one continuous top-to-bottom sweep. They did not run as two separately-committed halves. I split the work into two commits after the fact. I isolated the RATCHET-only diff from the COMMENT_BUDGET_SLACK diff in the same working tree. I temporarily reverted the slack paragraph, committed, then restored it for a second commit. No intermediate git commit exists at the literal 'first half done' boundary the plan describes. I did run the guard and update RATCHET to the live count (151) at that halfway point, as a checkpoint before continuing. That checkpoint was not itself a separate commit. See Deviations."
  - "Zero tier-4 (unrecoverable) sites exist in this file. CITATION-RESOLUTION.md's Section A resolves every one of host-tool.mts's originating phases (34, 35, 36, 37, 40, 47) to a real, findable plan or summary document. In practice, every citation site's surrounding prose already stated the technical reason the citation stood for. The correct edit was almost always deleting the citation prefix or parenthetical and keeping the sentence that followed. This matches the plan's own objective, which predicted that 'the correct edit is usually to delete four characters'."
  - "COMMENT_BUDGET_SLACK is set to 1650: 1595 (this file's measured deficit) plus a 55-character margin. The deficit is not lost reasoning. It is citation-adjacent packaging: parentheses, commas, the literal words 'Phase' and 'plan'. The guard's own `charsInCitations` tally never counts that packaging as 'citation characters', because only the regex-matched token substrings count. Removing that packaging alongside the citation costs comment bytes the arithmetic does not credit back. I sanity-checked this in both directions. Deleting a genuine explanatory paragraph reds the assertion. Restoring it returns the file to green and to a byte-identical state."
  - "The one string literal in this file that carried a citation was `HOST_TOOL_TEST_FORCE_CLI_REJECT`'s error message, naming 'WR-03 hole 2'. I rewrote it to name 'CLI never-throw regression testing' instead. I first checked that no test pins the literal string. host-tool.test.ts's own regression test asserts only the response shape (parseable JSON, non-zero exit code). It never asserts the message text. So no companion test file needed a change in the same commit."

requirements-completed: []

coverage:
  - id: D1
    description: "host-tool.mts scans clean under the guard's own predicate and its RATCHET entry is gone"
    requirement: "VOCAB-01"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#no shipped file carries planning vocabulary beyond its pinned ratchet allowance"
        status: pass
      - kind: other
        ref: "grep -ac '\\.planning' src/mcp/vice/host-tool.mts and grep -aE -c 'docs/phase[0-9]' src/mcp/vice/host-tool.mts, both print 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "resources/host-tool.mjs is byte-identical to a fresh build and scans clean, so the generated image carries no citation either"
    requirement: "VOCAB-01"
    verification:
      - kind: unit
        ref: "resources-sync.test.ts#resources/ is byte-identical to a fresh build of its TypeScript source"
        status: pass
      - kind: unit
        ref: "scanForPlanningVocabulary() driven directly against resources/host-tool.mjs (scratch script), TOTAL 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The file's comment character total did not fall by more than the citation characters removed, plus the finalized slack"
    requirement: "VOCAB-02"
    verification:
      - kind: unit
        ref: "skills-planning-vocabulary.test.ts#comment volume lost per file stays inside the citation characters removed"
        status: pass
    human_judgment: true
    rationale: "The mechanical budget check passing (deficit 4073-2478=1595 <= slack 1650) does not by itself prove no reason was shortened away -- a human should spot-check a sample of the rewritten sites against the original prose to confirm each reads as a genuine, substantively equivalent explanation, which is a judgment call the committed test cannot make."
  - id: D4
    description: "COMMENT_BUDGET_SLACK has its FINAL value, derived from this file's real diffs, and is frozen for the remaining plans"
    requirement: "VOCAB-02"
    verification:
      - kind: unit
        ref: "grep -aic 'provisional' skills-planning-vocabulary.test.ts prints 0; grep -ac 'COMMENT_BUDGET_SLACK' prints 3 (>= 2 required)"
        status: pass
      - kind: other
        ref: "Manual scratch experiment: deleting host-tool.mts's own header paragraph reds the budget assertion (commentBytesLost 4672 > slack 1650); restoring returns to green, file diffed byte-identical to pre-experiment"
        status: pass
    human_judgment: false

duration: 62min
completed: 2026-09-14
status: complete
---

# Phase 51 Plan 03: Host-tool seam citation sweep and slack finalization Summary

**All 325 planning-vocabulary citations in `host-tool.mts` -- the densest file in the phase -- rewritten into the reasons they stood for; `resources/host-tool.mjs` regenerated clean from the corrected source; `COMMENT_BUDGET_SLACK` finalized at 1650 from this file's own measured real diff.**

## Performance

- **Duration:** ~62 min
- **Started:** 2026-09-14T14:05:00Z (approx.)
- **Completed:** 2026-09-14T15:07:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Rewrote every one of `host-tool.mts`'s 325 citation sites (measured 174 distinct comment lines carrying at least one hit) top-to-bottom. Most were tier-0 or tier-1 in Section B's ladder. Each was a `Phase NN, plan NN-MM (id-list): ` prefix sitting directly in front of prose that already stated the technical reason. So the correct edit was almost always deleting the prefix or parenthetical and keeping the sentence. `git diff --numstat` on the file shows both directions of change (783 deletions, 822 insertions), not deletion alone.
- Zero unrecoverable (tier-4) sites. Every citation in this file traces to a real, findable phase (34, 35, 36, 37, 40, 47 per `CITATION-RESOLUTION.md` Section A). None of this file's tokens appear in Section E's dangling set.
- One runtime string literal carried a citation: `HOST_TOOL_TEST_FORCE_CLI_REJECT`'s simulated-rejection message, naming "WR-03 hole 2". I checked `host-tool.test.ts` first. Its own regression test asserts only response shape, never the message text. So I rewrote the string with no companion test change needed.
- Ran `npm run build`. `resources/host-tool.mjs` regenerated from the corrected source, never hand-edited, and scans clean under the same predicate. `resources-sync.test.ts`'s byte-identity assertion checks that it matches a fresh build.
- Deleted both files' `RATCHET` entries (host-tool.mts: 325 to gone, resources/host-tool.mjs: 238 to gone) now that both report zero. Left host-tool.mts's `COMMENT_BUDGET_BASELINE` row in place. The generated `.mjs` never had one, per 51-01's own convention that the compiler-rewritten artifact is not budget-checked.
- Measured host-tool.mts's real, complete sweep against `commentByteTotal()`. Comment bytes fell from 88550 to 84477, a loss of 4073. Citation characters fell from 2478 to 0, all deleted. The 1595-character gap between those two numbers is packaging deleted alongside each citation: parentheses, commas, the literal words "Phase" and "plan". The guard's own `charsInCitations` tally never credits that packaging, since only the regex-matched token substrings count as citation characters. Set `COMMENT_BUDGET_SLACK` to 1650 (1595 plus a 55-character margin) and replaced the "PROVISIONAL" wording with a final statement naming the corpus and the observed numbers.
- Sanity-checked the new slack value in both directions, as an uncommitted scratch experiment that was never committed. Deleting a genuine explanatory paragraph from host-tool.mts's own file header reds the budget assertion (`commentBytesLost=4672` against `citationCharsRemoved=2478`, exceeding slack 1650). Restoring the paragraph returns the suite to green. The restored file diffed byte-identical to the pre-experiment copy.
- Full automated gate (`npm run test:automated`) is green: `tests 4432, pass 4423, fail 0, skipped 9`. This matches the pre-phase baseline exactly. It is the first proof the widened guard survives a real sweep alongside every other guard in the tree.

## Task Commits

Each task's work was committed atomically. Tasks 1 and 2 (the citation sweep and the artifact rebuild) landed in one combined commit rather than two — see Deviations for why.

1. **Tasks 1+2: Rewrite host-tool.mts's citations to zero and regenerate its compiled image** - `4585cd1b` (feat)
2. **Task 3: Finalize COMMENT_BUDGET_SLACK against this file's real diffs** - `a973e445` (test)

_No plan-metadata commit yet. This SUMMARY, STATE.md, and ROADMAP.md are committed together right after this file is written (sequential/non-worktree mode)._

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - all 325 citation sites rewritten into stated reasons; zero planning-vocabulary tokens remain
- `src/mcp/vice/resources/host-tool.mjs` - regenerated by `npm run build` from the corrected source; also zero
- `src/mcp/vice/skills-planning-vocabulary.test.ts` - both host-tool `RATCHET` entries deleted; `COMMENT_BUDGET_SLACK` finalized at 1650 with "PROVISIONAL" wording replaced

## Decisions Made

See `key-decisions` in the frontmatter for the full list. The most consequential: `COMMENT_BUDGET_SLACK` is now frozen at 1650 for every remaining sweep plan in this phase, derived from this file's real, complete diff rather than the earlier plan's smaller, non-representative diffs.

## Deviations from Plan

### Disclosed, Not Auto-fixed: Tasks 1 and 2 landed as one commit instead of two

**Found during:** Execution -- this plan's tasks describe a "first half" (Task 1) and "the rest, plus rebuild" (Task 2) as two separately committed steps, with the guard run and `RATCHET` corrected between them.

**Issue:** I executed the sweep as one continuous top-to-bottom pass using batch-scripted rewrites (verified `content.count(old) == 1` before each replacement, run in ~15 small batches with the live guard re-run after each) rather than stopping at a literal halfway point to commit before continuing. I did pause once, roughly halfway through (`RATCHET` count 151, close to half of the original 325), to update the `RATCHET` entry to the live count and re-run the guard as a checkpoint -- matching the plan's instruction to never hand-guess a correction line -- but I did not commit at that exact point before continuing the sweep to zero.

**Resolution:** After the sweep reached zero, I split the final working-tree state into two commits by temporarily reverting only the `COMMENT_BUDGET_SLACK` paragraph (leaving the `RATCHET`-entry deletions in place), committing that as the Tasks-1+2 commit, then restoring the slack paragraph and committing it alone as the Task 3 commit. This produces the same two-commit shape the plan's `<output>` expects (a citation-sweep commit and a slack-calibration commit), but the sweep itself was not split into two git-visible halves. No task's acceptance criteria depended on the commit boundary itself (they depend on measured counts, which were verified live at each stage via the guard).

**Files modified:** none beyond what both commits already record.

**Verification:** `git log --oneline` shows exactly two commits for this plan, matching the two distinct concerns (sweep+rebuild, then slack). `git diff` on each commit in isolation shows the RATCHET-only change and the slack-only change respectively, confirmed by inspection before committing.

---

**Total deviations:** 0 auto-fixed. 1 disclosed (a commit-boundary process note, not a defect in the delivered state). **Impact:** None on the plan's actual deliverables -- every measured acceptance criterion (zero citations, artifact regenerated, no new tokens, slack finalized and proven to still red, full gate green) is satisfied in the final state.

## Issues Encountered

- Several batch-rewrite scripts hit a `content.count(old) != 1` guard on the first attempt (whitespace or wording mismatches against my own draft, e.g. a `*/`-on-its-own-line assumption that didn't match the real file, or a stray non-ASCII character I introduced while typing a long comment). Each was caught before any write occurred (the script exits before writing when any pair mismatches), diagnosed against the real file content, and corrected before re-running. No partial or corrupted write ever landed on disk.
- `npm run test:automated` exceeded the 120s foreground timeout and was moved to a background task by the harness; waited for its completion notification rather than polling with `sleep`. Final result: `tests 4432, pass 4423, fail 0, skipped 9`, exit code 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `host-tool.mts` and `resources/host-tool.mjs` are both at zero, with clean `RATCHET` bookkeeping. Their `COMMENT_BUDGET_BASELINE` rows stay in place (host-tool.mts's row persists past ratchet-zero, per 51-01's own convention: the budget check matters most for a file the moment after its citations are gone).
- `COMMENT_BUDGET_SLACK` is now 1650 and no longer provisional. Every remaining sweep plan (51-04 through 51-17) is held to this final value rather than the earlier, non-representative 20.
- `VOCAB-01`, `VOCAB-02`, `VOCAB-04`, `VOCAB-06` remain `Pending` in `REQUIREMENTS.md` (correctly, per the shared-id gate: other sweep plans in this phase declare the same ids and have not yet finished) -- this plan does not mark them `Complete` and none became ready via the `ready-ids` gate.
- No blockers for the next sweep plan.

## Self-Check: PASSED

Both key files exist on disk:
- `FOUND: src/mcp/vice/host-tool.mts`
- `FOUND: src/mcp/vice/resources/host-tool.mjs`
- `FOUND: src/mcp/vice/skills-planning-vocabulary.test.ts`

Both task commit hashes resolve in `git log --oneline --all`:
- `FOUND: 4585cd1b`
- `FOUND: a973e445`

Every plan-level `<verification>` item was re-run live:
- `npm run typecheck` exits 0.
- `npm run test:automated` exits 0 and reports `fail 0` (`tests 4432, pass 4423, fail 0, skipped 9`).
- `host-tool.mts` and `resources/host-tool.mjs` both scan clean (0 hits each) and have no `RATCHET` entry.
- The slack term is final (`grep -aic 'provisional'` prints 0) and still reds on a genuine comment deletion (reproduced live, restored to a byte-identical file).

---
*Phase: 51-planning-vocabulary-out-of-the-shipped-server*
*Completed: 2026-09-14*
