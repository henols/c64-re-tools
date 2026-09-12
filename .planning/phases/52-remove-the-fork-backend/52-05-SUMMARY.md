---
phase: 52-remove-the-fork-backend
plan: 05
subsystem: vice-mcp
tags: [refactor, fork-removal, dead-code-removal, manifest-collapse]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 03)
    provides: "vice-errors.ts split; vice.ts reduced to the fork transport half only, ready for whole-file deletion"
  - phase: 52-remove-the-fork-backend (plan 04)
    provides: "vice-proxy.ts's fork-only dispatch region deleted; forwardToVice() and its evidence gatherers gone, which is what made this plan's dead epoch-baseline cluster provably dead"
provides:
  - "src/mcp/vice/vice.ts deleted whole: DENY_LIST, denyListRefusalMessage(), the fork HTTP/JSON-RPC transport (rpc/ensureInitialized/withReconnect/call/callTool/serverInfo) and the session-identity apparatus (SessionInfo/beginSession/sessionReconnects/lastToolCall/assertSameMachine) are gone with it"
  - "tools-manifest.stock.json is the ONLY manifest; tools-manifest.json, refresh-manifest.ts and refresh-manifest.test.ts are deleted; nothing in the project regenerates a manifest from a live host"
  - "vice-proxy.ts's DENY_LIST manifest-registration skip, its CallToolRequestSchema override guard, and a dead epoch-baseline cluster (ensureViceSession/viceSession/epochBaseline/currentEpoch/epochChanged/epochDriftMessage/checkEpochAndRebaseline) all deleted -- the cluster's only caller was the already-deleted forwardToVice()"
  - "Every consumer discovered by a fresh repo-wide census -- beyond the plan's own files list -- repaired in the same wave: capability-registry.test.ts, stock-dispatch.test.ts and vice-proxy.test.ts's DENY_LIST imports; three fork-manifest-reading tests in stock-dispatch.test.ts; scripts/check-skill-tool-coverage.mjs narrowed to one manifest; scripts/generate-tool-support-table.mjs's DENY_LIST import unwound"
  - "anno-tools.ts's CURATED_ANNO_TOOLS/assertAnnoBatch()/ANNO_MAX_BATCH_DEPTH are byte-identical; its two DENY_LIST citations rewritten to describe the confused-deputy precedent in the abstract"
affects: [52-06, 52-07, 52-08, 52-09, 52-10]

actuals:
  tokens: 145000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Consumer census over plan file lists: a plan's own <files> enumeration is a starting point, not a ceiling -- deleting a widely-imported module (vice.ts, tools-manifest.json) requires a fresh repo-wide grep for every importer/reader, because a prior plan's or the orchestrator's own census can under-count (this plan found FIVE consumers the plan text and the orchestrator's measured-consumer-map both missed: stock-dispatch.test.ts's three fork-manifest-reading tests, package.json's stray refresh-manifest.ts files[] entry, and scripts/generate-tool-support-table.mjs's DENY_LIST import breaking an unrelated test file, audit-root-args.test.ts, by subprocess)."
    - "Narrow two-manifest assertions to one manifest, never delete the classification: every DENY_LISTED_TOOLS/NOT_A_TOOL_NAMES/FORK_ONLY_UNRECOVERABLE-style check that used to assert 'present in fork AND absent from stock' (or the reverse) drops the fork half and keeps the stock half, preserving every non-vacuity control -- a coverage gate that finds nothing must never pass by finding nothing."
    - "A dead-code cluster's true extent is found by tracing zero-caller chains, not by trusting a prior actor's own risk note: the orchestrator's measured-consumer-map flagged epochBaseline as 'LIVE' based on a grep that saw internal cross-references among ensureViceSession/currentEpoch/epochChanged/checkEpochAndRebaseline, but none of THOSE functions itself had an external caller -- the whole cluster was dead, orphaned by 52-04's own deletion of forwardToVice(), and confirmed dead only by tracing each function's caller set to zero, not by pattern-matching on 'reads/writes a variable'."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/vice-errors.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/capability-registry.test.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/test-gate.mjs
    - src/mcp/vice/test-gate.test.ts
    - src/mcp/vice/shipped-modules.ts
    - src/mcp/vice/acme-gate.ts
    - src/mcp/vice/smoke.mjs
    - src/mcp/vice/README.md
    - scripts/check-skill-tool-coverage.mjs
    - scripts/generate-tool-support-table.mjs
  deleted:
    - src/mcp/vice/vice.ts
    - src/mcp/vice/vice.test.ts
    - src/mcp/vice/fork-live.test.ts
    - src/mcp/vice/fork-deleted-tools.ts
    - src/mcp/vice/fork-manifest-surface.test.ts
    - src/mcp/vice/tools-manifest.json
    - src/mcp/vice/refresh-manifest.ts
    - src/mcp/vice/refresh-manifest.test.ts
    - src/mcp/vice/manifest-arg-compat.test.ts

