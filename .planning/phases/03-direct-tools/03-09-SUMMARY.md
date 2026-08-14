---
phase: 03-direct-tools
plan: 09
subsystem: api
tags: [typescript, binary-monitor, vice, mcp, execution-control, idempotence]

# Dependency graph
requires:
  - phase: 03-direct-tools
    provides: "03-01's stock-runstate.ts runState projection (runStateFor/attachRunStateTracker) and stock-handler.ts's shared handler contract (StockSessionHandler/stockAnswer/convertWireError); 03-02's advanceInstructionsBody() request-body encoder"
provides:
  - "stock-execution.ts -- Family C's four StockSessionHandlers: handleExecutionPause, handleExecutionRun, handleExecutionStep, handleExecutionUntilReturn"
  - "refuseIfUnknown() -- the one D-07 gate shared by the two stepping tools"
  - "settleEvents() -- the one-macrotask event-settling helper every handler in this module awaits before building its answer"
  - "beginProgramCounterCapture()/programCounterFromReply() -- best-effort programCounter surfacing from a settled STOPPED/RESUMED event, scoped to a single handler invocation"
affects: [03-12, 03-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scoped, single-call event listener (attach immediately before send(), detach right after settleEvents()) for a narrow, best-effort read -- distinct from stock-runstate.ts's persistent, idempotent-attach tracker (RESEARCH.md Pitfall 4 is about that tracker's own double-registration risk, not a blanket ban on any other module ever listening)"
    - "D-08 short-circuit: check the derived runState BEFORE any send(), answer with an explicit already-in-that-state marker on a match, and treat \"unknown\" as \"nothing to short-circuit against\" rather than \"do nothing\""

key-files:
  created:
    - .claude/mcp/vice/stock-execution.ts
    - .claude/mcp/vice/stock-execution.test.ts
  modified:
    - .planning/phases/03-direct-tools/deferred-items.md

key-decisions:
  - "REGISTER_INFO-based programCounter extraction is explicitly NOT implemented -- only a settled STOPPED/RESUMED event's own programCounter field is used, since mapping a register id to \"this is the PC\" needs Family A's register catalog (plans 03-06/03-07), which is not a dependency of this plan"
  - "stock-execution.ts NOT added to package.json's files array yet -- deferred to whichever plan (03-12/03-13) wires it into stock-dispatch.ts, to avoid a near-certain wave-merge conflict across the six parallel Wave-2 family-module plans all touching the same array (logged in deferred-items.md)"
  - "REQUIREMENTS.md's DIRECT-04/DIRECT-05 checkboxes deliberately NOT flipped -- both are also declared in 03-12/03-13 (the dispatch/manifest integration plans), and this plan's handlers are not reachable by an actual tool call until that wiring lands, matching 03-02's identical precedent for its own shared requirement IDs"

requirements-completed: [DIRECT-04, DIRECT-05]

# Metrics
duration: ~20min
completed: 2026-08-14
---

# Phase 3 Plan 9: Execution Control (Pause/Run/Step/Until-Return) Summary

**Four stock-backend execution-control handlers -- idempotent pause/resume via D-08 short-circuiting (zero wire traffic on a genuine retry) and D-07-gated step/until-return, including the new stock-only `vice_execution_until_return` tool for `EXECUTE_UNTIL_RETURN` (0x73), which has no fork counterpart.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-14T18:50:00+02:00 (approx., from base commit)
- **Completed:** 2026-08-14T19:06:00+02:00 (approx.)
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 append-only deferred-items log)

## Accomplishments

