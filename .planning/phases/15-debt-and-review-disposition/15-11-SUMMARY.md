---
phase: 15-debt-and-review-disposition
plan: 11
subsystem: testing
tags: [stock-vice, docs-parity, fork-manifest, ci, todo-disposition]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "15-09's prior edits to docs/stock-vice-parity.md and docs/tool-support.md, and the confirmation that tools-manifest.json is byte-identical to a fresh generation"
  - phase: 15-debt-and-review-disposition
    provides: "15-10's Deferred Items ledger baseline (pending 9, total 10) that this plan's three todo closures decrement from"
provides:
  - "vice_disk_attach's advertised no-side-effect approximation corrected in both the returned string and docs/stock-vice-parity.md's D-14 bullet to state the real reset-plus-load behaviour Phase 13's A5 probe observed, with the contract-redesign question promoted to REQUIREMENTS.md Future Requirements (owner named: plan 15-12, not yet landed)"
  - "The tools-manifest.json staleness todo disposed wont-fix on the D-16 ground (deliberate deletion, not staleness); fork-live.test.ts's live-surface diff now names D-16 explicitly instead of reporting an undifferentiated false finding, deriving the deliberately-deleted set from a new single shared constant"
  - "The CI test-command divergence settled from a real GitHub Actions run's own log (run 32517575905): npm test stays in CI, documented in an extended comment above ci.yml's Test step"
  - "All three todos closed to completed/ with cited Resolutions; STATE.md's Deferred Items ledger reconciled (pending 9->6, total 10->7)"
affects: [15-12]

actuals:
  tokens: 11009
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A response-field string that reaches an agent's decision-making is derived from a single exported named constant (DISK_ATTACH_APPROXIMATION), never re-typed in its own test's assertion, so the two cannot drift apart the way the original wrong string did."
    - "A shared 'deliberately deleted, not stale' set belongs in a plain .ts module, never imported from a sibling .test.ts file -- importing a .test.ts module for its exports also re-runs every top-level node:test test() call it registers as an import side effect, silently duplicating that file's test execution wherever it is imported. Caught live in this plan (Task 2) before commit."
    - "A CI test-command decision is derived from a real workflow run's own log (gh run view --log), never from local behaviour or the pre-existing comment's own untested claim -- the run id is cited directly in the workflow file so the decision can be re-checked."

key-files:
  created:
    - .claude/mcp/vice/fork-deleted-tools.ts
  modified:
    - .claude/mcp/vice/stock-machine.ts
    - .claude/mcp/vice/stock-machine.test.ts
    - docs/stock-vice-parity.md
    - .claude/mcp/vice/fork-manifest-surface.test.ts
    - .claude/mcp/vice/fork-live.test.ts
    - .github/workflows/ci.yml
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md
    - .planning/todos/completed/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md
    - .planning/todos/completed/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md

key-decisions:
  - "The plan's own read_first claim of a second disagreeing site in docs/stock-vice-parity.md at :311 was verified against source and found wrong -- that line is a DIFFERENT, unrelated D-14 (Phase 4's vice_disassemble show_symbols decision, not Phase 3's disk-attach decision). Only the single bullet at :270 needed correction; documented as a deviation rather than silently editing an unrelated section."
  - "The manifest todo is disposed wont-fix, not fixed: vice_snapshot_list's absence is D-16's deliberate deletion (cited to 03-05-SUMMARY.md, commit f5c171d), and regenerating the manifest would silently re-add a tool the project decided to remove. tools-manifest.json and its 62-tool count gate are untouched."
  - "The deliberately-deleted-tool set lives in a new plain .ts module (fork-deleted-tools.ts), not inside fork-manifest-surface.test.ts as the plan's action text first suggested -- importing a .test.ts file's exports also re-runs its top-level node:test registrations as an import side effect, which would have silently duplicated fork-manifest-surface.test.ts's 5 tests inside every run of fork-live.test.ts. Caught by re-running node --test fork-live.test.ts after the first implementation and seeing 5 unexpected passes; fixed before committing."
  - "The CI test-command divergence is decided keep npm test (Acceptance point 2), from run 32517575905's own log: all nine MANUAL_ONLY_TESTS suites (as of 15-10) ran to completion with zero failures in under two minutes wall-clock on ubuntu-latest, including the three originally-named suites. The workflow comment documenting this cites the run id but names zero manual-only test filenames, so test-gate.test.ts's drift guard stays the only list."
  - "The vice_disk_attach contract-redesign question (should the tool be restructured, given how little it differs from vice_autostart) is promoted to REQUIREMENTS.md Future Requirements with plan 15-12 named as owner, not implemented here -- REQUIREMENTS.md is not touched by this plan so 15-11 and 15-12 do not edit it concurrently."

