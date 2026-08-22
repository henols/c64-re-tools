---
phase: 15-debt-and-review-disposition
verified: 2026-08-22T22:15:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "DEBT-01: `c64-ram-capture` keyboard-typed-LOAD-fallback promotion now filed under REQUIREMENTS.md's `### Promoted by DEBT-01` section (fifth bullet, commit `7c6d55d`), naming an owner in the same shape three of the four pre-existing entries in that section already use ('whichever future plan or milestone next touches ...'). The prior verification's own reading of the todo's `Owner:` clause as naming nobody is retracted on direct comparison — it is precedented phrasing, not a defect; the actual gap was the missing REQUIREMENTS.md landing spot, which is now closed."
  gaps_remaining: []
  regressions: []
---

# Phase 15: Debt and Review Disposition Verification Report

**Phase Goal:** Every open code-review finding across all phases is dispositioned, and
every pending todo not already claimed by Phase 13/14/17 becomes fixed, dispositioned
`wont-fix` with recorded rationale, or explicitly promoted — nothing carried silently
into v0.5.0. Phase 03's three pending UAT scenarios are finally executed and recorded.

**Verified:** 2026-08-22T22:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (commit `7c6d55d`, following prior `gaps_found` at 3/4)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GATE-02 — every open code-review finding across all phases carries a cited disposition, and `docs-review-disposition.test.ts` runs green from a clean checkout | ✓ VERIFIED (regression) | Re-ran directly: `docs-review-disposition.test.ts` 7/7 pass. `15-REVIEW.md`'s own CR-01/WR-01/WR-02 fix re-confirmed live: `vice-proxy.test.ts` 119/119 pass (0 fail), `capability-registry.test.ts` 13/13 pass, `tool-support-table.test.mjs` 7/7 pass, README.md's "nine manual-only files" matches `test-gate.mjs`'s `MANUAL_ONLY_TESTS` array (9 entries, confirmed by direct read). No change since the prior pass; regression holds. |
| 2 | DEBT-01 — every item that was in `.planning/todos/pending/` during this phase is fixed with a commit reference, moved to `completed/` with a `wont-fix` rationale, or promoted into `REQUIREMENTS.md` → Future Requirements with a named owner; none carried silently into v0.5.0 | ✓ VERIFIED (gap closed) | `.planning/todos/pending/` still holds exactly 2 files, both `resolves_phase: 16`, matching real committed Phase 16 requirements `PKG-01`/`PKG-03` (`ROADMAP.md:405`, `REQUIREMENTS.md:208,210`). The one item that previously left `pending/` for `completed/` without a REQUIREMENTS.md landing spot — `2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll.md` — is now filed as REQUIREMENTS.md's fifth `### Promoted by DEBT-01` bullet (`REQUIREMENTS.md:285-299`, added by commit `7c6d55d`, confirmed present by direct read and by full-file grep for "keyboard-typed-fallback"). Its `Owner:` clause ("whichever future plan or milestone next touches `c64-ram-capture`'s keyboard-typed-fallback load path... no v0.4.0 phase (12-17) touches this file or this fallback route") is the same shape as 3 of the 4 pre-existing entries in that section (`vice_disk_attach` contract question, `InitialWarpMode` measurement, `cpuhistory-get` fixture derivation all use "Owner: whichever future ..."; only the GSD-toolkit entry names an external party instead) — confirmed by direct `grep -n "Owner:"` across the section. The prior verification's characterization of this clause as "naming nobody" is retracted here: it is precedented phrasing this same section already used three times, not a singular deviation. `docs-deferred-ledger.test.ts` (4/4 pass) still structurally only reconciles `pending/`, confirming the described blind spot is real — but the fix landed in the correct guarded location (REQUIREMENTS.md's Future Requirements section), which is what the roadmap's own Success Criterion 2 names as the required mechanism, not the ledger test. |
| 3 | DEBT-02 — the five undocumented behaviours are each documented at the location a user would look | ✓ VERIFIED (regression) | No files touched by the two gap-closure commits; re-confirmed unchanged at cited locations (`c64-ram-capture/SKILL.md`, `stock-dispatch.ts`, `GAINS-PROTOCOL.md`, `docs/stock-vice-parity.md`, `capability-registry.ts`). |
| 4 | DEBT-03 — Phase 03's three pending UAT scenarios are executed against real fixtures and a running program, and each is recorded `pass`/`fail` with evidence, none left `pending` (ROADMAP Success Criterion 4) | ✓ VERIFIED (judgment resolved) | `03-HUMAN-UAT.md`: zero `result: [pending]` rows (confirmed by direct read of all three `result:` lines). Scenario 1 `pass`, scenario 3 `pass`, scenario 2 `partial` (keyboard half pass; joystick half a definite zero-delta negative). The prior pass flagged unresolved tension between ROADMAP's literal "recorded pass or fail... none left pending" and REQUIREMENTS.md's own added clause "rather than left partial", given scenario 2's field literally reads `partial`. Commit `7c6d55d`'s rewritten closure note confronts this directly rather than quoting around it, arguing "left partial" denotes an abandoned/unfinished run, not two complete, independently evidenced sub-verdicts under different verdicts. **My own judgment, not deferred to the note:** I find this reading substantively sound. Both sub-results are definite and evidenced — keyboard: byte-level before/after read; joystick: five single-bit rounds plus fire, zero delta at both CIA1 ports, reproducing Phase 13's A3 under a strictly stronger (proven-running) precondition. Forcing scenario 2 to a bare `pass` would misrepresent the joystick half; forcing it to `fail` would misrepresent the keyboard half. `partial` is the honest label for a scenario that decomposed into two independently complete verdicts, not for an incomplete run. ROADMAP's own literal, authoritative Success Criterion 4 — the roadmap contract, per verification precedence rules — turns on "none left pending" as its operative exclusion, and that is unambiguously satisfied. I accept DEBT-03 as satisfied on this evidence; a reasonable reader could still prefer the stricter reading, but that preference does not change any underlying fact and the work itself is genuine, live, and honestly recorded. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/REQUIREMENTS.md` → `### Promoted by DEBT-01` | 5 promotions, each with a named owner | ✓ VERIFIED | Fifth bullet (keyboard-fallback-load) added by `7c6d55d`; all five confirmed present with `Owner:` clauses |
| `.planning/todos/pending/*` (2 files) | Fixed/wont-fix/promoted disposition | ✓ VERIFIED | Both carry `resolves_phase: 16` matching real `PKG-01`/`PKG-03` |
| `.planning/todos/completed/2026-08-19-keyboard-fallback-load-...md` | Promoted-with-real-owner disposition, tracked in the guarded system | ✓ VERIFIED | Todo body's `Owner:` clause + matching REQUIREMENTS.md bullet now both present |
| `03-HUMAN-UAT.md` | 0 pending rows, pass/fail/evidenced-partial with evidence | ✓ VERIFIED (judgment) | See truth 4 |
| `docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`, `docs-dangling-refs.test.ts`, `docs-linerefs.test.ts` | All four green from a clean checkout | ✓ VERIFIED | Re-ran directly: 4/4, 7/7, 8/8, 3/3 — 22/22 total |
| `.claude/mcp/vice/stock-registers.ts`, `README.md`, capability-registry/tool-support trio (CR-01/WR-01/WR-02 fixes) | Fixed per `15-REVIEW.md` | ✓ VERIFIED (regression) | `vice-proxy.test.ts` 119/119, `capability-registry.test.ts` 13/13, `tool-support-table.test.mjs` 7/7 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Phase 15 promotions | `REQUIREMENTS.md` → Future Requirements → `### Promoted by DEBT-01` | manual authorship, cross-checked by grep | ✓ WIRED | 5/5 promotions-out-of-`pending/` now landed correctly here (was 4/5) |
| `docs-deferred-ledger.test.ts` | `.planning/todos/pending/` + `STATE.md` | bidirectional file/row comparison | ✓ WIRED (scope confirmed) | Green at current 2-file state; confirmed by source read (`missingPendingStems`, `PENDING_DIR` only) that it structurally cannot see `completed/` items — this is why the REQUIREMENTS.md landing spot, not this guard, is DEBT-01's real enforcement mechanism |
| `docs-review-disposition.test.ts` | all `*-REVIEW.md` files | repo-wide glob + heading parser | ✓ WIRED | 7/7 pass, unchanged since prior pass |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All four planning-doc guards, re-run directly at HEAD | `node --test docs-deferred-ledger.test.ts docs-review-disposition.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts` | 4/4 + 7/7 + 8/8 + 3/3 = 22/22 pass, 0 fail | ✓ PASS |
| The one review-blocking regression, re-run directly | `node --test vice-proxy.test.ts` | 119/123 executed (4 skipped), 119/119 of the executed subset pass, 0 fail | ✓ PASS |
| WR-02's witnesses, re-run directly | `node --test capability-registry.test.ts tool-support-table.test.mjs` | 13/13 + 7/7 pass | ✓ PASS |
| README.md's "nine manual-only files" claim | direct read of `README.md:69` + `test-gate.mjs`'s `MANUAL_ONLY_TESTS` array | array has exactly 9 entries | ✓ PASS |
| REQUIREMENTS.md free of unresolved debt markers | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" .planning/REQUIREMENTS.md` | no hits | ✓ PASS |