- `handleExecutionPause`/`handleExecutionRun`: bare `PING`/`EXIT`, each short-circuiting to **zero** `send()` calls when the derived run state already matches the requested outcome (D-08) -- proven by call-count assertions, including a two-call, one-send retry test for each direction.
- `CommandType.Exit` has exactly one call site in the whole module (grep-gated to 1), reached only from `handleExecutionRun` -- the sole handler in the phase licensed to resume the machine (D-05).
- `handleExecutionStep`/`handleExecutionUntilReturn`: both refuse while the derived run state is `"unknown"` via a single shared `refuseIfUnknown()` gate, naming the exact next action and stating explicitly that the gate does NOT extend to memory/register/checkpoint tools (D-07).
- `vice_execution_until_return` is the planner-chosen stock-only tool name for `EXECUTE_UNTIL_RETURN` (0x73), which has no fork tool at all -- documented in-source as a distinct operation from `vice_execution_step`'s `stepOver`.
- `stepOver: true`'s runtime semantic stays labelled `[ASSUMED]` (RESEARCH.md A2) and points at the already-filed probe-debt todo -- never claimed as verified.
- Every ok-answer is built through `stockAnswer()`, so every answer carries `runState` by construction (D-06).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pause and resume, with D-08 short-circuiting** - `d313a90` (feat)
2. **Task 2: Step and the stock-only execute-until-return, with D-07 gating** - `ecc3d75` (feat)