requirements-completed: [DEBT-01, DEBT-02]  # Declared by this plan's frontmatter; NOT marked complete in REQUIREMENTS.md -- both are shared IDs plan 15-12 still declares (shared-ID gate #2388; requirements.ready-ids confirmed 0/2 ready)

coverage:
  - id: D1
    description: "vice_disk_attach's approximation string (exported as DISK_ATTACH_APPROXIMATION) and docs/stock-vice-parity.md's D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's A5 probe observed, citing 13-PROBE-RESULTS.md by name; stock-machine.test.ts's assertion derives from the same constant"
    requirement: DEBT-02
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test stock-machine.test.ts (23/23 pass)"
        status: pass
      - kind: other
        ref: "grep -v -E '^\\s*(//|\\*|/\\*)' stock-machine.ts | grep -c 'with the run flag clear' == 0; grep -ci 'reset' stock-machine.ts >= 1; grep -c '13-PROBE-RESULTS' docs/stock-vice-parity.md >= 1"
        status: pass
    human_judgment: true
    rationale: "The plan's own <human-check> requires confirming the corrected string is short enough to be useful in a response field while still naming both side effects without over-claiming the one unresolved A5 detail -- a prose-quality judgment, not a mechanically checkable fact."
  - id: D2
    description: "Skill audit confirmed no skill assumes vice_disk_attach is side-effect-free: vice-wedge-triage/SKILL.md:63 and c64-program-recon/references/observation-hazards.md:133 both use it as a reboot step, consistent with reset-plus-load"
    requirement: null
    verification:
      - kind: other
        ref: "direct read of both cited lines and c64-ram-capture/SKILL.md's 'Boot a disk' section; none assumed side-effect-freeness"
        status: pass
    human_judgment: false
  - id: D3
    description: "vice_disk_attach's contract-redesign question promoted to REQUIREMENTS.md Future Requirements with plan 15-12 named as owner, not implemented; REQUIREMENTS.md itself untouched by this plan"
    requirement: null
    verification:
      - kind: other
        ref: "git diff --quiet .planning/REQUIREMENTS.md (confirmed untouched by this plan)"
        status: pass
    human_judgment: false
  - id: D4
    description: "tools-manifest.json staleness todo disposed wont-fix on the D-16 ground; manifest and 62-tool count gate untouched; fork-live.test.ts's live-surface diff now partitions live-only names into deliberately-deleted (D-16-cited) vs genuinely unexpected via a new shared fork-deleted-tools.ts constant"
    requirement: DEBT-01
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test fork-manifest-surface.test.ts (5/5 pass) && node --test fork-live.test.ts (0 pass / 6 skip, all default-skip)"
        status: pass
      - kind: other
        ref: "git diff --quiet tools-manifest.json; grep -c '62' fork-manifest-surface.test.ts unchanged before/after; grep -c 'D-16' fork-live.test.ts >= 1; grep -c 'vice_snapshot_list' fork-live.test.ts == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "CI test-command divergence settled from GitHub Actions run 32517575905's own Test-step log: all nine MANUAL_ONLY_TESTS suites run to completion with zero failures in under two minutes; npm test stays in CI, documented in ci.yml's Test-step comment citing the run id, naming zero manual-only test filenames"
    requirement: null
    verification:
      - kind: other
        ref: "gh run view 32517575905 --log: '# tests 2245 / # pass 2200 / # fail 0', zero 'not ok' lines; vice-broker-launch.test.ts's own subtest at ok 1880, broker-e2e.test.ts's at ok 135, vice-proxy.test.ts's range confirmed via the log's own ci-guardrails self-check (ok 312/313)"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test test-gate.test.ts (3/3 pass) && python3 -c \"import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))\" exits 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "All three todos closed to completed/ with cited Resolutions; STATE.md's Deferred Items ledger table and both prose count figures reconciled across all three commits (pending 9->6, total 10->7)"
    requirement: null
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts (4/4 pass, both directions, re-verified after each of the plan's three commits)"
        status: pass
    human_judgment: false

duration: ~40min (estimated -- PLAN_START_TIME was not captured at session start)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 11: Correct the Disk-Attach Record, Dispose the Manifest Todo Inverted, and Settle CI From a Real Run Summary

**Corrected `vice_disk_attach`'s refuted no-side-effect promise in both the returned string and the parity doc, disposed the `tools-manifest.json` "staleness" todo `wont-fix` on its actual inverted ground (D-16's deliberate deletion), and settled the CI test-command divergence from a real GitHub Actions run's own log rather than local behaviour.**

