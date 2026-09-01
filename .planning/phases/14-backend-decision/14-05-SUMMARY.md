---
phase: 14-backend-decision
plan: 05
subsystem: decision-record
tags: [fork-backend, decision-record, requirements-closure, deferred-ledger, FORK-01, FORK-02]

# Dependency graph
requires:
  - phase: 14-backend-decision (plan 01)
    provides: "The literal branch token `retain`, decided by a human at a blocking-human checkpoint, and sub-question B's un-overridden default reading"
  - phase: 14-backend-decision (plan 02)
    provides: "14-ROUTE-EVIDENCE.md: all 17 FORK-02 hard-loss mention sites verdicted holds-as-is"
  - phase: 14-backend-decision (plan 03)
    provides: "14-CRITERION3-EVIDENCE.md: the fork's own -mcpserver transport exercised live for the first time; a new pending todo (tools-manifest.json staleness)"
  - phase: 14-backend-decision (plan 04)
    provides: "Confirmed retain-branch recorded zero: no code-consequence edits under .claude/mcp/vice/"
provides:
  - "The standing fork-removal todo disposed honestly against the retain branch: moved to .planning/todos/completed/ with a Resolution section citing the dated FORK-01 decision and 14-02/14-03's evidence"
  - "FORK-01 and FORK-02 marked Complete in REQUIREMENTS.md (checkbox + Traceability row), with a closure note recording which reading of FORK-02 applied"
  - "STATE.md's Deferred Items table and its previously-stale prose counts reconciled to the actual pending-todo tree (20 pending + 1 UAT gap = 21 items), docs-deferred-ledger.test.ts green in both directions"
  - "ROADMAP.md's Phase 14 section gains a Notes block recording the branch token, date, and a verdict for each of the three success criteria"
  - "ROADMAP.md's Phase 15/16/17 sections each gain a resolved dependency note stating what the retain decision means for the work they were sequenced to wait for"
  - "Three new REQUIREMENTS.md Future Requirements entries (24-tool disposition, breaking-release handling, manual KEYBOARD_MATRIX_SET reversal tracking) plus one Out of Scope entry, so excluded work has a named owner instead of an unstated gap"
  - "The warp-over-resource_set todo's fork-facing question answered directly on the todo (not moot; mark fork-only per SKILL-01), so Phase 15 does not re-derive it"
affects: [15-debt-and-review-disposition, 16-packaging-and-repo-shape, 17-project-identity-and-ledger-close]

# Actuals (#2632)
actuals:
  tokens: 6150
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch-conditional record-closing plan: every action gated on a single previously-decided token (retain/deprecate-first/remove-now), read from a sibling plan's SUMMARY rather than re-derived, with the non-taken branches' work explicitly skipped and recorded rather than silently omitted"
    - "Deferred-ledger prose reconciliation: the guarded table (docs-deferred-ledger.test.ts) and the unguarded prose that states its count are two different things — the table can be correct while the prose drifts, so both need explicit reconciliation, not just the table"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md
    - .planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md

key-decisions:
  - "Branch confirmed `retain` by directly reading 14-01-SUMMARY.md's ## Decision section (human decision, blocking-human checkpoint, sub-question B not overridden) before any edit — not assumed from the dispatch's own framing."
  - "remove-now contingency work (Task 2's Recommended follow-on note, README.md correction) correctly and visibly skipped: neither applies on retain. The plan's own artifacts_produced table marks both branch-conditional, and this SUMMARY records the skip explicitly rather than silently."
  - "Fork-removal todo closed (moved to completed/) rather than rewritten-and-kept-pending, per the plan's own branch rule: retain closes the todo honestly because the decision genuinely settled its open question (retain, not delete-or-defer)."
  - "FORK-01's closure note recorded no unmet-criterion qualifier, because ROADMAP criterion 3's remove clause is conditioned on a non-retain branch and simply does not apply here — there is nothing outstanding to name an owner for on this branch."
  - "STATE.md's stale '18 pending' prose (in both the Deferred Items section and the separate Pending Todos section) was corrected to the actual count, even though the guard only checks the table — the plan's own must_haves named this specific drift as a requirement, not an optional cleanup."

requirements-completed: [FORK-01, FORK-02]

