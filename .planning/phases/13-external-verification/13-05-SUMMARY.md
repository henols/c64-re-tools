---
phase: 13-external-verification
plan: 05
subsystem: testing
tags: [documentation-guards, deferred-ledger, todo-discipline, stock-vice-parity]

requires:
  - phase: 13-external-verification (plans 13-01, 13-02, 13-03, 13-04)
    provides: 13-CAPTURE-TRANSCRIPT.md, 13-HELP-DISCRIMINATOR-EVIDENCE.md and 13-PROBE-RESULTS.md's evidence; the A5 vice_disk_attach tool-contract finding handed over via D-13-04's escape hatch
provides:
  - Both retired verdicts in docs/phase2-backend-probe-evidence.md resolved with artifact citations, closing EXTV-01 and EXTV-02
  - A one-sentence caveat in docs/stock-vice-parity.md §A item 7 distinguishing a wrong probed implementation detail from a licensed divergence
  - Two finished todos moved to .planning/todos/completed/ with Resolution sections
  - The probe-phase3 todo trimmed to A4 as its only remaining item
  - Two newly filed pending todos for findings this phase surfaced but did not fix
  - STATE.md's Deferred Items section reconciled against the post-phase todo tree, passing docs-deferred-ledger.test.ts in both directions
affects: [milestone close, docs/phase2-backend-probe-evidence.md, docs/stock-vice-parity.md, .planning/STATE.md]

actuals:
  tokens: 58000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: ["closure-statement-with-citation: a retired verdict is only closed by a sentence naming the artifact/transcript that proves it, never by prose alone"]

key-files:
  created:
    - .planning/todos/pending/2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md
    - .planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md
  modified:
    - docs/phase2-backend-probe-evidence.md
    - docs/stock-vice-parity.md
    - .planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md
    - .planning/STATE.md
  moved:
    - .planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md -> .planning/todos/completed/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md
    - .planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md -> .planning/todos/completed/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md

key-decisions:
  - "Closed §1's EXTV-01 record honestly against D-13-01's accepted consequence: the re-recorded fixtures are real evidence for the wire protocol but were captured from the fork build (whichever x64sc resolved first on PATH), not genuine stock -- recorded as a deliberately out-of-scope byte-drift question, not silently assumed away."
  - "Closed §2's EXTV-02 verdict as resolved but did not overstate it: the -help/-? fallback ladder branches are recorded as unexercised on this host, not verified, because both real builds exited 0 with non-empty output on the first --help attempt."
  - "The probe-phase3 todo's A1/A2/A3/A5 sections were rewritten to point at 13-PROBE-RESULTS.md's recorded verdicts rather than restating them as open questions, and its frontmatter no longer claims phase 13 resolves it -- A4 stays its only remaining item with the CPU-loop-stall exclusion reason stated up front."
  - "Filed two todos rather than silently absorbing them: the two mislabelled cpuhistory-get* sidecars (13-RESEARCH.md's Open Question 1) and the vice_disk_attach D-14 tool-contract finding plan 13-04 handed over via its escape hatch -- neither was fixed in this verification-record plan."
  - "STATE.md's Deferred Items section edits kept the pending count numerically unchanged at 18 (two closed, two filed) -- called out explicitly in prose so the unchanged number does not read as 'nothing moved'."

patterns-established:
  - "Pattern: a retired verdict's closure statement always names the requirement it closes and cites the artifact/transcript by path, so 'a verdict that cites only itself' (T-13-12's threat) cannot pass the acceptance grep."

requirements-completed: [EXTV-01, EXTV-02, EXTV-03]

