---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 01
subsystem: testing
tags: [regenerator2000, acme, node-test, static-analysis, d-07, d-11]

# Dependency graph
requires:
  - phase: 10-adoption-boundaries-automated-bootstrap-and-the-removal
    provides: "r2000-launch.ts (the D-07 --vice deny-by-construction seam), r2000-verify.ts (acmeVerdict()), and the two Phase 10 review findings (WR-02, WR-04) this plan fixes"
provides:
  - "A non-vacuous D-07 guard: stripCommentLines() correctly closes a block comment on the first close-token found anywhere in the remaining text of a line, proven by a committed planted-violation test"
  - "acmeVerdict() unanimity: refuses a transcript containing both a passing and a failing ACME line, and refuses to guess when more than one ACME line is present"
  - "r2000-test-gate.ts: the single D-11 availability-gate seam (probeR2000, R2000_AVAILABLE, skipReasonFor, assertR2000RequiredIfEnvSet), adopted by r2000-verify.test.ts"
affects: [11-04, 11-05, 11-06, 11-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard predicates extracted to named local helpers, called by both real-source and planted-violation tests, so a future edit to the check itself is exercised by both call sites"
    - "Single shared D-11 test-gate module (r2000-test-gate.ts) imported by test files instead of hand-copied probeR2000()/SKIP_REASON bodies"

key-files:
  created:
    - .claude/mcp/vice/r2000-test-gate.ts
  modified:
    - .claude/mcp/vice/r2000-launch.test.ts
    - .claude/mcp/vice/r2000-verify.ts
    - .claude/mcp/vice/r2000-verify.test.ts

key-decisions:
  - "Predicate (c) (passthrough-named identifier) scans for extraArgs/passthrough/rest only, deliberately excluding argv/args/flags from the plan's illustrative list -- argv is a legitimate, pervasive parameter/field name elsewhere in r2000-launch.ts (assertNoViceFlag, runR2000, R2000ViceFlagErrorOptions.argv), and a literal whole-file scan for it would false-positive on today's real, correct source"
  - "Planted-violation test uses the reviewer's exact identifier (...extraArgs: string[]) rather than the plan prose's shortened ...extra, so the same synthetic source verifiably trips both predicate (b) (rest-parameter shape) and predicate (c) (forbidden identifier) at once, per the acceptance criterion that both must report the violation"

requirements-completed: [R2000-10, R2000-13]

# Metrics
duration: 45min
completed: 2026-08-20
---

# Phase 11 Plan 01: WR-02/WR-04 Fixes and the D-11 Test Gate Seam Summary

**Fixed a comment-stripper bug that could silently blind the D-07 --vice guard, made acmeVerdict() require unanimity across all parsed ACME lines, and consolidated three hand-copied regenerator2000 availability-gate bodies into one shared r2000-test-gate.ts module.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `stripCommentLines()` in `r2000-launch.test.ts` now closes a block comment on the first close-token found anywhere in the remaining text of a line (position-based `indexOf`, never `endsWith` as the sole close condition), re-feeding the remainder of the line back through the same logic so trailing code/comments survive.
- Three guard predicates (`hasFilterOverDenyList`, `hasRestParameterInBuilderSignature`, `hasPassthroughNamedIdentifier`) extracted to single named functions, shared by the real-source tests and a new committed planted-violation test reproducing 10-REVIEW.md's WR-02 finding verbatim.
- `acmeVerdict()` in `r2000-verify.ts` now requires unanimity: it filters ALL ACME lines (not just the first), drives the verdict from the first non-`ok` entry if any exists, and refuses to guess when more than one `ok` ACME line is present. Two pinned fixtures cover both cases.
- `r2000-test-gate.ts` created as the single D-11 availability-gate implementation (`R2000_BIN`, `probeR2000()`, `R2000_AVAILABLE`, `skipReasonFor()`, `assertR2000RequiredIfEnvSet()`), test-only by construction (filename does not match `*.test.*`, asserted absent from `package.json`'s `files[]`).
- `r2000-verify.test.ts` converted to import the gate, its local copy deleted, test names unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-02 — make the D-07 deny-by-construction guard able to fail** - `8b23784` (fix)
2. **Task 2: WR-04 — acmeVerdict() refuses a mixed transcript instead of reporting the first line** - `1f20a62` (fix)
3. **Task 3: r2000-test-gate.ts — one D-11 availability gate, adopted by an existing consumer** - `1271e06` (feat)

## Files Created/Modified

- `.claude/mcp/vice/r2000-launch.test.ts` - Fixed `stripCommentLines()`, extracted 3 guard predicates, added a planted-violation test and 4 direct `stripCommentLines()` unit tests
- `.claude/mcp/vice/r2000-verify.ts` - `acmeVerdict()` rewritten for unanimity over all parsed ACME lines; header extended to name WR-04
- `.claude/mcp/vice/r2000-verify.test.ts` - Added 2 pinned WR-04 fixtures; converted to import the shared D-11 gate from `r2000-test-gate.ts`; added a `files[]`-absence test
- `.claude/mcp/vice/r2000-test-gate.ts` (new) - The single D-11 availability-gate seam

## Decisions Made

- Scoped predicate (c)'s identifier scan to `extraArgs|passthrough|rest`, excluding `argv`/`args`/`flags` from the plan's illustrative list, because `argv` is legitimately used dozens of times in `r2000-launch.ts` today (function parameters on `assertNoViceFlag`/`runR2000`/`viceFlagRefusalMessage`, and a genuine field on `R2000ViceFlagErrorOptions` recording an already-built argv for error reporting — not a caller-supplied passthrough). Including it would flag correct, existing code as a violation. Documented in-line in the predicate's own doc comment.
- Built the planted-violation test's synthetic source using the reviewer's exact identifier (`...extraArgs: string[]`) rather than the plan prose's abbreviated `...extra`, so the single planted source verifiably trips BOTH guard predicates as the acceptance criteria require (the plan's own assertion text — "the text `buildEvilArgs` and `...extra` are still present" — is satisfied either way, since `...extra` is a substring of `...extraArgs`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Avoided literal `*/` inside a real JSDoc comment in the doc-comment prose describing the fix**
- **Found during:** Task 1 (first `node --test` run threw `ERR_INVALID_TYPESCRIPT_SYNTAX`)
- **Issue:** The new header comment for `stripCommentLines()` quoted the literal token `` `*/` `` inline, which closed the real enclosing `/** ... */` doc comment early, leaving the rest of the prose as invalid top-level TypeScript
- **Fix:** Reworded the doc comment to describe "the close token" instead of quoting the literal `*/` sequence, and switched the block to `//` line comments to eliminate the class of error entirely
- **Files modified:** `.claude/mcp/vice/r2000-launch.test.ts`
- **Verification:** `node --test r2000-launch.test.ts` parses and all 16 tests pass
- **Committed in:** `8b23784` (Task 1 commit)

**2. [Rule 1 - Bug] Reworded a WR-04 header comment to avoid a literal `lines.find(` substring**
- **Found during:** Task 2 verification (acceptance criterion `grep -c 'lines.find(' r2000-verify.ts` returns 0)
- **Issue:** A prose comment describing the pre-fix bug quoted the literal text `` `lines.find(...)` ``, which the mechanical grep check would have counted as a live occurrence even though it was only historical prose
- **Fix:** Reworded the comment to describe "a bare array .find() over the first matching entry" without the literal substring
- **Files modified:** `.claude/mcp/vice/r2000-verify.ts`
- **Verification:** `grep -c 'lines.find(' r2000-verify.ts` returns 0; all tests still pass
- **Committed in:** `1f20a62` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both discovered by running the actual verification commands rather than inspection)
**Impact on plan:** Both are wording-only fixes to comments, made to satisfy the plan's own mechanical acceptance criteria. No scope creep, no behavior change beyond what the plan specified.

## Non-Vacuity Demonstrations (recorded per `<verification>`)

**1. Pre-fix stripper drops the reintroduced code; the fixed one retains it.**

Running the pre-fix `stripCommentLines()` body (restored verbatim in a scratch script) against the exact planted-violation source used in the committed test:

```
--- PRE-FIX stripCommentLines() output ---
"import { spawnSync } from \"node:child_process\";\n"
contains buildEvilArgs: false
```

The fixed version (committed, `8b23784`) retains `buildEvilArgs` and `...extraArgs` — proven by the passing `planted violation: ...` test in `r2000-launch.test.ts`.

**2. The D-11 availability gate's hard-FAIL mode, observed failing live.**

```
$ R2000_BIN=/nonexistent/regenerator2000 VICE_REQUIRE_R2000=1 node --test r2000-verify.test.ts
...
not ok 9 - regenerator2000 availability gate (D-11)
  error: 'VICE_REQUIRE_R2000 is set but no real regenerator2000 was found at
  R2000_BIN="/nonexistent/regenerator2000" -- a maintainer who sets this variable
  expects a hard FAIL, never a SKIP, when the binary is actually missing.'
...
ok 11 - gated: verifyProject() on a .prg-shaped illegal-opcode fixture ... # SKIP ...
ok 12 - gated: verifyProject() on a flat 64K image ... # SKIP ...
# tests 12
# pass 9
# fail 1
# skipped 2
```

With `regenerator2000` genuinely installed (0.9.20) and `VICE_REQUIRE_R2000=1` set (no `R2000_BIN` override), the full suite is green (12/12 pass) — confirming the gate does not spuriously fail when the binary is actually present.

## Issues Encountered

**Unrelated pre-existing failure surfaced by the full `npm test` run, logged and left untouched:** `repo-root.test.ts`'s "path agreement ... the agreed path is not under .claude" assertion fails when the repo is checked out inside `.claude/worktrees/<agent-id>/` (this plan's own execution environment), because the worktree's own root path necessarily contains `.claude/`. This is disjoint from all three files this plan modifies and is not caused by any change in this plan. Logged to `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `r2000-test-gate.ts` is ready for plans 11-04 through 11-07 to import as their D-11 availability gate, avoiding a sixth hand-copied `probeR2000()` body.
- The D-07 guard is now proven able to fail under a planted violation, so plan 11-04's three new argv builders inherit a guard that has actually been observed catching a reintroduction, not merely one trusted by inspection.
- `acmeVerdict()`'s unanimity fix is in place ahead of plan 11-06's `--verify`/`--export_asm` acceptance check for `lda #$1b / sta $d011` rendering.
- One out-of-scope, environment-only test failure (`repo-root.test.ts`, worktree-path artifact) is tracked in `deferred-items.md` and does not block this plan or any dependent plan.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/r2000-test-gate.ts`
- FOUND: `.claude/mcp/vice/r2000-launch.test.ts`
- FOUND: `.claude/mcp/vice/r2000-verify.ts`
- FOUND: `.claude/mcp/vice/r2000-verify.test.ts`
- FOUND: `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/deferred-items.md`
- FOUND commit `8b23784` (Task 1)
- FOUND commit `1f20a62` (Task 2)
- FOUND commit `1271e06` (Task 3)