## Performance

- **Duration:** ~40 min (estimated)
- **Completed:** 2026-08-22T17:46:50Z
- **Tasks:** 3 completed
- **Files modified:** 11 (1 created, 10 modified, across 4 commits — one commit was a same-task correction, see Deviations)

## Accomplishments

- **Task 1 (disk-attach record correction):** `stock-machine.ts`'s `handleDiskAttach` now returns an exported named constant, `DISK_ATTACH_APPROXIMATION`: `"AUTOSTART (D-14): performs a full machine reset and loads a program from the image; unlike vice_autostart it does not issue a final run step, as far as observed."` `stock-machine.test.ts`'s assertion imports and compares directly against this constant, so the two cannot drift. `docs/stock-vice-parity.md`'s §A item 7 D-14 bullet corrected to match, citing `13-PROBE-RESULTS.md` § A5 by name and naming this an instance of item 7's own "wrong probed detail is a silently wrong answer, not a licensed divergence" caveat. Skill audit confirmed no skill assumes side-effect-freeness — `vice-wedge-triage/SKILL.md:63` and `c64-program-recon/references/observation-hazards.md:133` both use `vice_disk_attach` as a reboot step, and `c64-ram-capture/SKILL.md`'s "Boot a disk" section calls it as step 1 of an intentional boot sequence. The contract-redesign question (whether `vice_disk_attach` should be restructured, given how little it differs from `vice_autostart`) is promoted to `REQUIREMENTS.md` → Future Requirements with **plan 15-12 named as owner** — `REQUIREMENTS.md` itself is untouched by this plan. `docs/tool-support.md` and `tools-manifest.json` confirmed unchanged (the disk-attach row's note cell was already empty). Todo closed to `completed/` with a `## Resolution` covering all three of its own "How to verify" points.
- **Task 2 (manifest todo, inverted disposition):** Closed the `tools-manifest.json` staleness todo `wont-fix` — `vice_snapshot_list`'s absence is D-16's deliberate deletion (cited to `.planning/phases/03-direct-tools/03-05-SUMMARY.md`, commit `f5c171d`), not staleness, and regenerating the manifest against a live fork server that still advertises it would silently re-add a tool the project decided to remove. `tools-manifest.json` and `fork-manifest-surface.test.ts`'s 62-tool count gate are both confirmed byte-/assertion-identical (unchanged before and after this plan). Fixed the actual defect — `fork-live.test.ts`'s live-surface diff previously logged any live-only `vice_*` name as an undifferentiated finding; it now partitions live-only names into `deliberatelyDeleted` (checked against `DELIBERATELY_DELETED_FORK_TOOLS`, a new single shared constant in `fork-deleted-tools.ts`) and `genuinelyUnexpected` (still logged exactly as before, so the check keeps full teeth for a real future drift). Confirmed absent from every skill's tool-selection documentation. Todo closed to `completed/` with a `## Resolution` citing D-16's record and the ROADMAP.md locations that reference it.
- **Task 3 (CI decision from a real run):** Read GitHub Actions run `32517575905` (2026-08-21T19:15:58Z, `ubuntu-latest`, conclusion `success`) via `gh run view --log`. Its `Test` step log shows `npm test`'s full `*.test.*` glob running 2245 tests to completion (`# pass 2200 / # fail 0`, zero `not ok` lines) in 1m53s wall-clock, including all nine of `test-gate.mjs`'s `MANUAL_ONLY_TESTS` entries — the three originally-named suites each confirmed present and passing via their own subtest text (`vice-broker-launch.test.ts` at `ok 1880`, `broker-e2e.test.ts` at `ok 135`, `vice-proxy.test.ts`'s range confirmed via the log's own `ci-guardrails` self-check at `ok 312`/`ok 313`). Decided **keep `npm test` in CI** (Acceptance point 2) — none of the suites hangs on a GitHub Actions runner, and switching to the narrowed `npm run test:automated` would remove `vice-proxy.test.ts`'s coverage of the stdio proxy, which has no other executable coverage anywhere in the repo. Documented the decision in an extended comment directly above `ci.yml`'s `Test` step, citing the run id — the comment names **zero** manual-only test filenames, so `test-gate.test.ts`'s drift guard remains the single source of truth. Todo closed to `completed/` with a `## Resolution` recording the run id, the per-suite finding, the branch taken, and the release consequence (every merge to `main` auto-publishes unless opted out).
- **Deviation caught and fixed in-task (Task 1):** The first `git commit` for Task 1 landed only a `git mv` rename — a multi-path `git add` silently failed on one already-consumed pathspec, aborting the whole staging call, and the source/test/doc edits were left uncommitted. Caught by the mandatory `git show --stat` re-check; a follow-up commit (`1c5e5cd`) landed the actual content. No content was lost.
- **Deviation caught and fixed in-task (Task 2):** The first implementation imported the new shared constant directly from `fork-manifest-surface.test.ts` (a `.test.ts` file). Running `node --test fork-live.test.ts` afterward showed 5 unexpected passing subtests — importing a `.test.ts` module for its exports also re-runs every top-level `node:test` `test()` call it registers as an import side effect, silently duplicating `fork-manifest-surface.test.ts`'s own 5 tests inside `fork-live.test.ts`'s run. Fixed by extracting the constant into a new plain `.ts` module, `fork-deleted-tools.ts`, imported by both files; re-ran and confirmed `fork-live.test.ts` runs only its own 6 tests (all default-skip).
- **Deviation caught and fixed in-task (STATE.md ledger, both Task 1 and Task 2):** Task 1's own `npm run test:automated` re-check was run BEFORE the `git mv` of its todo (an ordering mistake), so the resulting green run did not reflect the post-move tree. `docs-deferred-ledger.test.ts` failed once the mismatch was discovered (`STATE.md`'s Deferred Items table still listed the moved todo as Pending). Fixed by updating `STATE.md`'s table and both prose count figures immediately for each of the plan's three todo closures, re-verifying `docs-deferred-ledger.test.ts` (4/4 pass) after each.
- **Deviation caught and fixed in-task (docs/stock-vice-parity.md, Task 1):** The plan's own read_first pointed to a "related mention at the second site" around `docs/stock-vice-parity.md:311` that needed correcting alongside the main D-14 bullet at `:270`. Direct verification found `:311` is a *different, unrelated* D-14 — Phase 4's `vice_disassemble` `show_symbols` decision, not Phase 3's disk-attach decision — so there was no second disk-attach site to correct. Only the single bullet at `:270` was edited; no unrelated section was touched.
- `npm run typecheck` and `npm run test:automated` (`.claude/mcp/vice`) both exit 0 after every task's final state: 2112 tests / 2107 pass / 0 fail / 5 pre-existing todo (unchanged from 15-10's baseline — no test count drift).
- `STATE.md`'s `## Deferred Items` ledger reconciled across all three commits: both prose count figures and the table decremented to match each todo move (pending 9 → 8 → 7 → 6; total 10 → 9 → 8 → 7); `node --test docs-deferred-ledger.test.ts` confirmed 4/4 pass in both directions after the final commit.
- **DEBT-01 and DEBT-02 are NOT marked complete** — both are shared requirement IDs still declared by sibling plan 15-12 per the shared-ID gate (#2388); `requirements.ready-ids` correctly returns 0/2 ready.

## Task Commits

Each task was committed atomically (Task 1 required a same-task follow-up commit; see Deviations):

1. **Task 1: Correct the disk-attach record in both places and promote the contract question** - `e56dfdf` (rename only, incomplete — see Deviations) + `1c5e5cd` (fix, actual content)
2. **Task 2: Dispose the manifest todo on the D-16 ground and stop the live-surface diff producing the same false finding** - `548fec4` (fix)
3. **Task 3: Settle the CI test-command divergence from a real workflow run** - `9e4abfa` (docs)

_No plan-metadata commit follows this file per the atomic close-out invariant — this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `.claude/mcp/vice/fork-deleted-tools.ts` - new plain `.ts` module holding `DELIBERATELY_DELETED_FORK_TOOLS`, the single shared constant naming D-16-deleted tool names
- `.claude/mcp/vice/stock-machine.ts` - `handleDiskAttach`'s approximation string replaced with the exported `DISK_ATTACH_APPROXIMATION` constant naming both real side effects
- `.claude/mcp/vice/stock-machine.test.ts` - assertion derives from `DISK_ATTACH_APPROXIMATION` instead of a re-typed literal
- `docs/stock-vice-parity.md` - §A item 7's D-14 bullet corrected, citing `13-PROBE-RESULTS.md` § A5 and item 7's own caveat
- `.claude/mcp/vice/fork-manifest-surface.test.ts` - imports the shared constant; "no entry is named vice_snapshot_list" test now checks the constant's members
- `.claude/mcp/vice/fork-live.test.ts` - live-surface diff partitions live-only names into deliberately-deleted (D-16-cited) vs genuinely unexpected
- `.github/workflows/ci.yml` - extended `Test`-step comment documenting the keep-`npm-test` decision, citing run `32517575905`
- `.planning/STATE.md` - Deferred Items ledger reconciled across all three todo closures; two prose sections ("Pending Todos" opener and "Newest" pointer) updated to match
- `.planning/todos/completed/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md` - moved from `pending/`; `## Resolution` added
- `.planning/todos/completed/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md` - moved from `pending/`; `## Resolution` added
- `.planning/todos/completed/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` - moved from `pending/`; `## Resolution` added

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) the plan's own claimed "second site" in `docs/stock-vice-parity.md` at `:311` was verified and found to be an unrelated D-14 — only one site needed correction; (2) the manifest todo is `wont-fix`, not a regeneration, on D-16's documented deletion; (3) the deliberately-deleted-tool constant lives in a new plain `.ts` module rather than inside a `.test.ts` file, to avoid re-running that file's own tests as an import side effect; (4) the CI decision keeps `npm test`, backed by a real run's log; (5) the disk-attach contract-redesign question is promoted to `REQUIREMENTS.md` with plan 15-12 named as owner, not implemented here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's first commit landed only a rename; a multi-path `git add` had silently aborted after one pathspec failed to match**
- **Found during:** Task 1, mandatory post-commit `git show --stat` re-check
- **Issue:** `git add <5 paths>` included the old `pending/` path for a todo already consumed by a prior `git mv` rename; the pathspec mismatch aborted the entire multi-path `git add` silently, so only the rename half of the staged changes was actually staged and committed (`e56dfdf`: "1 file changed, 0 insertions(+), 0 deletions(-)").
- **Fix:** Re-staged the four remaining modified files and committed the actual content in a follow-up commit.
- **Files modified:** none beyond the already-intended Task 1 files.
- **Verification:** `git show --stat HEAD` confirmed real insertions/deletions on the second commit; `npm run typecheck`, `node --test stock-machine.test.ts`, and `npm run test:automated` all re-run clean afterward.
- **Committed in:** `1c5e5cd`

