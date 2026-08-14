---
phase: 03-direct-tools
plan: 03
subsystem: protocol
tags: [typescript, ast, condition-parser, vice-binary-monitor, checkpoints]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: ViceError base class (vice.ts), the "single seam per concern" /
      isPlainObject() / long-header-comment conventions this module follows
provides:
  - A typed ConditionNode/ConditionOperand AST for stock-VICE checkpoint
    conditions
  - emitCondition() -- the one function that ever produces condition wire
    text, always fully parenthesised, always $hex, always uppercase RL/CY
  - parseConditionString() -- the fork-compatible string input path
  - conditionFromJson() -- the structured-object input path
  - StockConditionError -- the error type every refusal in this module raises
affects: [03-08 (consumes emitCondition()'s output for CONDITION_SET request
  bodies), Phase 6 GAIN-06 (extends this AST with raster semantics)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed discriminated-union AST + single canonical emitter, so a class
      of protocol-level bug (silently-always-false condition) is
      structurally unreachable rather than merely discouraged"
    - "Two input paths (string parser, JSON narrower), one emitter -- neither
      input path ever builds wire text itself"

key-files:
  created:
    - .claude/mcp/vice/stock-condition.ts
    - .claude/mcp/vice/stock-condition.test.ts
  modified: []

key-decisions:
  - "D-09 implemented exactly as scoped: condition argument accepts either a
    string or a structured object, both funnel into one typed AST and one
    canonical emitter"
  - "Range validation (RL <= 0x138, CY <= 0x3f) lives in emitCondition()
    itself, not just at the input-path boundary -- it is the last gate
    before the wire and re-validates rather than trusting its caller"
  - "Comparison-count and nesting-depth caps (8) applied in both input
    paths per the threat model's T-3-04 disposition"

patterns-established:
  - "Condition AST/emitter pattern: any future condition-building code
    (Phase 6 GAIN-06's raster semantics) extends this AST rather than adding
    a second emitter or a parallel string-building path"

requirements-completed: [DIRECT-03]

# Metrics
duration: 45min
completed: 2026-08-14
---

# Phase 3 Plan 3: Condition AST and Canonical Emitter Summary

**Typed condition AST with one canonical emitter (`emitCondition`) plus a fork-compatible string parser and a structured-object narrower, making VICE's three silently-always-false condition traps (no operator precedence, hex-by-default literals, `LIN`/`CYC` vs `RL`/`CY`) structurally unreachable rather than merely discouraged.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-14T16:36:50Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- Built the typed `ConditionNode`/`ConditionOperand` discriminated-union AST and `emitCondition()`, the sole function in the tree that ever produces condition wire text -- it always fully parenthesises every comparison and boolean node, always emits `$hex` literals (never bare decimal, never `0x`), and always uppercases `RL`/`CY`.
- Added `conditionFromJson()`, D-09's structured-object input path, narrowing untrusted JSON with named-path refusals (e.g. `condition.left.op`) for missing/unknown `kind`, unknown operators, lowercase names, `LIN`/`CYC`, non-numeric literals, and nesting depth over 8.
- Added `parseConditionString()`, D-09's fork-compatible string input path, accepting single comparisons and individually-parenthesised `&&`/`||` chains, and refusing each of the six named traps (LIN/CYC, wrong-case names, bare decimals, unparenthesised multi-comparison expressions, out-of-range values via `emitCondition()`'s own checks, and malformed/oversized input) with a message naming the correct form.
- Proved the two input paths share one emitter with a structural test: `emitCondition(parseConditionString(...))` and `emitCondition(conditionFromJson(...))` produce byte-identical output for the same logical condition.

## Task Commits

Each task was committed atomically:

1. **Task 1: The AST types and the canonical emitter** - `9508d1c` (feat)
2. **Task 2: The fork-compatible string parser and its refusal set** - `fbe767b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.claude/mcp/vice/stock-condition.ts` - Typed condition AST, `emitCondition()`, `parseConditionString()`, `conditionFromJson()`, `StockConditionError`
- `.claude/mcp/vice/stock-condition.test.ts` - Golden emitter tests, refusal tests per named trap, and the string/object structural-equivalence test

## Decisions Made
- Kept `emitCondition()`'s literal-range validation (general `0..0xffff`, plus RL/CY-specific `0x138`/`0x3f` bounds) inside the emitter itself rather than only at the input-path boundary, per the plan's explicit instruction that the emitter is "the last gate before the wire" and must not trust its caller.
- Implemented the comparison-count cap (8) and nesting-depth cap (8) in both `parseConditionString()` and `conditionFromJson()`, matching the threat model's T-3-04 disposition, even though the string grammar's flat `&&`/`||` chain structure only exercises the count cap in practice (the string grammar has no nested-object depth to speak of).
- Chose to accept a literal on either side of a comparison in `parseConditionString()` (e.g. `"0x42 == A"` parses to `($42 == A)`) rather than refusing reversed-operand forms, since the grammar note in the plan explicitly said to "pick one and assert it" and accepting is strictly more permissive of the fork's documented forms without weakening any refusal.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. Both tasks' acceptance criteria and verification commands pass as specified.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- **Pre-existing, unrelated test failure observed while running `npm run test:automated`:** `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test fails with "the agreed directory must not sit under .claude" because this execution runs from inside a git worktree checked out at `.claude/worktrees/agent-afcb392446dd03a9c/`, which is itself nested under a `.claude/` directory -- exactly the path shape that test's own regression guard refuses. This is unrelated to `stock-condition.ts`/`stock-condition.test.ts` (this plan's only files) and is not caused by any change in this plan. Confirmed out of scope per the executor's scope-boundary rule (only auto-fix issues directly caused by the current task's changes) and logged to `.planning/phases/03-direct-tools/deferred-items.md` rather than fixed. `stock-condition.test.ts` itself passes 27/27 with 0 failures, and `npm run typecheck` exits 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `emitCondition()`'s output is ready to be consumed by a later plan's `CONDITION_SET` request-body encoder (`conditionSetBody()` in `stock-protocol.ts`) -- this plan adds no handlers or dispatch entries by design.
- `parseConditionString()` and `conditionFromJson()` are both exported and ready for a handler to accept either input form for the `condition` argument per D-09.
- No blockers. The pre-existing `repo-root.test.ts` failure noted above is an environment/worktree-path artifact, not a phase blocker -- it is unrelated to any file this or prior 03-* plans touch.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-condition.ts`
- FOUND: `.claude/mcp/vice/stock-condition.test.ts`
- FOUND: `.planning/phases/03-direct-tools/03-03-SUMMARY.md`
- FOUND: `.planning/phases/03-direct-tools/deferred-items.md`
- FOUND commit: `9508d1c` (Task 1)
- FOUND commit: `fbe767b` (Task 2)
