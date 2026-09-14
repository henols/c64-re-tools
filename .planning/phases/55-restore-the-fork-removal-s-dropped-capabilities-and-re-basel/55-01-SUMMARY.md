---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 01
subsystem: api
tags: [mcp, chunking, result-continuation, vice-proxy, anno-tools]

requires: []
provides:
  - "wrapPossiblyChunked() has a real caller again at the proxy's single tools/call choke point"
  - "vice_result_continue serves real chunks instead of only ever refusing"
  - "anthropic/maxResultSizeChars advertisement and the enforced chunk boundary read the same OUTPUT_CHAR_CAP constant"
affects: [55-02, 55-03]

actuals:
  tokens: 5190
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Result-size enforcement lives at the ONE choke point every tools/call result crosses (the CallToolRequestSchema override), never per-family, so a future tool family gets chunking for free"
    - "Chunking test fixtures seed a real proxy-local anno_* store (seedAnnoWorkspace()) instead of an in-process HTTP stand-in, since the retired fork-forwarding harness is gone and anno_* needs neither emulator nor broker"

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/anno-tools.ts

key-decisions:
  - "Enforcement condition at the choke point: wrap only when isError===false, content.length===1, and that one item is a text item with a string text -- this excludes vice_result_continue's own two-item replies and any future multi-item producer without naming either by tool name"
  - "Rewrote tests use a second, unchunked proxy run of the identical query as the byte-exactness oracle, rather than a hand-written expected string -- extends to both rewritten byte-exactness assertions (recoverable-in-full and cap-stamp-boundary)"
  - "The unknown-token test's dead-harness liveness check (vice_ping over a retired VICE_MCP_URL stand-in, which requires a live broker) was swapped for anno_get_symbols, which is backend-independent and needs no broker"

patterns-established:
  - "seedAnnoWorkspace(labelCount) in vice-proxy.test.ts: seeds a temp workspace's project.annostore with N labels and returns {ws, storePath} for a spawned child's CLAUDE_PROJECT_DIR env -- the spawned-child analogue of anno-tools.test.ts's in-process withStore()"

requirements-completed: [PROXY-01]

coverage:
  - id: D1
    description: "An over-cap tools/call success is split into a payload chunk plus a marker item at the proxy's single choke point, and vice_result_continue serves real chunks for a token the same proxy issued; an at-or-under-cap result and any isError result pass through unchanged"
    requirement: "PROXY-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#an oversized result is recoverable in full across continuations"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#an exhausted continuation token fails loudly"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#an unknown continuation token (never issued by this proxy) fails loudly, not silently or opaquely"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#the _meta cap stamp and the actual chunk boundary never drift apart"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/vice-proxy.test.ts#tools/list declares the same cap it enforces"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-13
status: complete
---

# Phase 55 Plan 01: Restore result chunking at the tools/call choke point Summary

