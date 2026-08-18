---
phase: 07-cycle-timing-and-wedge-triage
plan: 18
subsystem: documentation
tags: [gap-closure, documentation-integrity, stock-vice, wedge-triage, requirements-tracking]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage plan 11
    provides: the CR-01 decode-vs-transport classification guard this plan cites as the connect-time half of the fix
  - phase: 07-cycle-timing-and-wedge-triage plan 12
    provides: the re-derived CPUHISTORY_GET wire layout and real fixture captures this plan cites
  - phase: 07-cycle-timing-and-wedge-triage plan 13
    provides: the live status (both binaries, both version quads, exact cycle figures) this plan quotes verbatim
  - phase: 07-cycle-timing-and-wedge-triage plan 14
    provides: vice_run_until's machineHalted/raceResolved/reachedUnknown field set this plan documents
  - phase: 07-cycle-timing-and-wedge-triage plan 15
    provides: machinePausedSource and the diagnosis_unavailable outcome (7 reason classes, exact message prefix) this plan documents
  - phase: 07-cycle-timing-and-wedge-triage plan 16
    provides: the WR-07 backend-aware advertised-schema fix this plan cites
  - phase: 07-cycle-timing-and-wedge-triage plan 17
    provides: the live triage proofs (checkpoint_trap, wedged, restarted) this plan cites, including their named honest limits
provides:
  - "docs/stock-vice-parity.md's false CR-01 'live-confirmed' claim corrected, with the actual history, both fixes, and 07-13's live status recorded in order"
  - "vice-wedge-triage/SKILL.md's opening move has a documented, actionable response for diagnosis_unavailable (all 7 reason classes) plus corrected confidence grades and provenance"
  - "c64-program-recon/references/tool-selection.md's unqualified 'vice_run_until has no working timeout' claim replaced with a backend-qualified statement"
  - "REQUIREMENTS.md's TIME-01/02/03 re-marked Complete with plan citations; TIME-04 re-marked Partial (new status value, defined in-file) with the specific unproven paths named"
  - "07-VALIDATION.md's Manual-Only table updated from the gap-closure batch's actual live results; nyquist_compliant's blocker moved from the resolved CPUHISTORY_GET row to the still-open broker-mediated monitor_held_elsewhere row"
  - "deferred-items.md's 07-10 entry gains a resolution note (07-11/07-12/07-13) without altering the original entry"
