---
phase: 52-remove-the-fork-backend
plan: 04
subsystem: vice-mcp
tags: [refactor, dead-code-removal, fork-removal, docs-guard-retirement]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 03)
    provides: "vice-errors.ts split, every surviving importer repointed, exact post-drift line numbers for this plan's own work"
provides:
  - "vice-proxy.ts with ONE dispatch path: buildBackendAwareTool() collapsed, every advertised tool (including vice_recycle/vice_diagnose via handleRecycle()/handleDiagnose()) reaches stockDispatch.dispatchStock() through a single new dispatchStockFor() helper"
  - "forwardToVice(), the three fork-only evidence gatherers (gatherWedgeEvidence/gatherCheckpointTrapEvidence/gatherBracketEvidence), rewriteArguments() and its exclusive helpers, the D-13/D-14 replace-and-report mechanism, and the D-16 seam-hazard annotation walk (SEAM_HAZARDS) all deleted -- each confirmed orphaned before deletion, not assumed"
  - "vice-probe.ts (278 lines) and vice-probe.test.ts deleted; package.json's files[] corrected (103 files)"
  - "The rewriteArguments()/forwardToVice() Architecture constraint retired from CLAUDE.md and .planning/PROJECT.md's Constraints lists byte-identically; docs-linerefs.test.ts deleted with its basis recorded; its registry entries in scripts/audit-gate.mjs and audit-integrity.test.ts removed in the same commit"