coverage:
  - id: D1
    description: "Standing fork-removal todo disposed honestly against the retain branch: closed with a Resolution section citing the dated FORK-01 decision, 14-02's route evidence, and 14-03's live criterion-3 evidence"
    requirement: "FORK-01"
    verification:
      - kind: other
        ref: "git mv to .planning/todos/completed/; grep -c 'FORK-01' on the Resolution section (contains an ISO date and the literal FORK-01); todo absent from .planning/todos/pending/"
        status: pass
    human_judgment: false
  - id: D2
    description: "FORK-01 and FORK-02 ticked complete in REQUIREMENTS.md, Traceability rows Complete, with a closure note recording which reading of FORK-02 (sub-question B not overridden) applied and on whose authority"
    requirement: "FORK-01, FORK-02"
    verification:
      - kind: other
        ref: "gsd-tools query requirements.ready-ids returned 2/2 ready before marking; grep -c '^- \\[x\\] \\*\\*FORK-01\\*\\*' and FORK-02 both return 1; Traceability rows both read Complete"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deferred-items ledger reconciled: the fork-removal todo's row removed from STATE.md's Deferred Items table, the new tools-manifest-stale todo's row already present (from 14-03), and the previously-stale '18 pending' prose corrected to the actual count in both places it appeared"
    requirement: null
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts (4/4 passing, both directions)"
        status: pass
      - kind: other
        ref: "ls .planning/todos/pending/*.md | wc -l -> 20; grep -c '^| todo |' inside STATE.md's ## Deferred Items section -> 20 (matches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ROADMAP.md's Phase 14 section gains a Notes block with the branch token, decision date, and an explicit verdict for each of the three success criteria — no criterion reported satisfied on evidence this phase did not produce"
    requirement: null
    verification:
      - kind: manual_procedural
        ref: "Task 2's own <human-check>: read ROADMAP.md's Phase 14 Notes against its three success criteria; confirmed each carries a verdict citing the specific plan/evidence document that produced it, and criterion 3's remove clause is stated as not-in-play rather than softened or omitted"
        status: pass
    human_judgment: true
    rationale: "Whether a verdict genuinely traces to the evidence that produced it (rather than merely asserting satisfaction) is a judgment call the plan's own <human-check> requires a human read for, not a grep."
  - id: D5
    description: "ROADMAP.md's Phase 15, 16 and 17 sections each gain a resolved dependency note stating the retain decision's consequence for the work they were sequenced to wait for (warp-over-resource_set's fork-facing half, WR-13's still-open dead string, Phase 16's unamended sweep-once rationale, Phase 17's pending-todo count delta), plus a structural-cause handoff naming Phase 14 in GATE-02's list"
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'Fork-decision consequence' .planning/ROADMAP.md -> 3 (Phases 15, 16, 17); grep -c '^### Phase' unchanged at 6 before/after"
        status: pass
    human_judgment: false
  - id: D6
    description: "Three Future Requirements entries added (24-tool disposition, breaking-release handling naming '[skip release]', manual KEYBOARD_MATRIX_SET reversal-trigger tracking) plus one Out of Scope entry for the un-built version probe, so work this phase deliberately excluded has a named owner"
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'skip release' .planning/REQUIREMENTS.md -> 1; new '### Fork Backend Follow-on' section present under ## Future Requirements with three bulleted items; new Out of Scope table row present"
        status: pass
    human_judgment: false
  - id: D7
    description: "The warp-over-resource_set todo's fork-facing question answered directly on the todo (retain decided; the fork stays; mark vice_machine_config_set's WarpMode description fork-only per SKILL-01 rather than delete it), so Phase 15 does not re-derive the fork's status"
    requirement: null
    verification:
      - kind: other
        ref: "grep -c 'FORK-01 decision applied' .planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md -> 1"
        status: pass
    human_judgment: false
  - id: D8
    description: "README.md correctly left untouched on the retain branch (no backend-default flip occurred at 14-04, so no correction is needed), and the zero recorded rather than silently skipped"
    requirement: null
    verification:
      - kind: other
        ref: "git diff --quiet -- README.md (exit 0, confirmed before and after all edits)"
        status: pass
    human_judgment: false
  - id: D9
    description: "All five docs-*.test.ts guards (docs-deferred-ledger, docs-dangling-refs, docs-review-disposition, docs-linerefs, docs-fork-decision) exit 0 in one run, plus both skill-fork-honesty/tool-coverage guards, matching 14-02's recorded post-edit baseline exactly"
    requirement: null
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts docs-dangling-refs.test.ts docs-review-disposition.test.ts docs-linerefs.test.ts docs-fork-decision.test.ts (25/25 passing)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-fork-honesty.mjs (11 mentions/30 files/6 dirs/24 fork-only names, byte-identical to 14-02's baseline) and node scripts/check-skill-tool-coverage.mjs, both exit 0"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 5: Closed the Record on `retain` — Todo Disposed, Requirements Marked, Downstream Phases Handed the Decision

**Fork-removal todo closed honestly against the decided `retain` branch; FORK-01/FORK-02 marked Complete in REQUIREMENTS.md; ROADMAP.md's Phase 14 Notes and Phase 15/16/17 dependency notes resolved against the decision; the deferred-items ledger reconciled (20 pending + 1 UAT gap) with its previously-stale prose count corrected to match.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-22T10:49:00Z (approx, immediately following 14-04's completion)
- **Completed:** 2026-08-22T11:15:00Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- Confirmed the FORK-01 branch token directly from `14-01-SUMMARY.md`'s
  `## Decision` section before any edit: **`retain`**, decided by a human at
  a `gate="blocking-human"` checkpoint, sub-question B **not** overridden.