_Note: both tasks touch the same two files. Following 03-02's own precedent, Task 1 was isolated to only its own pause/run scope, verified (tests + typecheck + all grep-gated acceptance criteria) and committed, then Task 2's step/until-return additions were restored and committed separately, so each commit's diff matches only its own task's scope._

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.claude/mcp/vice/stock-execution.ts` - `handleExecutionPause`, `handleExecutionRun`, `handleExecutionStep`, `handleExecutionUntilReturn`, plus the shared `settleEvents()`, `refuseUnexpectedArgs()`, `refuseIfUnknown()`, `beginProgramCounterCapture()`/`programCounterFromReply()` helpers
- `.claude/mcp/vice/stock-execution.test.ts` - 23 tests: D-08 short-circuit call-count assertions (both directions, both "unknown" pass-through cases, both two-call retry-is-a-no-op cases), D-07 gate refusal/pass-through for both stepping tools, `ADVANCE_INSTRUCTIONS` byte-offset assertions (defaults and `count:5, stepOver:true`), `count:0` refusal, `EXECUTE_UNTIL_RETURN` empty-body assertion, unexpected-argument refusals, `runState`-on-every-answer, a settled-event programCounter test, and a wire-rejection wedge-language-absence test
- `.planning/phases/03-direct-tools/deferred-items.md` - appended a third entry (see Deviations) logging why `stock-execution.ts` is not yet in `package.json`'s `files` array

## Decisions Made

- Kept `beginProgramCounterCapture()`'s listener strictly scoped to a single handler invocation (attach right before `send()`, detach immediately after `settleEvents()` resolves) rather than adding a second field to `stock-runstate.ts`'s persistent tracker -- keeps the "one persistent tracker, idempotently attached" invariant (RESEARCH.md Pitfall 4) intact and un-shared with an unrelated, narrower concern.
- `programCounterFromReply()` checks the resolved reply itself for a `programCounter` field before falling back to the captured event, even though neither `AdvanceInstructions` nor `ExecuteUntilReturn` parses to a shape carrying one today (both fall through to `stock-protocol.ts`'s `"unknown"` shape) -- a narrow, defensive check that costs nothing and is picked up for free if a future parser extension adds one, rather than a hardcoded "always use the event".
- `args.stepOver` is validated as strictly `boolean` when present (refusing a non-boolean with a typed message) rather than coerced via `Boolean(...)`, matching D-03's "an unhonourable/malformed argument is a hard error, not a silent coercion" convention used elsewhere in this phase (`stock-address.ts`'s own strict-form parsing).

## Deviations from Plan

### Auto-fixed Issues

None -- the plan's own action text was implemented as written; no bug, missing-critical-functionality, or blocking-issue fix was required.

### Logged (not fixed) items

**1. `stock-execution.ts` not added to `package.json`'s `files` array**
- **Found during:** Task 1, after creating the new module.
- **Context:** Plan 03-01 proactively added not-yet-runtime-reachable modules (`stock-runstate.ts`/`stock-address.ts`) to this array as a Rule 2 auto-fix, reasoning that a shipped-but-unreachable module is a real publish gap.
- **Why not applied here:** unlike 03-01 (the sole Wave-1 plan), 03-09 is one of six PARALLEL Wave-2 sibling plans, each adding its own new family module that is equally not dispatch-reachable until plans 03-12/03-13 wire it in. Editing the same `package.json` array from six concurrent worktrees is a near-certain wave-merge conflict for zero behavioural gain (matches this plan's own explicit scope note, "No dispatch or manifest edits -- plans 03-12 and 03-13 own those", and RESEARCH.md's own Focus Item 10 guidance for the analogous `stock-dispatch.ts`/manifest files).
- **Disposition:** Logged to `.planning/phases/03-direct-tools/deferred-items.md` (append), to be resolved by whichever plan wires `stock-execution.ts` into `stock-dispatch.ts`.

**2. Pre-existing, out-of-scope test failure (already documented)**
- `repo-root.test.ts`'s worktree-path assertion fails identically to every other Phase 3 plan's own worktree run (see `deferred-items.md` #1) -- reproduced in isolation as pre-existing, not caused by this plan's files, and not re-logged per this worktree's own environment note.

---

**Total deviations:** 0 auto-fixed; 1 logged-and-deferred (package.json array), 1 previously-logged pre-existing item reconfirmed
**Impact on plan:** No scope creep. The deferred `package.json` item is a publish-correctness detail that becomes correct in the same change that makes the module dispatch-reachable; nothing in this plan's own success criteria depends on it.

## Issues Encountered

- A full `npm run test:automated` run mid-session showed 2 failures instead of the expected 1 (the documented worktree-path artifact); a second run immediately after showed the expected 713 pass / 1 fail / 5 todo baseline. Treated as a transient flake in the broader suite (likely a timing-sensitive broker/async test unrelated to this plan's files, none of which appeared in either run's failure list beyond the one known artifact) rather than a regression -- re-verified clean before committing Task 2.

## User Setup Required

None - no external service configuration required.

## Requirements Tracking Note

This plan's frontmatter lists `[DIRECT-04, DIRECT-05]` as the requirements it
contributes to, and this SUMMARY's own `requirements-completed` field copies
that list per the summary template's instructions. **`.planning/REQUIREMENTS.md`'s
checkboxes were deliberately NOT flipped to complete for these IDs.** Both
IDs are also declared in plans 03-12 and 03-13 (the dispatch-table and
manifest integration plans) -- this plan builds the handler layer only; the
handlers are not reachable by an actual `tools/call` until that wiring
lands, so marking `REQUIREMENTS.md` complete here would be inaccurate until
the corresponding integration plan(s) land. This mirrors 03-02's identical,
already-reviewed precedent for its own overlapping requirement IDs.

## Next Phase Readiness

- `handleExecutionPause`, `handleExecutionRun`, `handleExecutionStep`, and `handleExecutionUntilReturn` are ready for plan 03-12/03-13's dispatch-table wiring to import directly from `stock-execution.ts`.
- The stock-only tool name `vice_execution_until_return` is fixed and documented in-source; the integration plan needs only to add its `tools-manifest.stock.json` entry (no arguments) and its `stock-dispatch.ts` table row.
- `stock-execution.ts` still needs a `package.json` `files` array entry -- see Deviations; the integration plan should add it in the same change that wires dispatch.
- No blockers for downstream Phase 3 plans. `node --test stock-execution.test.ts` (23/23 passing) and `npm run typecheck` are both green; `npm run test:automated` is green except the one pre-existing, unrelated, worktree-path-caused failure already logged in `deferred-items.md`.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-execution.ts`
- FOUND: `.claude/mcp/vice/stock-execution.test.ts`
- FOUND: `.planning/phases/03-direct-tools/03-09-SUMMARY.md`
- FOUND: `.planning/phases/03-direct-tools/deferred-items.md`
- FOUND: commit `d313a90` (Task 1)
- FOUND: commit `ecc3d75` (Task 2)
