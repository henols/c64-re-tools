---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 06
subsystem: testing
tags: [vice-proxy, test-gate, ledger-correction, workspace-env, ci-guardrails, full-glob]

# Dependency graph
requires:
  - phase: 55-05
    provides: "vice-proxy.test.ts fully green (56/53/0/3), all seven no-harness-set failures resolved; header/gate/manual-only ledger prose left byte-identical for this plan to correct"
provides:
  - "vice-proxy.test.ts's WORKSPACE_ENV gate re-measured 2026-09-14: all three gated cases still fail (same precondition, structural cause identified precisely), kept gated with a dated, measured reason replacing the stale pre-re-baseline figure"
  - "Three stale ledger claims corrected: vice-proxy-ping.test.ts no longer asserts its sibling hangs; vice-proxy.test.ts's header names the real successful-call route (proxy-local anno_* tracer, broker-mediated stand-in only via a real grant, never a direct VICE_MCP_URL dial); test-gate.mjs's disposition rationale for vice-proxy.test.ts states the measured cost reason, not the false hang, with the declined promotion recorded"
  - "The phase's terminal proof: npm test (the full *.test.* glob CI runs) is green with an empty failing set (4574/4493/0/81, 71.2s); npm run test:automated unmoved at 4417/0/9 with vice-proxy.test.ts still outside the derived automated set; npm run typecheck exits 0"
affects: []

actuals:
  tokens: 3175
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "When a required diagnostic run (both WORKSPACE_ENV variables set) fails a gated test's own precondition assertion rather than its main assertions, trace the precondition failure to its structural root (repoRoot()'s branch-1 containment check, repo-root.ts) before concluding the reason is merely 'the variable is unset' -- the true reason can be one level deeper (a bare-host shell cannot satisfy a containment check that requires the module's own on-disk location to sit inside the named container mount)."
    - "A collateral test failure discovered only inside a required diagnostic environment (not the test suite's own normal running conditions) is documented as corroborating evidence for the same root cause, not fixed and not gated -- it never runs in that environment under any real CI or `npm test`/`npm run test:automated` invocation."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/vice-proxy-ping.test.ts
    - src/mcp/vice/test-gate.mjs

key-decisions:
  - "All three WORKSPACE_ENV-gated cases stay gated -- none passed when the required both-variables-set measurement was run, so per the plan's own ladder the correct action was to rewrite the reason, not remove the gate."
  - "vice-proxy.test.ts stays in test-gate.mjs's MANUAL_ONLY_TESTS list -- promotion into the narrowed automated gate was considered and explicitly declined (recorded in the corrected disposition comment and in the Task 2 commit message), since the file costs ~26-27s and spawns a real child process per test case, which does not belong in a gate meant to run on every edit."
  - "The pre-existing `.planning/todos/pending/...` path citation inside test-gate.mjs's disposition comment was removed (kept the substantive quoted disposition) because it made the plan's own zero-planning-references verify command fail before this plan touched anything -- not a new stale claim this plan introduced, but a pre-existing one blocking this plan's own acceptance criteria."
  - "A leaked `installer/skills/acme-build/zz-scratch-*/` directory (left behind mid-run by a parallel session's own test suite -- installer/skills/ is fully gitignored, generated content) caused the first `npm test` run to fail on one unrelated test. Removed the stray directory, ran `node installer/scripts/sync-skills.mjs` (reported already in sync, nothing written), and re-ran -- per the dispatch's own named contingency for this exact situation, not treated as a phase failure."

patterns-established: []

requirements-completed: [PROXY-06]