- `.planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`
  moved to `.planning/todos/completed/` with a `## Resolution` section
  citing the dated `FORK-01` Key Decisions row, 14-02's `14-ROUTE-EVIDENCE.md`
  (all 17 hard-loss mention sites `holds-as-is`), and 14-03's
  `14-CRITERION3-EVIDENCE.md` (the fork's own `-mcpserver` transport
  exercised live for the first time, 6/6 passing). The Resolution also
  answers the todo's own cross-reference to `warp-over-resource_set`
  directly (not moot — see below).
- `FORK-01` and `FORK-02` ticked complete in `.planning/REQUIREMENTS.md`,
  Traceability rows flipped to `Complete`, and a closure note added under
  `FORK-02` recording that sub-question B's un-overridden default reading
  (an honest, complete statement of permanent loss satisfies the
  requirement — no replacement-capability requirement was added) is what
  was applied, and on whose authority (the plan's own default, since the
  human did not override it). `requirements.ready-ids` confirmed 2/2 ready
  before marking, per the shared-ID gate's own protocol.
- `.planning/STATE.md`'s `## Deferred Items` table had the fork-removal
  todo's row removed and its previously-stale "18 pending" prose (in two
  separate places — the `### Pending Todos` section and the `## Deferred
  Items` lead paragraph) corrected to the actual, current count: **20
  pending todos + 1 UAT gap = 21 total items** (down from 22, since only
  the fork-removal todo closed this plan — 14-03's `tools-manifest.json`
  todo and other tail-activity todos were already accounted for in the
  table, just not in the prose). A completed-todo stem mention inside the
  guarded section was also rephrased to a description without the literal
  filename, since the guard's direction-B check does a bare substring scan.
- `.planning/ROADMAP.md`'s Phase 14 section gained a `**Notes**:` block:
  branch token, decision date, and an explicit verdict for each of the
  three success criteria — criterion 3's "remove" clause stated as **not
  in play** on this branch rather than softened or omitted, per the
  `<human-check>`'s own requirement.
- ROADMAP.md's Phase 15 section gained a resolved dependency note: the
  `warp-over-resource_set` todo's fork-facing question is answered **not
  moot** (the fork stays; mark `vice_machine_config_set`'s `WarpMode`
  description fork-only per SKILL-01 rather than delete it), `WR-13`'s dead
  second refusal string is confirmed **still open** (14-02 made zero edits
  to `capability-registry.ts`), and a structural-cause handoff names Phase
  14 as the fourth instance of review findings landing after the last
  plan's own SUMMARY (after Phases 08, 09, 13).
- ROADMAP.md's Phase 16 section gained a resolved dependency note:
  14-04 confirmed zero code deletion under the current tree, so the
  sweep-path-and-line-reference-once rationale is **unamended**.
