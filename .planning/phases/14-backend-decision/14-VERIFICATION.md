---
phase: 14-backend-decision
verified: 2026-08-22
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 14: Backend Decision Verification Report

**Phase Goal:** The fork-backend question is answered by a dated decision rather than retained
by default for a third close, and whichever way it goes, a user hitting one of the three hard
losses (SID read-back, matrix keyboard, RESTORE/NMI) has an actual route to follow.
**Verified:** 2026-08-22
**Status:** passed

## Goal Achievement

The phase's deliverable was a *decision*, and a decision was taken: **`retain`**, chosen by a
human at plan 14-01's `gate="blocking-human"` checkpoint after the orchestrator explicitly
escalated a `"you decide"` response rather than inferring the branch. That escalation is the
load-bearing fact for this phase's goal — FORK-01 exists because the question had been answered
by default at two milestone closes, and the failure mode being guarded against was a third
silent carry. It was not inferred, not auto-approved, and not selected as the cheaper branch to
plan.

Verification did not rely on SUMMARY.md claims. Each criterion below was reproduced
independently against the live tree.

## Criterion Verdicts

### 1. Dated `FORK-01` entry with reversal criteria — VERIFIED

`.planning/PROJECT.md` carries a dated `FORK-01` row (2026-08-22) in `## Key Decisions`, three
cells matching the table's existing shape. Its Rationale names the `KEYBOARD_MATRIX_SET` opcode
landing as the reversal trigger and is correctly scoped: the opcode has not landed as of VICE
3.10, `apt` lags a release behind, landing it closes matrix keyboard specifically, its effect on
RESTORE/NMI is unconfirmed, and it closes SID read-back **not at all** because that is a
write-only-hardware fact no opcode changes. The row does not overclaim.

`docs-fork-decision.test.ts` re-run: 6/6 pass. The guard matches `KEYBOARD_MATRIX_SET`
case-sensitively, as its plan required, and was proven non-vacuous by a real break-and-restore.
The `## Out of Scope` bullet now cites FORK-01 instead of standing as the sole record.

### 2. A followable route at the point of use — VERIFIED

Two of the 17 sites enumerated in `14-ROUTE-EVIDENCE.md` were spot-checked directly against the
live files (`observation-hazards.md`, `README.md`) rather than taking the evidence document's
word — both matched. `capabilityRefusalMessage()` was called live: the refusal strings for all
three hard-loss tools contain `unrecoverable` and point to `Set VICE_BACKEND=fork`.
`capability-registry.test.ts` 13/13 pass. Both the skill-fork-honesty and skill-tool-coverage
guards re-run at exit 0 with unchanged floors.

The zero-diff outcome here is correct, not an omission: research found all three routes already
existed, were already annotated per-section, and were already policed by two mechanical guards.

### 3. Decision reflected in the code's actual state, checked live — VERIFIED

The `retain` clause is the operative one. `fork-live.test.ts` was run twice during verification:

- Opt-in variable unset → **6/6 skipped**, proving the default-skip is genuine and never hangs.
- `VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc` → **6/6 passed, 0 skipped**, with real observed
  payloads for `vice_ping`, `vice_registers_get`, and the load-bearing `vice_sid_get_state`,
  matching the output recorded in `14-CRITERION3-EVIDENCE.md`.

Fork-versus-stock binary identity was confirmed by `--help`/`-version` probe: the fork build at
`/usr/local/bin/x64sc` reports VICE 3.10 and advertises six `mcpserver` flags; genuine unpatched
stock at `/usr/bin/x64sc` reports 3.9 and advertises none. No stray emulator process survived
either run.

This is the first time in the repository's history that the fork's own `-mcpserver` HTTP
transport has been exercised live — `broker-e2e.test.ts` stubs the binary to `/bin/sleep`, and
Phase 13's live captures spoke stock `-binarymonitor` to the fork *binary* rather than its own
endpoint. Criterion 3's "if remove" clause does not apply on this branch, so there is no unmet
part to record and no follow-on removal phase to recommend.

## Requirement Traceability

| ID | Declared by | Status |
|----|-------------|--------|
| FORK-01 | 14-01, 14-03, 14-04, 14-05 | Complete |
| FORK-02 | 14-02, 14-03, 14-05 | Complete |

Both were held `Pending` by the shared-ID gate until 14-05, the last declaring plan, finished —
correct behaviour. Plan 14-04 attempted `requirements.mark-complete FORK-01` while still blocked
and correctly reverted it. `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` and `PROJECT.md` were
checked mutually consistent.

## Deliberate Zeros (not gaps)

- **14-02** produced zero edits to skill, doc or source files. Its deliverable is a per-site
  verdict record; research Pitfall 3 warned explicitly against budgeting new prose on this
  branch.
- **14-04** is a recorded zero: both tasks are gated by their own `<precondition>` elements to
  non-`retain` branches. Confirmed no `vice-errors.ts` was created, `resolvedBackend()` is
  untouched, and `git diff` is clean across `.claude/mcp/vice`.

## Notes

One commit in this phase came from the orchestrator rather than a plan: `db96a18`, fixing
`audit-integrity.test.ts`'s pinned `docs-*.test.ts` guard set after 14-01 added a fifth guard.
It belongs to no plan's SUMMARY by design, and was surfaced into code-review scope by the
SUMMARY-versus-diff cross-check.

Two stale statements were found and fixed during the review/verification gates (`69465e4`): a
skip-reason sentence in `fork-live.test.ts` describing behaviour `??` does not have, and the
FORK-01 Outcome cell still claiming the criterion-3 evidence was unproduced.

The repository's documented full-suite-concurrency flakiness was not scored as regression; each
named case was confirmed green when run focused, at both this phase's base commit and at HEAD.
Authoritative runs: typecheck exit 0; `resources-sync.test.ts` 2/2; full gate 2093/2099 with the
single failure being the already-filed shared-`/tmp` race; focused regression gate over all six
prior-phase test files, 266/266.

## Gaps

None.
