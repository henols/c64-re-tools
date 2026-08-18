---
phase: 07-cycle-timing-and-wedge-triage
plan: 16
subsystem: vice-mcp-stock-backend
tags: [vice-mcp, stock-vice, tools-manifest, backend-aware, wedge-triage, gap-closure]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-14's exact vice_run_until answer field set (machineHalted, raceResolved, reachedUnknown, etc.) and 07-15's machinePausedSource enum plus the diagnosis_unavailable outcome"
provides:
  - "resolveAdvertisedToolDefinition() in stock-dispatch.ts -- the one pure seam deciding whether RECYCLE_TOOL/DIAGNOSE_TOOL advertise vice-proxy.ts's own fork-worded literal or the corrected tools-manifest.stock.json entry, per backend"
  - "vice-proxy.ts's two former unconditional overwrites (tools[RECYCLE_TOOL.name] = ..., tools[DIAGNOSE_TOOL.name] = ...) now backend-aware, closing WR-07"
  - "tools-manifest.stock.json's vice_run_until/vice_diagnose outputSchema entries declare every field 07-14/07-15 actually emit, with reached no longer required and machineHalted/machinePausedSource added"
  - "6 new conformance tests in stock-dispatch.test.ts asserting the ADVERTISED definition, not just the source file, plus a guard that fails a future re-introduced unconditional overwrite"
affects: [07-18-skill-triage-table, vice-wedge-triage skill, any future manifest-schema plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pick-one-whole-definition, never merge: resolveAdvertisedToolDefinition() returns either the synthetic definition or the manifest entry in full, never a field-by-field merge, so description/inputSchema/outputSchema stay internally consistent."
    - "Advertisement-level testing, not source-level: WR-07 passed a source-level guard (stock-diagnose.test.ts's stale_read_path-in-comment-only check) while the SERVED schema was still wrong. The new tests assert on resolveAdvertisedToolDefinition()'s actual return value."

key-files:
  created: []
  modified:
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "The literal string \"stale_read_path\" was removed from tools-manifest.stock.json entirely, including from the vice_diagnose description's own explanatory prose (which named the fork's sixth verdict to contrast against). The plan's own acceptance criteria and top-level <verification> both require grep -c 'stale_read_path' on the manifest to be 0 -- the description now describes the fork's sixth verdict by what it does (a stale-versus-fresh read distinction) rather than by its name, so an agent reading the stock schema can never see the string at all, not even in prose."
  - "The RECYCLE_TOOL/DIAGNOSE_TOOL call sites in vice-proxy.ts stayed single-line (not the plan text's illustrative multi-line form) -- stock-dispatch.test.ts's proxyToolRegistrations() helper parses tools[KEY] = <rest-of-line> per LINE, so a multi-line call broke that structural test (observed failing, then fixed by keeping the assignment on one line, matching the existing manifest-loop registration's own style)."
  - "machinePaused and machinePausedSource were both added to vice_diagnose's outputSchema.required, since diagnoseVerdictResult() (stock-diagnose.ts) emits both unconditionally on every established-verdict answer, confirmed by reading the handler rather than assumed from the summary alone."

patterns-established:
  - "A backend-aware advertised-definition selector lives beside the manifest-path selector it already has (manifestPathForBackend()) in stock-dispatch.ts -- vice-proxy.ts calls into stock-dispatch.ts for both \"which manifest file\" and \"which definition wins\" decisions, never re-deriving either locally."

requirements-completed: [TIME-02, TIME-04]

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase 07 Plan 16: Backend-Aware Advertised Tool Contract (WR-07) Summary

**`vice_diagnose`/`vice_recycle` now advertise the stock manifest's own corrected definition on the stock backend instead of vice-proxy.ts's fork-worded literal, and `tools-manifest.stock.json`'s `outputSchema` entries declare every field 07-14/07-15 actually emit.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-18
- **Tasks:** 3/3 completed
- **Files modified:** 4

## Accomplishments

- **Closed WR-07:** `resolveAdvertisedToolDefinition(syntheticDef, backend, manifestTools)` (stock-dispatch.ts) is now the one seam deciding which definition `vice-proxy.ts`'s two synthetic tools advertise. On the fork it always returns the synthetic (fork-worded) definition unchanged; on stock it returns the matching `tools-manifest.stock.json` entry, falling back to the synthetic definition only when the manifest has no match (the malformed/unreadable-manifest case `readManifestTools()` already handles by returning `[]`). `vice-proxy.ts`'s two former unconditional overwrites (`tools[RECYCLE_TOOL.name] = ...` / `tools[DIAGNOSE_TOOL.name] = ...`) now call it, and the manifest array (`readManifestTools()`) is read once and reused for the loop and both synthetic registrations rather than re-read per registration.
- **Closed the Gap 2/Gap 3 manifest deltas:** `vice_run_until`'s `outputSchema` gains `machineHalted`, `machineHaltedNote`, `raceResolved` (enum `pc_at_address`/`pc_elsewhere`/`unresolved`), `pcAtCleanup`, `reachedUnknown`, `pcReadError`, `raceNote`, and `cleanupError`; `reached` left `required` (07-14's honest "unresolved" shape omits it entirely) and `machineHalted` joined `required` since it is emitted unconditionally. `vice_diagnose`'s `outputSchema` gains `machinePausedSource` (enum `no_session`/`observed`/`structural`), added to `required` alongside `machinePaused` since `diagnoseVerdictResult()` emits both unconditionally.
- **The literal string `stale_read_path` was removed from the manifest entirely** (not just from the verdict enum, which never had it) — the `vice_diagnose` description's own explanatory prose was rewritten to describe the fork's sixth verdict by behaviour rather than by name, satisfying the plan's explicit `grep -c 'stale_read_path' ... is 0` requirement.
- **6 new conformance tests** in `stock-dispatch.test.ts` assert on the ADVERTISED definition — what `resolveAdvertisedToolDefinition()` actually returns — rather than on the source file, which is precisely the level WR-07's original defect passed at. A guard test ties every `PROXY_LOCAL_TOOLS` name to its own stock manifest entry so a future re-introduced unconditional overwrite fails a test, not just a live agent reading the wrong schema.
- **Verified the guard is load-bearing empirically**, per the plan's own acceptance criterion: temporarily forced `resolveAdvertisedToolDefinition()` to always return the synthetic definition (simulating the original WR-07 bug), observed 4 of the 6 new tests fail with the expected assertions, then reverted (confirmed via `diff` against the committed file showing no difference) and re-ran the full suite green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add resolveAdvertisedToolDefinition() to stock-dispatch.ts and use it at the two overwrite sites** - `25c2c60` (fix)
2. **Task 2: Bring tools-manifest.stock.json's outputSchemas in line with what the handlers now emit** - `a08802c` (feat)
3. **Task 3: Assert the advertised stock contract, not just the source file** - `53976e9` (test)