coverage:
  - id: D1
    description: "No file in the tree still claims vice-proxy.test.ts hangs or must never be run"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "grep -raiE 'HANGS and must never be run|which HANGS' src/mcp/vice/ --include='*.ts' --include='*.mts' --include='*.mjs' -> hang_claims=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "vice-proxy.test.ts's own header describes the harness it actually uses (spawned child, stdio JSON-RPC; proxy-local anno_* tracer route plus broker-mediated stand-in reached only via a real grant), not the deleted direct-VICE_MCP_URL-to-stand-in mechanism"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts lines 1-14 (rewritten header); node --test vice-proxy.test.ts: 56/53/0/3, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The WORKSPACE_ENV gate's comment carries figures measured in this phase (dated 2026-09-14), no longer cites the removed CI env: block as a future fix or defers to a wholesale re-baseline"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts lines ~76-121 (rewritten WORKSPACE_ENV comment block); node --test vice-proxy.test.ts: 56/53/0/3 (default), 56/52/4/0 exit 1 (both variables set)"
        status: pass
    human_judgment: false
  - id: D4
    description: "test-gate.mjs's disposition for vice-proxy.test.ts states the real, measured reason it stays manual-only (a ~26-27s suite spawning one real child process per test case), not the false hang, with the declined promotion to the narrowed gate recorded explicitly"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "src/mcp/vice/test-gate.mjs's corrected WHY THIS FILE EXISTS block and new second-entry note; still_manual_only=1; file_in_narrowed_set=false"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each remaining WORKSPACE_ENV-gated case is re-measured and decided on that measurement -- all three fail under the only environment that runs them (a precise, now-documented structural reason), so all three stay gated rather than being silently ungated or dropped"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "node --test vice-proxy.test.ts (gated run): 56 tests / 52 pass / 4 fail / 0 skipped, exit 1; all three gated cases named in the failing set, plus one collateral, non-gated failure documented as corroborating evidence"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test (the FULL *.test.* glob CI runs) exits 0 from src/mcp/vice with an empty failing set"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "npm test: 4574 tests / 4493 pass / 0 fail / 81 skipped, duration_ms 71224.55, exit 0, empty failing set (after removing one parallel-session-leaked installer/skills/ scratch directory and re-running node installer/scripts/sync-skills.mjs, per the dispatch's own named contingency)"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm run test:automated reports 0 failures and 9 skips, with vice-proxy.test.ts still outside that derived set"
    requirement: "PROXY-06"
    verification:
      - kind: unit
        ref: "npm run test:automated: 4417 tests / 4408 pass / 0 fail / 9 skipped, exit 0; automatedTestFiles(cwd).includes('vice-proxy.test.ts') === false"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-14
status: complete
---

# Phase 55 Plan 06: Repair the vice-proxy.test.ts ledger and prove the full glob CI runs is green Summary