- ROADMAP.md's Phase 17 section gained a resolved dependency note: this
  phase's disposition reduced the pending-todo count `DEBT-04` measures
  from 21 to 20 (22 → 21 total Deferred Items) — explicitly **not** yet the
  "true close" count criterion 2 requires, since Phases 15 and 16 still
  have disposition and relocation work outstanding.
- `.planning/REQUIREMENTS.md`'s `## Future Requirements` gained a new
  `### Fork Backend Follow-on` section with three named-owner entries (the
  24-fork-only-tool disposition, breaking-tool-surface release handling
  naming `[skip release]`, and manual `KEYBOARD_MATRIX_SET` reversal-trigger
  tracking), and `## Out of Scope` gained one entry recording that a
  version probe for an opcode with zero wire presence is not being built.
- `.planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md`
  gained a `## FORK-01 decision applied` section answering its own
  fork-facing question directly, so Phase 15 does not have to re-derive it.
- **README.md deliberately left untouched.** On `retain`, 14-04 made no
  `resolvedBackend()` default flip, so README.md's backend-fallback prose
  was never wrong — `git diff --quiet -- README.md` confirmed empty before
  and after every other edit in this plan. Recorded as a decided zero, not
  a silent omission.
- **`remove-now` contingency work correctly skipped, visibly.** Task 2's
  branch-conditional `**Recommended follow-on**` note (proposing a
  fork-removal-execution phase) does not apply on `retain` and was not
  added — ROADMAP.md's Phase 14 Notes explicitly states the remove clause
  "does not apply on this branch" rather than silently omitting any mention
  of it.

## Task Commits

1. **Task 1: Dispose the standing todo and reconcile the deferred ledger** - `ac1320d` (docs, partial — see below), `d64e187` (docs, completes Task 1)
2. **Task 2: Hand the outcome to the phases that were sequenced to wait for it** - `90b85e6` (docs)

**Note on Task 1's split commit:** the first `git add` invocation used an
invalid pathspec (a file already renamed by `git mv`, re-listed by its old
path) and failed atomically before staging `REQUIREMENTS.md`/`STATE.md`,
so `ac1320d` landed only the bare `git mv` (0 content changes — the
Resolution-section edit had not yet been staged at that point). `d64e187`
immediately followed with the actual content: the Resolution section, the
REQUIREMENTS.md ticks/closure note, and the STATE.md reconciliation. Both
commits are part of Task 1; nothing was lost or silently dropped — `git diff
ac1320d..d64e187` shows exactly the intended Task 1 diff.

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - `FORK-01`/`FORK-02` ticked complete, Traceability rows `Complete`, closure note, three new Future Requirements entries, one new Out of Scope entry
- `.planning/ROADMAP.md` - Phase 14 Notes block; Phase 15/16/17 resolved dependency notes
- `.planning/STATE.md` - Deferred Items table row removed, stale prose counts corrected in two places, Current Position updated for 14-05's completion
- `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` - moved from `pending/`, `## Resolution` section added
- `.planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` - `## FORK-01 decision applied` section added

## Decisions Made

See `key-decisions` in frontmatter. The load-bearing ones: the branch was
independently re-confirmed as `retain` before any edit; the fork-removal
todo was closed (not rewritten-and-kept-pending) because `retain` genuinely
settles its open question; no unmet-criterion qualifier was needed on
FORK-01's closure note because criterion 3's remove clause simply does not
apply on this branch; and the stale "18 pending" prose was corrected in both
places it appeared, per the plan's own explicit must-have.

## Deviations from Plan

None — plan executed exactly as written for the `retain` branch. The
`remove-now`/`deprecate-first` contingency work (todo rewrite instead of
closure, `**Recommended follow-on**` note, README.md correction) was
correctly gated to non-`retain` branches by the plan's own action text and
skipped visibly, not silently.

## Issues Encountered