affects: [52-05, 52-06, 52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 51500
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Thin-wrapper delegation over body deletion: handleRecycle()/handleDiagnose() keep their exact registered names and declaration forms (a structural oracle in vice-proxy.test.ts pins handleRecycle's) but their fork-only bodies are replaced with a one-line call into a new shared dispatchStockFor() helper -- satisfying 'still declared and registered' without re-deriving stock-recycle.ts/stock-diagnose.ts's own already-complete implementations."
    - "Single-line registration discipline: dispatchStockFor(name, args) exists specifically so every `tools[...] = buildViceTool(..., (args) => dispatchStockFor(...))` registration reads as ONE source line -- vice-proxy.test.ts's own registration scanner keys each `tools[...] = ...;` line by its raw captured text, and a multi-line inline dispatch call (my first attempt) silently broke that scan."
    - "Deletion-consumer verification before each cut: for every candidate deletion (helper function, comment reference, structural test assertion), grep every remaining reference in the file/repo BEFORE deleting -- caught two whole mechanisms (the D-13/D-14 replace-and-report family and the D-16 seam-hazard annotation walk) whose sole caller was forwardToVice() but which the plan's own task text did not name individually."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/stock-derived.ts
    - src/mcp/vice/stock-paths.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/broker-kill.test.ts
    - src/mcp/vice/module-classification.ts
    - CLAUDE.md
    - .planning/PROJECT.md
    - scripts/audit-gate.mjs
    - src/mcp/vice/audit-integrity.test.ts
  deleted:
    - src/mcp/vice/vice-probe.ts
    - src/mcp/vice/vice-probe.test.ts
    - src/mcp/vice/docs-linerefs.test.ts

key-decisions:
  - "handleRecycle()/handleDiagnose() were rewritten as thin delegations to a new dispatchStockFor() helper rather than deleted outright -- required by the plan's own acceptance criteria ('handleRecycle and handleDiagnose are still declared and still registered', 'async function handleRecycle(args) count is still 1') and by vice-proxy.test.ts's structural oracle on handleRecycle's exact declaration form, which the plan explicitly said was off-limits to edit."
  - "dispatchStockFor() (name, args) => stockDispatch.dispatchStock(name, args, {ensureLease: ensureBrokerLease, resolvedBinaryPath, resolvedBinaryPathIsResolved}) is a NEW shared helper, introduced because the manifest loop, handleRecycle() and handleDiagnose() all need the identical deps object, and because inlining the dispatchStock() call at each site (my first-pass edit) put it on a second source line, which vice-proxy.test.ts's proxyToolRegistrations() scanner -- keyed on the raw single-line right-hand side of each `tools[...] = ...;` assignment -- could not see, silently breaking two structural tests. This is NOT a new generic-dispatch surface: it has no per-tool branching of its own and performs no routing decision that stockDispatch's own table doesn't already make; it is a parameter-object convenience wrapper, matching the plan's prohibition against re-opening a nested-argument dispatch hazard."
  - "The D-13/D-14 replace-and-report mechanism (handleGrantedInstanceUnreachable(), machineReplacedMessage(), replacementFailedMessage(), sessionMustRestartMessage()) and the D-16 seam-hazard annotation walk (SEAM_HAZARDS, CHECKPOINT_ARMING_TOOLS, detectCheckpointArmingHazard(), renderCheckpointArmingHazard(), renderSeamHazardAnnotations()) were BOTH deleted, even though neither is named individually in the plan's must_haves. Both had exactly one caller each -- forwardToVice()'s own pre-flight-probe-failure branch and its post-call annotation step, respectively -- confirmed via exhaustive grep before deletion. Left in place, both would have been genuinely dead code (unreachable, since their sole caller no longer exists) referencing types (ProbeResult) and functions (forwardToVice) that no longer compile. This is treated as 'every helper that exists only to serve it' under the plan's own general principle for rewriteArguments()'s helpers, generalised to the rest of the fork-only region."
  - "PathOutOfWorkspaceError and PathTranslationError were deleted (zero surviving consumers beyond rewritePathsIn()'s own throw and forwardToVice()'s own catch, both deleted). isInsideWorkspace() SURVIVED -- it has a second, independent caller inside containerizeGrant() (broker-grant containerization, backend-agnostic), confirmed by grep before assuming either way."
  - "resolvedBinaryPath / resolvedBinaryPathIsResolved were NOT fork-only: they were already part of the stock arm's own deps object (passed to stockDispatch.dispatchStock() at every site, before this plan and after it) -- confirmed by reading the stock arm first, per the plan's own instruction, rather than assumed."
  - "docs-linerefs.test.ts's deletion required two follow-on fixes NOT named in the plan's files_modified: scripts/audit-gate.mjs's EXPECTED_DOCS_GUARD_NAMES array and its audit-integrity.test.ts mirror both list every docs-*.test.ts guard BY NAME and assert disk-derived membership in both directions -- leaving the deleted name registered would have reported a missing guard as a structural error. Both were updated in the same commit as the guard's own deletion, with the removal's basis recorded inline (matching the array's own established per-entry commentary convention)."
  - "module-classification.ts's runAnnoCli citation (vice-proxy.ts:304, itself a 52-03 repair) drifted again to :299 as a direct consequence of this plan's own deletions; broker-kill.test.ts's KillStage-vocabulary structural test was repointed from vice-proxy.ts (whose own recycle-ack switch is deleted) to stock-recycle.ts (the sole surviving consumer of that vocabulary); and stock-dispatch.test.ts's five CR-07 structural tests, which pinned buildBackendAwareTool()'s literal existence and behaviour, were rewritten to assert the new post-collapse invariants instead of being merely disabled."

requirements-completed: []

coverage:
  - id: D1
    description: "buildBackendAwareTool() collapsed; every advertised tool registers through buildViceTool() calling stockDispatch.dispatchStock() (directly, or via handleRecycle()/handleDiagnose()'s own delegation)"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
      - kind: other
        ref: "grep -ac 'buildBackendAwareTool' vice-proxy.ts stock-derived.ts -> 0, 0"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts's 5 rewritten CR-07 structural tests (144/144 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "forwardToVice(), the three fork-only evidence gatherers, rewriteArguments() and its exclusive helpers, the D-13/D-14 replace-and-report mechanism, and the D-16 seam-hazard annotation walk are all deleted; vice-probe.ts and its test are gone with their files[] entry"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -ac for each of forwardToVice, rewriteArguments, gatherWedgeEvidence, gatherCheckpointTrapEvidence, gatherBracketEvidence, probeInstance, buildBackendAwareTool over vice-proxy.ts -> 0 for all seven (including comment text, not just code)"
        status: pass
      - kind: other
        ref: "test ! -f vice-probe.ts && test ! -f vice-probe.test.ts -> both true; node scripts/check-npm-packages.mjs -> exit 0, 103 files"
        status: pass
      - kind: unit
        ref: "npm run typecheck -> exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "handleRecycle()/handleDiagnose() survive with their exact declaration forms, still registered, now delegating to dispatchStockFor()"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "grep -ac 'async function handleRecycle(args)' vice-proxy.ts -> 1"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts's handleRecycle/handleDiagnose registration and delegation tests (144/144 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rewriteArguments()/forwardToVice() Architecture constraint is removed from CLAUDE.md and .planning/PROJECT.md's Constraints lists byte-identically; docs-linerefs.test.ts is deleted with its basis recorded, and its two registry mirrors (audit-gate.mjs, audit-integrity.test.ts) updated in the same commit"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "node --test docs-constraints-sync.test.ts (8/8 pass)"
        status: pass
      - kind: other
        ref: "grep -ac 'rewriteArguments' CLAUDE.md -> 0; grep -ac 'vice-proxy.ts:' CLAUDE.md -> 0"
        status: pass
      - kind: unit
        ref: "audit-integrity.test.ts (43/44 pass -- the 1 failure is D-12-02, a pre-existing floor member, confirmed by structuralErrors: [] in node scripts/audit-gate.mjs --json)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The automated suite's failure SET is back to the pre-plan 7-member floor, with no docs-linerefs member remaining and no new regression"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "cd src/mcp/vice && npm run test:automated -- three consecutive full runs, final run's failure set exactly matches the documented 7-member floor"
        status: pass
    human_judgment: false

duration: ~110min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 04: Delete the Fork-Only Region of vice-proxy.ts Summary

**`vice-proxy.ts` collapses to one dispatch path (~1,800 lines of fork-only forwarding, evidence-gathering and argument-rewriting code deleted, including two whole mechanisms -- D-13/D-14 replace-and-report and D-16 seam-hazard annotation -- the plan didn't name individually but whose sole caller died with `forwardToVice()`), and the CLAUDE.md/PROJECT.md Architecture constraint plus its `docs-linerefs.test.ts` guard are retired by recorded decision, not renumbered.**

## Checkpoint Decision (recorded verbatim)

**Decision:** Delete the fork-only region of `vice-proxy.ts` (`forwardToVice`, the three evidence gatherers, `rewriteArguments` and its helpers, the two handler fork arms, `vice-probe.ts`), AND retire the `rewriteArguments`/`forwardToVice` Architecture constraint together with `docs-linerefs.test.ts` — deliberately treating a line-citation mismatch as obsolescence rather than as the drift CLAUDE.md normally says it is?

**Answer:** **A** — Proceed with BOTH the code deletion and the constraint/guard retirement, as Tasks 1-3 describe.

**Answered by:** The human project owner, via a blocking-human decision gate presented by the orchestrator, which quoted the plan's own options A/B/C verbatim.

**Date:** 2026-09-12.

No file was modified before this answer was recorded. Task 3 ran (was not skipped).

## Performance

- **Duration:** ~110 min
- **Completed:** 2026-09-12
- **Tasks:** 3 (plus the pre-answered checkpoint)
- **Files modified:** 14 (11 modified, 3 deleted, 0 created)

## Accomplishments

- Collapsed `buildBackendAwareTool()` entirely: all three of its call sites (the manifest loop, `RECYCLE_TOOL`, `DIAGNOSE_TOOL`) now register through `buildViceTool()` directly, wired to a single new `dispatchStockFor()` helper that centralises the `{ensureLease, resolvedBinaryPath, resolvedBinaryPathIsResolved}` deps object every stock tool call needs.
- Deleted `forwardToVice()`, `gatherWedgeEvidence()`, `gatherCheckpointTrapEvidence()`, `gatherBracketEvidence()`, `rewriteArguments()` and every helper that existed only to serve it (`rewritePathsIn`, `pathArgsFor`, `PathResolution`, `resolutionNote`, `PATH_REWRITE_MAX_DEPTH`, `NO_PATH_ARGS`, `PATH_ARGS_BY_TOOL`, `PathOutOfWorkspaceError`, `PathTranslationError`) -- `isInsideWorkspace()` alone survives, confirmed to have a second, backend-agnostic caller (`containerizeGrant()`).
- Additionally deleted two whole mechanisms whose only caller was `forwardToVice()`, discovered by exhaustive consumer grep rather than assumed from the plan's own enumerated list: the D-13/D-14 replace-and-report family (`handleGrantedInstanceUnreachable()`, `machineReplacedMessage()`, `replacementFailedMessage()`, `sessionMustRestartMessage()`) and the D-16 seam-hazard annotation walk (`SEAM_HAZARDS`, `CHECKPOINT_ARMING_TOOLS`, `detectCheckpointArmingHazard()`, `renderCheckpointArmingHazard()`, `renderSeamHazardAnnotations()`). Also deleted the whole "host-unreachable triple" (`isConnectionRefusedReason`, `neverStartedMessage`, `deadOrHungMessage`, `aliveButFailedMessage`) and the diagnose-verdict apparatus (`resolveLiveIrqHandler`, `runCycleBracket`, `classifyLiveness`, `renderDiagnoseReport`, `renderCheckpointTrapReport`, the capture-step machinery, and their small numeric helpers) once confirmed orphaned.
- Rewrote `handleRecycle()`/`handleDiagnose()` as one-line delegations to `dispatchStockFor()`, preserving `handleRecycle`'s exact `const ... = async function handleRecycle(args) {...}` declaration form (the structural oracle in `vice-proxy.test.ts` pins this) and both handlers' registration identity, rather than re-deriving stock-recycle.ts's/stock-diagnose.ts's already-complete stock-native implementations a second time.
- Deleted `vice-probe.ts` (278 lines) and `vice-probe.test.ts`; removed the `"vice-probe.ts"` entry from `package.json`'s `files[]` (103 files, confirmed by `check-npm-packages.mjs`).
- Rewrote `stock-derived.ts`'s header (the hazard it once guarded against no longer has anywhere to come from) and `stock-paths.ts`'s "Never call `rewriteArguments()`" bullet into the surviving abstract lesson the plan asked for.
- Removed the Architecture constraint bullet from CLAUDE.md and `.planning/PROJECT.md`'s Constraints lists in one commit (`docs-constraints-sync.test.ts`: 8/8 pass), and deleted `docs-linerefs.test.ts` with its basis recorded here.
- Repaired three collateral automated-test regressions this plan's own deletions caused: `stock-dispatch.test.ts`'s five CR-07 structural tests (which pinned `buildBackendAwareTool()`'s literal existence), `broker-kill.test.ts`'s KillStage-vocabulary consumer check (repointed from `vice-proxy.ts` to `stock-recycle.ts`, the sole surviving consumer), and a drifted `runAnnoCli` line citation in `module-classification.ts` (`:304` → `:299`).
- Repaired two registry mirrors that would otherwise report `docs-linerefs.test.ts` as a missing expected guard: `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` and its `audit-integrity.test.ts` assertion-only mirror.

## Task Commits

1. **Tasks 1+2: Collapse buildBackendAwareTool() and delete the fork-only region** — `96ef711f` (feat)
2. **Task 3: Retire the Architecture constraint and docs-linerefs.test.ts** — `599b5c77` (docs)

_Note: Tasks 1 and 2 are combined into one commit — see Deviations below._

## Files Created/Modified

- `src/mcp/vice/vice-proxy.ts` — ~1,800 lines net removed; one dispatch path; `handleRecycle()`/`handleDiagnose()` now thin `dispatchStockFor()` delegations; ready-log ternary and every registration site collapsed to the stock-only form
- `src/mcp/vice/stock-derived.ts` — header rewritten: the client-side-derived-path hazard is now unreachable by construction (no generic-dispatch surface left), not merely "unreachable on stock today"
- `src/mcp/vice/stock-paths.ts` — "Never call rewriteArguments()" bullet rewritten to the surviving abstract lesson
- `src/mcp/vice/package.json` — `vice-probe.ts` removed from `files[]`
- `src/mcp/vice/stock-dispatch.test.ts` — five CR-07 structural tests rewritten for the post-collapse registration shape; new `reachesDispatchStock()` helper
- `src/mcp/vice/broker-kill.test.ts` — KillStage-vocabulary test repointed from `vice-proxy.ts` to `stock-recycle.ts`
- `src/mcp/vice/module-classification.ts` — drifted `runAnnoCli` citation repaired (`:304` → `:299`), in both the structured entry and its matching prose comment
- `CLAUDE.md`, `.planning/PROJECT.md` — Architecture constraint bullet removed, byte-identically
- `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts` — `docs-linerefs.test.ts` removed from both `EXPECTED_DOCS_GUARD_NAMES` copies
- Deleted: `src/mcp/vice/vice-probe.ts`, `src/mcp/vice/vice-probe.test.ts`, `src/mcp/vice/docs-linerefs.test.ts`

## Decisions Made

See `key-decisions` in frontmatter for the full record. In short: `handleRecycle()`/`handleDiagnose()` survive as thin `dispatchStockFor()` wrappers (required by the plan's own acceptance criteria and a structural oracle); the D-13/D-14 and D-16 mechanisms were deleted despite not being individually named, because each had exactly one now-dead caller; `PathOutOfWorkspaceError`/`PathTranslationError` were deleted but `isInsideWorkspace()` survived (confirmed second caller); `resolvedBinaryPath`/`resolvedBinaryPathIsResolved` were confirmed shared, not fork-only; and `docs-linerefs.test.ts`'s deletion required updating two registries not named in the plan's `files_modified`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `dispatchStock()` inlined at three call sites broke vice-proxy.test.ts's registration line scanner**
- **Found during:** Task 1/2, first full `npm run test:automated` pass after the initial collapse
- **Issue:** My first-pass edit inlined `stockDispatch.dispatchStock(name, args, {...})` directly at each of the three registration sites, spanning multiple source lines. `stock-dispatch.test.ts`'s `proxyToolRegistrations()` scans one `tools[...] = ...;` line at a time and keys each registration by its raw single-line right-hand side text -- a multi-line call made the manifest loop's own registration invisible to two structural tests (`every registered tool ... reaches dispatchStock`, `the synthetic tools are all registered ...`).
- **Fix:** Extracted the shared deps-object construction into a new `dispatchStockFor(name, args)` helper, so every registration site is exactly one source line (`tools[def.name] = buildViceTool(def, (args) => dispatchStockFor(def.name, args));`).
- **Files modified:** `src/mcp/vice/vice-proxy.ts`
- **Verification:** `npm run typecheck` exits 0; `node --test stock-dispatch.test.ts` 144/144 pass.
- **Committed in:** `96ef711f` (Tasks 1+2 commit)

**2. [Rule 1 - Bug] Two whole mechanisms orphaned by forwardToVice()'s deletion were not individually named in the plan, and were compile-breaking or dead if left in place**
- **Found during:** Task 2, systematic consumer grep before each deletion
- **Issue:** `handleGrantedInstanceUnreachable()`/`machineReplacedMessage()`/`replacementFailedMessage()`/`sessionMustRestartMessage()` (D-13/D-14 replace-and-report) and `SEAM_HAZARDS`/`detectCheckpointArmingHazard()`/`renderCheckpointArmingHazard()`/`renderSeamHazardAnnotations()` (D-16) each had exactly one caller, both inside `forwardToVice()`. Two of these functions' signatures directly referenced the now-deleted `ProbeResult` type, which is a real `TS2304` compile error, not merely dead code.
- **Fix:** Deleted both mechanisms in full, plus their now-orphaned message builders and the "host-unreachable triple" (`isConnectionRefusedReason`/`neverStartedMessage`/`deadOrHungMessage`/`aliveButFailedMessage`) and the diagnose-verdict apparatus (`resolveLiveIrqHandler`, `runCycleBracket`, `classifyLiveness`, `renderDiagnoseReport`, `renderCheckpointTrapReport`, the capture-step machinery, `toAddressNumber`/`formatByte`/`bytesFromMemoryReadResult`/`wordFromBytes`/`HIRAM_MASK`/`IrqHandlerResolution`/`CheckpointInfo`/`CheckpointTrapEvidence`/`DIAGNOSE_VERDICTS`) -- each confirmed to have zero surviving consumers by grep first.
- **Files modified:** `src/mcp/vice/vice-proxy.ts`
- **Verification:** `npm run typecheck` exits 0; `node scripts/check-npm-packages.mjs` exits 0.
- **Committed in:** `96ef711f` (Tasks 1+2 commit)

**3. [Rule 1 - Bug] Three automated test files structurally asserted the deleted mechanisms directly, which is a real regression, not documented drift**
- **Found during:** Task 2, first full `npm run test:automated` run after the deletion
- **Issue:** `stock-dispatch.test.ts` had five CR-07 tests asserting `buildBackendAwareTool()`'s literal existence and per-backend branching; `broker-kill.test.ts` asserted vice-proxy.ts's own (now-deleted) recycle-ack `switch`/`successfulKill` consumer of the `KillStage` vocabulary; `module-classification.ts` cited `vice-proxy.ts:304` for `runAnnoCli`, which my edits (following 52-03's own -4 shift) moved to `:299`.
- **Fix:** Rewrote the five CR-07 tests to assert the post-collapse invariant (every registration reaches `dispatchStock` via `dispatchStockFor()`, directly or through `handleRecycle()`/`handleDiagnose()`); repointed the KillStage test to `stock-recycle.ts` (the sole surviving consumer, already built in an earlier phase for exactly this reason); corrected the `runAnnoCli` citation in both `module-classification.ts`'s structured entry and its matching prose comment.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`, `src/mcp/vice/broker-kill.test.ts`, `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test stock-dispatch.test.ts` (144/144), `node --test broker-kill.test.ts` (38/38), `node --test module-classification.test.ts` (20/20) all pass.
- **Committed in:** `96ef711f` (Tasks 1+2 commit)

**4. [Rule 1 - Bug] docs-linerefs.test.ts's own registration in two "expected guard names" registries would have reported a missing guard**
- **Found during:** Task 3, precondition grep before deleting the guard file (the plan's own read_first instruction: "confirm nothing else depends on the guard's existence before deleting it")
- **Issue:** `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` and its `audit-integrity.test.ts` assertion-only mirror both list every `docs-*.test.ts` guard basename and assert disk-derived membership; deleting the file without updating both would make `checkAuditGate()` report a structural error ("expected guard ... is missing"), which `no milestone audit declares a gated status while any docs guard is red (D-12-02)" and related tests would surface as a NEW failure distinct from the pre-existing one.
- **Fix:** Removed `"docs-linerefs.test.ts"` from both arrays, with an inline comment recording the removal's basis, matching the arrays' own established per-entry commentary convention. `DOCS_GUARD_FLOOR` (`>= 7`) is unaffected -- 9 guards remain on disk.
- **Files modified:** `scripts/audit-gate.mjs`, `src/mcp/vice/audit-integrity.test.ts`
- **Verification:** `node scripts/audit-gate.mjs --root . --json` reports `"structuralErrors":[]`; `node --test audit-integrity.test.ts` (43/44 pass -- the one failure, D-12-02, is a pre-existing floor member unrelated to this change).
- **Committed in:** `599b5c77` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking-compile/structural fixes required by the plan's own deletions, 2 necessary registry/test repairs). **Impact on plan:** All four are direct, necessary consequences of executing Tasks 1-3 as written -- the plan's own must_haves required the deletions that caused each; none is scope creep beyond what "delete the fork-only region" entails.

### Combined Task 1+2 commit (process deviation, not a code deviation)

Tasks 1 and 2 are committed together (`96ef711f`) rather than as two separate commits. The collapsed registration seam (Task 1) and the handler-body rewrite (Task 2) both depend on the new `dispatchStockFor()` helper (Deviation 1 above) — an intermediate commit containing only Task 1's edits would either duplicate the deps-object construction inline (breaking the registration scanner, per Deviation 1) or leave `handleRecycle()`/`handleDiagnose()` still calling the deleted fork-only gatherers (failing typecheck), violating the "commit only after verification passes" discipline. Both tasks' own `<verify>` blocks pass against the combined commit.

## Issues Encountered

None beyond the deviations documented above, all resolved within this plan's own scope.

## Known Stubs

None. This plan is entirely removal, a shared-helper extraction, and two comment/lesson rewrites -- no new code path was stubbed.

## Threat Flags

None beyond what this plan's own `<threat_model>` already discloses (T-52-10 through T-52-13, T-52-SC) -- no new surface introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `vice-proxy.ts` has exactly one dispatch path (`stockDispatch.dispatchStock()`, reached via the single `dispatchStockFor()` helper) and no fork-era transport, evidence-gathering or argument-rewriting code.
- `vice.ts` still exists (reduced to the fork transport half by plan 52-03) and is ready for whole-file deletion by plan 52-05 -- this plan removed its LAST in-tree consumer inside `vice-proxy.ts` (`call`, `MachineRestartedError`) from the import list, but `vice.ts` itself is untouched.
- `ACTIVE_BACKEND`, `backend-detect.mts`, and `capability-registry.ts` are untouched by this plan, as declared — later plans in this phase own them.
- Plan 52-06 owns `vice-proxy.test.ts`'s own fork-conditional branches (its `"fork"`/`VICE_BACKEND` hits and its committed-`tools-manifest.json` reads) — this plan's deletions make several of that file's tests reference deleted symbols by name (`gatherWedgeEvidence`, `buildBackendAwareTool`, `probeInstance`), which is EXPECTED and owned by 52-06, not a gap in this plan: `vice-proxy.test.ts` is a `MANUAL_ONLY_TESTS` entry, excluded from `npm run test:automated` (this plan's own test gate) and reached only by the full `npm test` glob, which CI runs and 52-06 is scoped to repair.
- Plan 52-09 still owns `CLAUDE.md`'s stale Testing bullet naming `vice-sync.ts` (flagged by 52-03, untouched here) and its byte-identical `.planning/PROJECT.md` copy.
- A minor, out-of-scope staleness was noted but not fixed: `repo-root.ts:279`'s comment lists `vice-probe.ts` among modules that trigger its deploy-on-first-use side effect; `repo-root.ts` is not in this plan's `files_modified` and the staleness is cosmetic (one fewer consumer named in prose), not a guarded assertion.
- `FORKRM-01` remains `Pending` in `.planning/REQUIREMENTS.md` — declared by six sibling plans in this phase (52-02, 52-03, 52-04, 52-05, 52-06, 52-10); the shared-ID gate correctly withholds `Complete` until all six have a SUMMARY.
- No blockers.

## Self-Check: PASSED

- `test ! -f src/mcp/vice/vice-probe.ts` and `test ! -f src/mcp/vice/vice-probe.test.ts`: both exit 0 (absent).
- `test ! -f src/mcp/vice/docs-linerefs.test.ts`: exit 0 (absent).
- Both commit hashes verified present: `git log --oneline --all | grep -E '96ef711f|599b5c77'` returns both.
- `npm run typecheck` exits 0 (re-confirmed as the final action before writing this SUMMARY).
- `node scripts/check-npm-packages.mjs` exits 0 (103 files for `@henols/vice-mcp`).
- `node --test docs-constraints-sync.test.ts`: 8/8 pass.
- `node scripts/audit-gate.mjs --root . --json`: `structuralErrors: []`.
- Automated suite failure set: confirmed across three consecutive full runs, converging on the documented 7-member persistent floor with zero `docs-linerefs`-attributable members and zero new, unexplained members (two transient flakes observed across the three runs -- `anno-tools.test.ts`'s TOCTOU test and `SEAM-05`/a quiescence-window control -- each re-confirmed passing in isolation or absent on the next run, matching the documented flake pattern).

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
</content>