affects: [Phase 8 (SKILL-01, BACK-05, DIST-01..03 planning should read TIME-04's remaining broker-mediated gap and the accurate parity doc), any future reader of docs/stock-vice-parity.md or vice-wedge-triage/SKILL.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation claims must be sourced from a named plan SUMMARY's recorded evidence, never from intent or a prior draft's wording -- every 'live-confirmed'/'Confidence: HIGH' claim in the edited sections now names a binary path, a version quad, and the plan that produced the evidence"
    - "Introduce a new status value (REQUIREMENTS.md's 'Partial') only where the evidence genuinely does not support 'Complete', defined once in-file rather than left implicit"

key-files:
  created: []
  modified:
    - docs/stock-vice-parity.md
    - .claude/skills/vice-wedge-triage/SKILL.md
    - .claude/skills/c64-program-recon/references/tool-selection.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md
    - .planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md

key-decisions:
  - "TIME-04 marked Partial, not Complete, even though checkpoint_trap/wedged/restarted are now live-proven (07-17): the broker-mediated monitor_held_elsewhere verdict and a broker-supervised (not test-performed) restarted respawn remain unit-proven only per 07-13 Task 3's and 07-17's own explicitly-recorded scope boundaries -- this is exactly the class of proof the plan's source_audit named as still outstanding, so it is written down as outstanding rather than rounded up"
  - "TIME-01/02/03 marked Complete despite 07-14's WR-01/WR-02 honesty fields (part of TIME-02) being unit-proven only, not independently re-exercised live by this batch: the core mechanism each of these three requirements names was already live-proven (07-10 for run-until reach/timeout; 07-13 for cycles/diagnose connect), and the fixes layered on top are correctness patches proven via realistic derivation (a real PC read, not an assumption) -- this is judged different in kind from TIME-04's genuinely-never-attempted broker-mediated proof, which 07-VERIFICATION.md's own human_verification item 2 named as a required future step"
  - "docs/stock-vice-parity.md's item 4 (Route B/Route A dual-route stopwatch entry) was also corrected, even though the plan's read_first list did not name it explicitly -- its 'wire-layout mismatch not yet root-caused' note was now stale given 07-12/07-13's fix, and leaving it would have re-introduced the exact class of drift this plan exists to remove"
  - "'Open requirements per phase' Phase 7 count corrected from a stale '4' to '1': the prior figure predated the checklist's own [x] marks for three of the four TIME rows -- the same class of pre-existing drift Phase 5's line already documents correcting once for DERIV-01. The overall 35/12 complete/open split was moved to 38/9 by the same +3/-3 delta, with an explicit note that the per-phase breakdown is not fully exhaustive across every phase (e.g. DIRECT-06's Partial is not itemised in it) and this plan did not attempt a full independent re-audit beyond its own Phase 7 correction"

requirements-completed: [TIME-01, TIME-02, TIME-03]

# Metrics
duration: ~70min
completed: 2026-08-18
---

# Phase 07 Plan 18: Documentation Integrity Gap Closure (Gap 4 + Docs Halves of Gaps 1-3) Summary

**Corrected `docs/stock-vice-parity.md`'s false CR-01 "live-confirmed" claim and `vice-wedge-triage/SKILL.md`'s overstated confidence grades, gave the skill's opening move an actionable response for the `diagnosis_unavailable` non-verdict outcome, and re-marked `REQUIREMENTS.md`'s TIME-01..04 and `07-VALIDATION.md`'s Manual-Only table from the seven gap-closure plans' actual recorded evidence rather than from intent.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-18
- **Tasks:** 3/3 completed
- **Files modified:** 6

## Accomplishments

- **Task 1 (Gap 1 documentation blocker):** `docs/stock-vice-parity.md`'s §A "stock correctness gain" paragraph — which claimed the CPU-history capability "now actually resolves to `available` ... live-confirmed against the fork's own genuine VICE 3.10.0.0 build" at a time when the connect handshake failed before any capability value existed — is rewritten as a corrected history: the `count=0`→`count=1` fix (07-01), the worse failure it exposed (CR-01), and the two real fixes that closed it (07-11's decode-vs-transport guard, 07-12's re-derived wire layout from real captures), ending with 07-13's actual live status (both binaries, both version quads, 511,061/530,713 exact cycles). Three new §A entries document `diagnosis_unavailable` (07-15), `vice_run_until`'s `machineHalted`/`raceResolved` reporting (07-14), and the WR-07 advertised-schema fix (07-16). Item 4's stale "wire-layout mismatch not yet root-caused" note is also updated to point at its resolution.
- **Task 2 (Gap 4, skill actionability):** `vice-wedge-triage/SKILL.md` gains a `diagnosis_unavailable` row in the verdict-response table plus a 7-reason-class guidance table (never a jump to `vice_recycle`), a corrected `vice_run_until` confidence paragraph naming both binaries and version quads, a corrected Provenance row reflecting 07-17's actual live results (with the test-performed-vs-broker-supervised `restarted` caveat and the broker-mediated `monitor_held_elsewhere` gap both named), an updated backend note confirming WR-07 makes "read the tool's own schema" true on stock, and `machinePausedSource` guidance. `c64-program-recon/references/tool-selection.md`'s unqualified "`vice_run_until` has no working timeout" is replaced with a backend-qualified statement (fork: none; stock: `timeout_ms`-bounded per D-02), the only other permitted edit being a parenthetical on the five-state verdict row.
- **Task 3 (REQUIREMENTS.md / 07-VALIDATION.md / deferred-items.md):** `TIME-01`/`TIME-02`/`TIME-03` re-marked `Complete` with plan citations; `TIME-04` re-marked `Partial` — a new status value defined in-file — citing the still-unit-only broker-mediated `monitor_held_elsewhere` verdict and broker-supervised `restarted` respawn. The "Open requirements per phase" Phase 7 count is corrected from a stale `4` to `1`, and the coverage summary's 35/12 complete/open split moves to 38/9, with the arithmetic shown below. `07-VALIDATION.md`'s Manual-Only table moves the Route A row from OUTSTANDING to a full PASS (citing 07-12/07-13's measured cycle figures), updates the `vice_diagnose` row with 07-17's per-verdict live results, adds two new rows (`stockConnect()` on both binaries; `restarted` after a real kill-and-relaunch), and moves `nyquist_compliant`'s named blocker from the now-resolved CPUHISTORY_GET row to the still-open broker-mediated contention row. `deferred-items.md`'s 07-10 entry gains a resolution note citing 07-11/07-12/07-13 without altering the original entry text (verified byte-identical via `git diff`, append-only).

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct docs/stock-vice-parity.md's false claim and record what is now actually established** - `b57848a` (docs)
2. **Task 2: Give the skill an actionable response for every stock outcome, and correct its provenance grades** - `2a41f7f` (docs)
3. **Task 3: Re-mark REQUIREMENTS.md, update 07-VALIDATION.md's Manual-Only table, and close out deferred-items.md** - `d1a7277` (docs)

_No separate plan-metadata commit — this SUMMARY.md is committed by the worktree executor's final commit step._

## Files Created/Modified

- `docs/stock-vice-parity.md` — corrected the CR-01 history paragraph, added three new §A entries (`diagnosis_unavailable`, `vice_run_until` honesty fields, WR-07 schema fix), updated item 4's stale mismatch note.
- `.claude/skills/vice-wedge-triage/SKILL.md` — added a `diagnosis_unavailable` verdict-table row and reason-class guidance table; corrected the `vice_run_until` confidence paragraph and the Provenance table's stock row; updated the backend note; added `machinePausedSource` guidance.
- `.claude/skills/c64-program-recon/references/tool-selection.md` — backend-qualified the `vice_run_until` timeout claim; added a parenthetical to the five-state verdict row.
- `.planning/REQUIREMENTS.md` — re-marked TIME-01..04 (checklist + traceability table), added a `Partial` status definition, reconciled the Phase 7 open-count and coverage-summary arithmetic.
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md` — updated the Wave 0 CPUHISTORY_GET caveat, rewrote the Manual-Only Verifications table (5 rows updated/replaced, 2 new rows added), updated the sign-off checkboxes and `nyquist_compliant`'s named blocker and Approval note.
- `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` — appended a resolution note under the 07-10 entry.

## Surviving "live-confirmed" / "Confidence: HIGH" Claims and What Each Now Names

**`docs/stock-vice-parity.md`:**
- "live-reproduced independently twice: once in `07-REVIEW.md`, once in `07-VERIFICATION.md` against a freshly-launched, unmodified `/usr/local/bin/x64sc`" — names the binary; version quad (3.10) given by context (the CR-01 failure section).
- The quoted, explicitly-disavowed old claim ("... live-confirmed against the fork's own genuine VICE 3.10.0.0 build") — kept verbatim inside quotation marks as the thing being corrected, immediately followed by "and that claim was **wrong**".
- "live-confirmed against `/usr/local/bin/x64sc` (VICE 3.10.0.0) by **07-13**" — names binary, version quad, and plan.
- Item 4: "live-proven by **07-13** against `/usr/local/bin/x64sc` (VICE 3.10.0.0)" — names binary, version quad, and plan.

**`.claude/skills/vice-wedge-triage/SKILL.md`:**
- `vice_run_until` paragraph: "live-confirmed against genuine, unmodified `/usr/bin/x64sc` (VICE 3.9) and `/usr/local/bin/x64sc` (VICE 3.10) ... (07-10's live pass)" — both binaries, both quads, plan cited.
- Provenance table's stock row: "Live-proven against genuine `/usr/bin/x64sc` (VICE 3.9) and `/usr/local/bin/x64sc` (VICE 3.10) for `live` (07-10), `checkpoint_trap`, `wedged` ... and `restarted` (07-17)" — both binaries, both quads, plans cited, with the test-vs-broker-supervised caveat named in the same cell.

No occurrence of "live-confirmed" or "Confidence: HIGH" survives in the edited sections without a binary path, a version quad, and a citing plan in the same sentence/cell.

## Final `TIME-01`..`TIME-04` Statuses and Arithmetic Reconciliation

| Requirement | Prior status | New status | Evidence |
|---|---|---|---|
| TIME-01 | Complete (unjustified per 07-VERIFICATION.md) | **Complete** (07-11, 07-12, 07-13) | `stockConnect()` resolves with the correct capability on both genuine binaries; a real Route A bracket measures exact cycles on VICE 3.10.0.0 |
| TIME-02 | Complete (unjustified) | **Complete** (07-10, 07-14) | Reach/timeout mechanism live-proven pre-batch (07-10); WR-01/WR-02 honesty fields unit-proven (07-14) |
| TIME-03 | Complete (unjustified) | **Complete** (07-12, 07-13) | Route B refusal already live-proven; Route A decode fixed and live-proven on VICE 3.10.0.0 |
| TIME-04 | Complete (unjustified) | **Partial** (07-15, 07-16, 07-17) | `checkpoint_trap`/`wedged`/`restarted`(test-performed) live-proven; broker-mediated `monitor_held_elsewhere` and broker-supervised `restarted` remain unit-proven only |

**Arithmetic shown:** Phase 7's "Open requirements per phase" contribution moves from a stale `4` (which predated the checklist's own `[x]` marks) to `1` (`TIME-04` only). The coverage summary's "In scope: 47 — 35 already complete, 12 open" becomes "47 — 38 already complete, 9 open": +3 complete (`TIME-01`/`02`/`03` correctly counted as complete instead of the stale figure's incorrect "open"), -3 open (only `TIME-04` remains open, not all four). This delta is isolated to Phase 7's own contribution; the per-phase breakdown line is explicitly noted as not fully exhaustive across every phase (e.g. Phase 3's `DIRECT-06` Partial is not itemised in it), so the 9/38 totals reflect a targeted correction of Phase 7's own stale figure, not a full independent re-audit of every phase's arithmetic.

## `nyquist_compliant` Value Chosen and Why

**Value: `false`** (unchanged from before this plan — the value itself did not need to flip, only its named blocker).

**Why:** Of `07-VALIDATION.md`'s now-seven Manual-Only rows, six carry a full PASS (one of those six, `restarted`, carries an explicit test-performed-vs-broker-supervised caveat within its own PASS). One row — "Second-client contention does not itself hang the diagnostician" — remains PARTIAL: the socket-level contention bound is live-proven (07-13 Task 3, ~1501–1502ms against a 1500ms bound), but the broker-mediated `monitor_held_elsewhere` verdict (a real second `claimMonitor()` refusal from a genuinely broker-managed session) remains unit-proven only, per 07-13 Task 3's own recorded scope boundary. Per the standing instruction (T-07-19), `nyquist_compliant` stays `false` until every Manual-Only row is a full pass — the previous blocker (the Route A CPUHISTORY_GET decode mismatch) is now resolved and no longer named; the new, narrower named blocker is the broker-mediated contention gap.

## Deviations from Plan

None — plan executed exactly as written. One extension beyond the plan's explicit `read_first` list is noted in `key-decisions`: item 4 of `docs/stock-vice-parity.md`'s §A (the dual-route stopwatch entry) was also corrected to remove its own stale "not yet root-caused" note, since leaving it would have reintroduced exactly the kind of drift this plan exists to close, and the correction is a small, low-risk addition fully traceable to 07-12/07-13.

## Issues Encountered

- `node_modules` was absent at worktree start (never committed, per `CLAUDE.md`'s "Tech stack" note) — ran `npm ci --no-audit --no-fund` in `.claude/mcp/vice` to provision the already-locked dependencies from the committed `package-lock.json` before running the plan's `<verify>` test-gate command. This restores pinned, already-vetted dependencies from a committed lockfile (the project's own documented `SessionStart` provisioning step), not a new/unvetted package install.
- The worktree agent's initial branch check found HEAD at a stale ancestor of the required base (`6ff1acd7b4ccd0094d1519813bbe0720a2722246`) rather than at HEAD itself — a known recurring issue in this project (user memory `worktree-agents-fork-stale-base.md`). Corrected via `git reset --hard` to the correct base before any file edits, per the mandatory `<worktree_branch_check>` step. The working tree was clean and the stale commit was confirmed to be a genuine ancestor of the target base (not a divergent branch), so the reset was safe.

## User Setup Required

None — no external service configuration required. This plan changes no code; `node test-gate.mjs` was run only to confirm the plan's own top-level `<verification>` requirement ("this plan changes no code, so the suite must be unchanged") holds.

## Next Phase Readiness

- This is the last plan in Phase 7. `docs/stock-vice-parity.md`, `vice-wedge-triage/SKILL.md`, `c64-program-recon/references/tool-selection.md`, `REQUIREMENTS.md`, `07-VALIDATION.md`, and `deferred-items.md` are all now consistent with the gap-closure batch's actual recorded evidence.
- One genuine gap remains open and is now named accurately rather than hidden: the broker-mediated `monitor_held_elsewhere` verdict and a broker-supervised (not test-performed) `restarted` respawn are unit-proven only. A future plan standing up the host broker control plane with two real acquired sessions would close this and allow `nyquist_compliant: true`.
- Phase 8 planning (SKILL-01, BACK-05, DIST-01..03) can now read an accurate parity doc and skill without re-deriving what this gap-closure batch already established.

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `docs/stock-vice-parity.md`
- FOUND: `.claude/skills/vice-wedge-triage/SKILL.md`
- FOUND: `.claude/skills/c64-program-recon/references/tool-selection.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md`
- FOUND: `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md`
- FOUND: `.planning/phases/07-cycle-timing-and-wedge-triage/07-18-SUMMARY.md`
- FOUND commit: `b57848a` (Task 1)
- FOUND commit: `2a41f7f` (Task 2)
- FOUND commit: `d1a7277` (Task 3)
