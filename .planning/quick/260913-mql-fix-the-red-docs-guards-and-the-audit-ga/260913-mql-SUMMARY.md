---
phase: quick-260913-mql
plan: 01
subsystem: testing
tags: [node-test-runner, audit-gate, requirements-traceability, milestone-archive, docs-guards]

requires: []
provides:
  - "STATE.md's Deferred Items Pending table carries a row for every pending todo on disk, and both live pending-count claims agree with the tree"
  - "Phase 49's CR-01 review finding has a recognised disposition record (49-REVIEW-FIX.md)"
  - "src/mcp/vice/requirement-ids.ts: one resolver for 'is this requirement id real', unioning the live REQUIREMENTS.md with every archived v*-REQUIREMENTS.md snapshot"
  - "scripts/audit-gate.mjs attributes a red guard verdict to the actual failing file via per-file spawn + exit status, never output parsing"
affects: [audit-gate, anno-register, anno-import, docs-deferred-ledger, docs-review-disposition]

actuals:
  tokens: 8900
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "requirement-id resolution as a union over the live doc + every archived milestone snapshot, rather than live-only with a newest-archive fallback"
    - "per-file subprocess spawn with a shared TOTAL time budget (not per-spawn), for attribution that needs no output parsing"

key-files:
  created:
    - src/mcp/vice/requirement-ids.ts
    - .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md
  modified:
    - .planning/STATE.md
    - src/mcp/vice/anno-register.test.ts
    - src/mcp/vice/anno-import.test.ts
    - scripts/audit-gate.mjs
    - src/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "Task 1 produced TWO commits (ledger rows, then review disposition), not one, per the plan's own explicit 'do not combine them' instruction for root causes A and B -- overriding the plan's looser 'three commits' summary line. Total commits for this quick task: 4, one per root cause (A, B, C, D)."
  - "requirement-ids.ts is excluded from package.json's files[] (reads the planning tree, must not ship) and carries no [ASSUMED] label."
  - "audit-gate.mjs's GUARD_RUN_TIMEOUT_MS reinterpreted as a TOTAL budget for the whole per-file loop, not a per-spawn timeout, to keep the 30s PreToolUse contract intact by construction."

requirements-completed: [QUICK-260913-mql]

