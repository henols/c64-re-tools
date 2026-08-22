---
phase: 14-backend-decision
plan: 01
subsystem: decision-record
tags: [fork-backend, decision-record, keyboard-matrix-set, api-coverage, doc-content-guard]

# Dependency graph
requires: []
provides:
  - "A dated FORK-01 Key Decisions row in .planning/PROJECT.md: retain, decided 2026-08-22"
  - "The literal branch token `retain` for downstream plans 14-02/14-03/14-04/14-05 to dispatch on"
  - "docs-fork-decision.test.ts, a committed guard proven non-vacuous by real break-and-restore"
  - "14-DECISION-BRIEF.md, the evidence document the checkpoint decision was taken against"
  - "COVERAGE.md, the api-coverage seal-gate declaration for this phase"
affects: [14-02-backend-decision, 14-03-backend-decision, 14-04-backend-decision, 14-05-backend-decision]

# Actuals (#2632)
actuals:
  tokens: 6390
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc-content-guard idiom (docs-linerefs.test.ts / docs-deferred-ledger.test.ts) extended to a Key-Decisions table row: isolate section by heading regex, extract data rows by pipe-space prefix, assert case-sensitive literal match, prove non-vacuity by a real break-and-restore rather than a planted-violation unit test"

key-files:
  created:
    - .planning/phases/14-backend-decision/14-DECISION-BRIEF.md
    - .planning/phases/14-backend-decision/COVERAGE.md
    - .claude/mcp/vice/docs-fork-decision.test.ts
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "FORK-01 branch token: retain. Decided by a human at the blocking-human checkpoint (Task 2) after explicit escalation — NOT inferred, NOT auto-approved, NOT the orchestrator's own choice."
  - "Sub-question B: NOT overridden. The plan's default reading stands — an honest, complete statement of permanent loss (no client-side substitute for SID read-back or RESTORE/NMI) satisfies FORK-02 on the retain branch; no replacement-capability requirement was added."
  - "Sub-question A does not arise: it is conditioned on a non-retain branch."

requirements-completed: [FORK-01]

coverage:
  - id: D1
    description: "FORK-01 decision brief assembled, presenting both branches' costs, the three literal option tokens, the two open questions, and reversal-criteria draft text — with no recommended outcome"
    requirement: "FORK-01"
    verification:
      - kind: other
        ref: "test -s 14-DECISION-BRIEF.md && grep -c 'remove-now' ... && node gsd-tools.cjs query check api-coverage.verify-pre .planning/phases/14-backend-decision"
        status: pass
    human_judgment: false
  - id: D2
    description: "FORK-01 branch decided by a human at a blocking-human checkpoint (retain), with sub-question B explicitly not overridden"
    requirement: "FORK-01"
    verification: []
    human_judgment: true
    rationale: "The branch token is inherently a human decision (gate=blocking-human, never auto-approved) — there is nothing for automation to verify beyond the fact that a checkpoint was escalated and a literal token was returned, which is recorded above."
  - id: D3
    description: "PROJECT.md carries exactly one dated FORK-01 Key Decisions row naming KEYBOARD_MATRIX_SET and a reversal trigger; the Out of Scope bullet cites FORK-01 instead of contradicting it"
    requirement: "FORK-01"
    verification:
      - kind: other
        ref: "grep -c FORK-01 .planning/PROJECT.md (>=2); grep FORK-01 | grep -c KEYBOARD_MATRIX_SET (>=1); grep FORK-01 | grep -Ec ISO-date (>=1)"
        status: pass
    human_judgment: true
    rationale: "Task 3's own <verify> block requires a human-check reading the new row against FORK-01's requirement text to confirm it reads as a decision taken rather than a status-quo restatement — the automated grep counts above are necessary but the plan does not treat them as sufficient on their own."
  - id: D4
    description: "docs-fork-decision.test.ts: a mechanical guard on the FORK-01 row, proven non-vacuous by a real break-and-restore (not a planted-violation unit test)"
    requirement: "FORK-01"
    verification:
      - kind: unit
        ref: "docs-fork-decision.test.ts (6/6 passing)"
        status: pass
      - kind: other
        ref: "manual break-and-restore: lower-cased KEYBOARD_MATRIX_SET in PROJECT.md, re-ran the guard (1 failure, test 4, naming the missing literal), restored, re-ran (6/6 pass again)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 1: FORK-01 Decision Brief and Dated Decision Summary

