---
phase: 03-direct-tools
plan: 13
subsystem: api
tags: [typescript, json-schema, stock-vice, mcp, manifest, dispatch, conformance-testing]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-12's STOCK_DISPATCH_TABLE (25 entries), withStockSession() adapter, and stock-schema-check.ts's checkAgainstSchema() outputSchema checker -- this plan's own manifest entries are the last piece 03-12 left as an explicit handoff"
provides:
  - "tools-manifest.stock.json: 25 entries (up from 1), each with an inputSchema whose required arguments are fork-verbatim (D-03) and an outputSchema inside checkAgainstSchema()'s supported subset, every one requiring a runState enum of running/stopped/unknown (D-06)"
  - "The D-02 answer-conformance harness in stock-dispatch.test.ts: every one of the 25 tools dispatched through the real dispatchStock() path against a stubbed session, its actual answer validated against its own declared outputSchema, with a completeness guard and a negative control"
  - "The four assertions plan 03-12 documented as failing-by-design (D-03 name coverage, bidirectional table/manifest agreement, D-02 outputSchema presence, D-06 runState enum) now pass, with no further stock-dispatch.ts changes"
affects: [phase-04-derived-tools, phase-08-parity-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "conformanceTest(toolName, run) -- a thin wrapper around node:test's test() that ALSO records the tool name into a shared registry, so a completeness guard (case list vs. manifest name list) can never drift from what actually got registered, regardless of test execution order"
    - "A synthetic StockConnectSession + StockDispatchDeps builder (buildConformanceSession/buildConformanceDeps) that dispatches through dispatchStock() itself rather than calling a family handler directly -- exercising ensureStockSession(), withStockSession(), and stockAnswer() end-to-end per case, with a unique targetId per case so no case's held session bleeds into another's"
    - "Pre-emitting a synthetic stopped/resumed event on a freshly-attached run-state tracker (attachRunStateTracker() called by the test itself, idempotently, before ensureStockSession()'s own later call) to give a conformance case a KNOWN runState without touching stock-runstate.ts's own no-setter invariant"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "vice_checkpoint_add's outputSchema nests operation as {value, flags, defaulted} (matching the ACTUAL handleCheckpointAdd() payload shape) rather than the plan text's separately-named 'operationNames' field, which no handler in this tree ever emits -- read the code, not the plan's abbreviated description, per this task's own read_first instruction"
  - "D-09: vice_checkpoint_set_condition's condition inputSchema property deliberately omits \"type\" (the fork types it as a bare string; stock accepts EITHER a string OR a structured condition object, which the checker's subset cannot express as a union) -- the pre-existing D-03 input-compatibility test (from 03-12) hard-asserted type equality for every fork/stock property pair with no exemption mechanism, so a single named TYPE_CHECK_EXEMPT_PROPERTIES set was added to that test rather than weakening its general rule"
  - "Fixed the pre-existing (03-12) outputSchema well-formedness test's synthetic-instance builder to recurse into nested object properties -- its original single-level placeholderFor(type) built an empty {} for vice_checkpoint_add's nested operation field, which trips that field's OWN required check (value/flags/defaulted) the moment a manifest entry nests a required object one level deep, which none did before this plan"
  - "vice_snapshot_load's outputSchema requires programCounter and metadata (not optional, per the plan's own text) because handleSnapshotLoad() ALWAYS sets both keys (defaulting to null), never omitting them -- matching the plan's own read_first instruction to read the handler's actual stockAnswer() payload rather than infer from prose"

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-08-14
---

# Phase 3 Plan 13: Stock Manifest Entries and the D-02 Conformance Harness Summary

**Wrote all 24 new `tools-manifest.stock.json` entries plus `vice_ping`'s retrofitted `outputSchema` (25 total), then closed D-02's contract with a harness that dispatches every one of those 25 tools through the real `dispatchStock()` path against a stubbed session and validates each real answer against its own declared schema -- turning plan 03-12's four documented handoff failures green with no weakening of any assertion.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-14 (worktree spawn + context load)
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 2 (`tools-manifest.stock.json`, `stock-dispatch.test.ts`)

## Accomplishments

- `tools-manifest.stock.json` grew from 1 entry (`vice_ping`, no `outputSchema`) to 25: `vice_ping` (retrofitted with an `outputSchema`), three memory tools, three register tools (one stock-only), six checkpoint/watchpoint tools, four execution tools (one stock-only), five machine tools, three input tools -- every entry's `inputSchema` required-argument set matches its fork counterpart exactly (D-03), every stock-only addition is optional, and every `outputSchema` stays inside `checkAgainstSchema()`'s supported keyword subset with a required `runState` enum of `["running","stopped","unknown"]` (D-06).
- The four assertions plan 03-12 explicitly recorded as failing-by-design now pass: D-03 name coverage, bidirectional table/manifest agreement, D-02 outputSchema presence, and D-06 runState enum -- with zero further changes needed to `stock-dispatch.ts` itself, exactly as 03-12's handoff predicted.
- Two OTHER pre-existing `stock-dispatch.test.ts` assertions (both added by 03-12, both trivially passing before this plan because the stock manifest had only one entry) started failing the moment this plan's 24 new entries gave them real cases to check, and both needed a real fix rather than a workaround:
  - The D-03 input-compatibility test hard-asserted `stockProp.type === forkProp.type` for every shared property with no exemption path, but `vice_checkpoint_set_condition`'s `condition` property deliberately has no `"type"` at all (D-09: it accepts a string OR a structured object, which the checker cannot express as a union). Fixed by adding a single, named, commented `TYPE_CHECK_EXEMPT_PROPERTIES` set to the test -- not by loosening the general rule.
  - The outputSchema well-formedness test's synthetic-instance builder was single-level (`placeholderFor(type)` for each top-level property), which produced an empty `{}` for `vice_checkpoint_add`'s nested `operation` object -- the first manifest entry in this tree to nest a `required` object one level deep. Fixed by making the synthetic-instance builder recurse into nested object schemas.
- The D-02 answer-conformance harness (Task 3): 25 `conformanceTest()` cases, each dispatching through the REAL `dispatchStock()` path (never a family handler called directly) against a from-scratch `StockConnectSession`/`StockDispatchDeps` pair, asserting the real answer both validates against its own manifest `outputSchema` AND carries a valid `runState` independently of the schema. A completeness guard asserts the case-name set equals the manifest's own tool-name set exactly; a negative control proves `checkAgainstSchema()` genuinely rejects a bad answer (an empty instance against `vice_ping`'s schema) rather than vacuously passing.
- `vice_checkpoint_list`'s conformance case supplies a non-empty `related[]` array (one `checkpoint_info` frame) so the N+1 accumulation path is exercised, per this plan's own Task 3 action text. The two execution-control steppers plus pause/run pre-emit a synthetic `stopped`/`resumed` wire event on a freshly-attached run-state tracker so their `runState` is never `"unknown"` mid-test (D-07's stepping gate would otherwise refuse).

## Task Commits

Each task was committed atomically:

1. **Task 1: Manifest entries for memory, registers and execution** - `497d85c` (feat)
2. **Task 2: Manifest entries for checkpoints, machine, snapshots and input** - `a8fb65f` (feat)
3. **Task 3: The per-handler answer-conformance harness** - `2322d6f` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/tools-manifest.stock.json` - grew from 1 to 25 entries; every entry now carries an `outputSchema` with a required `runState` enum; hand-maintained, no generator (unlike the fork manifest, which `refresh-manifest.ts` regenerates from a live server)
- `.claude/mcp/vice/stock-dispatch.test.ts` - Task 2 added a named `TYPE_CHECK_EXEMPT_PROPERTIES` exemption to the pre-existing D-03 input-compatibility test (D-09) and fixed the pre-existing outputSchema well-formedness test's synthetic-instance builder to recurse into nested object schemas; Task 3 added the full D-02 conformance harness (`buildConformanceSession`/`buildConformanceDeps`/`conformanceTest`, 25 cases, a completeness guard, and a negative control)

## Decisions Made

- `vice_checkpoint_add`'s `outputSchema` nests `operation` as `{value, flags, defaulted}` -- matching `handleCheckpointAdd()`'s actual payload shape exactly -- rather than the plan text's separately-named `operationNames` field, which no handler in this tree emits. This task's own `read_first` instruction says to read the handler code, not infer the schema from the plan's abbreviated description; the plan text and the code disagree here, and the code wins.
- `vice_checkpoint_set_condition`'s `condition` inputSchema property is the one property in this manifest that deliberately omits `"type"` (D-09): the fork types it as a bare string, stock accepts either a string or a structured condition object, and the checker's supported subset has no union keyword to express that. The pre-existing D-03 input-compatibility test (added by 03-12) had no exemption mechanism for this, so a small named `TYPE_CHECK_EXEMPT_PROPERTIES` set was added to that test with a comment naming exactly why -- the general type-equality rule is unchanged for every other property.
- The outputSchema well-formedness test's synthetic-instance builder (also pre-existing, from 03-12) was fixed to recurse into nested object schemas rather than building a shallow `{}` placeholder -- necessary the moment a manifest entry (this plan's `vice_checkpoint_add`) nests a `required` object one level deep, which none did before.
- `vice_snapshot_load`'s `outputSchema` requires `programCounter` and `metadata` (not optional) because `handleSnapshotLoad()` always sets both keys, defaulting to `null` rather than omitting them -- the plan's own prose said "optional", but the actual handler code (which this task's `read_first` instruction says to trust) always includes them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-03 input compatibility test had no exemption path for D-09's deliberate type omission**
- **Found during:** Task 2, running `node --test stock-dispatch.test.ts` after adding the checkpoint/machine/input entries
- **Issue:** `manifest/backend (D-03 input compatibility)` (a pre-existing test from plan 03-12) asserted `stockProp.type === forkProp.type` for every shared inputSchema property with no way to except a specific, intentional divergence. `vice_checkpoint_set_condition.condition` deliberately has no `"type"` per this plan's own Task 2 design (D-09), so the assertion failed the moment a real entry existed to exercise it (previously trivially passing against zero real cases).
- **Fix:** Added a single named `TYPE_CHECK_EXEMPT_PROPERTIES` set (`"vice_checkpoint_set_condition.condition"`) with a comment naming D-09 and stating that any future addition needs the same justification -- not a blanket loosening of the type-equality rule.
- **Files modified:** `.claude/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` -- 67/67 passing after this fix (up from 65/67).
- **Committed in:** `a8fb65f` (Task 2 commit)

**2. [Rule 1 - Bug] outputSchema well-formedness test's synthetic-instance builder was single-level, tripping a nested required check**
- **Found during:** Task 2, same test run
- **Issue:** `manifest/backend: every outputSchema itself uses only checkAgainstSchema's supported keyword subset` (also pre-existing, from 03-12) built a flat placeholder object (`placeholderFor(propSchema.type)` per top-level property, with no recursion). `vice_checkpoint_add`'s `operation` property is `{type: "object", properties: {value, flags, defaulted}, required: [...]}` -- the first manifest entry in this tree to nest a `required` object one level deep -- so the flat placeholder built an empty `{}` for it, which failed `operation`'s own nested `required` check.
- **Fix:** Replaced the single-level placeholder with a recursive `buildSyntheticInstance()` that walks nested `object` schemas' own `properties` (and leaves arrays empty, since `checkAgainstSchema()`'s `items` check never fails against an empty array).
- **Files modified:** `.claude/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` -- all 67 tests passing, including this one, for every one of the 25 manifest entries' outputSchemas.
- **Committed in:** `a8fb65f` (Task 2 commit)