### Probe Execution

N/A — unchanged from the prior verification pass. This phase has no `scripts/*/tests/probe-*.sh`-convention probes; its live-emulator work (DEBT-03) is captured as opt-in `node --test` suites with narrative evidence documents (`15-UAT-EVIDENCE.md`, `15-A4-PROBE-EVIDENCE.md`), cross-checked against `03-HUMAN-UAT.md`'s `result:` fields directly in this pass.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GATE-02 | 15-01..15-05, 15-12 | Every open review finding dispositioned | ✓ SATISFIED | Guard green, commits re-verified |
| DEBT-01 | 15-06, 15-07, 15-09, 15-10, 15-11, 15-12 | Every pending todo fixed/wont-fix/promoted-with-owner | ✓ SATISFIED | Fifth promotion now landed in REQUIREMENTS.md; gap closed |
| DEBT-02 | 15-06, 15-09 | Five undocumented behaviours documented at point of use | ✓ SATISFIED | Unchanged, re-confirmed |
| DEBT-03 | 15-08, 15-10 | Phase 03 UAT scenarios executed and recorded | ✓ SATISFIED | Judgment call resolved in this pass — see truth 4 |

No orphaned requirements: all four IDs declared across the 12 plans' `requirements:` frontmatter match REQUIREMENTS.md's Phase 15 entries exactly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | ~177-198 (DEBT-03 bullet) | Two full `**Closure note (Phase 15).**` paragraphs appear back-to-back inside the same bullet — the diff in commit `7c6d55d` appended a new closure paragraph after the old sentence it was replacing ("...because scenario 2's joystick half is a genuine, honestly-recorded negative result —") rather than fully removing that dangling half-sentence and its now-superseded header. Content is not contradictory (both paragraphs assert the same facts), so this is a redundant/duplicated-editing artifact, not a factual defect. | ⚠️ WARNING (documentation quality, non-blocking) | Confusing to a future reader; does not change any verified fact or the phase's disposition record. Cheap to clean up: delete the dangling half-sentence and the now-redundant first "All three scenarios executed live..." paragraph, keeping only the newer, more complete one. |
| `.planning/PROJECT.md` | 543 | The pre-existing "Known open, tracked, non-blocking" line for the `vice_keyboard_type` `LOAD` fallback route was not updated to reflect Phase 15's "promoted with a named owner" disposition — it still reads as an open item with no pointer to the closure or the new REQUIREMENTS.md bullet. This was flagged as a "missing" item in the prior verification pass and was not addressed by commit `7c6d55d` (which touched only `REQUIREMENTS.md`). | ⚠️ WARNING (documentation quality, non-blocking) | The item's disposition IS now tracked in the guarded system (REQUIREMENTS.md's Future Requirements section, which is DEBT-01's literal required landing spot per ROADMAP Success Criterion 2) — PROJECT.md's stale line is a second, unreconciled mention in a different document, not the sole record. Does not block DEBT-01, which is satisfied by the REQUIREMENTS.md entry, but the two documents now silently disagree about this item's status and should be reconciled at the next PROJECT.md touch. |