coverage:
  - id: D1
    description: "Both retired verdicts in docs/phase2-backend-probe-evidence.md (§1 EXTV-01, §2 EXTV-02) resolved with artifact citations; the -help/-? fallback ladder recorded as unexercised rather than verified"
    requirement: EXTV-01
    verification:
      - kind: other
        ref: "cd .claude/mcp/vice && node --test docs-dangling-refs.test.ts docs-linerefs.test.ts (11/11 pass) plus the plan's own inline citation-presence script"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/stock-vice-parity.md §A item 7 gains a one-sentence caveat distinguishing a wrong probed implementation detail from a licensed divergence"
    verification:
      - kind: other
        ref: "git diff --numstat docs/stock-vice-parity.md (4 lines added, within the plan's own cap)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two finished todos moved to .planning/todos/completed/ with Resolution sections answering every numbered acceptance step (6 for the fixtures todo, 5 for the discriminator todo)"
    requirement: EXTV-01
    verification:
      - kind: other
        ref: "the plan's own node -e verification script confirming renames, Resolution headings, and both stems present in completed/ absent from pending/"
        status: pass
    human_judgment: false
  - id: D4
    description: "The probe-phase3 todo trimmed to A4 as its only remaining item; two new findings filed as pending todos"
    requirement: EXTV-03
    verification:
      - kind: other
        ref: "the plan's own node -e verification script (pending floor >=10, positive-control todo untouched, mislabel todo present)"
        status: pass
    human_judgment: false
  - id: D5
    description: "STATE.md's Deferred Items section passes docs-deferred-ledger.test.ts in both directions against the post-phase todo tree"
    verification:
      - kind: unit
        ref: "docs-deferred-ledger.test.ts (4/4 pass, both directions plus non-vacuity and planted-violation)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-22
status: complete
---

# Phase 13 Plan 05: Close the Phase's Record Summary

**Resolved both retired verdicts in `docs/phase2-backend-probe-evidence.md` with artifact citations, closed the two finished probe-debt todos with Resolution sections, trimmed the third to its one remaining item (A4), filed two new findings as pending todos, and reconciled `STATE.md`'s Deferred Items ledger so `docs-deferred-ledger.test.ts` passes in both directions.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-22T00:15:00Z (approx.)
- **Completed:** 2026-08-22T00:42:39Z
- **Tasks:** 3
- **Files modified:** 8 (2 docs, 2 todos moved with Resolution sections added, 1 todo trimmed, 2 new todos filed, STATE.md)

## Accomplishments