**2. [Rule 1 - Bug] Importing a shared constant from a `.test.ts` file re-ran that file's own tests as an import side effect**
- **Found during:** Task 2, first implementation of the shared `DELIBERATELY_DELETED_FORK_TOOLS` constant
- **Issue:** `fork-live.test.ts` imported the constant directly from `fork-manifest-surface.test.ts`. Every `.test.ts` file's top-level `test(...)` calls register with `node:test` as a side effect of module evaluation — so importing it caused `fork-manifest-surface.test.ts`'s own 5 tests to silently run again inside every `node --test fork-live.test.ts` invocation (confirmed: 5 unexpected `ok` results appeared where only 6 skips were expected).
- **Fix:** Extracted the constant into a new plain `.ts` module, `fork-deleted-tools.ts` (never a `.test.ts`), imported by both `fork-manifest-surface.test.ts` and `fork-live.test.ts`.
- **Files modified:** `.claude/mcp/vice/fork-deleted-tools.ts` (new), `.claude/mcp/vice/fork-manifest-surface.test.ts`, `.claude/mcp/vice/fork-live.test.ts`
- **Verification:** `node --test fork-live.test.ts` afterward shows exactly its own 6 tests, all default-skip; `node --test fork-manifest-surface.test.ts` shows exactly its own 5 tests, all passing.
- **Committed in:** `548fec4`