coverage:
  - id: D1
    description: "docs-deferred-ledger.test.ts and docs-review-disposition.test.ts both exit 0 -- the ledger has a row for every pending todo, and phase 49's CR-01 has a recognised disposition"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts (6/6 pass)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts (7/7 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One resolver (requirement-ids.ts) decides whether a cited requirement id is real, spanning the live document and every archived milestone snapshot; anno-register.test.ts and anno-import.test.ts both exit 0 and the NOPE-99 fabricated-id fixture is still reported undeclared"
    requirement: "QUICK-260913-mql"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts (13/13 pass)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-import.test.ts (39/39 pass, combined run)"
        status: pass
    human_judgment: false
  - id: D3
    description: "audit-gate.mjs attributes a red guard verdict to the actual failing file's own exit status (per-file spawn), never output parsing; proven by a regression test measured RED against the pre-fix logic before the fix landed"
    requirement: "QUICK-260913-mql"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts (45/45 pass, including the new attribution regression test)"
        status: pass
      - kind: other
        ref: "node scripts/audit-gate.mjs --root . --json -> {allowed:true, redGuards:[], structuralErrors:[], guardFiles:10} in 1.77s"
        status: pass
    human_judgment: false
  - id: D4
    description: "test:automated suite genuinely green (0 failures) after all three fixes, with the 9 opt-in environment skips unchanged as a set; the 12 CI-only MANUAL_ONLY_TESTS files measured individually rather than assumed"
    verification:
      - kind: unit
        ref: "npm run test:automated from src/mcp/vice (4384 pass / 0 fail / 9 skip, exit 0, third run after two transient scratch-dir race flakes self-healed)"
        status: pass
    human_judgment: true
    rationale: "Two of the twelve MANUAL_ONLY_TESTS files did not pass (vice-proxy.test.ts hangs as documented; broker-e2e.test.ts fails deterministically on a real crash-respawn timing assertion) -- both are pre-existing, out of this task's file scope, and logged rather than fixed. A human should confirm this is an acceptable state to push against CI, which still runs the full glob."

duration: 30min
completed: 2026-09-13
status: complete
---

# Quick Task 260913-mql: Fix the Red Docs Guards and the Audit Gate's Attribution Bug — Summary

**Fixed two genuinely-red docs guards (a missing Deferred Items ledger row, an undispositioned phase-49 review finding), unified requirement-id resolution across the milestone archive so `anno-register.test.ts`/`anno-import.test.ts` stop reddening on correct trees, and replaced `audit-gate.mjs`'s broken output-parsing attribution with per-file subprocess exit status — `test:automated` went from 7 failures to 0.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-13T14:36:04Z (plan commit)
- **Completed:** 2026-09-13T14:48:47Z (last task commit), verification continued after
- **Tasks:** 3 (Task 1 produced 2 commits per its own explicit instruction)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- **Root cause A (ledger gap):** Added two missing rows to STATE.md's Deferred Items Pending table (`capability-registry-manifest-claim-stale`, `2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root`) and reconciled both live pending-count prose claims (both already wrong before this change) to the counted tree total of 10.
- **Root cause B (undispositioned finding):** Created `49-REVIEW-FIX.md`, the established per-phase disposition-record convention, recording that CR-01's two planning-vocabulary citations were already removed by commit `29d4c467` before this record existed — the gap was the record, not the code.
- **Root cause C (requirement-id resolution):** Added `src/mcp/vice/requirement-ids.ts`, the one resolver unioning the live `.planning/REQUIREMENTS.md` with every archived `.planning/milestones/v*-REQUIREMENTS.md` snapshot. Eleven ids across ten verbs (`STORE-01/04/06`, `MCP-04`, `IMP-01/02`, `AUTO-01`, `EVID-01/03/04/05`) now resolve correctly; the planted `NOPE-99` fabricated id is still reported undeclared.
- **Root cause D (attribution bug):** `audit-gate.mjs`'s `runGuardsLive()` now spawns one subprocess per guard file and reads each file's own exit status, replacing `parseRedGuardNames()`'s output-parsing fallback, which — measured directly — found zero parseable lines under either reporter on this Node version and therefore reported *every* guard red on *every* call. Added a RED-first regression test (`redGuardIndex: 2`, deep-equal assertion) that reproduced this exact failure before the fix.
- Real tree: `node scripts/audit-gate.mjs --root . --json` now reports `allowed: true`, `redGuards: []`, in 1.77s (measured ~1.7s claim confirmed).
- `test:automated`: 7 failures -> 0 failures, 9 skips unchanged as a set (all opt-in environment gates: upstream clone, live stock VICE, GHIDRA_HOME).

## Task Commits

1. **Task 1a (root cause A): Deferred Items ledger row gap** — `5624a6ec` (docs)
2. **Task 1b (root cause B): phase 49 CR-01 disposition** — `c363fcaa` (docs)
3. **Task 2 (root cause C): requirement-id resolver across the milestone archive** — `b5499297` (fix)
4. **Task 3 (root cause D): per-file attribution in audit-gate.mjs** — `e342392b` (fix)

_Note: an unrelated concurrent commit (`56d1215a`, Phase 53 docs work by a different session) landed between commits 3 and 4; it touches no file this plan names and is excluded from every diff/verification claim above._

## Files Created/Modified

- `src/mcp/vice/requirement-ids.ts` (created) — the one resolver for declared requirement ids, live doc UNION every archived milestone snapshot
- `.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/49-REVIEW-FIX.md` (created) — CR-01's disposition record
- `.planning/STATE.md` — two new Deferred Items rows, two count-claim reconciliations
- `src/mcp/vice/anno-register.test.ts` — `requirementsPath()`/`REQUIREMENTS_PATH`/inline parse removed; now calls `requirement-ids.ts`; two assertion messages widened to name both sources
- `src/mcp/vice/anno-import.test.ts` — register-surface test now checks membership against `requirement-ids.ts`'s resolved set instead of a bare `.includes()` against the live file only
- `scripts/audit-gate.mjs` — `runGuardsLive()` rewritten to one-spawn-per-file with a shared total time budget; `parseRedGuardNames()` deleted; both callers derive `redGuards` through one new `redGuardNamesFrom()` seam
- `src/mcp/vice/audit-integrity.test.ts` — added the RED-first attribution regression test

## Decisions Made

- **Commit count is 4, not 3.** The plan's `<output>` section and top-level `<verification>` say "three atomic commits", but Task 1's own action block is explicit and unambiguous: "TWO SEPARATE COMMITS. Do not combine them — each root cause must be revertible alone." The orchestrator's own constraint ("Each root cause gets its own atomic commit") independently agrees: there are 4 root causes (A, B, C, D per the plan's own `measured_baseline` decomposition), so 4 commits. Followed the more specific, unambiguous instruction over the looser summary line.
- Kept the `declaredRequirementIds()` local wrapper name in both test files (calling the new module's `declaredRequirementIds` under an aliased import in `anno-register.test.ts`, and directly in `anno-import.test.ts`), per the plan's instruction to preserve the exported-to-the-file shape and optional-argument form so no other call site needed touching.
- Category value `mcp` added to STATE.md's Pending table (new; existing values `broker`/`planning`/`testing`/`store` didn't fit the capability-registry manifest-claim finding) — stated in the Task 1 commit message rather than forced into a wrong-fitting existing category.