- `docs/phase2-backend-probe-evidence.md` §1 closed: the D-19 override record now names the EXTV-01 closure, the resolved binary (`fork:/usr/local/bin/x64sc`, VICE `3.10.0.0`), the event-order outcome (differs from the synthetic model, matches `docs/phase1-probe-results.md`'s recorded order), the terminator-frame outcome (CONFIRMED, no correction needed), and D-13-01's accepted fork-vs-stock consequence.
- `docs/phase2-backend-probe-evidence.md` §2 resolved: the `OPEN, not resolved either way` verdict replaced with a resolution citing both committed `fixtures/backend-detect/` transcripts, `probeBackend()`'s live per-binary verdicts, `resolvedBackend()`'s zero-additional-probe cache round-trip, and the `-help`/`-?` fallback ladder recorded honestly as unexercised rather than verified.
- `docs/stock-vice-parity.md` §A item 7 gained a one-sentence caveat (4 added lines) distinguishing a wrong probed implementation detail from a licensed divergence, naming where the per-assumption verdicts live.
- Both finished probe-debt todos `git mv`-moved to `.planning/todos/completed/` with Resolution sections citing plans 13-01/13-02's commits and answering every one of their numbered acceptance steps (6 and 5 respectively) — including the honest non-answers (e.g. the fallback ladder's "unexercised" finding) rather than upgrading them to passes.
- `2026-08-14-probe-phase3-assumed-wire-details.md` rewritten in place: A1/A2/A3/A5 sections now point at `13-PROBE-RESULTS.md`'s recorded verdicts instead of restating open questions; the acceptance check trimmed to A4 only, with the CPU-loop-stall exclusion reason stated at the top; frontmatter no longer claims phase 13 resolves it.
- Filed `.planning/todos/pending/2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md` (two real `cpuhistory-get*` sidecars record `capturedFrom: "stock"` for a fork binary path, found via `13-RESEARCH.md`'s Open Question 1) and `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md` (plan 13-04's escape-hatch finding: `vice_disk_attach`'s advertised D-14 no-side-effect approximation is empirically false per `13-PROBE-RESULTS.md` §A5).
- `STATE.md`'s `## Deferred Items` section reconciled: both closed stems removed everywhere in the section (including prose), both new stems added as rows, the probe-phase3 row updated to state its A4-only remainder, `## Current Position` rewritten to describe phase 13's actual state instead of stale Phase 12 audit-gate narrative, and a new `### Decisions` entry added for this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip both retired verdicts in the evidence doc and add the parity caveat** - `ed61f98` (docs)
2. **Task 2: Close the two finished todos, trim the third to A4 only, and file every surfaced-but-unfixed finding** - `0b1abd9` (docs)
3. **Task 3: Update STATE.md's deferred ledger so its two-directional guard stays green** - `7f299d9` (docs)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `docs/phase2-backend-probe-evidence.md` - §1 and §2 verdicts closed/resolved with citations
- `docs/stock-vice-parity.md` - §A item 7's one-sentence caveat
- `.planning/todos/completed/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` - moved, Resolution added
- `.planning/todos/completed/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md` - moved, Resolution added
- `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md` - trimmed to A4
- `.planning/todos/pending/2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md` - new
- `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md` - new
- `.planning/STATE.md` - Deferred Items ledger, Current Position, Decisions, frontmatter timestamps

## Decisions Made

See `key-decisions` in frontmatter — summarized: closed EXTV-01/EXTV-02 honestly against their accepted limits (fork-not-stock provenance; unexercised fallback ladder), rewrote rather than deleted the probe-phase3 todo's answered sections, filed rather than silently absorbed the two surfaced-but-unfixed findings, and called out in STATE.md prose that the pending count holding at 18 is arithmetic coincidence (two closed, two filed) not stagnation.

## Deviations from Plan

None - plan executed exactly as written. The one incidental discovery — `build-atomic.test.ts`'s "private temp directory is cleaned up" test failed once under the full `npm test` run and passed on immediate retry and in isolation — is a pre-existing timing flake in a file this plan never touched (confirmed unrelated: this plan's diff touches only `docs/`, `.planning/todos/`, and `.planning/STATE.md`). Logged here for visibility, not filed as a new todo, since it did not reproduce.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 is now complete: all five plans (13-01 through 13-05) have SUMMARY.md files, EXTV-01/EXTV-02/EXTV-03 are all satisfied by cited evidence, and the milestone's `docs-*.test.ts` guard set (`docs-deferred-ledger.test.ts`, `docs-dangling-refs.test.ts`, `docs-review-disposition.test.ts`, `docs-linerefs.test.ts`) is green.
- Two new pending todos are filed for the next session or a future phase to disposition: the `cpuhistory-get*` sidecar mislabel (low priority, cosmetic) and `vice_disk_attach`'s D-14 tool-contract correction (high priority — a real caller-facing correctness gap).
- The pending-todo count is 18 (unchanged numerically from before this phase; composition changed) plus Phase 03's UAT gap, all reconciled in `STATE.md`'s Deferred Items section.
- Requirements `EXTV-01`, `EXTV-02` and `EXTV-03` are ready to mark complete: this is the last plan declaring all three, and their sibling plans (13-01/13-02/13-03/13-04) already have SUMMARYs.

---
*Phase: 13-external-verification*
*Completed: 2026-08-22*

## Self-Check: PASSED

- All 7 key files (2 created, 4 modified, 2 moved-with-edit — one file, `2026-08-14-probe-phase3-assumed-wire-details.md`, counted once) confirmed present on disk at their final paths; both moved todos confirmed absent from `.planning/todos/pending/` and present in `.planning/todos/completed/`.
- All three task commits (`ed61f98`, `0b1abd9`, `7f299d9`) confirmed in `git log --oneline --all`.
- Re-ran every task's `<acceptance_criteria>` command: all passed (grep for the retired OPEN verdict returns nothing; the evidence-doc citation script passes; `git diff --numstat docs/stock-vice-parity.md` shows exactly 4 added lines; the todo-tree verification script reports "18 pending, 11 completed" with both closures, the A4-only trim, the untouched positive control, and the new mislabel todo all confirmed).
- Re-ran the plan-level `<verification>` block: `node --test docs-deferred-ledger.test.ts docs-dangling-refs.test.ts docs-review-disposition.test.ts docs-linerefs.test.ts` — 19/19 pass; `npm run test:automated` — 2091 tests / 2086 pass / 0 fail / 5 pre-existing todo; `npm test` — 1 transient failure in `build-atomic.test.ts` (a file this plan never touched) on the first run, 2262 tests / 2227 pass / 0 fail / 30 skipped / 5 todo on immediate retry, confirming the flake is pre-existing and unrelated.
