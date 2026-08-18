---
phase: quick-260818-nh5
plan: 01
subsystem: testing
tags: [vice-mcp, stock-vice, node-test, test-gate, evidence-shape, uat-gap-closure]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "vice_diagnose's five-verdict/non-verdict diagnosis surface, including the restarted verdict's evidence shape (baselineEpoch/currentEpoch, plus WR-04's jamObserved on every verdict)"
provides:
  - "A restarted-evidence live assertion in stock-live-triage.test.ts that tolerates additive evidence widening while still proving zero emulator cost against all eleven cost-bearing keys"
  - "An automated unit shape-oracle in stock-diagnose.test.ts pinning the restarted verdict's exact evidence key set for both call sites, runnable under node test-gate.mjs with no emulator"
  - "A standing rule in test-gate.mjs's header comment: every payload shape a manual-only live suite depends on must have a mirror assertion in the automated set"
  - "07-VERIFICATION.md corrected to attribute its 12:29:43Z live-evidence claim to a pre-88b9a15 measurement and cite a freshly re-measured 2026-08-18T15:08:51Z 3/3-per-binary (6/6 total) result"
affects: [07-cycle-timing-and-wedge-triage, vice-wedge-triage-skill, any-future-additive-evidence-change-to-handleDiagnoseStock]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additively-tolerant live assertions: assert presence of load-bearing keys and absence of a named cost-bearing key set, instead of an exact sorted-key-set string match, so a live proof survives future additive (never removed) evidence fields"
    - "Shape oracle pairing: when a manual-only live test's assumption cannot itself run under the automated gate, mirror the exact assumption in a zero-cost unit test so drift reds automatically before it silently breaks the live suite"

key-files:
  created: []
  modified:
    - ".claude/mcp/vice/stock-live-triage.test.ts"
    - ".claude/mcp/vice/stock-diagnose.test.ts"
    - ".claude/mcp/vice/test-gate.mjs"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md"
    - ".planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md"

key-decisions:
  - "D-01 (from PLAN.md, executed as resolved): jamObserved STAYS on the restarted branch's evidence. stock-diagnose.ts is NOT modified by this plan -- confirmed by git diff --stat showing zero changes to it, stock-runstate.ts, or any .mts/resources file."
  - "Relaxed the live test's assertion rather than reverting or excluding jamObserved: the restarted verdict's evidence is allowed to grow additively; the live proof now asserts only what a real emulator run can prove (verdict reached, zero emulator cost) and defers exact-shape pinning to an automated unit oracle."

requirements-completed: [UAT-07-T8]

# Metrics
duration: ~25min
completed: 2026-08-18
---

# Phase quick-260818-nh5: Close Phase 07 UAT Gap (stale restarted-evidence assertion) Summary

**Relaxed a stale exact-key-set live assertion that broke on WR-04's additive `jamObserved` evidence field, added a zero-cost automated shape oracle so the same drift reds under `node test-gate.mjs` next time, and re-measured/corrected 07-VERIFICATION.md's now-stale 12:29:43Z live-evidence claim with a fresh 3/3-per-binary (6/6 total) result.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-18T14:46:00Z (approx, first tool call)
- **Completed:** 2026-08-18T15:11:45Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (3 code/test files, 2 phase docs)

## Accomplishments
- `stock-live-triage.test.ts`'s restarted-is-live-proven test now tolerates additive evidence widening (asserts presence of `baselineEpoch`/`currentEpoch`, absence of all eleven cost-bearing keys via a named `EMULATOR_COST_EVIDENCE_KEYS` array) instead of an exact sorted-key-set string match.
- `stock-diagnose.test.ts` gained a shape-oracle unit test exercising both restarted call sites (session-null thrown `MachineRestartedError`, and session-non-null on-disk epoch bump) and pinning the exact evidence key set `{baselineEpoch, currentEpoch, jamObserved}` for each — runs under `node test-gate.mjs` at zero emulator cost.
- `test-gate.mjs`'s header comment now states the standing rule this oracle exemplifies, without touching the frozen `MANUAL_ONLY_TESTS` array.
- `07-VERIFICATION.md` re-attributes its stale 12:29:43Z live claim to a pre-`88b9a15` measurement and records a fresh, currently-standing 2026-08-18T15:08:51Z run: 3/3 pass on genuine `/usr/bin/x64sc` (VICE 3.9) and 3/3 pass on genuine `/usr/local/bin/x64sc` (VICE 3.10), 6/6 total, zero stray `x64sc` processes afterward.
- `stock-diagnose.ts` is confirmed unmodified (D-01 upheld) via `git diff --stat` against the plan's declared base.

## Task Commits

Each task was committed atomically:

1. **Task 1: Relax the live restarted-evidence assertion to survive additive widening** - `acc9933` (fix)
2. **Task 2: Add the automated evidence-shape oracle that closes the gate hole** - `84cca54` (test)
3. **Task 3: Re-run both live binaries and correct the stale 07-VERIFICATION.md claim** - `9831fa8` (docs)

_No TDD gating applied to this plan (`type: execute`, no `tdd="true"` tasks)._