## Deviations from Plan

### Auto-fixed / Adjusted (not defects, but divergences from the plan's stated assumptions)

**1. The vice-proxy scratch-dir todo was already tracked, not untracked as the plan (measured at an earlier planning-time snapshot) claimed.**
- **Found during:** Task 1, before committing
- **Detail:** `2026-09-13-vice-proxy-test-leaks-scratch-dirs-into-planning-root.md` had already been committed (in `1e5d9bcf`, before this task ran) between planning time and execution time. The plan's instruction to `git add` it in the same commit as the ledger row was therefore a no-op — the file was already tracked, and `git status --short .planning/todos/pending/2026-09-13-...md` showed a clean working tree for it.
- **Impact:** None on correctness. Documented in the Task 1 commit message.

**2. Baseline capture was per-guard, not a single pre-edit `test:automated` snapshot.**
- **Found during:** execution planning
- **Detail:** The plan's verification strategy item 1 calls for capturing a full `test:automated` baseline before any edit. This execution instead confirmed each of the four root causes' RED state individually and in isolation (`docs-deferred-ledger.test.ts` run and captured RED with the exact 2 missing stems; `anno-register.test.ts` run and captured RED with all 15 basis problems across 11 ids; the new attribution regression test run and captured RED with the fallback reporting all 10 guards). `docs-review-disposition.test.ts` was verified via direct source inspection (per the plan's own instruction for that task: "VERIFY the finding's current state yourself") rather than run RED-then-fixed, since its substance was already fixed by a prior commit and only the record was missing.
- **Impact:** None on the outcome — every root cause's pre-fix state is independently substantiated above and in the individual test output captured during execution, and the full-suite baseline the plan describes (7 failures, 9 skips, ~4392 tests) matches what these four isolated captures predict (2+1+3+1=7).

**3. A flaky, self-healing test-suite race was hit twice during `test:automated` runs, unrelated to any change in this task.**
- **Found during:** post-fix full-suite verification (run 1 and run 2 of 3)
- **Detail:** `acme-seam.test.ts` (run 1) and `anno-verb-coverage.test.ts` (run 2) each failed on a transient scratch-directory artifact from a concurrently-running/leftover test fixture (`.anno-memmap-render-plain-*`, `installer/skills/acme-build/zz-scratch-*`) that a directory-tree-walking assertion in an unrelated file picked up mid-run. Neither failing test, nor the scratch-dir writers, were touched by this task. A third run completed clean (4384 pass / 0 fail / 9 skip, exit 0).
- **Impact:** None — this is a pre-existing, known class of flake (test suite races on repo-tree scratch files), not a regression from this task's four commits.

**4. `broker-e2e.test.ts` (a MANUAL_ONLY_TESTS / CI-only file) fails deterministically, out of scope.**
- **Found during:** the plan's mandated measurement of all 12 `MANUAL_ONLY_TESTS` files individually
- **Detail:** `wired warm-hit (plan 41-05): an acquire over the real control plane is served from a ready, ungranted instance an ordinary crash-respawn left behind...` fails with the same assertion on two separate runs — a real broker/x64sc crash-respawn deadline is not met. This file is untouched by any of this task's four commits (which touch only `.planning/STATE.md`, a phase-49 doc, `requirement-ids.ts`, the two `anno-*.test.ts` files, and `audit-gate.mjs`/`audit-integrity.test.ts`), so per the SCOPE BOUNDARY rule this was measured and logged, not fixed.
- **Logged:** `.planning/WINDOWS.md` entry (kind: deviation, phase: quick-260913-mql, file: `src/mcp/vice/broker-e2e.test.ts:403`).
- **Impact:** This is a genuine gap between "automated gate is green" and "CI's full glob is green" that predates this task and is out of its scope to fix.

---

**Total deviations:** 4 (2 documentation/measurement-methodology notes, 1 flaky-but-self-healing observation, 1 pre-existing out-of-scope failure logged to the windows ledger)
**Impact on plan:** All four root causes fixed exactly as scoped. No guard was weakened, narrowed, or exempted. No fix reached outside the files each task named.

## Issues Encountered

None that blocked completion. See Deviations above for measured divergences from the plan's stated assumptions, none of which required a different fix.

## Proof the attribution regression test is non-vacuous (RED-first, captured before the fix)

Test: `attribution: exactly one red guard among many is named by basename, and no others` (`src/mcp/vice/audit-integrity.test.ts`), `redGuardIndex: 2` (deliberately not 0, so the pre-existing planted-violation test's own index-0 assertion could not make this pass by coincidence).

Run against the pre-fix `parseRedGuardNames()` logic:

```
✖ attribution: exactly one red guard among many is named by basename, and no others (measured RED against parseRedGuardNames()'s output-parsing fallback) (220.410259ms)
  AssertionError [ERR_ASSERTION]: expected redGuards to name exactly the one planted-red guard; got: ["docs-absorbed-decisions.test.ts","docs-constraints-sync.test.ts","docs-core-value-decision.test.ts","docs-dangling-refs.test.ts","docs-deferred-ledger.test.ts","docs-fork-absence.test.ts","docs-fork-decision.test.ts","docs-review-disposition.test.ts","docs-uat-abstention.test.ts","docs-worktree-isolation.test.ts"]
    expected: [ 'docs-review-disposition.test.ts' ]
```

This confirms the mechanism exactly as the plan's `measured_baseline` predicted: with only one guard planted red (index 2, `docs-review-disposition.test.ts`), the pre-fix code reported **all ten** guards red — the "found nothing, fall through to the full list" fallback was the only code path this runner ever took. After the fix, the same test asserts `redGuards` deep-equals `["docs-review-disposition.test.ts"]` and passes.

## Measured before/after (test:automated, from `src/mcp/vice`)

| | Total | Pass | Fail | Skip |
|---|---|---|---|---|
| **Before** (plan's measured baseline, cross-checked per-root-cause during execution — see Deviation #2) | ~4392 | ~4385 | 7 | 9 |
| **After** (this task, run 3 of 3, clean) | 4393 | 4384 | 0 | 9 |

Total grew by 1 (the new attribution regression test). The 9 skips are the same opt-in environment gates before and after: upstream-clone re-hash (1), live anno-store export (1), live `anno_evid_ingest` (1), `GHIDRA_HOME`-gated sleigh compile (5), live `vice_memmap_zap` (1) — none became a failure.

## MANUAL_ONLY_TESTS (CI-only) delta — measured individually, under an explicit 60s timeout, no broker running

| File | Result |
|---|---|
| `vice-broker-launch.test.ts` | PASS (11 pass / 4 skip) |
| `vice-proxy.test.ts` | **TIMED OUT** at 60s (the documented known hanger; pre-existing, unrelated to this task) |
| `broker-e2e.test.ts` | **FAIL**, deterministic on 2 runs — `wired warm-hit (plan 41-05)`; pre-existing, out of scope, logged to WINDOWS.md |
| `stock-live.test.ts` | PASS (0 pass / 14 skip — no live stock VICE bin set) |
| `stock-live-triage.test.ts` | PASS (0 pass / 3 skip) |
| `stock-live-broker-monitor.test.ts` | PASS (0 pass / 1 skip) |
| `stock-broker-live.test.ts` | PASS (0 pass / 5 skip) |
| `stock-a4-checkpoint-flood.test.ts` | PASS (0 pass / 1 skip) |
| `dxa-live.test.ts` | PASS (0 pass / 5 skip) |
| `ghidra-live.test.ts` | PASS (0 pass / 24 skip) |
| `ghidra-opcode-live.test.ts` | PASS (4 pass / 8 skip) |
| `text-monitor-live.test.ts` | PASS (1 pass / 8 skip) |

## Divergences found between the plan's measured baseline and the tree as executed

- Deviation #1 above (vice-proxy scratch-dir todo already tracked).
- The plan's `measured_baseline` correctly predicted the exact shape of failures A/B/C/D (2/1/3/1 = 7) and every id/file cited; no other divergence was found in the scope this plan authorized.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `test:automated` is genuinely green (0 failures). Local `main` can be pushed to `origin/main` with the automated gate passing.
- **Before pushing**, be aware CI runs the FULL `*.test.*` glob (not `test:automated`), which includes the 12 `MANUAL_ONLY_TESTS` files. Two of those are not clean: `vice-proxy.test.ts` (known hanger — CI's timeout behavior for this specific file should be confirmed separately) and `broker-e2e.test.ts` (deterministic real-broker timing failure, logged to WINDOWS.md, not fixed by this task).
- No blockers for this quick task's own scope: all four root causes are closed, the gate reports clean on the real tree, and no docs guard was weakened.

## Self-Check: PASSED

All claimed created files exist on disk (`src/mcp/vice/requirement-ids.ts`,
`.planning/phases/49-.../49-REVIEW-FIX.md`, this SUMMARY.md) and all four
claimed commit hashes (`5624a6ec`, `c363fcaa`, `b5499297`, `e342392b`) are
present in `git log --oneline --all`.

---
*Phase: quick-260913-mql*
*Completed: 2026-09-13*