### Documented, Not Fixed (plan-text/acceptance-criteria discrepancy)

**3. `vice_memory_read`'s literal `"sideEffects"` grep count is 3, not the plan's stated 1**
- **Found during:** Task 1, verifying acceptance criteria
- **Issue:** The plan's Task 1 acceptance bullet expects `grep -c '"sideEffects"' tools-manifest.stock.json` to return 1, but the plan's own action text separately specifies that `vice_memory_read`'s `outputSchema` ALSO names `sideEffects` (matching the real handler's payload, which always includes it) -- so the property name legitimately appears on three lines: the `inputSchema` property, the `outputSchema` property, and the `outputSchema`'s `required` array. This is the same class of drafting imprecision 03-02/03-10/03-12's own summaries already documented for analogous literal `grep -c` acceptance criteria that did not anticipate a property appearing in more than one place by design.
- **Disposition:** Not fixed -- the semantic requirement ("`sideEffects` is optional on the input side, never in the input's own `required` array") is met and independently verified; the literal count includes the `outputSchema`'s own legitimate, plan-specified mentions of the same property name.
- **Files affected:** `.claude/mcp/vice/tools-manifest.stock.json` (no changes made in response to this item)

---

**Total deviations:** 3 (2 Rule 1 auto-fixes in pre-existing test infrastructure this plan's own manifest entries exposed for the first time; 1 documented plan-text/acceptance-criteria discrepancy with no behavioral impact)
**Impact on plan:** Both Rule 1 fixes correct genuine gaps in test infrastructure that this plan's own new entries were the first to exercise -- neither is a defect introduced by this plan's manifest content itself. The documented discrepancy has zero behavioral impact.

## Issues Encountered

- **Worktree base drift, corrected before any file edits:** this worktree's branch HEAD had drifted to an ancestor commit predating plan 03-12's merge. Corrected via `git reset --hard c47dba0fd0387b7a034194dd8a72c40e88eb0478` per the mandatory `<worktree_branch_check>` step; `git status --short` showed no uncommitted work before the reset.
- **Missing `node_modules`:** this worktree's `.claude/mcp/vice/node_modules` was absent (gitignored, normally provisioned by a `SessionStart` hook that does not run in worktrees). Confirmed `package-lock.json` byte-identical to the main checkout, then copied the main checkout's already-`npm ci`'d tree -- the same sanctioned environment fix every prior Phase 3 plan documents. Not re-logged to `deferred-items.md` (already logged there as item 2).
- **Pre-existing, environment-only test failure (not caused by this plan):** `repo-root.test.ts`'s "path agreement ... not under .claude" assertion fails in this worktree for the identical, already-documented reason (`deferred-items.md` item 1) -- the worktree checkout itself sits under a `.claude/` path segment. Not re-logged per this plan's own environment note.
- `npm run test:automated` reports **926 pass / 1 fail / 5 todo** out of 932: the single failure is the pre-existing worktree-path artifact above. `npm run typecheck` exits 0.
- `node --test vice-proxy.test.ts` (the manual-only suite, run explicitly per this plan's own verification step) progressed to 50/110 tests passing with zero failures before stalling at the 60-second mark -- the documented, pre-existing "stalls outside the devcontainer" behavior (`.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`), not a regression from this plan's changes (which touch no file `vice-proxy.test.ts` exercises).
- `git diff --stat .claude/mcp/vice/vice-proxy.ts` shows no change, confirming `tools/list` continues to serve the manifest with no code change needed, exactly as this plan's objective states.

## User Setup Required

None - no external service configuration required.

## Requirements Tracking Note

This plan's frontmatter lists `requirements: [DIRECT-01 .. DIRECT-09]`. **`.planning/REQUIREMENTS.md`'s checkboxes were deliberately NOT flipped to complete here**, matching every sibling Phase 3 plan's identical, already-reviewed precedent of leaving shared requirement-tracking edits to the orchestrator's own state-update step (this plan's own instructions explicitly reserve `STATE.md`/`ROADMAP.md` writes for the orchestrator; `REQUIREMENTS.md` is treated the same way here for consistency with 03-11's and 03-12's precedent, to avoid a solo worktree agent making a judgment call on a phase-wide requirements-completion decision).

That said: with this plan's manifest wiring landing, DIRECT-01 through DIRECT-09 ARE now genuinely end-to-end reachable through the actual `tools/list` surface (dispatch table since 03-12, advertised manifest since this plan) -- **with one caveat**: DIRECT-06 reads "User can reset the machine, autostart a PRG or disk image, and attach or detach disks on the stock backend"; only the attach half is in scope for Phase 3 (D-13 moves disk-detach to Phase 7 via the text monitor, per 03-05's SUMMARY, which flagged this exact ROADMAP reconciliation as out of scope for any individual plan). Whoever performs the phase-completion requirements marking should treat DIRECT-06 as partially satisfied pending Phase 7, and the other eight as fully satisfied.

## Next Phase Readiness

- The stock backend now advertises all 25 Phase 3 tools via `tools/list`, each with a fork-verbatim `inputSchema` (D-03) and a checked `outputSchema` (D-02/D-06) -- Phase 3's own scope (direct 1:1-opcode tools) is complete.
- `stock-schema-check.ts`'s `checkAgainstSchema()` and this plan's conformance-harness pattern (`buildConformanceSession`/`buildConformanceDeps`/`conformanceTest`) are ready for later phases to reuse directly when validating their own new manifest entries' `outputSchema`s against stubbed handlers.
- Phase 8's parity harness (mentioned in 03-05's SUMMARY) can rely on this plan's manifest as the stock surface's stable, schema-checked contract.
- No blockers for Phase 4.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*