- **Full-suite `node test-gate.mjs` run (2099 tests) surfaced 9 failures / 4
  cancelled on the first pass.** This plan made zero edits to
  `.claude/mcp/vice/` (confirmed by `git diff --quiet -- .claude/mcp/vice`
  throughout), so any failure here is pre-existing, not introduced by this
  plan. All 13 non-passing cases were individually diagnosed, not waved
  off: `audit-integrity.test.ts`'s D-12-02 case (1), `broker-control.test.ts`'s
  two singleton cases (2), `broker-e2e.test.ts`'s SIGTERM/SIGINT cases (2),
  `anno-cli.test.ts`'s six `--help`/verb-options-map cases (6), and
  `anno-mcp-client.test.ts`'s one timeout Property case (1) — all match
  this session's pre-named known-flaky-under-full-suite-load set exactly,
  and each was individually re-run focused and confirmed clean: `audit-integrity.test.ts`
  43/43, `broker-control.test.ts` 45/45, `broker-e2e.test.ts` 11/11 pass + 1
  skip, `anno-cli.test.ts` 64/64, `anno-mcp-client.test.ts` 23/23.
  **One case was NOT on the pre-named list by file name:**
  `broker-kill.test.ts`'s `registerShutdownHandlers: an injected uncaught
  exception...` case (16.9s duration under load). Diagnosed rather than
  dismissed: it is the same underlying class (a real-child-process,
  signal/timing-sensitive test under full-suite CPU/IO contention) as the
  named `broker-control.test.ts`/`broker-e2e.test.ts` cases, confirmed
  clean in isolation (`node --test broker-kill.test.ts` — 38/38 passing),
  and this plan made no edit to that file or anything it depends on. Six
  orphaned `/bin/sleep 600` stub processes left behind by these tests'
  child-process handling under load were found and killed by hand
  (`pkill -9 -f "sleep 600"`) after the run, confirmed clean afterward.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ROADMAP.md's Phase 15 section can be planned with the retain decision's
  consequences already resolved: `warp-over-resource_set`'s fork-facing fix
  is named (mark fork-only, don't delete), `WR-13`'s dead string is
  confirmed still open for `GATE-02` to disposition, and Phase 14 is named
  in the structural-cause handoff list.
- ROADMAP.md's Phase 16 section's sweep-once relocation rationale is
  confirmed unamended by this phase.
- ROADMAP.md's Phase 17 section has the pending-todo delta this phase
  produced (22 → 21) on record, explicitly not yet the true `DEBT-04` close.
- `FORK-01` and `FORK-02` are now `Complete` in `.planning/REQUIREMENTS.md`
  — this was the last declaring plan for both shared IDs.
- Phase 14 itself is **not** marked complete by this plan — that is the
  orchestrator's `phase.complete` step, run after this SUMMARY is recorded,
  per this dispatch's own instruction not to duplicate that step here.
- No blockers.

## Self-Check: PASSED

- `[ -f .planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md ]` → FOUND
- `[ ! -f .planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md ]` → CONFIRMED ABSENT
- `git log --oneline --all | grep -q ac1320d` → FOUND
- `git log --oneline --all | grep -q d64e187` → FOUND
- `git log --oneline --all | grep -q 90b85e6` → FOUND
- `grep -c '^- \[x\] \*\*FORK-01\*\*' .planning/REQUIREMENTS.md` → 1
- `grep -c '^- \[x\] \*\*FORK-02\*\*' .planning/REQUIREMENTS.md` → 1
- `grep -n 'FORK-01 | 14\|FORK-02 | 14' .planning/REQUIREMENTS.md` → both read `Complete`
- `ls .planning/todos/pending/*.md | wc -l` → 20
- `grep -c '^| todo |' <(sed -n '/^## Deferred Items/,/^## Session Continuity/p' .planning/STATE.md)` → 20 (matches)
- `grep -c '^### Phase' .planning/ROADMAP.md` → 6 (unchanged)
- `git diff --quiet -- README.md` → exit 0 (no edit, as required on `retain`)
- All task-level `<acceptance_criteria>` re-run: PASS
- Plan-level `<verification>` re-run: PASS — 25/25 across the five `docs-*.test.ts` guards; `check-skill-fork-honesty.mjs` and `check-skill-tool-coverage.mjs` both exit 0 at baseline-matching counts; full `node test-gate.mjs` run diagnosed (see Issues Encountered) with zero unexplained failures

---
*Phase: 14-backend-decision*
*Completed: 2026-08-22*