**Re-measured the WORKSPACE_ENV gate (all three cases still fail, for a now-precisely-identified structural reason -- kept gated with a dated comment), corrected three stale/false ledger claims (the sibling's "HANGS" claim, the harness header's dead-mechanism description, and test-gate.mjs's false hang-based disposition), and proved the phase goal: `npm test` -- the full glob CI actually runs -- is green with an empty failing set (4574/4493/0/81), the narrowed gate is unmoved (4417/0/9, `vice-proxy.test.ts` still outside it), and `npm run typecheck` exits 0.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (2 produced commits; Task 3 was measurement-only, no code change)
- **Files modified:** 3 (`vice-proxy.test.ts`, `vice-proxy-ping.test.ts`, `test-gate.mjs`)
- **Commits:** 2

## Accomplishments

- **Task 1** (`2653d851`): ran `vice-proxy.test.ts` twice -- default (56/53/0/3, exit 0, unchanged) and with `CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH` both set in this process's own environment (56/52/4/0, exit 1). Established the CURRENT gated set is exactly three tests (`path translation: container paths cannot reach the host`, `path translation: relative paths resolve for declared path arguments only`, `containerize: a host-rooted grant epoch_file is rewritten so epoch drift is actually detected, and the translation line names all three fields` -- one fewer than the stale comment's "four", matching 55-03's own deletion of the recycle-block gated case). All three failed under the gated run, all three on the IDENTICAL precondition assertion (`hostPath() must actually translate in this environment for this test to be meaningful`), before any of their own translated-forwarding assertions ran. Traced the precondition failure to its structural root in `repo-root.ts`: `repoRoot()`'s branch-1 containment check requires the calling module's own on-disk location to resolve INSIDE `CONTAINER_WORKSPACE_PATH` -- true only running inside an actual devcontainer bind-mounting this checkout at that path. Exporting the two variables from a bare-host shell does not satisfy that containment check (this checkout's real path is not under `/workspace`), so `repoRoot()` falls through to its `.git`-ancestor branch and returns the unchanged host path, leaving `hostPath()` with nothing to translate. Per the plan's ladder, since none of the three passed, **kept all three gated** and rewrote the WORKSPACE_ENV comment block with this run's own dated (2026-09-14) figures, removed the sentence deferring to "a wholesale re-baseline" (this phase), and corrected the comment's own stale "four tests" to "three". Also recorded, as corroborating evidence only (explicitly NOT a new gate), a fourth, previously-ungated failure observed in the same gated run (`containerize safety net: a grant whose epoch_file translates outside the workspace is refused...`) caused by the identical mechanism one level removed in `containerpath.ts`'s own module-scope-cached `WORKSPACE_ROOT`; that test is untouched and passes in every run this suite actually performs.
- **Task 2** (`3cd0e0cc`): corrected the three stale ledger claims. `vice-proxy-ping.test.ts`'s opening sentence no longer asserts its sibling "HANGS and must never be run" -- replaced with the measured cost (terminates in ~26-27s per run, 56/53/0/3, spawns a real child process per test case, manual-only for that cost, not a host dependency). `vice-proxy.test.ts`'s own header no longer describes the harness as dialling an in-process HTTP stand-in directly through `VICE_MCP_URL` (that route is confirmed dead by Plans 55-04/55-05: `ensureStockSession()` now refuses outright the instant the variable is set) -- rewrote to name today's real successful-call route: the leading tracer's proxy-local `anno_*` call needs no stand-in and no broker; every broker-mediated test still spawns the same `startStandInServer()` stand-in but reaches it only through a real acquired broker grant. Also fixed the stray `vice-proxy.mjs` filename (renamed to `.ts` long ago) in the same lines being rewritten -- left every other pre-existing `vice-proxy.mjs` reference and phase/plan citation elsewhere in the file untouched as out of this task's scope. `test-gate.mjs`'s disposition block: corrected the stale "eight" file count (the list has grown to twelve) and stated what the corrected number counts (eleven for genuine manual host setup, one -- `vice-proxy.test.ts` -- for cost alone); added a dedicated second-entry rationale note for `vice-proxy.test.ts` (the file's first three list members had never had individual per-entry paragraphs) stating the measured reason and explicitly that it is NOT a host dependency; recorded the declined promotion into the narrowed gate; did NOT remove the file from `MANUAL_ONLY_TESTS`. Also removed a pre-existing `.planning/todos/pending/...` path citation from the same paragraph (kept the substantive quoted disposition) since it was making the plan's own zero-planning-references verify command fail before this plan touched anything, and corrected an adjacent "ninth" to "thirteenth" for internal consistency with the corrected total.
- **Task 3** (no commit -- measurement only): confirmed no broker/emulator process running throughout (`pgrep -c x64sc` = 0 before, during, and after). Ran `npm test` (`node --test '*.test.*'`, the exact command CI's Test step runs) from `src/mcp/vice`: first run failed (exit 1, 4574/4492/1/81, 65.5s) on one test unrelated to this plan's files (`the shipped skill tree's markdown is byte-identical to the source tree's...`, `anno-verb-coverage.test.ts`) -- caused by a `installer/skills/acme-build/zz-scratch-*/` directory left behind mid-run by the parallel session named in this dispatch's own execution notes (`installer/skills/` is fully gitignored, generated content, confirmed via `git check-ignore`). Removed the stray directory, ran `node installer/scripts/sync-skills.mjs` (reported "already in sync ... NOTHING WRITTEN"), and re-ran the full glob: exit 0, 4574 tests / 4493 pass / 0 fail / 81 skipped, duration_ms 71224.55 (~71.2s), **empty failing set**. Then ran `npm run test:automated`: exit 0, 4417/4408/0/9, unmoved from the phase's protected baseline; confirmed `automatedTestFiles(cwd)` does not include `vice-proxy.test.ts`. The 4574-4417=157 count delta is fully attributed to the twelve `MANUAL_ONLY_TESTS` files' own combined test count, confirmed by running them directly as a group (157 tests / 85 pass / 0 fail / 72 skipped, exit 0). Ran `npm run typecheck`: exit 0. No broker/x64sc process at any point.

## Task Commits

1. **Task 1: Re-measure the environment-gated cases and decide each on that measurement** - `2653d851` (test)
2. **Task 2: Correct the three stale ledger claims about this file** - `3cd0e0cc` (docs)
3. **Task 3: Prove the full glob CI runs is green, and protect the narrowed gate's baseline** - no commit (measurement only, no files changed)

**Plan metadata:** (recorded separately by the orchestrator, per this plan's constraint against committing docs artifacts from this agent)

## Files Created/Modified

- `src/mcp/vice/vice-proxy.test.ts` - WORKSPACE_ENV gate comment rewritten with 2026-09-14 dated figures and the structural root cause (Task 1); harness header rewritten to name the live successful-call route and drop the dead direct-VICE_MCP_URL-to-stand-in description, stray `vice-proxy.mjs` filename in those same lines corrected to `.ts` (Task 2).
- `src/mcp/vice/vice-proxy-ping.test.ts` - opening sentence's false "HANGS and must never be run" claim replaced with the measured cost reason (Task 2).
- `src/mcp/vice/test-gate.mjs` - disposition block's stale file count corrected and re-scoped (eleven host-dependent, one cost-only), a dedicated `vice-proxy.test.ts` rationale note added, a pre-existing `.planning/` path citation dropped, "ninth" corrected to "thirteenth" for consistency (Task 2).

## Decisions Made

- All three WORKSPACE_ENV-gated cases stay gated (measured failing under the only environment that runs them, for a now-precisely-identified structural reason -- not merely "the variable is unset").
- `vice-proxy.test.ts` stays in `MANUAL_ONLY_TESTS` -- promotion explicitly considered and declined, recorded in both the corrected comment and the commit message.
- The pre-existing `.planning/todos/` citation in `test-gate.mjs` was removed as a necessary precondition for the plan's own zero-planning-references verify check to pass -- not a new claim invented by this plan, but a pre-existing one this plan's acceptance criteria required to be cleared.
- The parallel session's leaked `installer/skills/` scratch directory was treated exactly as this dispatch's own execution notes anticipated: removed, `sync-skills.mjs` re-run (confirmed already in sync), and the full-glob run repeated rather than reported as a phase failure.

## Deviations from Plan

**None of Rules 1-4** were triggered against this plan's own scope. The one action beyond the plan's literal task list -- removing the leaked `installer/skills/acme-build/zz-scratch-*/` directory and re-running `sync-skills.mjs` -- was explicitly pre-authorized by this dispatch's own execution notes as the named remedy for exactly this situation, not a deviation.

## Issues Encountered

- First `npm test` run failed on one test outside this plan's files (`anno-verb-coverage.test.ts`'s shipped-skill-tree byte-identity check), caused by a leaked scratch directory from a concurrently-running parallel session. Resolved per the dispatch's own contingency (remove the directory, re-run `sync-skills.mjs`, re-run the full glob); the second run was clean. This is not reported as a phase failure since it was neither caused by this plan's changes nor present in the final measured state.
- None otherwise. Every measurement command completed within its stated budget; no broker or stray `x64sc` process was observed at any point.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 55's goal is MET: the full `*.test.*` glob CI actually runs (`npm test`) is green with an empty failing set (4574/4493/0/81, 71.2s, exit 0), measured with no broker/emulator running, redirected, exit code read on the same line.
- The narrowed automated gate (`npm run test:automated`) is unmoved at 4417/4408/0/9, exit 0; `vice-proxy.test.ts` confirmed still outside its derived set.
- `npm run typecheck` exits 0.
- The ledger now describes `vice-proxy.test.ts` truthfully: terminating (not hanging), costly (~26-27s, a real child process per test case), manual-only for that cost rather than any host dependency. Every figure in the corrected comments was measured in this plan and is dated 2026-09-14.
- No open work handed to a future phase from this plan.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.test.ts`
- FOUND: `src/mcp/vice/vice-proxy-ping.test.ts`
- FOUND: `src/mcp/vice/test-gate.mjs`
- FOUND commit: `2653d851` (Task 1 -- WORKSPACE_ENV gate re-measurement)
- FOUND commit: `3cd0e0cc` (Task 2 -- three stale ledger claims corrected)

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-14*
