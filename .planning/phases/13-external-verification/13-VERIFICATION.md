---
phase: 13-external-verification
verified: 2026-08-22T02:10:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "The automated test gate (`npm run test:automated`) is green at the end of the phase, and the milestone's `docs-*.test.ts` guard set stays green."
    - "EXTV-03: 'any detail the binary contradicts is corrected at its source rather than noted' — literal wording vs. the D-13-04 escape-hatch outcome."
  gaps_remaining: []
  regressions: []
human_verification: []
---

# Phase 13: External Verification Verification Report

**Phase Goal:** Replace *asserted* protocol/discriminator/assumption evidence with real-hardware
evidence for `VERIF-02`'s three binmon fixtures (EXTV-01), the `--help` backend discriminator
(EXTV-02), and Phase 3's four wire assumptions A1/A2/A3/A5 (EXTV-03) — honestly, with no
partially-stripped labels, no silently-absorbed findings, and no requirement closed on a document
edit alone.
**Verified:** 2026-08-22T02:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (commits `f73d0fa`, `b346e34`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EXTV-01: three `VERIF-02` binmon fixtures are real captures, no sidecar still declares synthetic | ✓ VERIFIED | Re-confirmed: all three sidecars still read `synthetic: false`, `capturedFrom: "fork:/usr/local/bin/x64sc"`. Untouched by the two gap-closure commits. |
| 2 | No document/module header/test still describes the three fixtures as synthetic | ✓ VERIFIED | Unaffected by gap-closure commits; not re-scanned in depth this pass (previously verified, no code path in the diff touches these files). |
| 3 | EXTV-02: `--help` discriminator confirmed against both real stock and real fork `x64sc`, transcripts committed | ✓ VERIFIED | Unaffected by gap-closure commits; fixtures untouched in `git show f73d0fa`/`b346e34` diffs. |
| 4 | Fallback-ladder (`-help`/`-?`) honesty | ✓ VERIFIED | Unchanged; no relevant diff. |
| 5 | EXTV-03: four wire assumptions (A1/A2/A3/A5) probed against a real binary, one verdict each | ✓ VERIFIED | `13-PROBE-RESULTS.md` unchanged by the two commits; verdicts stand (A1 CONFIRMED, A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED). |
| 6 | EXTV-03: any CONTRADICTED detail is corrected at its source, or the deviation is explicitly and honestly reconciled with REQUIREMENTS.md's text | ✓ VERIFIED (closure note added) | `REQUIREMENTS.md:32-46` now carries a "Closure note (Phase 13, D-13-04 escape hatch)" directly under EXTV-03's checkbox. It states plainly that "corrected at its source" is satisfied by a scoped contract todo when the contradiction is a tool-contract defect rather than a wire-encoding bug; names the exact todo (`2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`, confirmed present in `todos/pending/`); states A5's `[ASSUMED]` label "deliberately stays on" until that todo closes (does not overstate closure); and gives per-assumption status for A1/A2/A3/A4 in the same note. This makes the carve-out visible at the point of reading, names the residual work, and does not claim more than was verified — resolving the previous pass's literal-wording tension rather than merely restating it. |
| 7 | Label discipline: A1/A2 labels removed everywhere; A3/A5 kept everywhere; never a partial strip | ✓ VERIFIED | Re-confirmed independently: `grep -rn '\[ASSUMED\]'` (excluding tests/resources) shows A1/A2 absent, A3 (`stock-input.ts:161,166`, `stock-protocol.ts:796`) and A5 (`stock-protocol.ts:852`) present. `assumption-label-discipline.test.ts` re-run: 7/7 pass. |
| 8 | A4's `03-RESEARCH.md` row is byte-for-byte untouched (D-13-05) | ✓ VERIFIED | Re-ran `git diff 1359ef7 -- .../03-RESEARCH.md`: A4's row absent from the diff; A1/A2/A3/A5 rows each carry only a "Post-probe status" addition, matching the prior pass exactly — the REQUIREMENTS.md edit in `b346e34` did not touch this file. |
| 9 | Deferred ledger (`STATE.md` ↔ `.planning/todos/pending/`) stays reconciled in both directions, including this phase's own `13-REVIEW.md` findings | ✓ VERIFIED | `docs-deferred-ledger.test.ts` re-run: 4/4 pass. `STATE.md:411` now carries a row for the new `2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned` todo, closing the timing gap the prior pass flagged (ledger now postdates `13-REVIEW.md`). |
| 10 | `npm run test:automated` is green at phase close | ✓ VERIFIED | Re-run independently in this session (not trusting the orchestrator's report): `2091 tests / 2086 pass / 0 fail / 5 todo`. `docs-review-disposition.test.ts` (4/4) and `audit-integrity.test.ts` (43/43) both pass in isolation. `npx tsc --noEmit -p tsconfig.json` clean (exit 0). |

**Score:** 10/10 truths verified (rolled up to must-haves: 9/9 — truths 1–2, 3–4 collapse as before).

### Gap-Closure Verification Detail

**Gap 1 — undispositioned review findings.**
- `.planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md` names all four ids (WR-01, WR-02, IN-01, IN-02) explicitly, each with its own "Recommended disposition" (fix-at-source for WR-01, defer-with-intent for WR-02, fix-if-reprobed for IN-01, fix-in-workflow for IN-02) — this is a recorded decision per finding, not a bare observation. `resolves_phase: 15` correctly routes ongoing disposition ownership to GATE-02, following the established phase-08/09 precedent named in the todo's own text.
- `docs-review-disposition.test.ts` re-run independently: 4/4 pass (including both planted-violation/planted-false-negative non-vacuity subtests).
- `docs-deferred-ledger.test.ts` re-run independently: 4/4 pass in both directions — every pending todo stem (including the new one) has a `STATE.md` row, and no completed todo stem remains listed as pending.
- WR-01 was additionally fixed at source (see below), which is a stronger disposition than the todo alone requires.

**Gap 1 — WR-01 fix authenticity (verified independently, not from the diff alone).** `checkCommandAvailable()` in `probe-binmon.mjs` now reads:
```js
function checkCommandAvailable(cmd) {
  const r = spawnSync("sh", ["-c", 'command -v "$1"', "sh", cmd], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}
```
This is the correct positional-parameter pattern: `cmd` is passed as `argv[3]`, which `sh -c` binds to `$1` (argv[2], `"sh"`, fills the conventional `$0`) — the value is never spliced into script text, so it can never be parsed as shell syntax, regardless of content. Independently reproduced in an isolated Node process:
- `checkCommandAvailable("c1541")` → `true` (the real guarded call site still works — a broken fix that always returned `false` would silently turn A5's probe into a permanent INCONCLUSIVE; ruled out)
- `checkCommandAvailable("node")` → `true`
- `checkCommandAvailable("totally-bogus-cmd-xyz")` → `false`
- `checkCommandAvailable("node; touch /tmp/pwned_test_marker")` → `false`, and the marker file was never created — confirming the injection surface is genuinely closed, not relocated (e.g. not "fixed" by moving the same interpolation into a different shell invocation).

**Gap 2 — EXTV-03 wording.** The added closure note (`REQUIREMENTS.md:32-46`) is judged to genuinely resolve the tension, not merely restate it: it (a) sits directly under the checked-off EXTV-03 line, so a reader encounters the carve-out at the point of reading rather than having to cross-reference a verification report; (b) names the exact pending todo carrying the remaining work and confirms that file exists; (c) explicitly keeps A5's `[ASSUMED]` label "on" pending that todo's closure, rather than claiming the label was resolved; (d) gives honest per-assumption status for all four (A1/A2 corrected-at-source, A3 inconclusive/label-stays, A4 deliberately not probed/D-13-05, A5 contradicted/escape-hatch). This was recorded as a maintainer decision in the task brief; the question re-verified here is whether the record is honest and complete, and it is — no must-have text is overstated.

### Required Artifacts

All artifacts previously verified (see `13-CAPTURE-TRANSCRIPT.md`, `13-HELP-DISCRIMINATOR-EVIDENCE.md`, `13-PROBE-RESULTS.md`, sidecars, `assumption-label-discipline.test.ts`, completed/pending todo moves) are unaffected by the two gap-closure commits, whose diffs touch only `probe-binmon.mjs` (8 lines), `REQUIREMENTS.md`, `STATE.md`, and the new pending todo file. Re-confirmed:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `13-REVIEW.md` | Code review disposition | ✓ VERIFIED (now closed) | Findings named in `docs-review-disposition.test.ts`'s recognised source #3 (`.planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md`); WR-01 additionally fixed at source in `probe-binmon.mjs`. |
| `.planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md` | New disposition todo | ✓ VERIFIED | Exists, names all 4 ids with individual recommended dispositions, `resolves_phase: 15`, matching `STATE.md:411`. |
| `REQUIREMENTS.md` EXTV-03 closure note | Honest carve-out record | ✓ VERIFIED | Present, accurate, does not overstate closure (see Gap 2 detail above). |
| `probe-binmon.mjs` `checkCommandAvailable()` | Non-shell-interpolating command check | ✓ VERIFIED | Fixed at source; injection surface closed; legitimate `c1541` check still functions (independently reproduced). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.planning/todos/pending/` | `STATE.md`'s Deferred Items | `docs-deferred-ledger.test.ts` | ✓ WIRED | No longer stale — the new todo has a matching row; guard passes 4/4 in both directions. |
| `13-REVIEW.md` finding ids | a recognised disposition source | `docs-review-disposition.test.ts` | ✓ WIRED | All four ids now named by the new pending todo (source #3); guard passes 4/4. |
| `REQUIREMENTS.md` EXTV-03 | `.planning/todos/pending/2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md` | citation by path in closure note | ✓ WIRED | Todo file confirmed to exist at the cited path. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated gate (re-run independently) | `cd .claude/mcp/vice && npm run test:automated` | 2091 tests / 2086 pass / 0 fail / 5 todo | ✓ PASS |
| `docs-review-disposition.test.ts` (isolated) | `node --test docs-review-disposition.test.ts` | 4/4 pass | ✓ PASS |
| `docs-deferred-ledger.test.ts` (isolated) | `node --test docs-deferred-ledger.test.ts` | 4/4 pass | ✓ PASS |
| `assumption-label-discipline.test.ts` (isolated) | `node --test assumption-label-discipline.test.ts` | 7/7 pass | ✓ PASS |
| `audit-integrity.test.ts` (isolated) | `node --test audit-integrity.test.ts` | 43/43 pass | ✓ PASS |
| `npx tsc --noEmit` | `tsc --noEmit -p tsconfig.json` | clean, exit 0 | ✓ PASS |
| WR-01 fix behavioral proof (out-of-repo, isolated Node process) | `checkCommandAvailable("c1541")`, `("totally-bogus-cmd-xyz")`, `("node; touch /tmp/pwned_test_marker")` | `true`, `false`, `false` + no marker file created | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EXTV-01 | 13-01 | Real-capture the 3 binmon fixtures | ✓ SATISFIED | Unchanged from prior pass; re-confirmed. |
| EXTV-02 | 13-02, 13-05 | Confirm `--help` discriminator against both real builds | ✓ SATISFIED | Unchanged from prior pass; re-confirmed. |
| EXTV-03 | 13-03, 13-04, 13-05 | Probe 4 wire details, correct contradictions at source | ✓ SATISFIED | A1/A2 CONFIRMED and corrected at source; A3 INCONCLUSIVE, label retained per design; A5 CONTRADICTED, resolved via the now-explicit and honestly-recorded D-13-04 escape hatch (REQUIREMENTS.md closure note), with its residual work tracked in a named, existing pending todo. |

No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `probe-binmon.mjs` (pre-fix) | 1486-1489 | Shell-interpolated `sh -c` command construction (`13-REVIEW.md` WR-01) | Resolved | Fixed at source in `f73d0fa`; independently verified closed (see above). No longer an open finding. |
| `probe-binmon.mjs` | whole file, 2429 lines | Six-concern single file (`13-REVIEW.md` WR-02) | ℹ️ Info, dispositioned (defer-with-intent) | Recorded in the new pending todo with an explicit rationale for deferring; not a blocker. |

`13-REVIEW.md`'s IN-01 and IN-02 remain dispositioned via the same todo (fix-if-reprobed / fix-in-workflow respectively) — informational, no correctness impact, not blockers.

No `TODO`/`FIXME`/`XXX`/`TBD` debt markers found in any file touched by the two gap-closure commits.

### Human Verification Required

None. Both previously-flagged items were mechanically re-checked and closed: the automated gate is genuinely green (independently re-run, not trusted from narrative), and the EXTV-03 wording tension was a maintainer decision that is now honestly and completely recorded in REQUIREMENTS.md, matching the task brief's own description of what changed.

### Gaps Summary

No gaps remain. The prior pass's two flagged items are both closed:

1. **Automated gate.** `docs-review-disposition.test.ts` and `audit-integrity.test.ts` both go green because `13-REVIEW.md`'s four findings (WR-01, WR-02, IN-01, IN-02) are now named by a recorded-decision disposition source (a new pending todo, `resolves_phase: 15`, each finding given its own recommended disposition) — not merely re-observed by a verification report, which is the exact silence the guard exists to catch. WR-01 was additionally fixed at source, independently confirmed to close the injection surface without breaking the legitimate `c1541` check. Re-running the full gate in this session shows 0 fail (2091/2086/0/5), matching the claimed post-fix state.
2. **EXTV-03 wording.** The added closure note in REQUIREMENTS.md makes the D-13-04 carve-out visible at the point EXTV-03 is read, names the exact residual-work todo, and does not overstate what was verified (A5's label explicitly stays on). This is judged to genuinely resolve the tension rather than restate it, and is recorded as the maintainer's own decision rather than this verifier's judgment call on scope.

All previously-verified truths (1, 2, 3, 4, 5, 7, 8, 9) were re-confirmed unaffected by the two gap-closure commits, whose diffs are narrowly scoped to `probe-binmon.mjs`, `REQUIREMENTS.md`, `STATE.md`, and one new todo file.

---

*Verified: 2026-08-22T02:10:00Z*
*Verifier: Claude (gsd-verifier)*