## Files Created/Modified
- `.claude/mcp/vice/stock-live-triage.test.ts` - restarted-evidence assertion relaxed to presence + cost-key-absence checks; new `EMULATOR_COST_EVIDENCE_KEYS` module-scope constant
- `.claude/mcp/vice/stock-diagnose.test.ts` - new shape-oracle test pinning the exact restarted evidence key set for both call sites
- `.claude/mcp/vice/test-gate.mjs` - header comment extended with the standing rule and the 2026-08-18 incident as its worked example; `MANUAL_ONLY_TESTS` array itself untouched (still exactly five entries)
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VERIFICATION.md` - truth-3 row, reproduction note, and both per-binary evidence rows corrected with re-attribution and the new measurement
- `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` - logged the recurrence of the pre-existing, unrelated `repo-root.test.ts` worktree-path failure

## Decisions Made
- Followed D-01 from PLAN.md exactly: `jamObserved` stays on the restarted branch; `stock-diagnose.ts` untouched. No re-litigation of that decision.
- Kept Task 2's shape oracle as a single `test()` call exercising both branches (per the plan's explicit "add ONE new test" instruction) rather than splitting into two separate top-level tests, even though the plan's own done-criterion language ("total test count at least 2 higher") implied a delta of 2. The actual delta is +1 (1623 pass -> 1624 pass in this environment, matching the exact figure named as the "previous 1624 pass baseline" in the plan). Followed the more specific/authoritative task action text over the looser done-criterion wording; documented here for transparency rather than silently picking one.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed. The `stock-live-triage.test.ts` comment string originally drafted for Task 1 accidentally still contained the literal `"baselineEpoch,currentEpoch"` substring (in a doc comment, not code), which would have failed the task's own `grep -c` verification gate; caught and reworded before commit (not a plan deviation, just a self-caught drafting error during Task 1, verified via the task's own `<automated>` check before committing).

---

**Total deviations:** 0 rule-based auto-fixes.
**Impact on plan:** None. Plan executed exactly as written, including D-01.

## Issues Encountered

**Pre-existing, out-of-scope test failure (not fixed, logged to deferred-items.md):** `node test-gate.mjs` reports 1 failure in `repo-root.test.ts` ("the agreed directory must not sit under .claude") in this worktree. Confirmed via `git stash`/`stash pop` around Task 2's changes that this failure exists identically before and after this plan's edits (pass count moved 1623 -> 1624, fail count stayed at 1 throughout) — it is a property of this agent's worktree living under `.claude/worktrees/agent-aba4dcf6984414059/`, already documented for prior quick tasks (`04-01`, `260817-n6p`), and out of scope per the executor's scope-boundary rule (pre-existing failure unrelated to this plan's files). `npx tsc --noEmit` exits 0 throughout.

## Verification Results

Run from `.claude/mcp/vice/` (in the order specified by PLAN.md's `<verification>` block):

1. `npx tsc --noEmit` — exit 0, no diagnostics. ✓
2. `node test-gate.mjs` — 1624 pass / 1 fail / 5 todo across 21 suites, 1630 total. The 1 failure is the pre-existing, unrelated `repo-root.test.ts` worktree-path artifact documented above and in `deferred-items.md`; the 5 sanctioned `vice-sync.ts` todos are unchanged. ✓ (for this plan's own scope)
3. `VICE_LIVE_TRIAGE_BIN=/usr/bin/x64sc node --test stock-live-triage.test.ts` — 3 pass / 0 fail. ✓
4. `VICE_LIVE_TRIAGE_BIN=/usr/local/bin/x64sc node --test stock-live-triage.test.ts` — 3 pass / 0 fail. ✓
5. `node build.ts && git status --porcelain -- resources/` — empty output, zero drift (no `.mts` file touched). ✓

Regression sanity: `git diff --stat f2d6bd0..HEAD -- .claude/mcp/vice/stock-diagnose.ts .claude/mcp/vice/stock-runstate.ts '*.mts' 'resources/*.mjs'` — empty output. `stock-diagnose.ts` is unmodified; WR-04's `jamObserved` is intact on every verdict, restarted included, per D-01.

No stray `x64sc` processes remained after either live run (`ps aux | grep x64sc`, empty).

## Next Phase Readiness
- Phase 07's UAT test-8 gap (stale restarted-evidence assertion) is closed: `stock-live-triage.test.ts` is green on both real stock binaries, and the drift that broke it is now covered automatically at zero emulator cost.
- No new gaps introduced. The pre-existing `repo-root.test.ts` worktree-path artifact remains open (tracked in `deferred-items.md`, unrelated to this plan) and does not block phase completion.

---
*Phase: quick-260818-nh5*
*Completed: 2026-08-18*

## Self-Check: PASSED

All 6 claimed files found on disk (`stock-live-triage.test.ts`, `stock-diagnose.test.ts`,
`test-gate.mjs`, `07-VERIFICATION.md`, `deferred-items.md`, this SUMMARY.md). All 3 task
commit hashes (`acc9933`, `84cca54`, `9831fa8`) found in `git log --oneline --all`.