_No separate plan-metadata commit — this SUMMARY.md is committed by the worktree executor's final commit step._

## Files Created/Modified

- `.claude/mcp/vice/stock-dispatch.ts` — Added `resolveAdvertisedToolDefinition(syntheticDef, backend, manifestTools)`, declared as a `function` (not `const`) per this module tree's own cycle-safety rule. Imports `type ToolInfo` from `vice.ts` (type-only, erased at compile time, no runtime cycle).
- `.claude/mcp/vice/vice-proxy.ts` — Hoisted `readManifestTools()`'s return into a local `manifestTools`, reused by the manifest loop and both synthetic registrations. `RECYCLE_TOOL`/`DIAGNOSE_TOOL` registration calls `stockDispatch.resolveAdvertisedToolDefinition(...)` instead of passing the literal constant directly. Both call sites kept single-line to satisfy `stock-dispatch.test.ts`'s per-line structural parser.
- `.claude/mcp/vice/tools-manifest.stock.json` — `vice_run_until` and `vice_diagnose` `outputSchema`/`description` entries updated per the field table below; `vice_recycle` confirmed unchanged (D-01's no-screenshot note and record-before-RPC ordering statement were already present).
- `.claude/mcp/vice/stock-dispatch.test.ts` — 6 new tests under a `WR-07/resolveAdvertisedToolDefinition` heading, plus two minimal fork-worded synthetic stand-ins (`FORK_WORDED_DIAGNOSE_STANDIN`, `FORK_WORDED_RECYCLE_STANDIN`) constructed locally rather than imported, so the tests prove the selection rather than assuming vice-proxy.ts's real literals still carry the fork's wording.

## Final outputSchema Deltas

**`vice_run_until`** — added to `properties`: `machineHalted` (boolean), `machineHaltedNote` (string), `raceResolved` (string, enum `["pc_at_address","pc_elsewhere","unresolved"]`), `pcAtCleanup` (number), `reachedUnknown` (boolean), `pcReadError` (string), `raceNote` (string), `cleanupError` (string, previously undeclared despite being emitted on the `delete_failed` cleanup path). `required` changed from `["requested","reached","address","timeoutMs","runState"]` to `["requested","address","timeoutMs","runState","machineHalted"]` — `reached` dropped (the honest "unresolved" race path omits it by design), `machineHalted` added (emitted unconditionally on every non-error answer).

**`vice_diagnose`** — added to `properties`: `machinePausedSource` (string, enum `["no_session","observed","structural"]`). `required` changed from `["verdict","report","runState"]` to `["verdict","report","runState","machinePaused","machinePausedSource"]` — both added since `deriveMachinePaused()`/`diagnoseVerdictResult()` (stock-diagnose.ts) emit them unconditionally on every established verdict. `verdict.enum` confirmed unchanged at exactly D-03's five values in order: `restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`. Description extended to name the five verdicts, explain `machinePausedSource`'s three values, and describe the `diagnosis_unavailable` non-verdict outcome (7 reason classes, message-prefix format, anti-escalation wording) — without ever naming `stale_read_path` literally, and without adding `diagnosis_unavailable` to the `verdict` enum itself.

**`vice_recycle`** — no change. Already carried D-01's "no screenshot is captured" note and the "written to a permanent, repo-tracked incident record BEFORE anything is killed" ordering statement.

## check-skill-tool-coverage.mjs Output

Ran from the repo root per Task 3's instruction (report, do not fix):

```
check-skill-tool-coverage: OK -- 35 distinct vice_* names extracted from 30 files across 6 skill directories; 27 resolved as advertised on the stock manifest (38 tools total). Classified: 2 proxy-local, 1 deny-listed, 2 not-a-tool-name, 3 fork-only-unrecoverable, 0 pending-later-phase.
```

**Exit code 0 — the script passed**, so this plan's changes did not trip WR-08. Note for the record: the script's own `PROXY_LOCAL_TOOLS` reason strings for `vice_diagnose`/`vice_recycle` still read "present in neither manifest by design" — this was **already false before this plan touched anything**, since both names have always had an entry in `tools-manifest.stock.json` (the WR-07 defect this plan closes was that the entry existed but was never SERVED, not that it was absent). This plan's changes make that entry reach `tools/list`, which does not change whether the string is true or false — it was stale at Phase 2/07-09 and remains stale now. Per the plan's explicit instruction, this is recorded as evidence, not reclassified — WR-08 is out of scope for this gap-closure batch.

## Decisions Made

- **`stale_read_path` removed from the manifest entirely, including from prose.** The plan's acceptance criteria and top-level `<verification>` both require `grep -c 'stale_read_path' tools-manifest.stock.json` to be `0`. The pre-existing `vice_diagnose` description explained the fork's sixth verdict by name (`"The fork's sixth verdict, stale_read_path, is absent on stock..."`), which would have kept the count at 1. Rewrote that clause to describe the verdict's behaviour (a stale-versus-fresh read distinction) instead of naming it, satisfying the criterion without losing the explanation.
- **Single-line call sites, not the plan text's illustrative multi-line form.** Initially wrote the two `tools[...]` assignments across three lines each (function call with newline-separated arguments); `stock-dispatch.test.ts`'s `proxyToolRegistrations()` parses `tools[KEY] = <rest-of-line>` per source LINE, so the multi-line form broke `"structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware"` (it saw `buildBackendAwareTool(` on the first line with no `handleRecycle(`/`handleDiagnose(` on that same line). Reformatted to single lines, matching the existing manifest-loop registration's own style; all 126 tests then passed.
- **`machinePaused` added to `required` alongside `machinePausedSource`.** The plan's action text made this conditional ("if 07-15 emits both unconditionally (check the code)"). Read `diagnoseVerdictResult()` directly: it destructures both from `deriveMachinePaused()` and includes both in `payload` unconditionally on every call, so both belong in `required`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Multi-line call-site format broke a structural test's per-line parser**
- **Found during:** Task 1, immediately after the first `tsc`/test run
- **Issue:** `stock-dispatch.test.ts`'s `proxyToolRegistrations()` regex-matches `tools[KEY] = <rest of the SAME line>`. Writing the two backend-aware registrations as multi-line function calls (arguments on their own lines) meant the captured "rest of line" for each was just `buildBackendAwareTool(` with no `handleRecycle(`/`handleDiagnose(` present — failing `"structure/proxy (CR-07): handleDiagnose and handleRecycle are each referenced by exactly one registration, and it is backend-aware"`.
- **Fix:** Reformatted both `tools[RECYCLE_TOOL.name] = ...` / `tools[DIAGNOSE_TOOL.name] = ...` assignments onto single lines.
- **Files modified:** `.claude/mcp/vice/vice-proxy.ts`
- **Verification:** `node --test stock-dispatch.test.ts load-order.test.ts` — 126/126 pass (was 125/126 with the multi-line form).
- **Committed in:** `25c2c60` (Task 1 commit — caught and fixed before that commit was made, so the committed history shows only the correct form)

**2. [Rule 1 - Bug] `stale_read_path` present in manifest prose, contradicting the plan's own explicit `grep -c ... is 0` acceptance criterion**
- **Found during:** Task 2, running the acceptance-criteria greps after the initial edit
- **Issue:** The pre-existing `vice_diagnose` description named the fork's sixth verdict literally (`stale_read_path`) to explain its absence on stock. The plan's Task 2 acceptance criteria and top-level `<verification>` both require the manifest file to contain the string zero times, which the description's own explanatory clause violated.
- **Fix:** Rewrote the clause to describe the verdict's behaviour instead of its name: `"The fork's sixth verdict, naming a stale-versus-fresh read distinction, is absent on stock..."`.
- **Files modified:** `.claude/mcp/vice/tools-manifest.stock.json`
- **Verification:** `grep -c 'stale_read_path' tools-manifest.stock.json` → `0`; `node --test stock-dispatch.test.ts` still 119/119 (later 125/125 after Task 3's additions).
- **Committed in:** `a08802c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed, both Rule 1 (bugs caught by the plan's own acceptance criteria/tests before the affected commit was made — neither shipped in the committed history).
**Impact on plan:** None — both are exactly the kind of self-correction the plan's own verification steps are designed to catch, fixed within the same task before its commit.

## Issues Encountered

- `node_modules` was absent at worktree start (never committed, per `CLAUDE.md`'s "Tech stack" note) — ran `npm ci --no-audit --no-fund` in `.claude/mcp/vice` to provision the already-locked dependencies from the committed `package-lock.json` before any typecheck/test could run. This is restoring pinned, already-vetted dependencies from a committed lockfile (the project's own documented `SessionStart` provisioning step), not a new/unvetted package install, so it does not trigger the package-install checkpoint.
- The worktree agent forked from a stale base — corrected via the mandatory `<worktree_branch_check>` `git reset --hard` to `04f8cc02ea953e39ddb384974129bf05494ba7da` (the wave-1-merged base containing 07-11/07-12/07-14/07-15) before any file edits, per this project's known recurring worktree-fork issue (user memory `worktree-agents-fork-stale-base.md`).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 07-18 (skill triage table) can now rely on `vice-wedge-triage/SKILL.md`'s own claim — "Read the tool's own schema for the exact contract on whichever backend is active" — actually being true on the stock backend: `tools/list` now serves the corrected manifest entry, not the fork's literal text.
- No further manifest-schema work is queued from 07-14/07-15's handoff notes; both plans' full field sets are now declared.
- `WR-08` (the `check-skill-tool-coverage.mjs` stale `PROXY_LOCAL_TOOLS` reason-string classification) remains open, unreclassified, exactly as this plan's own scope boundary requires. Evidence is recorded above for whichever future plan picks it up.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*