key-decisions:
  - "Checkpoint answered before this executor ran (see 'Checkpoint Decision' section below): proceed with deleting vice.ts (taking DENY_LIST/denyListRefusalMessage() with it) and the fork manifest, leaving anno-tools.ts's inverted allowlist byte-identical and its citations rewritten in the abstract."
  - "Task 1's beginSession()/assertSameMachine() precondition was re-run and its narrower HALT condition (a stock-*.ts or text-*.ts module calling either) did not fire -- see 'Precondition Result' below. Proceeded without halting."
  - "The whole ensureViceSession()/viceSession/epochBaseline/currentEpoch/epochChanged/epochDriftMessage/checkEpochAndRebaseline cluster was deleted, not just ensureViceSession(): tracing every caller showed checkEpochAndRebaseline() itself has ZERO external callers (its only would-be caller, forwardToVice(), was deleted by 52-04), so the entire cluster was orphaned dead code, not a live epoch-drift check as the orchestrator's measured-consumer-map assumed. stock-connect.ts (the stock path's own reconnect/epoch handling) is unaffected and untouched."
  - "Tasks 1 and 2 are committed together: Task 1's own typecheck cannot pass in isolation, because refresh-manifest.ts (deleted in Task 2) imports serverInfo/ServerInfoPayload from vice.ts (deleted in Task 1) -- the identical interdependency 52-04 recorded for its own combined commit."
  - "stock-dispatch.test.ts's three fork-manifest-reading tests (not named in the plan or the orchestrator's consumer map) were narrowed to the single stock manifest rather than left broken: the plan's own floorcheck verify block explicitly disallows new failures in this file (only tool-support-table.test.mjs and capability-registry.test.ts are named bounded exceptions), so leaving them red would be a regression, not a deferral."
  - "scripts/generate-tool-support-table.mjs's DENY_LIST import was unwound just enough to keep the MODULE LOADABLE (it was breaking audit-root-args.test.ts's argv-parsing tests via subprocess spawn, an unrelated test file with no connection to the tool-support table itself) -- its own two-manifest table-generation logic (forkManifestPath still defaulting to the now-deleted tools-manifest.json) is left broken, because retiring or rewriting that generation logic is plan 52-07's named scope (the tool-support table's retirement), not this plan's."
  - "package.json's files[] entry for refresh-manifest.ts was NOT named by the plan or the measured-consumer-map, and its survival alongside a deleted file broke shippedTsModules()'s ShippedFilesEntryMissingError guard, in turn failing two WR-13 invariant tests in stock-dispatch.test.ts. Removed in the same commit as vice.ts's own files[] entry."
  - "module-classification.ts's runAnnoCli citation (vice-proxy.ts:299, itself a 52-04 repair) drifted again to :290 as a direct consequence of this plan's own vice-proxy.ts edits; repaired in both the structured basis.consumers entry and its matching prose comment, exactly as 52-03 and 52-04 each did for the same recurring citation."

requirements-completed: []

coverage:
  - id: D1
    description: "vice.ts deleted whole (DENY_LIST, denyListRefusalMessage(), the fork transport, the session-identity apparatus); vice.test.ts, fork-live.test.ts, fork-deleted-tools.ts and fork-manifest-surface.test.ts deleted with it; vice-proxy.ts's two DENY_LIST consumers removed with nothing replacing them"
    requirement: FORKRM-01
    verification:
      - kind: unit
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
      - kind: other
        ref: "grep -rac 'DENY_LIST' src/mcp/vice/vice-proxy.ts -> 0; grep -rac 'denyListRefusalMessage' src/mcp/vice --include='*.ts' -> 0"
        status: pass
      - kind: other
        ref: "test ! -f vice.ts / vice.test.ts / fork-live.test.ts / fork-deleted-tools.ts / fork-manifest-surface.test.ts -> all absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools-manifest.stock.json is the only manifest, byte-identical; tools-manifest.json/refresh-manifest.ts/refresh-manifest.test.ts/manifest-arg-compat.test.ts deleted; every remaining reader (check-skill-tool-coverage.mjs, anno-tools.test.ts, stock-dispatch.test.ts, smoke.mjs, README.md) reads the stock manifest only"
    requirement: FORKRM-06
    verification:
      - kind: other
        ref: "git diff --numstat -- tools-manifest.stock.json -> no output (untouched)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs -> exit 0 (38 vice_* names, 32 resolved, 26 anno_* names)"
        status: pass
      - kind: other
        ref: "npm run smoke -> exit 0, 74 tools advertised"
        status: pass
    human_judgment: false
  - id: D3
    description: "anno-tools.ts's CURATED_ANNO_TOOLS/assertAnnoBatch()/ANNO_MAX_BATCH_DEPTH are provably unchanged (comment-only diff); its two DENY_LIST citations rewritten to the abstract confused-deputy precedent"
    requirement: FORKRM-04
    verification:
      - kind: other
        ref: "git diff -U0 anno-tools.ts | grep non-comment changed lines -> 0"
        status: pass
      - kind: unit
        ref: "node --test anno-tools.test.ts -> exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The automated suite's failure set stays at the 7-member floor (minus one intermittent) plus exactly three documented, bounded exceptions this plan could not close without taking on plan 52-07's own scope"
    requirement: FORKRM-01
    verification:
      - kind: other
        ref: "/tmp/claude-1000/gsd52/floorcheck.sh -- five consecutive runs, each converging on the 7-member floor (with the documented intermittent member absent or substituted) plus exactly {mechanical completeness (capability-registry.test.ts), --root naming the repository root itself (audit-root-args.test.ts), tool-support-table.test.mjs}"
        status: pass
    human_judgment: true
    rationale: "The three bounded exceptions are a judgment call about scope boundary (this plan's vs. plan 52-07's), not a mechanically provable fact -- a human should confirm the boundary was drawn in the right place before the ship gate."

