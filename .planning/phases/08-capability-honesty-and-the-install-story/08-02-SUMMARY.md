---
phase: 08-capability-honesty-and-the-install-story
plan: 02
subsystem: mcp-server
tags: [typescript, node-test, vice-proxy, capability-registry, backend-detect, deny-list-ordering]

# Dependency graph
requires: ["08-01"]
provides:
  - "vice-proxy.ts's CallToolRequestSchema override renders a capability refusal (naming tool, reason, providing backend) on a tools[name] miss, strictly after DENY_LIST, before the generic Unknown-tool fallback (BACK-05 runtime wiring)"
  - "vice-proxy.test.ts: 4 new BACK-05 end-to-end tests proving both refusal directions, the surviving typo fallback, and the D-G ordering invariant observed at the wire"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layer 3 refusal: capabilityRefusalMessage(name, ACTIVE_BACKEND.backend) called only inside the pre-existing tools[name] miss branch, strictly after the pre-existing DENY_LIST check -- same shape as vice.ts's own DENY_LIST/denyListRefusalMessage() sibling pattern, now a third consumer"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/vice-proxy.test.ts

key-decisions:
  - "Comment above the new call site says 'this lookup' rather than repeating the literal identifier 'capabilityRefusalMessage', keeping grep -c 'capabilityRefusalMessage' at exactly 2 (one import, one call site) per the plan's own acceptance criterion"
  - "Task 2 test 4 (D-G ordering) is unaffected by a transient revert of Task 1's edit -- documented as a finding, not treated as a defect, since it exercises DENY_LIST's pre-existing construction-time skip and the synthetic vice_diagnose/vice_recycle registration, neither of which the new capability lookup touches"

requirements-completed: [BACK-05]

# Metrics
duration: 15min
completed: 2026-08-18
---

# Phase 8 Plan 02: Capability Refusal Runtime Wiring Summary

**`vice-proxy.ts`'s `CallToolRequestSchema` override now renders `capability-registry.ts`'s per-backend refusal on a manifest miss instead of the generic `Unknown tool` fallback, live-verified end to end against a real spawned proxy under `VICE_BACKEND=stock`, with the `DENY_LIST` ordering invariant re-proven both in source order and at the wire.**

## Performance

- **Duration:** ~15 min (22:07 base -> 22:21 final commit)
- **Started:** 2026-08-18T22:07:12+02:00 (base commit)
- **Completed:** 2026-08-18T22:21:31+02:00 (final task commit)
- **Tasks:** 2
- **Files modified:** 2 (both edited, none created)

## Accomplishments

- The confirmed-live bug (`VICE_BACKEND=stock` calling `vice_sid_get_state` returned `{"content":[{"type":"text","text":"Unknown tool: vice_sid_get_state"}],"isError":true}`) is fixed: it now returns the capability refusal naming the tool, "unrecoverable", and `VICE_BACKEND=fork`.
- The reverse direction works: the fork backend refuses `vice_execution_until_return` by name and `VICE_BACKEND=stock`.
- A genuine typo (`vice_totally_made_up_xyz`) still gets the byte-identical generic `Unknown tool: <name>` fallback.
- The `DENY_LIST` ordering invariant (`D-G`) is pinned twice, independently: a source-offset assertion (`DENY_LIST.includes(name)` byte offset < `capabilityRefusalMessage(name` offset < `` `Unknown tool: ${name}` `` offset) and a wire-level test (`tools_call` carrying a nested `vice_disk_list` bypass attempt still gets the deny-list refusal, never a capability refusal; `vice_diagnose` is never refused either way).
- Transient revert of Task 1's edit empirically fails tests 1 and 2 (back to `Unknown tool: ...`) while tests 3 and 4 stay green -- proving tests 1/2 genuinely depend on the new code, and clarifying (see Deviations) that test 4 depends on pre-existing structure, not the new lookup.

## Task Commits

Each task was committed atomically:

1. **Task 1: Insert the capability lookup on the tools[name] miss branch, after DENY_LIST** - `262d9ee` (feat)
2. **Task 2: End-to-end and ordering tests in vice-proxy.test.ts** - `ec346d8` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/vice-proxy.ts` - imported `capabilityRefusalMessage` from `./capability-registry.ts`; added the Layer 3 lookup inside the `tools[name]` miss branch, strictly after the pre-existing `DENY_LIST` check, falling through to the unchanged generic fallback when the lookup returns `undefined`.
- `.claude/mcp/vice/vice-proxy.test.ts` - four new `BACK-05` tests (stock refusal, fork refusal, typo survival, D-G ordering at the wire), each spawning a real `vice-proxy.ts` subprocess with `VICE_BACKEND=stock`/`fork` (no emulator needed).

## Before/After: `vice_sid_get_state` on stock (verbatim JSON)

**Before (base commit, `VICE_BACKEND=stock`):**
```json
{
  "result": {
    "content": [{ "type": "text", "text": "Unknown tool: vice_sid_get_state" }],
    "isError": true
  },
  "jsonrpc": "2.0",
  "id": 3
}
```

**After (this plan's Task 1 commit):**
```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "vice_sid_get_state is unrecoverable on the stock backend: SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes no SID read command. Use the fork backend instead (Set VICE_BACKEND=fork)."
      }
    ],
    "isError": true
  },
  "jsonrpc": "2.0",
  "id": 3
}
```

## Re-verified Line Numbers

At plan start (base commit `eaa49b5`), before any edit in this plan:
- `CallToolRequestSchema` override: line 3219 (matched plan's cited range exactly)
- `DENY_LIST.includes(name)` check: line 3227
- `tools[name]` miss branch (`const tool = tools[name]`): line 3254
- Generic `Unknown tool: ${name}` fallback: line 3256
- `CLAUDE.md`'s cited `rewriteArguments()` sites: **exact match, no pre-existing drift** -- confirmed at `vice-proxy.ts:2889` (inside `forwardToVice()`) and `:1368` (`gatherWedgeEvidence()`).

After this plan's own edits (current HEAD):
- `CallToolRequestSchema` override: line 3224 (+5, from this plan's own 5-line import addition earlier in the file)
- `DENY_LIST.includes(name)` check: line 3232 (+5)
- `tools[name]` miss branch: line 3259 (+5)
- Generic `Unknown tool: ${name}` fallback: line 3274 (+18, from Task 1's new lookup block inserted between the miss branch and the fallback)
- `rewriteArguments()` call sites: now at `2894` and `1373` (+5 each) -- this drift is caused entirely by this plan's own import addition, not a pre-existing discrepancy discovered independently of this plan's work. Recorded here per the plan's own instruction to re-verify and log drift at each phase.

## Transient-Revert Proof (Task 2 acceptance criterion)

Reverted Task 1's edit in `vice-proxy.ts` (restored to base-commit content), re-ran `node --test --test-name-pattern="BACK-05" vice-proxy.test.ts`:

- **Test 1** (stock refuses `vice_sid_get_state`) -- **FAILED** as expected: `actual: 'Unknown tool: vice_sid_get_state'`, assertion `/unrecoverable/` did not match.
- **Test 2** (fork refuses `vice_execution_until_return`) -- **FAILED** as expected: `actual: 'Unknown tool: vice_execution_until_return'`, assertion `/VICE_BACKEND=stock/` did not match.
- **Test 3** (typo fallback) -- stayed green, as expected (this path was never touched).
- **Test 4** (D-G ordering) -- **stayed green**, which the plan's own acceptance criteria did not predict (it expected 1, 2, and 4 to fail). See Deviations below for why this is correct behaviour, not a defect.

Restored Task 1's edit immediately after capture; `git diff --stat` against the committed content showed zero diff before proceeding.

## Transitive-Closure Module Count

`node scripts/check-npm-packages.mjs`:
- **Before this plan's edit** (base commit content, transient checkout+restore): `41 modules, clean`
- **After Task 1's edit** (current HEAD): `42 modules, clean` -- exactly one more, from the new `capability-registry.ts` import, as expected.

## Decisions Made

- Worded the new call site's comment to avoid literally repeating the identifier `capabilityRefusalMessage` a third time in prose, so `grep -c 'capabilityRefusalMessage' vice-proxy.ts` stays at exactly 2 (import + call site) rather than being inflated by an incidental comment match -- matching the plan's own acceptance criterion precisely.
- Left the pre-existing `grep -c 'DENY_LIST.includes(name)'` count at 2 (one real check at the call site, one comment mentioning the same substring at line 2617, both present in the base commit before this plan touched anything) rather than editing that unrelated comment -- out of this plan's scope per the Scope Boundary rule; the plan's own acceptance criterion assumed a clean base file that, empirically, already had this comment-based inflation before this plan started.

## Deviations from Plan

### Finding, not a defect: Task 2 test 4 does not red on a Task 1 revert

The plan's Task 2 acceptance criteria stated: "Reverting Task 1's edit in `vice-proxy.ts` makes tests 1, 2 and 4's negative assertion fail while test 3 still passes." Empirically, only tests 1 and 2 fail on revert; test 4 stays green regardless of Task 1's presence.

**Why:** Test 4's two assertions are:
1. A nested `tools_call` bypass attempt gets the `DENY_LIST` refusal, never a capability refusal. `tools_call` is filtered out of `tools` entirely at construction time (`if (DENY_LIST.includes(def.name)) continue;`) and refused at Layer 1 (the `DENY_LIST.includes(name)` check), which runs unconditionally regardless of whether Task 1's lookup exists at all -- the call never reaches the `tools[name]` miss branch Task 1 touches.
2. `vice_diagnose` is registered on **both** backends via synthetic registration (`buildBackendAwareTool`/`resolveAdvertisedToolDefinition`), so `tools["vice_diagnose"]` always exists and the call always reaches its real handler -- again never touching the branch Task 1 edits.

Both assertions in test 4 are therefore genuinely independent of Task 1's capability lookup by design -- which is itself a *stronger* proof of the D-G ordering invariant than the plan anticipated: the deny-list-wins property holds structurally (construction-time filtering + Layer-1 ordering), not merely because Task 1 happened to be placed correctly. Test 4 is retained unchanged since it correctly proves what its own `<action>` text describes (the D-G invariant observed at the wire); the plan's acceptance-criteria prose describing the revert's expected blast radius is what had drifted from the actual dependency graph, not the test itself. No code or test change was made in response to this finding -- documented per the "genuinely unsure -> ask/record" guidance rather than silently reconciled.

### Auto-fixed: comment wording to hit the exact grep-count acceptance criterion

**[Rule 3 - blocking issue]** The first draft of Task 1's new comment mentioned the literal identifier `capabilityRefusalMessage()` in prose, which pushed `grep -c 'capabilityRefusalMessage' vice-proxy.ts` to 3 instead of the plan's specified exactly-2. Reworded the comment to say "this lookup" instead, restoring the count to 2 without changing any code behaviour. Verified by re-running the grep and the source-ordering `node -e` check, both green.

## Issues Encountered

`node test-gate.mjs`'s full automated run reports 1 pre-existing failure (`repo-root.test.ts`'s "the agreed directory must not sit under .claude" check) -- the same worktree-path-caused, out-of-scope failure already documented in `08-01-SUMMARY.md` and `deferred-items.md`. Confirmed unrelated: neither file touched by this plan overlaps with `repo-root.test.ts`, and this plan's per-file checks (`vice-proxy.test.ts` full run: 115 pass / 0 fail / 4 skip; `capability-registry.test.ts`: 9/9 pass) are clean in isolation. Not auto-fixed, per the parallel-execution instructions for this wave explicitly calling out this exact failure as already triaged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

BACK-05's runtime wiring is now live and end-to-end tested. Plan 08-03 (generated support table) and plan 08-04 (skill-text lint) both consume `capability-registry.ts` directly (per 08-01's own readiness note) and are unaffected by this plan's `vice-proxy.ts`/`vice-proxy.test.ts` edits -- no file overlap. No blockers.

---
*Phase: 08-capability-honesty-and-the-install-story*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/vice-proxy.ts`
- FOUND: `.claude/mcp/vice/vice-proxy.test.ts`
- FOUND: `.planning/phases/08-capability-honesty-and-the-install-story/08-02-SUMMARY.md`
- FOUND commit `262d9ee` (Task 1: feat)
- FOUND commit `ec346d8` (Task 2: test)
- FOUND commit `b004941` (docs: SUMMARY)
