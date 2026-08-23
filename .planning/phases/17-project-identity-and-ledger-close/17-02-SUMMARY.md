---
phase: 17-project-identity-and-ledger-close
plan: 02
subsystem: docs
tags: [core-value, planning-doc, doc-guard, node-test, audit-integrity]

requires:
  - phase: 11
    provides: "R2000-10's two-session sealed-question test, R2000-14/R2000-15's symbol round trip, and R2000-01's structural VICE-incapability guard — the evidence this plan's verdict weighs"
  - phase: 14
    provides: "FORK-01's dated-decision shape (Key Decisions row + docs-fork-decision.test.ts) — the direct template this plan's Core Value entry and guard mirror"
provides:
  - "A dated, evidence-citing CORE-01 verdict inside PROJECT.md's `## Core Value` section, discharging the v0.3.0 'deliberately not rewritten yet' flag"
  - "docs-core-value-decision.test.ts, a committed guard pinning the verdict's date, named evidence, and reversal condition against future drift"
affects: [milestone-close, gsd-complete-milestone, audit-integrity]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: ["dated-verdict-in-prose (Core Value), mirroring FORK-01's dated-verdict-in-table shape", "planted-violation-proven doc guard, sibling of docs-fork-decision.test.ts"]

key-files:
  created:
    - src/mcp/vice/docs-core-value-decision.test.ts
  modified:
    - .planning/PROJECT.md
    - src/mcp/vice/audit-integrity.test.ts

key-decisions:
  - "CORE-01 decided keep-dated: PROJECT.md's Core Value leading statement is unchanged; a dated entry inside `## Core Value` records that the evidence was weighed and the statement deliberately retained."
  - "The keep-dated verdict was escalated to a human at plan 17-02 task 1's gate=\"blocking-human\" checkpoint. The human, having seen the full evidence, explicitly delegated the choice to the orchestrating session rather than selecting an option; the orchestrator then selected keep-dated. This is recorded precisely in both PROJECT.md and here, per the checkpoint resolution's explicit instruction not to overstate human involvement."
  - "Because the verdict is keep-dated, task 3 built docs-core-value-decision.test.ts (the plan's discretionary guard) rather than skipping it — the restate branch's no-guard rule does not apply here."

requirements-completed: []
# CORE-01 is NOT marked complete in REQUIREMENTS.md by this plan. 17-03-PLAN.md
# also declares CORE-01 and has no SUMMARY yet; the shared-ID gate
# (`requirements.ready-ids`) correctly reported 0/1 ready. It will be marked
# complete when 17-03 (the last plan declaring it) finishes.

coverage:
  - id: D1
    description: "PROJECT.md's `## Core Value` section carries a dated (2026-08-23), CORE-01-labelled, evidence-citing verdict (keep-dated), discharging the v0.3.0 'not rewritten yet' flag"
    requirement: "CORE-01"
    verification:
      - kind: other
        ref: "awk '/^## Core Value/,/^## Requirements/' .planning/PROJECT.md | grep checks for ISO date, 'sealed-question|Phase 11', 'CORE-01', 'blocking-human', absence of the retired flag's bolded run-in, and a reversal phrase — all run live in this session, all passing"
        status: pass
    human_judgment: true
    rationale: "Whether the evidence was genuinely weighed (vs. asserted) is the load-bearing half of CORE-01 and is not mechanically checkable, per this plan's own probe_coverage note (verification: backstop). The automated checks above prove the artifacts of a weighed decision are present; a human must still read the entry end to end per task 2's <human-check> block, harvested at end-of-phase per workflow.human_verify_mode."
  - id: D2
    description: "docs-core-value-decision.test.ts pins the kept verdict: non-vacuity, ISO date, named evidence, reversal condition, and a planted-violation test proving each predicate fires — demonstrated live against the real file (deleting the date turned the date-scoped test run red, exit 1, before the edit was reverted)"
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-core-value-decision.test.ts#1-5 (all 5 pass)"
        status: pass
      - kind: other
        ref: "planted-violation live demonstration: node --test --test-name-pattern='date' docs-core-value-decision.test.ts against a temporarily date-stripped PROJECT.md, exit 1, then reverted (git diff clean)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs-fork-decision.test.ts and docs-deferred-ledger.test.ts remain green and untouched by task 2/3; the full src/mcp/vice test suite is green after the one deviation fix"
    verification:
      - kind: unit
        ref: "node --test docs-fork-decision.test.ts (6/6 pass), node --test docs-deferred-ledger.test.ts (4/4 pass)"
        status: pass
      - kind: integration
        ref: "npm test: 2391 total, 2347 pass, 0 fail, 39 skipped, 5 todo"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-23