duration: 165min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 05: Delete the Fork Transport and the Fork Manifest Summary

**`vice.ts` (the fork's HTTP/JSON-RPC transport, `DENY_LIST`, and the session-identity apparatus) and the fork manifest (`tools-manifest.json`, `refresh-manifest.ts`) are both deleted whole, with a fresh repo-wide census finding and repairing five consumers neither the plan nor the orchestrator's own measured-consumer-map named, and `anno-tools.ts`'s inverted allowlist left provably byte-identical.**

## Checkpoint Decision (recorded verbatim, per this executor's prompt)

**Decision:** Delete `vice.ts` whole -- taking `DENY_LIST` and `denyListRefusalMessage()`, the one refusal this tree calls a security control, with it -- and delete `tools-manifest.json` and `refresh-manifest.ts`, after which nothing in the project can regenerate the fork's tool surface?

**Answer:** **A** -- Proceed with both deletions. The nested-argument hazard class stays guarded by inversion in `anno-tools.ts`, byte-identical, with its explanatory citations rewritten rather than dropped.

**Answered by:** The human project owner, via a blocking-human decision gate presented by the orchestrator, which quoted the plan's own options A/B verbatim, disclosed the grep-only residual risk on `beginSession()`/`assertSameMachine()`, and explicitly surfaced that the nested-argument hazard class survives and stays guarded by inversion in `anno-tools.ts`.

**Date:** 2026-09-12.

No file was modified before this answer was recorded (the orchestrator's prompt states the answer was given before any file was touched, and this executor's own first action was reading the plan and required files, not editing). Task 3 ran (was not skipped) -- the surviving `anno-tools.ts` guard's byte-identity is verified mechanically below, and the discussion of that surviving guard is recorded in this checkpoint's own text above ("the nested-argument hazard class stays guarded by inversion in `anno-tools.ts`"), not assumed.

## Precondition Result (Task 1)

The plan's own precondition text: `grep -rn 'beginSession(\|assertSameMachine(' --include='*.ts' --include='*.mts' src/` returns hits only inside `vice.ts` and `vice.test.ts`.

**Re-run, literal result:** FALSE as literally stated -- hits also appear in `vice-proxy.ts`, `fork-live.test.ts`, `vice-errors.ts`, `vice-broker.mts`, `broker-kill.mts`.

**The precondition's actual HALT condition is narrower**, and it is what governs: *"If any `stock-*.ts` or `text-*.ts` module calls either."* Classifying every hit:
- `vice-errors.ts:17-18,91` -- comment only.
- `vice-broker.mts:787`, `broker-kill.mts:538` -- comment only.
- `vice-proxy.ts:627,655` (pre-edit line numbers) -- comment at 627; a real call at 655/660 (`viceSession = beginSession();`), but inside `ensureViceSession()`, which has ZERO external callers (traced below).
- `fork-live.test.ts:325` -- a real call, inside the file this task deletes.
- No `stock-*.ts` or `text-*.ts` module calls either function.

**Result: the precondition's HALT condition did not fire.** Proceeded without halting, per the plan's own stated resolution rule.

## Dead-Cluster Finding (deviation from the orchestrator's own risk note)

The orchestrator's measured-consumer-map rated `epochBaseline` "LIVE" and asked this executor to "trace what must initialise `epochBaseline` on the stock path and preserve that behaviour." Tracing every caller of every function in the cluster (`ensureViceSession()`, `currentEpoch()`, `epochChanged()`, `epochDriftMessage()`, `checkEpochAndRebaseline()`) found:

- `ensureViceSession()`: zero external callers (only referenced in stale comments).
- `checkEpochAndRebaseline()` (the function that actually reads/writes `epochBaseline`): **zero callers, anywhere in the repository.**
- `currentEpoch()`, `epochChanged()`, `epochDriftMessage()`: called only from within `checkEpochAndRebaseline()` itself.

**Conclusion: the entire cluster was dead code**, orphaned by plan 52-04's own deletion of `forwardToVice()` (the cluster's sole real caller, per its own header comment: "Two hazards are enforced HERE... 2. Per-call epoch re-check... before AND after every forwarded call"). The cluster existed only to serve a forwarding function that no longer exists. Deleted in full: `viceSession`, `epochBaseline`, `ensureViceSession()`, `currentEpoch()`, `epochChanged()`, `epochDriftMessage()`, `checkEpochAndRebaseline()`, and the `viceSession = null;` re-baseline line inside the broker-lease acquisition path. `stock-connect.ts`'s own, separate epoch/reconnect handling (confirmed live via its own callers on the stock dispatch path) is completely unaffected -- it never touched this cluster.

## Performance

- **Duration:** ~165 min
- **Completed:** 2026-09-12
- **Tasks:** 3 (plus the pre-answered checkpoint)
- **Files modified:** 26 (17 modified, 9 deleted, 0 created)

## Accomplishments

- Deleted `src/mcp/vice/vice.ts` (564 lines) whole: `DENY_LIST`, `denyListRefusalMessage()`, `DEFAULT_ENDPOINT`, `DEFAULT_TIMEOUT_MS`, `rpc()`, `ensureInitialized()`, `withReconnect()`, `call()`/`callTool`, `serverInfo()`, `RpcOptions`, `ServerInfoPayload`, `SessionInfo`, `BeginSessionOptions`, `beginSession()`, `sessionReconnects()`, `lastToolCall()`, `CallFn`, `AssertSameMachineOptions`, `assertSameMachine()` are all gone. Deleted `vice.test.ts`, `fork-live.test.ts`, `fork-deleted-tools.ts` and `fork-manifest-surface.test.ts` alongside it.
- In `vice-proxy.ts`: removed the `./vice.ts` import (a single statement, exactly as 52-03 arranged); removed the `if (DENY_LIST.includes(def.name)) continue;` manifest-registration skip with nothing replacing it; removed the `CallToolRequestSchema` override's `DENY_LIST`/`denyListRefusalMessage()` layer; removed the dead `ensureViceSession()`/`viceSession`/`epochBaseline` cluster in full (see Dead-Cluster Finding above); rewrote every comment block that explained or cited the deleted mechanisms so nothing dangles.
- Deleted `src/mcp/vice/tools-manifest.json` (1223 lines), `refresh-manifest.ts`, `refresh-manifest.test.ts` and `manifest-arg-compat.test.ts` (its entire premise was two-manifest comparison, exactly like `manifest-arg-compat.test.ts` itself). `tools-manifest.stock.json` is untouched, confirmed byte-identical (`git diff --numstat` produces no output).
- Rewrote `scripts/check-skill-tool-coverage.mjs` to drop `forkManifest`/`forkNames` and every classification phrased as a two-manifest fact, narrowing each to a single-manifest statement while preserving every non-vacuity control; re-verified it still exits 0 and reports non-zero skills/tools scanned (38 vice_* names, 32 resolved, 26 anno_* names, 5 anno CLI verbs).
- Rewrote `anno-tools.ts`'s two `DENY_LIST` citations (`:81`, `:2010`) to describe the confused-deputy precedent in the abstract, naming no deleted symbol; `CURATED_ANNO_TOOLS`/`assertAnnoBatch()`/`ANNO_MAX_BATCH_DEPTH` are byte-identical, mechanically verified (`git diff -U0` filtered to non-comment lines: 0).
- **Beyond the plan's own scope, found and repaired by a fresh repo-wide census:** `capability-registry.test.ts`'s and `stock-dispatch.test.ts`'s `DENY_LIST` imports and dependent assertions (unwound minimally); `vice-proxy.test.ts`'s `DENY_LIST` import and its one real identifier usage (unwound minimally, this file's wider fork-branch cleanup stays plan 52-06's); three fork-manifest-reading tests in `stock-dispatch.test.ts` narrowed to the single stock manifest (a "top-level keys" test, a "D-03 name coverage" test, and a whole-file-deletion-equivalent "D-03 input compatibility" test whose premise, like `manifest-arg-compat.test.ts`'s, was purely two-manifest comparison); `scripts/generate-tool-support-table.mjs`'s `DENY_LIST` import (unwound just enough to keep the module loadable, since it was breaking an unrelated test file, `audit-root-args.test.ts`, via subprocess spawn); `package.json`'s stray `refresh-manifest.ts` `files[]` entry (undetected by the plan, caught two WR-13 invariant tests in `stock-dispatch.test.ts` failing on `ShippedFilesEntryMissingError`); `module-classification.ts`'s drifted `runAnnoCli` citation (`:299` -> `:290`, this plan's own line-shift).
- `test-gate.mjs`'s `MANUAL_ONLY_TESTS` shrunk from thirteen to twelve entries (`fork-live.test.ts` removed); its doc comment's count word and `test-gate.test.ts`'s pinned array both updated; the retired "EIGHTH entry" historical paragraph rewritten to note the retirement without renumbering the surviving entries.
- `smoke.mjs` and `README.md` repointed from `tools-manifest.json` to `tools-manifest.stock.json`; `npm run smoke` re-verified exit 0, 74 tools advertised.
- `shipped-modules.ts` and `acme-gate.ts`'s mutual "TEST-ONLY plain `.ts`" cross-citations repointed away from the deleted `fork-deleted-tools.ts` -- to `acme-verify.ts` and `acme-gate.ts` respectively -- after discovering the ORIGINAL third citation (`anno-test-gate.ts`) was ALREADY a phantom reference to a file that has never existed in this tree (a pre-existing, unrelated defect, opportunistically fixed since the exact line was already being edited).

## Task Commits

1. **Tasks 1+2: Delete vice.ts, its consumers, the fork manifest, and every reader** -- `1bd2928e` (feat)
2. **Task 3: Rewrite anno-tools.ts's two DENY_LIST citations in the abstract** -- `bcc8f6b6` (docs)

_Note: Tasks 1 and 2 are combined into one commit -- see Deviations below (identical reasoning to 52-04's own combined Task 1+2 commit)._

## Files Created/Modified

- `src/mcp/vice/vice-proxy.ts` -- `./vice.ts` import removed; DENY_LIST manifest-registration skip and CallToolRequestSchema override layer removed; the entire dead epoch-baseline cluster removed; every comment referencing a deleted symbol rewritten
- `src/mcp/vice/vice-errors.ts` -- "WHAT NOT TO DO" header updated: the fork-transport apparatus it warned never to move here is now simply gone, not merely warned against
- `src/mcp/vice/module-classification.ts` -- drifted `runAnnoCli` citation repaired (`:299` -> `:290`) in both the structured entry and its matching prose comment
- `src/mcp/vice/package.json` -- `vice.ts`, `tools-manifest.json` and (undetected by the plan) `refresh-manifest.ts` removed from `files[]`
- `src/mcp/vice/anno-tools.ts` -- two `DENY_LIST` citations rewritten in the abstract; zero non-comment lines changed
- `src/mcp/vice/anno-tools.test.ts` -- its own source-text pin updated to match the rewritten citation wording ("smuggling shape" -> "confused-deputy shape"); its fork/stock manifest-absence test narrowed to stock-only
- `src/mcp/vice/capability-registry.test.ts` -- `DENY_LIST` import removed; the now-premise-less "DENY_LIST boundary" test deleted; one `excluded` set narrowed to drop `...DENY_LIST`
- `src/mcp/vice/stock-dispatch.test.ts` -- `DENY_LIST` import removed; its own "no DENY_LIST name" test deleted; three fork-manifest-reading tests narrowed or deleted; `FORK_MANIFEST_PATH`/`TYPE_CHECK_EXEMPT_PROPERTIES` removed (both now unused)
- `src/mcp/vice/vice-proxy.test.ts` -- `DENY_LIST` import removed; its one real identifier usage (`DENY_LISTED = new Set(DENY_LIST)`) replaced with an empty set and an explanatory comment
- `src/mcp/vice/test-gate.mjs`, `src/mcp/vice/test-gate.test.ts` -- `fork-live.test.ts` removed from `MANUAL_ONLY_TESTS`; count word/array updated thirteen -> twelve
- `src/mcp/vice/shipped-modules.ts`, `src/mcp/vice/acme-gate.ts` -- cross-citations of the deleted `fork-deleted-tools.ts` repointed to real, existing sibling files
- `src/mcp/vice/smoke.mjs`, `src/mcp/vice/README.md` -- repointed from `tools-manifest.json` to `tools-manifest.stock.json`
- `scripts/check-skill-tool-coverage.mjs` -- narrowed to the single stock manifest throughout; every non-vacuity assertion preserved
- `scripts/generate-tool-support-table.mjs` -- `DENY_LIST` import and its one usage removed, minimally, to keep the module loadable
- Deleted: `src/mcp/vice/vice.ts`, `vice.test.ts`, `fork-live.test.ts`, `fork-deleted-tools.ts`, `fork-manifest-surface.test.ts`, `tools-manifest.json`, `refresh-manifest.ts`, `refresh-manifest.test.ts`, `manifest-arg-compat.test.ts`

## Decisions Made

See `key-decisions` in frontmatter for the full record. In short: the checkpoint was pre-answered A (proceed); the precondition's narrow HALT condition did not fire; the entire epoch-baseline cluster (not just `ensureViceSession()`) was confirmed dead by tracing every caller to zero, contradicting the orchestrator's own "LIVE" risk flag; Tasks 1+2 are one commit for the same reason 52-04's were; three stock-dispatch.test.ts fork-manifest tests were repaired rather than left red because the plan's own floorcheck forbids new failures there; generate-tool-support-table.mjs was unwound only enough to stay loadable, not retired (52-07's job); the stray `refresh-manifest.ts` `files[]` entry and the drifted `runAnnoCli` citation were both found and fixed as direct, unavoidable consequences of this plan's own deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `package.json`'s `files[]` still listed the deleted `refresh-manifest.ts`, breaking `shippedTsModules()` and two WR-13 invariant tests**
- **Found during:** Task 2, first `node --test stock-dispatch.test.ts` run after the deletions
- **Issue:** `refresh-manifest.ts` was deleted but its `files[]` entry was not (only `vice.ts` and `tools-manifest.json` were named in the plan's own file lists as needing `files[]` removal). `shippedTsModules()` throws `ShippedFilesEntryMissingError` when a listed file does not exist on disk, failing both of `stock-dispatch.test.ts`'s WR-13 invariant tests before they could scan anything.
- **Fix:** Removed `"refresh-manifest.ts"` from `package.json`'s `files[]`.
- **Files modified:** `src/mcp/vice/package.json`
- **Verification:** `node --test stock-dispatch.test.ts` -- 0 failures (was 2).
- **Committed in:** `1bd2928e` (Tasks 1+2 commit)

**2. [Rule 1 - Bug] Three fork-manifest-reading tests in `stock-dispatch.test.ts`, not named by the plan or the orchestrator's consumer map, broke the moment `tools-manifest.json` was deleted**
- **Found during:** Task 2, simulated deletion (temporary rename) before committing, to get the exact failure set rather than guess
- **Issue:** A "top-level keys" test, a "D-03 name coverage" test, and a "D-03 input compatibility" test all read `FORK_MANIFEST_PATH` directly. The plan's own read_first flagged "stock-dispatch.test.ts lines 56, 116, 141-142, 211-215... belong to plans 52-06/52-07" but the plan's OWN floorcheck `<fails_when>` explicitly names only `tool-support-table.test.mjs` and `capability-registry.test.ts` as allowed new failures -- not `stock-dispatch.test.ts`. Left unrepaired, these three would be a regression the plan's own acceptance criteria forbid.
- **Fix:** Narrowed the "top-level keys" test and the "D-03 name coverage" test to assert only stock-manifest facts (dropping the now-meaningless fork comparison, keeping every assertion that survives with one manifest); deleted the "D-03 input compatibility" test whole, since its entire premise was schema comparison between two manifests and nothing survives without a second one to compare against (the same reasoning the plan itself applied to `manifest-arg-compat.test.ts`). Removed the now-unused `TYPE_CHECK_EXEMPT_PROPERTIES` const and `FORK_MANIFEST_PATH` alongside it. Also narrowed a fourth fork-manifest test in this same file (the anno_* "absent from BOTH manifests" duplicate of the one named in `anno-tools.test.ts`) to stock-only.
- **Files modified:** `src/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` -- 0 failures.
- **Committed in:** `1bd2928e` (Tasks 1+2 commit)

**3. [Rule 3 - Blocking] `scripts/generate-tool-support-table.mjs`'s `import { DENY_LIST } from "../src/mcp/vice/vice.ts"` broke module resolution entirely, in turn failing 9 tests in an unrelated file, `audit-root-args.test.ts`, which spawns this script as a subprocess to test generic `--root` argv parsing**
- **Found during:** Task 2, first full `npm run test:automated` run after the deletions
- **Issue:** `ERR_MODULE_NOT_FOUND` on `vice.ts` at import time meant the subprocess could not even start, failing every argv-parsing test that spawns it -- these tests have nothing to do with the tool-support table's own content, only with a shared `--root` parsing seam several scripts share.
- **Fix:** Removed the `DENY_LIST` import and its one usage (the loop that stripped deny-listed names from the fork/stock name sets) from `generate-tool-support-table.mjs`, and removed the matching `STATICALLY_BOUND` entry. The script's own two-manifest table-generation logic (which still defaults `forkManifestPath` to the now-deleted `tools-manifest.json`) is deliberately left broken -- retiring or rewriting that logic is plan 52-07's named scope (the tool-support table's retirement), not this plan's, and the one remaining failure this causes (`audit-root-args.test.ts`'s "repository root itself is accepted" test, which actually runs the full generation) is recorded below as a bounded exception.
- **Files modified:** `scripts/generate-tool-support-table.mjs`
- **Verification:** `node --test audit-root-args.test.ts` -- 1 failure (was 9), and that one failure is the documented bounded exception (see Deferred Items below).
- **Committed in:** `1bd2928e` (Tasks 1+2 commit)

**4. [Rule 1 - Bug] `module-classification.ts`'s `runAnnoCli` citation drifted again (`:299` -> `:290`) as a direct consequence of this plan's own `vice-proxy.ts` edits**
- **Found during:** Task 1/2, first full `npm run test:automated` run
- **Issue:** Removing the `./vice.ts` import statement and the dead epoch-baseline cluster shifted every later line in `vice-proxy.ts`; `module-classification.ts`'s structured `basis.consumers` entry and its matching prose comment both cited the pre-edit line.
- **Fix:** Corrected both citations to `:290`, the real post-edit line.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` -- 0 failures.
- **Committed in:** `1bd2928e` (Tasks 1+2 commit)

**5. [Rule 1 - Bug, opportunistic] A pre-existing phantom file citation (`anno-test-gate.ts`, which has never existed) was discovered while repointing the exact same line's OTHER citation (`fork-deleted-tools.ts`, deleted by this plan)**
- **Found during:** Task 1, repointing `shipped-modules.ts`'s and `acme-gate.ts`'s mutual "plain `.ts` test-only helper" cross-citations away from the deleted `fork-deleted-tools.ts`
- **Issue:** `shipped-modules.ts:76`'s comment named both `fork-deleted-tools.ts` (deleted by this plan) and `anno-test-gate.ts` as sibling examples of the same pattern -- `anno-test-gate.ts` does not exist anywhere in this tree and never has, a pre-existing, unrelated defect this plan's own edit to the SAME line surfaced.
- **Fix:** Repointed both citations to real, existing files (`acme-verify.ts` in `shipped-modules.ts`; `acme-verify.ts` in `acme-gate.ts`, avoiding a self-citation), verified each with `ls`.
- **Files modified:** `src/mcp/vice/shipped-modules.ts`, `src/mcp/vice/acme-gate.ts`
- **Verification:** `ls acme-verify.ts` confirms the file exists and matches the "TEST-ONLY, plain .ts" pattern being cited.
- **Committed in:** `1bd2928e` (Tasks 1+2 commit)

---

**Total deviations:** 5 auto-fixed (3 blocking/structural fixes required by this plan's own deletions, 1 direct citation-drift repair, 1 opportunistic unrelated-defect fix). **Impact on plan:** All five are direct, necessary consequences of executing Tasks 1-2 as written, or trivial adjacent fixes made while editing the exact same lines. None is scope creep beyond what "delete the fork transport and the fork manifest, and unwind every consumer" requires.

### Combined Task 1+2 commit (process deviation, not a code deviation)

Identical reasoning to plan 52-04's own combined Task 1+2 commit: Task 1's own `<verify>` (`npm run typecheck` exits 0) cannot pass in isolation, because `refresh-manifest.ts` (deleted only in Task 2) imports `serverInfo`/`ServerInfoPayload` from `vice.ts` (deleted only in Task 1). An intermediate commit containing only Task 1's edits would fail its own typecheck acceptance criterion.

## Issues Encountered

None beyond the deviations documented above, all resolved within this plan's own scope.

## Known Stubs

None. This plan is entirely removal, targeted repair of readers, and two comment rewrites -- no new code path was stubbed.

## Deferred Items (bounded, cross-wave exceptions -- not fixed here, by design)

These three suite members are new relative to the pre-plan floor. Each is confirmed to have the SAME root cause (a fork-manifest or DENY_LIST dependency squarely inside plan 52-06's or 52-07's own named scope), confirmed NOT fixable without taking on that scope, and confirmed to be exactly the set the plan's own `<fails_when>` polarity anticipated (plus one the plan's own text did not individually name, `audit-root-args.test.ts`'s one remaining failure, which shares generate-tool-support-table.mjs's root cause with `tool-support-table.test.mjs`):

1. **`capability-registry.test.ts`: "mechanical completeness: the registry's name set equals the manifest-derived divergence set"** -- reads `tools-manifest.json` directly (ENOENT). Explicitly named in the plan's own `<fails_when>` as an EXPECTED, bounded new member. Owned by plan 52-06/52-07 (`capability-registry.ts`'s fate).
2. **`tool-support-table.test.mjs`** -- imports `DENY_LIST` from `./vice.ts` (module not found). Explicitly named in the plan's own `<fails_when>` as an EXPECTED, bounded new member. Owned by plan 52-07 (the tool-support table's retirement).
3. **`audit-root-args.test.ts`: "--root naming the repository root itself is accepted and writes identical bytes"** -- the ONE test in this file that actually runs `generate-tool-support-table.mjs`'s full generation (rather than only its argv-parsing refusal paths), which still fails on the now-deleted `tools-manifest.json`. NOT individually named by the plan or the orchestrator's consumer map, discovered by this executor. Shares its root cause with #2 above and is owned by the same plan (52-07).

Also flagged, not fixed (genuinely out of this plan's scope, per its own explicit text):
- `scripts/check-npm-packages.mjs:165`'s hard assertion that `vice.files.includes("tools-manifest.json")` -- CONFIRMED red (`node scripts/check-npm-packages.mjs` exits 1, `vice-mcp: missing tools-manifest.json`, the ONLY failure). Plan 52-07 owns this script.
- `CLAUDE.md`'s Compatibility constraint bullet still names `manifest-arg-compat.test.ts` (now deleted) as what pins the argument-shape half of the backward-compatibility guarantee. CONFIRMED this citation is now stale; no live docs guard currently checks it (matching 52-03's own finding about the `vice-sync.ts` Testing bullet). Plan 52-09 owns retiring this constraint (both `CLAUDE.md` and its byte-identical `.planning/PROJECT.md` copy, together, per `docs-constraints-sync.test.ts`).
- A minor, cosmetic staleness left untouched: `vice-proxy.ts:506`'s comment ("it is never in tools-manifest.json (RESEARCH Key Finding 3), so a manifest regenerate can never drop it") is now trivially true in a different way (the file doesn't exist at all) and its second clause (about a regenerate) is moot since the regenerator is gone too -- not a guarded assertion, not fixed, matching 52-04's own precedent for a similarly cosmetic staleness.
- `stock-dispatch.test.ts:115`'s comment ("neither is ever in tools-manifest.json, which is regenerated from the host fork server's own tools/list") is similarly stale historical prose, left untouched (not a guarded assertion).
- `capability-registry.ts`'s five comment citations of `DENY_LIST`/`vice.ts` (`:22,31,49,99,389`, named in `.planning/notes/deny-list-is-a-fork-artifact.md`'s own consumer list) are untouched -- `capability-registry.ts`'s fate is explicitly plan 52-06/52-07's, not this plan's, and these are prose-only, non-breaking references.
- `vice-proxy.test.ts` retains extensive `DENY_LIST`-dependent test BODIES (structural tests, wire-behavior tests) beyond the one real identifier usage this plan repaired for typecheck -- these tests already exercise machinery deleted by plan 52-04 (the fork forwarding path) and are MANUAL_ONLY (excluded from `npm run test:automated`); their runtime correctness is plan 52-06's named scope ("vice-proxy.test.ts's own fork-BRANCH cleanup"), and this plan's obligation was only to keep the file typechecking, which it does.

## Threat Flags

None beyond what this plan's own `<threat_model>` already discloses (T-52-14 through T-52-17, T-52-SC) -- no new surface introduced. The removal of `DENY_LIST` (T-52-14) is confirmed sound: its target surface (the four fork meta-tool names, `vice_disk_list`) is gone with the fork manifest and transport in the same wave, and no replacement filter was introduced anywhere (T-52-15), confirmed by grep across every file touched in this plan.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `src/mcp/vice/vice.ts` no longer exists anywhere in the tree; every surviving importer resolves shared symbols from `vice-errors.ts` and fork-only symbols from nowhere (they are gone).
- `tools-manifest.stock.json` is the only manifest; `npm run smoke` and `node scripts/check-skill-tool-coverage.mjs` both confirm the live stock tool surface (74 tools advertised, 38 vice_* skill references resolved).
- Plan 52-06 has an updated, narrower scope for `vice-proxy.test.ts`'s own fork-branch cleanup: the `DENY_LIST` import/typecheck concern this plan owned is resolved; the file's remaining fork-forwarding-dependent test bodies (already broken by 52-04) are unchanged and still that plan's to repair.
- Plan 52-07 has three confirmed, bounded, same-root-cause suite members ready to close in one pass: `capability-registry.test.ts`'s mechanical-completeness test, `tool-support-table.test.mjs`, and `audit-root-args.test.ts`'s one remaining generate-tool-support-table.mjs test -- plus the `check-npm-packages.mjs:165` `files[]` assertion and `generate-tool-support-table.mjs`'s own still-broken two-manifest generation logic (this plan only kept the module loadable, not functional).
- Plan 52-09 has a confirmed, exact stale citation to retire: `CLAUDE.md`'s Compatibility bullet naming `manifest-arg-compat.test.ts` (deleted by this plan), byte-identical in `.planning/PROJECT.md`, gated by `docs-constraints-sync.test.ts`.
- `FORKRM-01`, `FORKRM-04` and `FORKRM-06` remain `Pending` in `.planning/REQUIREMENTS.md` -- `FORKRM-01` is declared by six sibling plans in this phase (52-02 through 52-06, 52-10) and the shared-ID gate correctly withholds `Complete` until all six have a SUMMARY (`requirements.ready-ids` confirms 0/3 ready as of this plan).
- No blockers.

## Self-Check: PASSED

- `test ! -f src/mcp/vice/vice.ts`, `vice.test.ts`, `fork-live.test.ts`, `fork-deleted-tools.ts`, `fork-manifest-surface.test.ts`, `tools-manifest.json`, `refresh-manifest.ts`, `refresh-manifest.test.ts`, `manifest-arg-compat.test.ts`: all exit 0 (absent).
- `test -f src/mcp/vice/tools-manifest.stock.json`: exit 0 (present); `git diff --numstat -- src/mcp/vice/tools-manifest.stock.json`: no output (byte-identical).
- Both commit hashes verified present: `git log --oneline --all | grep -E '1bd2928e|bcc8f6b6'` returns both.
- `npm run typecheck` exits 0 (re-confirmed as the final action before writing this SUMMARY).
- `node scripts/check-skill-tool-coverage.mjs` exits 0; `npm run smoke` exits 0.
- `node scripts/check-npm-packages.mjs` exits 1 with exactly one failure, the documented `files[]` cross-wave coupling.
- `git diff -U0 -- src/mcp/vice/anno-tools.ts | grep non-comment changed lines` -> 0.
- Automated suite failure set: confirmed across five consecutive full runs, each converging on the 7-member floor (minus the documented intermittent `check-skill-fork-honesty`/`check-skill-cli-invocations` member) plus exactly the three documented bounded exceptions, with zero unexplained new members (two transient flakes observed across the runs -- `anno-verb-coverage.test.ts` and `anno-durability.test.ts`'s EVID-05 concurrent-planting test -- each re-confirmed passing in isolation, matching the documented flake pattern).

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