**3. [Rule 1 - Bug] `docs-deferred-ledger.test.ts` went red after each todo move because `STATE.md`'s ledger update was not re-verified after the `git mv`**
- **Found during:** Task 2, `npm run test:automated` re-run
- **Issue:** Task 1's own `npm run test:automated` check had been run BEFORE its `git mv` of the disk-attach todo (an ordering mistake), so its green result did not reflect the moved tree. By the time Task 2's own full-suite check ran, `docs-deferred-ledger.test.ts` failed (2 subtests) because `STATE.md`'s Deferred Items table still listed the already-moved todo as Pending.
- **Fix:** Updated `STATE.md`'s Deferred Items table and both prose count figures for the disk-attach move (folded into Task 1's follow-up commit `1c5e5cd`), then again for Task 2's own move (`548fec4`), then a final reconciliation for Task 3's move (`9e4abfa`) — each time re-running `node --test docs-deferred-ledger.test.ts` before proceeding, per this plan's own must-have that the guard "is never left red."
- **Files modified:** `.planning/STATE.md`
- **Verification:** `node --test docs-deferred-ledger.test.ts` (4/4 pass, both directions) after each of the three commits.
- **Committed in:** `1c5e5cd`, `548fec4`, `9e4abfa`

**4. [Rule 1 - Bug] The plan's own read_first named a non-existent "second site" needing correction in `docs/stock-vice-parity.md`**
- **Found during:** Task 1, before editing
- **Issue:** The plan instructed correcting "the related mention at the second site" around `docs/stock-vice-parity.md:311` alongside the D-14 bullet at `:270`. Direct source inspection found `:311` is a *different* D-14 decision (Phase 4's `vice_disassemble` `show_symbols` no-symbol-table behaviour), unrelated to disk attach.
- **Fix:** Verified no second disk-attach site existed anywhere in the file (`grep -n 'disk attach\|disk_attach'` found only the one bullet); corrected only that bullet.
- **Files modified:** none beyond the already-intended `docs/stock-vice-parity.md` edit.
- **Verification:** Post-edit `grep -n 'disk attach\|disk_attach' docs/stock-vice-parity.md` shows no remaining claim of attaching without loading or running, and no unrelated section was altered.
- **Committed in:** `1c5e5cd`

---

**Total deviations:** 4 auto-fixed (4 bugs, all Rule 1)
**Impact on plan:** All four were caught by re-running the plan's own verification commands (or the mandatory post-commit `git show --stat` check) before considering any task complete, not left for a later plan or the phase-close audit to discover. No scope creep; no production behaviour changed beyond what each task's own action text specified.

## Issues Encountered

None beyond the four auto-fixed deviations above, all caught and resolved within the task that introduced them, before that task's final commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both of DEBT-01/DEBT-02's items assigned to this plan are corrected with cited evidence; the `vice_disk_attach` contract-redesign question is promoted with a named owner (plan 15-12) rather than either implemented or silently dropped.
- The manifest todo's inverted disposition (`wont-fix`) is on record with its D-16 citation; `tools-manifest.json` and its 62-tool count gate are unchanged, and the false finding that generated the todo can no longer recur from a live run.
- The CI test-command divergence is settled with a citable run id (`32517575905`); no CI run was triggered by this plan and nothing was pushed.
- `.planning/todos/pending/` count is 6 (was 9 at the start of this plan); `docs-deferred-ledger.test.ts` confirmed green in both directions after the final commit.
- Plan 15-12 is the designated closer for DEBT-01/DEBT-02/DEBT-03 and holds this plan's own promoted finding (the `vice_disk_attach` contract-redesign question) by name — `requirements.ready-ids` correctly returns 0/2 ready for this plan's own two requirement IDs.
- No follow-up work is blocked by this plan's own execution: `npm run typecheck` and `npm run test:automated` both exit 0 (2112/2107/0/5, unchanged from baseline), all named plan-level `<verification>` commands re-run clean.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

- `.claude/mcp/vice/fork-deleted-tools.ts` — FOUND (created, git-tracked)
- `.claude/mcp/vice/stock-machine.ts` — FOUND (`DISK_ATTACH_APPROXIMATION` present, both side effects named)
- `.claude/mcp/vice/stock-machine.test.ts` — FOUND (assertion derives from the constant)
- `docs/stock-vice-parity.md` — FOUND (D-14 bullet corrected, `13-PROBE-RESULTS.md` cited)
- `.claude/mcp/vice/fork-manifest-surface.test.ts` — FOUND (imports shared constant, 62-count unchanged)
- `.claude/mcp/vice/fork-live.test.ts` — FOUND (D-16-aware partition present, no duplicate test registration)
- `.github/workflows/ci.yml` — FOUND (comment cites run `32517575905`, YAML parses, no second manual-only list)
- `.planning/STATE.md` — FOUND (ledger reconciled, pending 6 matches disk count)
- All three completed todos — FOUND (moved from `pending/`, each with exactly one `## Resolution`, none remaining in `pending/` under these names)
- Commit `e56dfdf` — FOUND in `git log --oneline --all` (incomplete, superseded by `1c5e5cd`, documented as Deviation 1)
- Commit `1c5e5cd` — FOUND in `git log --oneline --all`
- Commit `548fec4` — FOUND in `git log --oneline --all`
- Commit `9e4abfa` — FOUND in `git log --oneline --all`
- Plan-level `<verification>` re-run clean: `npm run typecheck` exits 0; `npm run test:automated` exits 0 (2112/2107/0/5); `git diff --quiet .claude/mcp/vice/tools-manifest.json docs/tool-support.md` confirms byte-identity; `node --test stock-machine.test.ts fork-manifest-surface.test.ts test-gate.test.ts` all green; `.github/workflows/ci.yml` parses as YAML and contains no second manual-only list; `node --test docs-deferred-ledger.test.ts` 4/4 pass both directions.
