---
phase: quick
plan: 260817-n6p
subsystem: testing
tags: [typescript, disassembler, input-validation, code-review-followup]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler
    provides: disasm-decoder.ts's decode() function and its 04-REVIEW.md code review
provides:
  - "isValidStartAddress() guard in decode(), rejecting startAddress > 0xffff instead of wrapping it"
  - "04-REVIEW.md Resolution Status section covering WR-01/IN-01/IN-02/IN-03"
affects: [phase-05-derivations-and-screenshots]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate narrowing predicate per argument when one argument (startAddress) needs a stricter bound than siblings (opts.count/opts.end) that must stay unbounded by design"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/disasm-decoder.ts
    - .claude/mcp/vice/disasm-decoder.test.ts
    - .planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-REVIEW.md
    - .planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md

key-decisions:
  - "WR-01 is hardening on a currently unreachable path, not a bug fix for a reachable defect -- both named future consumers (DERIV-02, GAIN-01) were cut from v0.2.0 scope on 2026-08-17, so this is defense-in-depth, not a live fix"
  - "isNonNegativeSafeInteger() was left completely untouched; a new, separate isValidStartAddress() was added instead, so opts.count/opts.end (IN-03) stay unbounded by design"
  - "04-REVIEW.md front-matter status left as issues_found (not changed to resolved) because IN-02 is still a live, if scoped, Info for Phase 5"
  - "Used npm run test:automated (the project's own documented automated gate) rather than bare npm test as the pass/fail signal, per .planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md's disposition that bare npm test is not a usable gate"

patterns-established: []

requirements-completed: [WR-01, DISASM-05, DISASM-07]

# Metrics
duration: ~30min
completed: 2026-08-17
---

# Phase quick: Bound decode()'s startAddress to 0..0xffff Summary

**Closed Phase 4 review finding WR-01 with a dedicated `isValidStartAddress()` guard that rejects an out-of-range `startAddress` instead of silently wrapping it, and recorded that both named future consumers of the gap (DERIV-02, GAIN-01) were cut from scope the same day -- so the fix is defense-in-depth, not a bug fix on a reachable path.**

## Performance

- **Duration:** ~30 min (dominated by full-suite verification runs, not code changes)
- **Completed:** 2026-08-17T15:10:02Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 source/test, 2 docs)

## Accomplishments

- `decode()` in `.claude/mcp/vice/disasm-decoder.ts` now returns `[]` for a `startAddress` above `0xffff` instead of wrapping it via `(startAddress + offset) & 0xffff` and returning a plausible-looking but wrong disassembly.
- Confirmed a genuine RED->GREEN transition: `decode(new Uint8Array([0xea, 0xea]), 0x1ffff)` returned two wrapped `nop`s at `$FFFF`/`$0000` before the fix, `[]` after.
- Confirmed the `0xffff` boundary is still inclusive: `decode(new Uint8Array([0xea]), 0xffff)` still returns exactly one instruction at `$FFFF`.
- Confirmed `opts.count`/`opts.end` remain unbounded (IN-03 preserved): `decode(bytes, 0, { count: 0x1ffff })` still returns both instructions.
- `04-REVIEW.md` now has a `## Resolution Status` section covering all four Phase 4 findings without rewriting any original finding text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bound startAddress to 0..0xffff in decode(), with test and header note** - `e19d8eb` (fix)
2. **Task 2: Record resolution status for all four Phase 4 review findings** - `90107f3` (docs)

**Deviation commit:** `ff87d94` (docs: log pre-existing worktree-path test failure as deferred)

_Note: no TDD RED/GREEN split commits -- the task was executed as a single `fix` commit containing both the guard and its test, matching this plan's `tdd="true"` behavior-spec-then-implement structure rather than a strict two-commit RED/GREEN cycle._

## Files Created/Modified