status: complete
---

# Phase 17 Plan 02: CORE-01 Verdict and Guard Summary

**CORE-01 decided `keep-dated` at a blocking-human checkpoint delegated to the orchestrator; PROJECT.md's Core Value carries the dated verdict and a new sibling guard, `docs-core-value-decision.test.ts`, pins it.**

## Performance

- **Duration:** ~25 min (continuation agent, resuming after Task 1's resolved checkpoint)
- **Completed:** 2026-08-23T08:52:00Z
- **Tasks:** 2 of 3 executed by this agent (Task 1 was resolved by a prior executor at the checkpoint with no file changes, per its own acceptance criteria)
- **Files modified:** 3 (1 planning doc, 1 new test file, 1 pre-existing test file fixed as a deviation)

## Task 1 — Resolution Record (Verbatim, Per Instruction)

**Task 1 was RESOLVED, not executed by this agent.** A prior executor reached the `gate="blocking-human"` checkpoint, made no file changes and no commits (correct — the task's own acceptance criteria require none), and returned for a human decision.

**Verdict: `keep-dated`.**

**How the verdict was reached, stated precisely and not overstated:** the checkpoint was escalated to the human operator at the `gate="blocking-human"` gate. The full evidence was presented — the current Core Value text, all six FOR-restating items and all five AGAINST items, the FORK-01 precedent, and the downstream consequence of each branch. The human, having read that, declined to pick between the two options themselves and explicitly delegated the call to the orchestrating session ("you decide"). The orchestrator then selected `keep-dated` on the reasoning recorded in PROJECT.md's new entry (decisive reason: the outlives-the-session property belongs to a component — regenerator2000 — structurally incapable of driving VICE at all (`R2000-01`); v0.4.0 produced zero new evidence on the question; the pre-drafted restatement is a conjunction naming two structurally separate subsystems in one sentence).

**Acceptance criterion honesty note (explicitly required by the checkpoint resolution instructions):** Task 1's acceptance criterion reads "Exactly one of `restate` or `keep-dated` is selected, **by a human**." This was satisfied in the *attended-escalation* sense — a human saw the `gate="blocking-human"` checkpoint, read the full evidence, and responded to it — but **not** in the *literal* sense of the human personally selecting the option word. The human delegated the choice; the orchestrator made the selection. This is recorded here and inside PROJECT.md's new entry itself precisely so a later verifier reading that criterion literally has the facts in front of them, rather than a record that reads as more human-decided than it was. This phase is fundamentally about audit integrity; overstating human involvement here would be the exact failure mode CORE-01 exists to prevent.

## Accomplishments

- **Task 2:** Replaced PROJECT.md's standing "Flagged at the v0.3.0 close, deliberately not rewritten yet" paragraph with a dated (`2026-08-23`), `CORE-01`-labelled entry inside `## Core Value` — leading statement left byte-identical, provenance stated precisely (including the delegation nuance above), decisive reasoning given, the case against the verdict named rather than suppressed (Phase 11's sealed-question test called out as this project's strongest evidence, left unnamed in the identity statement for a third close), and a concrete two-part reopening trigger stated (a shipped skill demonstrably depending on cross-session recall, checkable by emptying the annotation store; or a second milestone's worth of genuinely new persistent-state evidence).
- **Task 3:** Built `src/mcp/vice/docs-core-value-decision.test.ts` (the keep-dated branch requires the guard) as a direct sibling of `docs-fork-decision.test.ts`: 5 tests (non-vacuity, ISO date, named evidence, reversal condition, planted violation), all passing against the real file, and the date-scoped test independently demonstrated to fail (exit 1) against a temporarily date-stripped copy of PROJECT.md before the edit was reverted (working tree confirmed clean via `git diff`).
- **Deviation fix:** `audit-integrity.test.ts`'s `EXPECTED_GUARD_NAMES_FOR_ASSERTION` — the D-12-07/D-12-08 non-vacuity/completeness check comparing the derived `docs-*.test.ts` set on disk against a hand-maintained list — broke as a direct, foreseeable consequence of adding a fifth guard file. Its own header comment names exactly this maintenance obligation ("extend this array... the day a fifth guard is added"). Fixed by appending `"docs-core-value-decision.test.ts"` to the list.

## Task Commits

Each task was committed atomically:

1. **Task 2: Record the CORE-01 verdict inside PROJECT.md's Core Value** — `2e958bb` (docs)
2. **Task 3: Build docs-core-value-decision.test.ts** — `b440c5c` (test)
3. **Deviation fix: extend audit-integrity's guard-name list** — `c6d6794` (fix)

**Plan metadata:** committed alongside this SUMMARY (see below).

## Files Created/Modified

- `.planning/PROJECT.md` — `## Core Value` section: retired the v0.3.0 flag paragraph, added the dated CORE-01 verdict entry
- `src/mcp/vice/docs-core-value-decision.test.ts` — new doc guard, sibling of `docs-fork-decision.test.ts`, scoped to `## Core Value`
- `src/mcp/vice/audit-integrity.test.ts` — `EXPECTED_GUARD_NAMES_FOR_ASSERTION` extended to include the new guard file

## Decisions Made

See `key-decisions` in frontmatter. In prose: CORE-01 decided `keep-dated`, delegated by a human to the orchestrator at the blocking-human checkpoint; the delegation (not a literal human selection) is recorded honestly rather than smoothed over; task 3 built the guard because the keep-dated branch requires it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `audit-integrity.test.ts`'s guard-name completeness check broke on the new guard file**
- **Found during:** Task 3, post-implementation full-suite run
- **Issue:** `audit-integrity.test.ts`'s "the docs guard set is derived from disk with a non-vacuity floor (D-12-07 / D-12-08)" test does a `deepEqual` between the live `docs-*.test.ts` glob and a hand-maintained `EXPECTED_GUARD_NAMES_FOR_ASSERTION` array. Adding `docs-core-value-decision.test.ts` made the derived set diverge from that array, failing the test.
- **Fix:** Appended `"docs-core-value-decision.test.ts"` to `EXPECTED_GUARD_NAMES_FOR_ASSERTION`. The file's own header comment explicitly names this exact maintenance step as required "in a commit, alongside the new guard file."
- **Files modified:** `src/mcp/vice/audit-integrity.test.ts`
- **Verification:** `node --test audit-integrity.test.ts` (43/43 pass); full `npm test` (2391 total, 2347 pass, 0 fail, 39 skipped, 5 todo)
- **Committed in:** `c6d6794`

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1).
**Impact on plan:** Necessary and foreseeable consequence of task 3's own deliberate addition; explicitly anticipated by the affected file's own header comment. No scope creep.

