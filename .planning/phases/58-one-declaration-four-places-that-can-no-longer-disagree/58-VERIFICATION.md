---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
verified: 2026-09-17T22:50:00Z
status: passed
score: 5/5 roadmap success criteria verified
behavior_unverified: 0
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-01-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-02-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-03-PLAN.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-03-SUMMARY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-REVIEW.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-SECURITY.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-UAT.md"
  - ".planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-VALIDATION.md"
  - "README.md"
  - "docs/phase58-declaration-provenance.md"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/phase58-citation-ledger.test.ts"
  - "src/mcp/vice/prerequisites.json"
  - "src/mcp/vice/prerequisites.test.ts"
covered_digest: "v1:sha256:deba46f46576bd04113cc9f7d7b116949022a7ebe47dd48a961d57967a81746d"
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5 roadmap success criteria verified
  gaps_closed:
    - "SC5 — both wrong file:line citations (REQUIREMENTS.md:88→85/86, ci.yml:70-72→80-81) corrected by live re-derivation and independently re-confirmed against source; a mechanical citation-ledger guard (phase58-citation-ledger.test.ts, 10/10 passing) now enforces resolution, completeness, no-orphans and non-vacuity for all 25 citations inside npm run test:automated"
  gaps_remaining: []
  regressions: []
  rounds:
    - round: 1
      previous_status: gaps_found
      previous_score: 3/5 roadmap success criteria verified
      status: human_needed
      score: 4/5 roadmap success criteria verified
      note: >-
        Gap-closure plan 58-03 corrected both wrong citations and shipped the
        citation-ledger guard. One item (SC2's real-runner CI execution) was
        left routed to human verification because 58-03-PLAN.md explicitly
        forbade pushing to origin as part of that closure.
    - round: 2
      previous_status: human_needed
      previous_score: 4/5 roadmap success criteria verified
      status: passed
      score: 5/5 roadmap success criteria verified
      note: >-
        The phase 58 commits were pushed to origin/main (2026-09-17T20:21Z),
        CI run 35270271098 executed, and job decl-02-node18-proof completed
        green in 12s with the exact expected output line. Independently
        re-confirmed in this round via `gh run view --job ... --log`, not
        accepted from 58-UAT.md's narrative alone. This discharges the sole
        remaining behavior_unverified item; no other criterion regressed.
        This round's own covered_digest changed for a purely mechanical
        reason: verify:post's validate-phase step rewrote 58-VALIDATION.md
        after the prior report was written, so the file set and digest were
        recomputed against the current tree (58-UAT.md and 58-SECURITY.md,
        both newly created this round, are added to covered_files for the
        same reason). This round also flagged an advisory: REQUIREMENTS.md
        still marked DECL-02 unchecked/"Gaps Found" despite SC2 now being
        verified, and recommended a later phase.complete or ship pass correct
        it.
    - round: 3
      previous_status: passed
      previous_score: 5/5 roadmap success criteria verified
      status: passed
      score: 5/5 roadmap success criteria verified
      note: >-
        The prior round's advisory recommendation was acted on: commit
        027fdf3a ("docs(58): transition phase 58 complete, advance to phase
        59") edited exactly two lines of .planning/REQUIREMENTS.md — DECL-02's
        checkbox `[ ]`→`[x]` (line 28) and its traceability status "Gaps
        Found"→"Complete" (line 117) — plus a matching ROADMAP.md checkbox and
        trailing-clause correction, and STATE.md/state.json's phase transition
        to Phase 59. Independently re-diffed this round via `git show 027fdf3a`:
        the edit is exactly the two-line bookkeeping correction recommended,
        DECL-03 (Phase 60 scope) is confirmed still unticked and untouched, and
        no implementation, test, or declaration file changed. This closes the
        one advisory item that was still open; the CR-01/CR-02/WR-01/WR-02
        guard-robustness advisory is unchanged and carried forward. Only
        .planning/REQUIREMENTS.md among covered_files actually changed;
        covered_digest recomputed against the current tree.
advisory:
  - finding: "The citation-ledger audit function (phase58-citation-ledger.test.ts) has two code-review CRITICAL findings against its own robustness against future/adversarial ledger content: a symlink inside the repo root can defeat the path-containment check and let the audit read (and silently 'verify') a file outside the repository (CR-01); a citation resolving to a directory crashes the whole test run with an uncaught EISDIR instead of a graceful failure string (CR-02). Two WARNING findings also apply: an empty-string anchor trivially 'verifies' any cited range (WR-01), and an off-by-one in the end-of-file line count admits one phantom trailing line (WR-02)."
    category: other
    reason: >-
      Confirmed via 58-REVIEW.md (issues_found, 2 critical/2 warning/1 info) and independently
      re-checked in this round: no commit since 681b364f (the review commit) touches
      phase58-citation-ledger.test.ts or docs/phase58-declaration-provenance.md, so all four
      findings are unchanged and still unfixed. None of the four is triggered by content present
      in the committed ledger today — the review itself confirmed by direct inspection that "all
      25 body citations have exactly one matching, resolving ledger entry today, so the shipped
      document is currently self-consistent." Each requires a future ledger-JSON edit (a symlinked
      path, a directory citation, an empty anchor, or an EOF-adjacent line number) to trigger. None
      of the 58-03-PLAN.md must-haves required adversarial robustness against a symlinked or
      directory-valued citation path. This is real follow-on hardening work on the new guard, not
      a defect in today's provenance content, and does not bear on whether Phase 58's own success
      criteria are met.
    evidence_status: "confirmed by code review + independent re-read across three rounds; not fixed as of the last commit touching either file (681b364f)"
human_verification: []
---

# Phase 58: One Declaration, Four Places That Can No Longer Disagree — Verification Report

**Phase Goal:** Every prerequisite described once — what it unblocks and the remedy per platform
— in plain JSON a Node too old to run the server can still parse, and present in the published
package.
**Verified:** 2026-09-17
**Status:** passed
**Re-verification:** Yes — third round. Round 1 followed gap-closure plan 58-03. Round 2 closed
the sole remaining behavior-unverified item (real-runner CI execution) after human UAT. This round
re-confirms substance is unchanged after a REQUIREMENTS.md bookkeeping correction this verifier
itself recommended in round 2.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the authoritative contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — One committed declaration names every prerequisite in the closed set (x64sc, c1541, petcat, ACME binary, ACME lib, Ghidra, dxa, Node), each with id/unblocks/remedies-per-platform (DECL-01) | ✓ VERIFIED | `src/mcp/vice/prerequisites.json` contains exactly these eight keys; `prerequisites.test.ts` re-run live this round (30/30 pass, combined with the ledger suite) asserts id-equals-key, closed unblocks vocabularies, platform-key closure, and remedy field completeness. Unchanged since round 2; regression-checked only. |
| 2 | SC2 — Plain JSON, no new runtime dependency, proven to parse under the oldest Node the doctor must start on via a dedicated CI job (DECL-02) | ✓ VERIFIED | Unchanged since round 2: `gh run view 35270271098 --job 105367530978` still shows job `decl-02-node18-proof` succeeded in 12s on `ubuntu-latest`, with `node: v18.20.8` acquired and the exact expected output line `prerequisites.json parsed on Node 18 -- 8 tool record(s)`. `.planning/REQUIREMENTS.md` now correctly reflects this (`DECL-02` `[x]` / "Complete" as of commit `027fdf3a`) — the bookkeeping this verifier flagged as advisory in round 2 has been corrected, not merely re-claimed. |
| 3 | SC3 — Node is the only record carrying a version floor, non-vacuously tested (DECL-04) | ✓ VERIFIED | Re-run live: `tools.node.versionFloor` (`>=24.0.0`) is the only `versionFloor` key across all 8 records; `prerequisites.test.ts` passes, including the planted-violation case. Unchanged since round 2. |
| 4 | SC4 — Declaration ships in the published tarball, proven via the tarball's own file list (DECL-05) | ✓ VERIFIED | `prerequisites.json` still present in `package.json`'s `files[]` (line 68, re-read live); packaging subtest re-run live, passes, reads the packed tarball list rather than `existsSync`. Unchanged since round 2. |
| 5 | SC5 — No remedy text is invented at authoring time; every disagreement between two sources is recorded with which one was chosen and why, and every citation names an artifact that actually says what is claimed | ✓ VERIFIED | Both previously-wrong citations remain corrected (re-read live this round); `phase58-citation-ledger.test.ts` re-run live (10/10 pass), enforcing resolution/completeness/no-orphans/non-vacuity over all 25 body citations, and runs inside `npm run test:automated` (still absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`). No commit since the review (`681b364f`) touched either the ledger doc or the guard. |

**Score:** 5/5 roadmap success criteria verified (0 present-but-behavior-unverified)

### What changed this round

Exactly one covered file changed since round 2, and it is precisely the correction this verifier
recommended:

- `git show 027fdf3a -- .planning/REQUIREMENTS.md` shows only two lines touched: line 28's
  `- [ ] **DECL-02**:` → `- [x] **DECL-02**:`, and line 117's traceability row
  `| DECL-02 | Phase 58 | Gaps Found |` → `| DECL-02 | Phase 58 | Complete |`.
- `DECL-03` (`- [ ] **DECL-03**: ...`, line 29) was independently confirmed **still unticked** —
  correctly so, since DECL-03 is Phase 60 scope (`ROADMAP.md` names Phase 60 as the seam-wiring
  phase for that requirement), not Phase 58's. The edit did not sweep in an unrelated requirement.
- This is not a requirement being marked complete without evidence: DECL-02's underlying evidence
  (the real GitHub Actions run) was independently re-verified by this verifier in round 2 *before*
  the bookkeeping edit existed, and is re-confirmed unchanged in this round (see SC2 row above).
  The edit brings the written record into agreement with evidence already gathered, not the other
  way around.
- The same commit also updated `.planning/ROADMAP.md` (Phase 58 checkbox ticked, trailing clause
  corrected from "ready for re-verification" to a completed-with-results statement) and
  `.planning/STATE.md` / `.planning/state.json` (phase transition to Phase 59, carrying the four
  CR-01/CR-02/WR-01/WR-02 advisory findings forward verbatim). Only `.planning/REQUIREMENTS.md` is
  in this report's `covered_files`, so it is the only one that moved `covered_digest`; the
  ROADMAP/STATE changes were reviewed for consistency but are outside this phase's tracked file
  set (they are cross-phase planning-transition bookkeeping, not phase 58 deliverables).
- No implementation file, test file, or the declaration itself (`prerequisites.json`,
  `prerequisites.test.ts`, `phase58-citation-ledger.test.ts`, `docs/phase58-declaration-provenance.md`,
  `package.json`, `.github/workflows/ci.yml`) changed. Both test suites re-run green (30/30).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DECL-01 | 58-01, 58-02, 58-03 | One declaration names every prerequisite, with unblocks + remedies + provenance reasoning | ✓ SATISFIED | JSON structure and full test suite sound; the provenance doc's citation ledger is complete and mechanically guarded. `.planning/REQUIREMENTS.md` marks `DECL-01` `[x]` / "Complete" — matches. |
| DECL-02 | 58-01, 58-03 | Plain JSON, parses under the oldest Node floor, proven by CI | ✓ SATISFIED | Independently re-confirmed via `gh` against the real GitHub Actions run. `.planning/REQUIREMENTS.md` now correctly marks `DECL-02` `[x]` / "Complete" (corrected this round, commit `027fdf3a`) — the round-2 advisory (stale bookkeeping) is resolved. |
| DECL-04 | 58-01 | Node is the only version-floor record, non-vacuously guarded | ✓ SATISFIED | Re-confirmed live this round; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |
| DECL-05 | 58-01 | Declaration ships in the published tarball | ✓ SATISFIED | Re-confirmed live this round; `.planning/REQUIREMENTS.md` marks `[x]` / "Complete" — matches. |

No orphaned requirements: REQUIREMENTS.md's Phase 58 traceability row lists exactly these four IDs, matching all three plans' `requirements:` frontmatter. `DECL-03` remains correctly unticked and attributed to Phase 60 elsewhere in REQUIREMENTS.md/ROADMAP.md — not a Phase 58 orphan.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/prerequisites.json` | Eight-record declaration | ✓ VERIFIED | Unchanged this round; re-confirmed live |
| `src/mcp/vice/prerequisites.test.ts` | Structural gate | ✓ VERIFIED | Re-run live alongside the ledger suite, all pass |
| `src/mcp/vice/package.json` | `files[]` includes `prerequisites.json` | ✓ VERIFIED | Confirmed at line 68 |
| `.github/workflows/ci.yml` | `decl-02-node18-proof` job present, proven to execute green | ✓ VERIFIED | Job present at lines 277-296 (unchanged shape); executed and green on a real runner (run 35270271098, job 105367530978), re-confirmed this round |
| `docs/phase58-declaration-provenance.md` | Corrected citations + total citation ledger + Case six | ✓ VERIFIED | Unchanged since round 2; both prior wrong citations remain corrected; ledger section present (25 entries); Case six section present |
| `src/mcp/vice/phase58-citation-ledger.test.ts` | Structural guard over the provenance doc's citations | ✓ VERIFIED | Re-run live, all 10 pass, discovered by the automated gate. Unfixed known robustness gaps (CR-01/CR-02/WR-01/WR-02) carried forward as advisory. |
| `.planning/REQUIREMENTS.md` | `DECL-F3` recorded, Phase 58 traceability accurate | ✓ VERIFIED (corrected this round) | `DECL-F3` present and correct; DECL-02's checkbox and status column now read `[x]` / "Complete", matching this verifier's own round-2 evidence. The round-2 advisory is resolved, not just re-asserted. |
| `58-UAT.md` | Human verification of SC2 recorded | ✓ VERIFIED | Unchanged since round 2: `status: complete`, 1/1 passed |
| `58-VALIDATION.md` | Nyquist validation strategy | ✓ VERIFIED | Unchanged since round 2: `status: validated`, `nyquist_compliant: true` |
| `58-SECURITY.md` | Threat register verification | ✓ VERIFIED | Unchanged since round 2: `threats_open: 0`, 13/13 threats closed or accepted |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `decl-02-node18-proof` CI job | A real GitHub Actions runner execution | push to origin, `gh run view` | ✓ WIRED | Unchanged since round 2, re-confirmed this round |
| Provenance doc citations | The files/lines they claim to quote | `file:line` pointers, live-re-derived | ✓ WIRED | All 25 citations resolve; unchanged since round 2 |
| `phase58-citation-ledger.test.ts` | `test-gate.mjs`'s `automatedTestFiles()` | Directory-scan discovery, no list edit | ✓ WIRED | Confirmed via source read; file absent from `MANUAL_ONLY_TESTS` |
| `.planning/REQUIREMENTS.md` `DECL-F3` | `docs/phase58-declaration-provenance.md` "Case six" | Two halves of one deferral record | ✓ WIRED | Both sides present and cross-consistent |
| `.planning/REQUIREMENTS.md` `DECL-02` status | Real CI-runner evidence gathered in round 2 | Bookkeeping correction, commit `027fdf3a` | ✓ WIRED | New this round — the written record now agrees with the evidence |
| `tools.node.versionFloor` | `package.json`'s `engines.node` | Byte-equality test | ✓ WIRED | Re-confirmed live, unchanged |
| `package.json` `files[]` | Packed tarball's own file list | `npm pack --dry-run --json` | ✓ WIRED | Re-confirmed live, unchanged |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Citation-ledger + prerequisites suites pass together | `node --test --test-reporter=tap prerequisites.test.ts phase58-citation-ledger.test.ts` | `# pass 30`, `# fail 0` | ✓ PASS |
| REQUIREMENTS.md edit scope confirmed minimal | `git show 027fdf3a -- .planning/REQUIREMENTS.md` | exactly 2 lines changed (DECL-02 checkbox + status cell) | ✓ PASS |
| DECL-03 correctly left open | `sed -n '29p' .planning/REQUIREMENTS.md` | `- [ ] **DECL-03**: ...` unticked | ✓ PASS |
| Real-runner CI execution of `decl-02-node18-proof` (regression) | `gh run view 35270271098 --job 105367530978` | job `success`, 12s, expected output line present | ✓ PASS |
| package.json / README unchanged (regression) | `grep -n prerequisites.json src/mcp/vice/package.json` | line 68 present | ✓ PASS |

### Anti-Patterns Found

None. No new file entered `covered_files` this round beyond the already-scanned set; the one
changed file (`.planning/REQUIREMENTS.md`) received a two-line checkbox/status edit with no debt
markers introduced.

### Code Review Findings (58-REVIEW.md) — Assessed for Goal Relevance

Unchanged since round 2. `58-REVIEW.md`'s five findings (2 critical, 2 warning, 1 info) target
only the citation-ledger guard's handling of hypothetical *future* adversarial ledger content —
none is triggered by anything in the committed ledger today, confirmed again this round by the
absence of any commit touching either file since the review. Carried forward as advisory, not a
gap.

### Human Verification Required

None.

### Gaps Summary

No gaps remain, and the one advisory item that was still actionable — a stale `DECL-02`
checkbox/status cell in `.planning/REQUIREMENTS.md` — has been corrected exactly as recommended:
independently re-diffed this round (`git show 027fdf3a`), the edit touches only DECL-02's two
cells, leaves `DECL-03` (Phase 60 scope) untouched, and rests on evidence this verifier already
gathered independently in round 2 rather than being an unevidenced claim of completion. The one
remaining advisory item — four unfixed code-review findings against the citation-ledger guard's
handling of hypothetical future adversarial content — is real follow-on hardening work, not a
defect in today's shipped content, and is carried forward unchanged. The phase goal remains fully
achieved: every prerequisite is described once, in plain JSON a Node 18 interpreter can parse
(proven on a real runner), the declaration ships in the published tarball, and the project's own
requirements bookkeeping now honestly reflects all of this.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