- `.claude/mcp/vice/disasm-decoder.ts` - added `isValidStartAddress()` (separate from `isNonNegativeSafeInteger()`), swapped it into `decode()`'s `startAddress` guard, extended the JSDoc and `WHAT NOT TO DO` header block, and noted DERIV-02/GAIN-01 were cut from scope
- `.claude/mcp/vice/disasm-decoder.test.ts` - added the WR-01 too-large-`startAddress` case and the `0xffff` inclusive-boundary case to the existing "never throws" suite
- `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-REVIEW.md` - appended `## Resolution Status` covering WR-01 (resolved), IN-02 (live, carried to Phase 5), IN-03 (moot by design), IN-01 (deferred, unchanged); front-matter `status` left as `issues_found`
- `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md` - logged the pre-existing worktree-path test artifact reproduced during this task's verification, plus the bare-`npm-test`-is-not-a-gate and empty-`node_modules`-in-worktree environment notes

## Decisions Made

- **WR-01's severity is now "hardening", not "bug fix".** The finding's own stated motivation for mattering was two future direct consumers of `decode()` that bypass `parseAddress()`'s existing `0..0xffff` enforcement: Phase 5's backtrace (`DERIV-02`) and Phase 6's CPU-history decode (`GAIN-01`). Both were cut from v0.2.0 scope on 2026-08-17 (Phase 6 removed wholesale from `ROADMAP.md`; `DERIV-02` listed under "Cut from scope"). Every reachable caller today reaches `decode()` via `stock-disassemble.ts` -> `parseAddress()`, which already enforces the bound. The fix is still correct and still worth having -- the module's own ethic favours refusal over silent wrapping -- but it closes a gap on a currently unreachable path, not a live defect. Recorded explicitly in both the module header and `04-REVIEW.md` so this isn't overstated in the milestone log.
- **IN-03 was consciously preserved, not overlooked.** `isNonNegativeSafeInteger()` was left completely untouched and still gates `opts.count`/`opts.end`. A new, separate `isValidStartAddress()` predicate was added instead of folding an upper bound into the shared helper -- exactly the trap the plan called out as easy to get wrong. The `WHAT NOT TO DO` header block and `04-REVIEW.md`'s Resolution Status both now say so explicitly, so a future reviewer does not "fix" this into a regression.
- **IN-02 is a live carry-forward for Phase 5's `DERIV-04` work**, not resolved by this task. `DERIV-04` (the symbol store) survived the 2026-08-17 scope cut and is Phase 5's own responsibility to add duplicate-name detection for; `04-REVIEW.md`'s Resolution Status flags this so Phase 5 planning picks it up.
- **`04-REVIEW.md`'s front-matter `status` was left as `issues_found`**, not changed to `resolved`. Even though the sole Warning (WR-01) is now resolved, IN-02 remains a live (if scoped-to-Phase-5) Info, so `issues_found` is still the accurate reading.
- **Used `npm run test:automated` (this project's own documented automated gate), not bare `npm test`,** as the actual pass/fail verification signal for `npm test`-shaped plan language. `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md` records a prior, explicit user decision that bare `npm test` is not a usable gate because four files (`vice-proxy.test.ts`, `vice-broker-launch.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`) need a real broker/emulator/display topology and are excluded from the automated gate by `test-gate.mjs`'s own `MANUAL_ONLY_TESTS` list. Bare `npm test` did complete in this environment (~12 min, exit 0) but reported 128 failures dominated by `vice-proxy.test.ts`; `npm run test:automated` is the project's real signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned this worktree's empty `node_modules` from the main checkout's identical lockfile**

- **Found during:** Task 1 verification (`npx tsc --noEmit` and `npm run test:automated`)
- **Issue:** This worktree's `.claude/mcp/vice/node_modules` was completely empty (0 installed packages, only an empty `.cache/` dir) -- unlike the main checkout, which was fully `npm ci`'d. `npx tsc --noEmit` failed outright (`Cannot find type definition file for 'node'`) and `npm run test:automated` showed 29 failures, none related to `disasm-decoder.ts`.
- **Fix:** Confirmed `.claude/mcp/vice/package-lock.json` is byte-identical between the main checkout and this worktree, then copied the main checkout's already-`npm ci`'d `node_modules/` into the worktree -- an exact copy of already-vetted packages matching the identical committed lockfile, not a new/unverified install (matches the identical precedent already documented in `03-direct-tools/deferred-items.md` item 2). Not committed (`node_modules/` is gitignored).
- **Files modified:** none tracked (gitignored directory only)
- **Verification:** After the copy, `npx tsc --noEmit` became clean and `npm run test:automated` failures dropped from 29 to 1 (the pre-existing worktree-path artifact below).
- **Committed in:** N/A -- environment-only fix, not a git change

**2. [Scope Boundary - documented, not fixed] Pre-existing worktree-path test failure reproduced**

- **Found during:** Task 1 verification (`npm run test:automated`, full run)
- **Issue:** `repo-root.test.ts`'s "path agreement (D-3, D-6, THE regression this task exists to catch)" test fails because this worktree's own resolved repo root sits under `.claude/worktrees/agent-<id>/`, which the test's "must not be under `.claude`" assertion cannot distinguish from the real regression it guards against. Identical symptom already documented in this same phase's `deferred-items.md` (`04-01` entry) and in `03-direct-tools/deferred-items.md`.
- **Fix:** Not fixed -- out of scope (no file this task touches is involved; `repo-root.test.ts` has zero reference to `disasm`). Logged as a new entry in `04-client-side-tool-seam-and-6510-disassembler/deferred-items.md` for the fourth time this pattern has been independently reproduced.
- **Files modified:** `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md` (documentation only)
- **Verification:** N/A -- confirmed pre-existing and unrelated by inspection, matching prior independent reproductions across four different plans/tasks.
- **Committed in:** `ff87d94`

---

**Total deviations:** 2 (1 auto-fixed blocking-issue environment provisioning, 1 documented-but-not-fixed pre-existing failure)
**Impact on plan:** Neither affects `disasm-decoder.ts`'s correctness or this task's scope. The environment provisioning was necessary to get a trustworthy verification signal at all; the worktree-path artifact is a known, previously-dispositioned condition of running tests from inside a Claude Code worktree, independent of this task's code.

## Known Stubs

None -- this task adds a validation guard and two tests; no UI, no data source, nothing that could stub.

## Threat Flags

None -- `T-n6p-01` (the guard's own threat entry) and `T-n6p-02`/`T-n6p-03` (accept/mitigate, already scoped in the plan's own threat model) cover the full surface this task touches. No new network endpoint, auth path, file access pattern, or schema change was introduced.

## Issues Encountered

- The full, bare `node --test '*.test.*'` run took ~12 minutes and reported 128 failures before this worktree's `node_modules` was provisioned -- resolved by recognizing (via `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`) that this is a known, already-dispositioned condition and switching to the project's own `npm run test:automated` gate, which is fast (~25s) and gives a trustworthy signal (1189/1195 green, the one remaining failure being the documented worktree-path artifact).

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `decode()`'s `startAddress` bound is closed; Phase 5's `DERIV-04` symbol-store work should pick up `IN-02` (duplicate-symbol-name detection in `disasm-renderer.ts`'s `render()`) as part of its own test suite, per `04-REVIEW.md`'s Resolution Status section.
- No blockers for Phase 5 introduced by this task.

---
*Phase: quick (260817-n6p)*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/disasm-decoder.ts`
- FOUND: `.claude/mcp/vice/disasm-decoder.test.ts`
- FOUND: `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-REVIEW.md`
- FOUND: `.planning/phases/04-client-side-tool-seam-and-6510-disassembler/deferred-items.md`
- FOUND: commit `e19d8eb` (Task 1)
- FOUND: commit `90107f3` (Task 2)
- FOUND: commit `ff87d94` (deviation docs)