## Issues Encountered

None beyond the deviation above. `docs-fork-decision.test.ts` and `docs-deferred-ledger.test.ts` were confirmed green and untouched throughout, satisfying the plan's own constraint that neither is affected by this plan's Core Value edit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CORE-01's verdict and guard are complete and committed; `REQUIREMENTS.md`'s CORE-01 checkbox is intentionally NOT flipped by this plan — `17-03-PLAN.md` also declares CORE-01 and has no SUMMARY yet, and the shared-ID gate (`requirements.ready-ids`) correctly reported `0/1` ready. It becomes ready when 17-03 finishes.
- The `<human-check>` on task 2's `<verify>` block is harvested at end-of-phase per `workflow.human_verify_mode: end-of-phase` and is the only check that reaches the "weighed, not bookkeeping" half of this plan's must-have criterion 1 — it should be reviewed alongside 17-03's own end-of-phase human checks, not separately.
- The full `cd src/mcp/vice && npm test` gate this plan ran (2347 pass / 0 fail) is a superset check, not a substitute for the full gate plan 17-03 (the phase's designated closer) is responsible for running as its own verification step.

---
*Phase: 17-project-identity-and-ledger-close*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: `.planning/PROJECT.md`
- FOUND: `src/mcp/vice/docs-core-value-decision.test.ts`
- FOUND: `src/mcp/vice/audit-integrity.test.ts`
- FOUND commit: `2e958bb` (Task 2)
- FOUND commit: `b440c5c` (Task 3)
- FOUND commit: `c6d6794` (deviation fix)
- Task 2 acceptance criteria: all 6 automated greps re-run live, all pass (date present, `sealed.question|Phase 11` present, `CORE-01` present, `blocking-human` present, retired flag's bolded run-in absent, reversal phrase present); `docs-fork-decision.test.ts` (6/6) and `docs-deferred-ledger.test.ts` (4/4) both green
- Task 3 acceptance criteria: `docs-core-value-decision.test.ts` 5/5 pass; planted-violation date-strip demonstrated exit 1 then reverted (`git diff` clean); `grep -c 'docs-core-value-decision' package.json` = 0; `node scripts/check-npm-packages.mjs` exit 0; `npm run typecheck` exit 0
- Full `cd src/mcp/vice && npm test`: 2391 total, 2347 pass, 0 fail, 39 skipped, 5 todo