Scanned all files touched by the two gap-closure commits (`7c6d55d`: `.planning/REQUIREMENTS.md`; `c340a61`: `stock-registers.ts`, `README.md`, `capability-registry.test.ts`, `generate-tool-support-table.mjs`, `tool-support-table.test.mjs`) for debt/placeholder markers — no `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` hits and no empty-implementation patterns.

### Human Verification Required

None. The one outstanding interpretive question from the prior pass (DEBT-03's `partial` vs. `pass`/`fail` wording tension) has been directly confronted by the phase's own closure note and independently judged here (see truth 4) rather than escalated again. If a human reviewer disagrees with that judgment on the merits, the concrete fact pattern to re-examine is: `03-HUMAN-UAT.md` scenario 2's `result:` field literally reads `partial`, and REQUIREMENTS.md's DEBT-03 criterion literally contains the phrase "rather than left partial" — the disagreement, if any, would be about what "left partial" was meant to exclude, not about any unverified fact.

### Gaps Summary

None remaining. The single blocking gap from the prior verification pass (DEBT-01: the keyboard-fallback-load promotion had no REQUIREMENTS.md landing spot) is closed by commit `7c6d55d`, which added a fifth bullet to `### Promoted by DEBT-01` in the same shape as three of its four siblings. The prior pass's secondary characterization of the todo's own `Owner:` clause as "naming nobody" is retracted on direct re-comparison against the section's existing entries — it was precedented phrasing, and the actual, now-fixed defect was the missing REQUIREMENTS.md bullet. DEBT-03's wording tension (ROADMAP's literal "pass or fail" vs. the recorded `partial` scenario) has been directly confronted by the rewritten closure note and is resolved here on judgment rather than re-escalated, since the underlying UAT work is genuine, live, and honestly recorded regardless of which reading of "left partial" is preferred. Two non-blocking documentation-quality items are noted above (a duplicated closure-note paragraph in REQUIREMENTS.md; an unreconciled stale line in PROJECT.md) — neither affects any of the four requirement dispositions.

All four requirements (GATE-02, DEBT-01, DEBT-02, DEBT-03) are verified against the current tree, not against SUMMARY.md or closure-note prose alone: guard test suites were re-run directly (22/22 across the four planning-doc guards), the fifth REQUIREMENTS.md promotion bullet was read directly, the two remaining pending todos were cross-checked against Phase 16's committed requirements, and the code-review fix commit's tests were re-run live (119/119, 13/13, 7/7).

---

_Verified: 2026-08-22T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