**FORK-01 decided `retain`: the forked VICE MCP backend stays the default hedge, formalised in PROJECT.md with dated, KEYBOARD_MATRIX_SET-coupled reversal criteria and a mechanically-enforced guard.**

## Performance

- **Duration:** 17 min (across two executor sessions spanning the blocking-human checkpoint)
- **Started:** 2026-08-22T09:00:23Z
- **Completed:** 2026-08-22T09:17:01Z
- **Tasks:** 3 (1 auto, 1 checkpoint:decision, 1 tracer)
- **Files modified:** 4 (3 created, 1 modified)

## Decision

**Branch token: `retain`.**

Decided by a **human**, at Task 2's `gate="blocking-human"` checkpoint, after
explicit escalation by the orchestrator. This is not an inference, not an
auto-approval under auto-mode (blocking-human checkpoints are never
auto-approved regardless of `workflow.auto_advance`), and not a default carry
— the decision cites named reversal criteria and an ISO date, which is what
distinguishes it from the two prior milestone closes that answered this
question by omission.

**Sub-question A:** does not arise. It is conditioned on a non-`retain`
branch (full deletion vs. deprecate-then-delete), and the human chose
`retain`.

**Sub-question B: NOT overridden.** The plan's default reading stands
unmodified: on the `retain` branch this sub-question does not itself arise
either (it too is conditioned on a non-`retain` branch), but for the record —
no override was recorded, so the plan's own stated default (an honest,
complete statement of permanent loss satisfies FORK-02 for SID read-back and
RESTORE/NMI, matching how `capability-registry.ts` already words genuinely
unbuilt losses) is what plans 14-02 through 14-05 should read.

**Reasoning the human accepted:** the two unrecoverable losses (SID
read-back, write-only in hardware; RESTORE/NMI, no client-side substitute)
have no route except the fork. Retention's steady-state cost is already sunk
and running in CI. The one unpaid cost — the first live exercise of the
fork's own `-mcpserver` HTTP transport — is paid by 14-03 on this branch.
`retain` here is a genuine dated decision, not a third default carry,
because the Key Decisions row now carries the ISO date, the
`KEYBOARD_MATRIX_SET` coupling, and named reversal triggers.

**Downstream plans (14-02, 14-04, 14-05): read the branch token as `retain`
from this section.**

## Accomplishments
- `14-DECISION-BRIEF.md` assembled: all eight required `##` headings, the
  three literal option tokens (`retain`, `deprecate-first`, `remove-now`),
  the `KEYBOARD_MATRIX_SET` coupling, `[skip release]`, the `remove-now`
  in-phase-infeasibility statement, and the two open sub-questions — **with
  no sentence recommending one option over another** (verified by direct
  read: the only match for recommendation-adjacent language is the brief's
  own explicit disclaimer, "It does not recommend an outcome," and the
  adjacent sentence stating research's own lean is deliberately not carried
  forward).
- `COVERAGE.md` written: single declaration line beginning `No external API
  integration:`, satisfying the api-coverage seal gate
  (`api-coverage.verify-pre` returns `passed: true`).
- Blocking-human checkpoint (Task 2) escalated and answered: `retain`.
- `.planning/PROJECT.md` Key Decisions table gained one new three-cell row
  citing `FORK-01`, an ISO date (`2026-08-22`), the literal
  `KEYBOARD_MATRIX_SET`, and the reversal-trigger phrase "reverses if";
  the `## Out of Scope` fork-backend bullet was edited to cite the new row
  rather than asserting retention on its own.
- `docs-fork-decision.test.ts` created (6 tests, following the
  `docs-linerefs.test.ts` / `docs-deferred-ledger.test.ts` idiom), proven
  non-vacuous by a **real break-and-restore**: lower-casing
  `KEYBOARD_MATRIX_SET` in the live `PROJECT.md` made the guard fail (1/6,
  naming the missing literal exactly), and restoring it returned the suite
  to 6/6 green.