**Restored `wrapPossiblyChunked()`'s only call site at the `CallToolRequestSchema` override, closing the gap where a 23,290-character result crossed a 200-character advertised cap whole and `vice_result_continue` could only ever refuse.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-13T22:09:39Z
- **Completed:** 2026-09-13T22:24:24Z (SUMMARY authoring)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `wrapPossiblyChunked()` (already fully implemented -- split, bounded `CONTINUATION_STORE`, oldest-first eviction) now has a real caller at the `CallToolRequestSchema` override's success branch, the one place every registered tool family's result (manifest-driven stock tools, `vice_recycle`/`vice_diagnose`, the `anno_*` family, and `vice_result_continue` itself) converges before reaching the wire.
- The wrap fires only on a single-item text success (`isError===false`, `content.length===1`, that item's `type==="text"` and `text` a string) -- an error result and `vice_result_continue`'s own two-item replies are never re-wrapped, and no tool is named explicitly in the condition.
- `OUTPUT_CHAR_CAP` remains declared exactly once; the advertised `_meta["anthropic/maxResultSizeChars"]` and the enforced chunk boundary are one read of that constant.
- Rewrote all four chunking tests in `vice-proxy.test.ts` against `anno_get_symbols` over a seeded local store (`seedAnnoWorkspace()`), since the retired HTTP stand-in (`startBigPayloadServer()`, reached through the deleted `forwardToVice()`'s `VICE_MCP_URL`) is no longer on any live dispatch path. The `tools/list declares the same cap it enforces` test was left untouched.
- Corrected two comments left false by the restore: `anno-tools.ts`'s size-cap block no longer claims this family is "never chunked" (it now crosses the same choke point as everything else); `vice-proxy.ts`'s shared-result-shape doc comment no longer names a `handleToolsCall()` that does not exist, naming the `CallToolRequestSchema` override instead.

## Live measurements (MEASURED, this session)

- **Before the fix** (scratch repro, `VICE_MAX_RESULT_CHARS=200`, `anno_get_symbols` against a 300-label seeded store): `isError:false`, **1** content item, **27,788** characters -- reproducing the regression described in the plan (a different label-name length than the plan's own 23,290-character measurement, same defect).
- **After the fix**, same fixture: `isError:false`, **2** content items (200-char chunk + marker naming `vice_result_continue`); the issued token, replayed against `vice_result_continue`, returned a further real 200-char chunk (not the "unknown or has already expired" refusal); the same query with the cap raised past the payload size returned exactly **1** item at the full 27,789 characters.

## Task Commits

1. **Task 1: Wire the cap into the one surviving tools/call choke point, end to end** - `54a4ac54` (fix)
2. **Task 2: Rewrite the four chunking tests against a harness that still exists** - `ef018e23` (test)
3. **Task 3: Correct the two comments that describe chunking as it was, not as it is** - `b40afda5` (docs)

**Plan metadata:** (recorded separately by the orchestrator, per this plan's constraint against committing docs artifacts from this agent)

## Files Created/Modified

- `src/mcp/vice/vice-proxy.ts` - Restored `wrapPossiblyChunked()`'s call site at the `CallToolRequestSchema` override; corrected the `OkTextResult` doc comment's stale `handleToolsCall()` reference.
- `src/mcp/vice/vice-proxy.test.ts` - Rewrote the four chunking tests against `anno_get_symbols`/`seedAnnoWorkspace()`; added the `anno-store.ts` import.
- `src/mcp/vice/anno-tools.ts` - Corrected the size-cap block's now-false "never chunked" claim.

## Decisions Made

- **Enforcement condition** at the choke point derives from the data, not the tool name: `raw.isError === false && raw.content.length === 1 && raw.content[0].type === "text" && typeof raw.content[0].text === "string"`. This single condition keeps `vice_result_continue`'s own two-item replies out of a second wrap without naming that tool, so a future second multi-item producer is covered by the same rule.
- **Byte-exactness without a hardcoded fixture:** both rewritten byte-exactness assertions ("recoverable in full" and "cap stamp/boundary never drift apart") spawn a second proxy against the SAME seeded store with a cap large enough that the identical query never splits, and compare the reassembled chunked sequence against that unchunked run -- a real proof rather than a literal expected string.
- **Label counts calibrated by direct measurement**, not guessed: `seedAnnoWorkspace(30)` (~2,812 chars unchunked) for the cap=1000 tests, `seedAnnoWorkspace(50)` (~4,632 chars) for the CAP=777 test -- chosen so the chunk count is neither 1 (no split) nor an exact multiple of the cap (needed to prove the "not a clean multiple" case), matching the calibration done live before editing the test file.
- **Test 3 harness swap:** the unknown-continuation-token test's post-failure liveness check used to call `vice_ping` through the retired `VICE_MCP_URL` stand-in, which (measured live, pre-fix) now fails without a live broker -- not because of anything this plan changed, but because that stand-in never answered a real dispatch path once fork forwarding was removed. Replaced with `anno_get_symbols`, which is backend-independent by construction and needs neither broker nor host.

## Deviations from Plan

None of Rules 1-4 were triggered by code under this plan's own scope. One out-of-scope, pre-existing discrepancy was found and is documented under Issues Encountered rather than fixed (per the scope-boundary instruction: pre-existing issues in unrelated code are logged, not auto-fixed).

## Issues Encountered

- **Task 3's own automated verify command** (`grep -aEc '\.planning/|/gsd-[a-z]|ROADMAP\.md|REQUIREMENTS\.md' src/mcp/vice/anno-tools.ts src/mcp/vice/vice-proxy.ts`) reports `vice-proxy.ts:1` rather than the `0` its `<fails_when>` clause expects. MEASURED: this single match is a PRE-EXISTING line (`.planning/todos/pending/2026-08-04-proxy-reports-a-live-broker-as-stale-blocking-all-emulator-access.md`, in `brokerControlUnreachableMessage()`'s doc comment, an entirely different subsystem -- broker control-plane connectivity, not chunking) that was already present at this plan's own starting commit (`5688fd75`), confirmed via `git show HEAD~2:src/mcp/vice/vice-proxy.ts` before this plan's first commit. It is unrelated to any of this plan's three tasks and out of this plan's stated file scope beyond the accident of sharing a file. Per the scope-boundary instruction ("only auto-fix issues directly caused by the current task's changes... pre-existing issues in unrelated files are out of scope... do NOT fix them"), it was left as-is rather than fixed. Note the plan's own acceptance criteria for this task uses the narrower word "gained" ("Neither file gained a planning-tree path...") which this plan's changes satisfy (zero NEW planning-vocabulary references were introduced by any of the three commits) even though the blanket `<fails_when>` count-based check does not pass on the whole file. Following the instruction to report a measurement that contradicts the plan rather than silently adjusting either the plan or the code: this is a genuine, reproducible gap between the plan's acceptance-criteria wording and its own verify script, and a follow-up plan should either fix the pre-existing broker-comment reference or narrow the verify script to a diff-based check.
- The full, unfiltered `node --test vice-proxy.test.ts` run (not part of this plan's required verification, which instead names a name-pattern run plus three sibling files) was observed to exceed a 120s window when tried opportunistically; killed rather than waited on, consistent with the execution notes' statement that the whole file is red/slow by design pending a later plan's re-baseline. No stray `x64sc` or orphaned proxy children resulted (`pgrep -c x64sc` = 0 both before and after; the three long-lived `vice-proxy.ts` processes present throughout are Claude Code's own MCP servers, left untouched per the execution notes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The restored chunking capability and its four rewritten tests are ready for whatever plan 55-02/55-03 build on next.
- `docs/stock-hard-losses.md`/`docs/stock-vice-parity.md`-adjacent work is unaffected; this plan touched only the proxy's own result-size enforcement and the annotation-store size-cap documentation.
- The pre-existing, out-of-scope `planningrefs` gap in `vice-proxy.ts` (see Issues Encountered) remains open for a future plan or a direct fix outside this one's scope.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.ts`
- FOUND: `src/mcp/vice/vice-proxy.test.ts`
- FOUND: `src/mcp/vice/anno-tools.ts`
- FOUND: `.planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel/55-01-SUMMARY.md`
- FOUND commit `54a4ac54` (Task 1)
- FOUND commit `ef018e23` (Task 2)
- FOUND commit `b40afda5` (Task 3)

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-13*