## Task Commits

1. **Task 1: Assemble the FORK-01 decision brief (and the api-coverage declaration)** - `0d29d0a` (docs)
2. **Task 2: FORK-01 decision checkpoint** - no commit (checkpoint task; resolved by human, recorded above)
3. **Task 3: Record the dated FORK-01 decision and prove it with a mechanical guard** - `5f7dda7` (docs, PROJECT.md), `cecdbc6` (test, docs-fork-decision.test.ts)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.planning/phases/14-backend-decision/14-DECISION-BRIEF.md` - the evidence document read at the checkpoint; both branches' costs, three options, two open questions, reversal-criteria draft
- `.planning/phases/14-backend-decision/COVERAGE.md` - api-coverage seal-gate declaration
- `.planning/PROJECT.md` - new dated FORK-01 Key Decisions row; Out of Scope bullet now cites it
- `.claude/mcp/vice/docs-fork-decision.test.ts` - mechanical guard on the FORK-01 row (6 tests), kept out of `package.json`'s `files[]`

## Decisions Made
See `## Decision` above — the branch token (`retain`) and the sub-question B
non-override are the load-bearing decisions this plan exists to record.

## Deviations from Plan

None - plan executed exactly as written. The only adaptation was tightening
`docs-fork-decision.test.ts`'s Out-of-Scope-bullet lookup from a loose
substring scan (which initially matched an unrelated "The fork backend keeps
working..." validated-requirement bullet at PROJECT.md line 67) to a
bold-span-anchored regex scoped to the `### Out of Scope` section — caught
and fixed during the plan's own verification loop (test 6 failed on first
run, fixed, re-verified 6/6 pass), not a deviation from the plan's intent.

## Issues Encountered
None.

## Threat Flags

None. This plan's threat model (T-14-01 through T-14-04, T-14-SC) is fully
addressed by the artifacts above: `docs-fork-decision.test.ts` mitigates
T-14-01/T-14-02 (repudiation/tampering of the row), the `gate="blocking-human"`
checkpoint mitigates T-14-03 (elevation via an inferred token — did not
happen; a human decided), and the guard's absence from `package.json`'s
`files[]` (confirmed) mitigates T-14-04.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 14-02, 14-04, and 14-05 (all declaring `FORK-01`) can now read the
  branch token `retain` and the sub-question B non-override from this
  SUMMARY's `## Decision` section.
- Plan 14-03 (declaring both `FORK-01` and `FORK-02`) is the phase's live
  criterion-3 exercise of the fork's own `-mcpserver` HTTP transport — the
  one unpaid cost this plan's decision explicitly deferred to it.
- `FORK-01` is NOT yet marked complete in `.planning/REQUIREMENTS.md`: the
  shared-ID gate (#2388) correctly holds it open because sibling plans
  14-03, 14-04, and 14-05 also declare `FORK-01` and have not yet produced
  their own SUMMARY.md. `requirements.ready-ids` returned `0/1 ready`.
  It will flip to `Complete` automatically once the last declaring plan
  finishes.
- No blockers.

## Self-Check: PASSED

- `[ -f .planning/phases/14-backend-decision/14-DECISION-BRIEF.md ]` → FOUND
- `[ -f .planning/phases/14-backend-decision/COVERAGE.md ]` → FOUND
- `[ -f .claude/mcp/vice/docs-fork-decision.test.ts ]` → FOUND
- `git log --oneline --all | grep -q 0d29d0a` → FOUND
- `git log --oneline --all | grep -q 5f7dda7` → FOUND
- `git log --oneline --all | grep -q cecdbc6` → FOUND
- All task-level `<acceptance_criteria>` re-run: PASS (grep counts, `node --test docs-fork-decision.test.ts` 6/6, `files[]` exclusion check, `test-gate.test.ts`, `check-npm-packages.mjs`, break-and-restore proof)
- Plan-level `<verification>` re-run: PASS (28/28 across the six `docs-*.test.ts`/`test-gate.test.ts` files; `check-npm-packages.mjs` OK; `api-coverage.verify-pre` `passed: true`)

---
*Phase: 14-backend-decision*
*Completed: 2026-08-22*
